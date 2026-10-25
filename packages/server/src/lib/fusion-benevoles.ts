import { prisma } from '@relaytour/database'

import { fusionnerPlages, PLAGES_MAX, PRECISIONS_MAX } from './appels.ts'
import { NOTE_BENEVOLE_MAX } from './benevoles.ts'
import { erreurSaisie } from './erreurs.ts'
import { journal } from './journal.ts'
import { sousVerrouOrganisation } from './limites.ts'
import { i18n } from './langue.ts'

// Fusion de deux fiches bénévoles (ADR 0042). La fiche gardée reçoit les places,
// les plages, les candidatures et les notifications de l'autre fiche, qui
// disparaît. Le nom, l'adresse et le téléphone gardés se choisissent un par un.
//
// Le lien personnel, la confirmation et l'option « Prévenir par mail » suivent
// l'adresse gardée : la personne qui lit cette adresse garde le lien qu'elle a
// reçu, et reste joignable comme avant.

export type Cote = 'GARDEE' | 'AUTRE'

export interface ChoixFusion {
  nom: Cote
  courriel: Cote
  telephone: Cote
}

const ROLE_RANG = { RESPONSABLE: 0, RENFORT: 1 } as const

/** Deux textes facultatifs mis bout à bout, coupés à la longueur permise. */
function bout(a: string | null, b: string | null, max: number): string | null {
  const texte = [a, b].filter(t => t !== null && t.trim() !== '').join('\n\n')
  return texte === '' ? null : texte.slice(0, max)
}

/**
 * Fusionne `autreId` dans `gardeeId`, deux fiches de la même activité. L'appelant
 * a vérifié que la personne administre l'activité. Rend l'identifiant de la fiche
 * gardée.
 */
