import { createHmac } from 'node:crypto'

import type { Prisma, PrismaClient } from '@relaytour/database'

import { membreActif } from './appartenances.ts'
import { adminsAPrevenir } from './demandes.ts'
import { aujourdhui } from './droits.ts'
import { publierNotification } from './flux.ts'
import { journal } from './journal.ts'
import { niveauxDes } from './notifications.ts'

// Dépôt public d'une candidature (ADR 0041).
//
// La page publique désigne chaque séquence par une référence calculée : aucun
// identifiant de la base n'en sort. La référence dépend de l'empreinte de
// l'appel : une nouvelle adresse change aussi les références.

/** Une référence publique : 16 caractères base64url. */
export const REFERENCE = /^[A-Za-z0-9_-]{16}$/

/** La référence publique d'une séquence dans un appel. */
export function referencePublique(
  empreinteAppel: string,
  sequenceId: string
): string {
  return createHmac('sha256', empreinteAppel)
    .update(sequenceId)
    .digest('base64url')
    .slice(0, 16)
}

/**
 * L'état public du besoin d'une séquence : le nombre de places encore
 * recherchées, et vrai quand les renforts atteignent le besoin. Une place à
 * confirmer compte dans les renforts.
 */
export function jaugePublique(
  besoin: number,
  renforts: number
): { placesRecherchees: number; complete: boolean } {
  return {
    placesRecherchees: Math.max(0, besoin - renforts),
    complete: renforts >= besoin,
  }
}

/**
 * Prévient l'équipe qu'une candidature attend sa revue : les admins de l'activité
 * (sinon ceux de l'organisation), et les personnes qui écrivent dans le périmètre
 * d'une séquence choisie ou de l'appel. Chaque personne reçoit au plus une
 * notification par activité et par jour, sans nom, dans l'application seulement.
 * Ne lève jamais : une notification manquée ne fait pas échouer le dépôt.
 */
export async function signalerCandidature(
  prisma: PrismaClient,
  candidature: {
    organisationId: string
    activiteId: string
    editionId: string
    perimetreIds: string[]
  },
  maintenant = new Date()
): Promise<void> {
  const { organisationId, activiteId, editionId, perimetreIds } = candidature
  try {
    const admins = await adminsAPrevenir(prisma, organisationId, activiteId)
    const referents =
      perimetreIds.length === 0
        ? []
        : (
            await prisma.affectation.findMany({
              where: {
                editionId,
                perimetreId: { in: perimetreIds },
                user: membreActif(organisationId),
              },
              select: { userId: true },
            })
          ).map(a => a.userId)
    const niveaux = await niveauxDes(prisma, admins, activiteId)
    const { fuseauHoraire } = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { fuseauHoraire: true },
    })
    const jour = aujourdhui(maintenant, fuseauHoraire)
    for (const userId of new Set([...admins, ...referents])) {
      try {
        await prisma.notification.create({
          data: {
            organisationId,
            userId,
            type: 'CANDIDATURE_RECUE',
            niveau: niveaux.get(userId) ?? 'REFERENT',
            activiteId,
            editionId,
            cle: `CANDIDATURE_RECUE-${activiteId}-${userId}-${jour}`,
          },
          select: { id: true },
        })
        publierNotification(organisationId, userId)
      } catch (erreur) {
        // P2002 : la personne est déjà prévenue aujourd'hui pour cette activité.
        if ((erreur as { code?: string }).code !== 'P2002') throw erreur
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type: 'CANDIDATURE_RECUE',
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}

/**
 * La séquence au moment du dépôt, lue sous son verrou par une lecture courante :
 * une vue transactionnelle plus ancienne ne cache ni un placement, ni un besoin
 * retiré, ni un horaire avancé. L'appelant tient le verrou de la séquence.
 */
export async function sequenceAuDepot(
  tx: Prisma.TransactionClient,
  sequenceId: string
): Promise<{
  editionId: string
  perimetreId: string | null
  debut: Date
  besoin: number
  renforts: number
} | null> {
  const lignes = await tx.$queryRaw<
    {
      editionId: string
      perimetreId: string | null
      debut: Date
      besoinBenevoles: number | null
    }[]
  >`SELECT editionId, perimetreId, debut, besoinBenevoles FROM Sequence WHERE id = ${sequenceId} FOR UPDATE`
  const sequence = lignes[0]
  if (sequence === undefined) return null
  const compte = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM PlaceSequence
    WHERE sequenceId = ${sequenceId} AND role = 'RENFORT'
    LOCK IN SHARE MODE`
  return {
    editionId: sequence.editionId,
    perimetreId: sequence.perimetreId,
    debut: sequence.debut,
    besoin: sequence.besoinBenevoles ?? 0,
    renforts: Number(compte[0]?.n ?? 0),
  }
}

/**
 * Le statut d'un choix nouveau : en attente tant que les renforts de la séquence
 * restent sous son besoin, en liste d'attente sinon.
 */
export function statutAuDepot(s: {
  besoin: number
  renforts: number
}): 'EN_ATTENTE' | 'LISTE_ATTENTE' {
  return s.renforts < s.besoin ? 'EN_ATTENTE' : 'LISTE_ATTENTE'
}