export async function fusionnerFiches(entree: {
  organisationId: string
  activiteId: string
  gardeeId: string
  autreId: string
  choix: ChoixFusion
  acteurId: string
}): Promise<string> {
  const { gardeeId, autreId } = entree
  if (gardeeId === autreId) {
    throw erreurSaisie(i18n._('Choisissez deux fiches différentes.'))
  }
  // Les séquences des deux fiches se lisent hors de la transaction : les verrous
  // passent avant toute lecture ordinaire (MariaDB 11.8).
  const sequenceIds = [
    ...new Set(
      (
        await prisma.placeSequence.findMany({
          where: { benevoleId: { in: [gardeeId, autreId] } },
          select: { sequenceId: true },
        })
      ).map(p => p.sequenceId)
    ),
  ].sort()
  await sousVerrouOrganisation(entree.organisationId, async tx => {
    for (const id of sequenceIds) {
      await tx.$queryRaw`SELECT id FROM Sequence WHERE id = ${id} FOR UPDATE`
    }
    const [gardee, autre] = await Promise.all(
      [gardeeId, autreId].map(id =>
        tx.benevole.findFirst({
          where: { id, activiteId: entree.activiteId },
          include: { places: true, plages: true },
        })
      )
    )
    if (!gardee || !autre) {
      throw erreurSaisie(i18n._('Une des deux fiches n’existe plus.'))
    }

    // Les places : une seule par séquence. « Responsable » l'emporte sur
    // « renfort », et une place confirmée sur une place à confirmer.
    const parSequence = new Map(gardee.places.map(p => [p.sequenceId, p]))
    for (const place of autre.places) {
      const tenue = parSequence.get(place.sequenceId)
      if (tenue === undefined) {
        await tx.placeSequence.update({
          where: { id: place.id },
          data: { benevoleId: gardee.id },
        })
        continue
      }
      await tx.placeSequence.update({
        where: { id: tenue.id },
        data: {
          role:
            ROLE_RANG[place.role] < ROLE_RANG[tenue.role]
              ? place.role
              : tenue.role,
          confirmeeLe: tenue.confirmeeLe ?? place.confirmeeLe,
        },
      })
      await tx.placeSequence.delete({ where: { id: place.id } })
    }
    for (const sequenceId of sequenceIds) {
      await tx.sequence.update({
        where: { id: sequenceId },
        data: { version: { increment: 1 } },
      })
    }

    // Les plages, réunies période par période.
    const editions = new Set(
      [...gardee.plages, ...autre.plages].map(p => p.editionId)
    )
    for (const editionId of editions) {
      const reunies = fusionnerPlages(
        [...gardee.plages, ...autre.plages].filter(
          p => p.editionId === editionId
        )
      ).slice(0, PLAGES_MAX)
      await tx.plageDisponibilite.deleteMany({
        where: { benevoleId: { in: [gardee.id, autre.id] }, editionId },
      })
      await tx.plageDisponibilite.createMany({
        data: reunies.map(p => ({
          editionId,
          benevoleId: gardee.id,
          debut: p.debut,
          fin: p.fin,
        })),
      })
    }

    await tx.candidature.updateMany({
      where: { benevoleId: autre.id },
      data: { benevoleId: gardee.id },
    })
    await tx.notification.updateMany({
      where: { benevoleId: autre.id },
      data: { benevoleId: gardee.id },
    })

    // Le lien et la confirmation suivent l'adresse gardée. Quand les deux fiches
    // ont la même adresse, la confirmation la plus récente l'emporte.
    const depuis = entree.choix.courriel === 'AUTRE' ? autre : gardee
    const memeAdresse =
      gardee.courriel !== null && gardee.courriel === autre.courriel
    const confirmations = [gardee.courrielConfirmeLe, autre.courrielConfirmeLe]
      .filter((d): d is Date => d !== null)
      .sort((x, y) => y.getTime() - x.getTime())
    const lien = {
      courrielConfirmeLe: memeAdresse
        ? (confirmations[0] ?? null)
        : depuis.courrielConfirmeLe,
      espaceSel: depuis.espaceSel,
      espaceEmpreinte: depuis.espaceEmpreinte,
      lienEnvoyeLe: depuis.lienEnvoyeLe,
      relanceLe: depuis.relanceLe,
    }
    // L'autre fiche disparaît d'abord : son empreinte est unique dans
    // l'organisation, et la fiche gardée peut la reprendre.
    await tx.benevole.delete({ where: { id: autre.id } })
    await tx.benevole.update({
      where: { id: gardee.id },
      data: {
        nom: entree.choix.nom === 'AUTRE' ? autre.nom : gardee.nom,
        courriel: depuis.courriel,
        // « Prévenir par mail » suit l'adresse : la fiche reste joignable comme
        // celle dont elle reprend l'adresse.
        prevenirParMail: depuis.prevenirParMail,
        telephone:
          entree.choix.telephone === 'AUTRE'
            ? autre.telephone
            : gardee.telephone,
        note: bout(gardee.note, autre.note, NOTE_BENEVOLE_MAX),
        precisionsDisponibilite: bout(
          gardee.precisionsDisponibilite,
          autre.precisionsDisponibilite,
          PRECISIONS_MAX
        ),
        accordLe:
          gardee.accordLe.getTime() <= autre.accordLe.getTime()
            ? gardee.accordLe
            : autre.accordLe,
        // Une fiche qu'un périmètre seul lisait s'ouvre si l'autre ne l'était pas.
        perimetreImportId:
          gardee.perimetreImportId === autre.perimetreImportId
            ? gardee.perimetreImportId
            : null,
        sourceImport: gardee.sourceImport ?? autre.sourceImport,
        creeParId: gardee.creeParId ?? autre.creeParId,
        ...lien,
      },
    })
  })
  journal.info(
    {
      evenement: 'benevoles-fusionnes',
      activiteId: entree.activiteId,
      gardeeId,
      autreId,
      acteurId: entree.acteurId,
    },
    'Deux fiches bénévoles ont été fusionnées.'
  )
  return gardeeId
}
