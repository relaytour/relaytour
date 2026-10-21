import type { Prisma, PrismaClient } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { membreActif } from './appartenances.ts'
import { DELAI_CONVOCATION_MS } from './convocations.ts'
import { adminsAPrevenir } from './demandes.ts'
import { publierNotification } from './flux.ts'
import { journal } from './journal.ts'
import { empreinte, jetonDe, nouveauSel } from './liens.ts'
import { niveauxDes } from './notifications.ts'

// Espace bénévole et mails aux bénévoles (ADR 0041).
//
// Seule une décision de l'équipe déclenche un mail, et seulement vers une fiche
// joignable : une adresse, et l'option « Prévenir par mail ». La première place
// d'une fiche joignable envoie le lien personnel, une seule fois. Ensuite, seule
// une adresse confirmée reçoit un mail, à chaque changement de ses places,
// regroupé sur deux minutes. Une fiche qui n'est pas joignable ne reçoit rien.
//
// Le lien se recalcule à partir du secret du serveur et du sel de la fiche
// (lib/liens.ts) : il reste le même d'un mail à l'autre. La charge utile d'un
// mail ne porte que l'identifiant de la fiche (invariant 5).

type Base = PrismaClient | Prisma.TransactionClient

/** Une fiche joignable : une adresse, et l'option « Prévenir par mail ». */
export const JOIGNABLE = {
  courriel: { not: null },
  prevenirParMail: true,
} satisfies Prisma.BenevoleWhereInput

/** Les fiches joignables parmi celles demandées. */
export async function fichesJoignables(
  base: Base,
  benevoleIds: readonly string[]
): Promise<Set<string>> {
  if (benevoleIds.length === 0) return new Set()
  const fiches = await base.benevole.findMany({
    where: { id: { in: [...new Set(benevoleIds)] }, ...JOIGNABLE },
    select: { id: true },
  })
  return new Set(fiches.map(f => f.id))
}

/**
 * Le jeton du lien d'une fiche. Une fiche sans lien en reçoit un ; l'empreinte se
 * réaligne quand le secret du serveur a changé. `nouveau` tire un nouveau sel, ce
 * qui révoque l'ancien lien.
 */
export async function jetonEspace(
  base: Base,
  benevoleId: string,
  options: { nouveau?: boolean } = {}
): Promise<string> {
  if (options.nouveau) {
    await base.benevole.update({
      where: { id: benevoleId },
      data: { espaceSel: nouveauSel() },
    })
  } else {
    // Deux appels simultanés ne tirent qu'un sel.
    await base.benevole.updateMany({
      where: { id: benevoleId, espaceSel: null },
      data: { espaceSel: nouveauSel() },
    })
  }
  const { espaceSel, espaceEmpreinte } = await base.benevole.findUniqueOrThrow({
    where: { id: benevoleId },
    select: { espaceSel: true, espaceEmpreinte: true },
  })
  const jeton = await jetonDe('espace', espaceSel!)
  if (espaceEmpreinte !== empreinte(jeton)) {
    await base.benevole.update({
      where: { id: benevoleId },
      data: { espaceEmpreinte: empreinte(jeton) },
    })
  }
  return jeton
}

/** Le lien de l'espace d'une fiche, pour un mail ou pour le bouton « Copier ». */
export function lienEspace(origine: string, jeton: string): string {
  return `${origine.replace(/\/$/, '')}/benevole/${jeton}`
}

/**
 * Annonce une place nouvelle à sa fiche. La première place d'une fiche joignable
 * envoie le lien personnel ; une fiche qui l'a déjà reçu, et dont l'adresse est
 * confirmée, reçoit le mail de ses places. Ne lève jamais.
 */
export async function annoncerPlace(
  prisma: PrismaClient,
  fiche: { benevoleId: string; organisationId: string; activiteId: string },
  maintenant = new Date()
): Promise<void> {
  try {
    const { count } = await prisma.benevole.updateMany({
      where: { id: fiche.benevoleId, lienEnvoyeLe: null, ...JOIGNABLE },
      data: { lienEnvoyeLe: maintenant },
    })
    if (count === 1) {
      await mettreEnFile(
        'benevole-lien',
        { benevoleId: fiche.benevoleId },
        {
          jobId: `benevole-lien-${fiche.benevoleId}`,
          organisationId: fiche.organisationId,
          activiteId: fiche.activiteId,
        }
      )
      return
    }
    await signalerPlacesModifiees(prisma, [fiche.benevoleId], fiche, maintenant)
  } catch (erreur) {
    journal.error(
      {
        evenement: 'courriel-benevole-echoue',
        message: (erreur as Error).message,
      },
      'Le mail d’une ou d’un bénévole n’a pas pu être mis en file.'
    )
  }
}

/**
 * Renvoie le lien personnel par mail, une seule fois par fiche : la relance. Rend
 * faux quand la fiche ne peut plus en recevoir (déjà relancée, jamais annoncée,
 * ou plus joignable).
 */
export async function relancer(
  prisma: PrismaClient,
  fiche: { benevoleId: string; organisationId: string; activiteId: string },
  maintenant = new Date()
): Promise<boolean> {
  const { count } = await prisma.benevole.updateMany({
    where: {
      id: fiche.benevoleId,
      lienEnvoyeLe: { not: null },
      relanceLe: null,
      ...JOIGNABLE,
    },
    data: { relanceLe: maintenant },
  })
  if (count === 0) return false
  await mettreEnFile(
    'benevole-lien',
    { benevoleId: fiche.benevoleId },
    {
      jobId: `benevole-relance-${fiche.benevoleId}`,
      organisationId: fiche.organisationId,
      activiteId: fiche.activiteId,
    }
  )
  return true
}

/**
 * Annonce un changement de places aux fiches dont l'adresse est confirmée. Les
 * changements d'une même fiche se regroupent sur deux minutes, comme les
 * convocations (ADR 0037) : le mail relit les places au moment de l'envoi. Ne
 * lève jamais.
 */
export async function signalerPlacesModifiees(
  prisma: Base,
  benevoleIds: readonly string[],
  contexte: { organisationId: string; activiteId: string },
  maintenant = new Date()
): Promise<void> {
  if (benevoleIds.length === 0) return
  try {
    const confirmees = await prisma.benevole.findMany({
      where: {
        id: { in: [...new Set(benevoleIds)] },
        courrielConfirmeLe: { not: null },
        ...JOIGNABLE,
      },
      select: { id: true },
    })
    const fenetre = Math.floor(maintenant.getTime() / DELAI_CONVOCATION_MS)
    for (const { id } of confirmees) {
      await mettreEnFile(
        'benevole-places',
        { benevoleId: id },
        {
          jobId: `benevole-places-${id}-${fenetre}`,
          delai: DELAI_CONVOCATION_MS,
          organisationId: contexte.organisationId,
          activiteId: contexte.activiteId,
        }
      )
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'courriel-benevole-echoue',
        message: (erreur as Error).message,
      },
      'Le mail d’une ou d’un bénévole n’a pas pu être mis en file.'
    )
  }
}

/**
 * Prévient l'équipe qu'une ou un bénévole a quitté une séquence depuis son
 * espace : les personnes qui écrivent dans son périmètre, sinon les admins de
 * l'activité. Ne lève jamais.
 */
export async function notifierRetrait(
  prisma: PrismaClient,
  retrait: {
    placeId: string
    benevoleId: string
    sequence: {
      id: string
      organisationId: string
      activiteId: string
      editionId: string
      perimetreId: string | null
    }
  }
): Promise<void> {
  const { sequence } = retrait
  try {
    const referents =
      sequence.perimetreId === null
        ? []
        : (
            await prisma.affectation.findMany({
              where: {
                editionId: sequence.editionId,
                perimetreId: sequence.perimetreId,
                user: membreActif(sequence.organisationId),
              },
              select: { userId: true },
            })
          ).map(a => a.userId)
    const admins =
      referents.length > 0
        ? []
        : await adminsAPrevenir(
            prisma,
            sequence.organisationId,
            sequence.activiteId
          )
    const niveaux = await niveauxDes(prisma, admins, sequence.activiteId)
    for (const userId of new Set([...referents, ...admins])) {
      try {
        await prisma.notification.create({
          data: {
            organisationId: sequence.organisationId,
            userId,
            type: 'BENEVOLE_RETIRE',
            niveau: niveaux.get(userId) ?? 'REFERENT',
            activiteId: sequence.activiteId,
            perimetreId: sequence.perimetreId,
            editionId: sequence.editionId,
            sequenceId: sequence.id,
            benevoleId: retrait.benevoleId,
            cle: `BENEVOLE_RETIRE-${retrait.placeId}-${userId}`,
          },
          select: { id: true },
        })
        publierNotification(sequence.organisationId, userId)
      } catch (erreur) {
        if ((erreur as { code?: string }).code !== 'P2002') throw erreur
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type: 'BENEVOLE_RETIRE',
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}

/**
 * Révoque le lien des fiches qu'aucune place ni candidature d'une période non
 * archivée ne retient : l'espace bénévole cesse de répondre à l'archivage de la
 * dernière période de la fiche.
 */
export async function revoquerEspaces(
  base: Base,
  options: { organisationId?: string } = {}
): Promise<number> {
  const { count } = await base.benevole.updateMany({
    where: {
      ...(options.organisationId === undefined
        ? {}
        : { organisationId: options.organisationId }),
      espaceEmpreinte: { not: null },
      places: {
        none: { sequence: { edition: { statut: { not: 'ARCHIVEE' } } } },
      },
      candidatures: { none: { edition: { statut: { not: 'ARCHIVEE' } } } },
    },
    data: { espaceSel: null, espaceEmpreinte: null },
  })
  return count
}

/** Les places à venir d'une fiche, dans les périodes non archivées, par début. */
export function placesAVenir(
  prisma: Base,
  benevoleId: string,
  maintenant = new Date()
) {
  return prisma.placeSequence.findMany({
    where: {
      benevoleId,
      sequence: {
        fin: { gt: maintenant },
        edition: { statut: { not: 'ARCHIVEE' } },
      },
    },
    include: {
      sequence: {
        include: {
          lieu: { select: { nom: true } },
          perimetre: { select: { nom: true } },
        },
      },
    },
    orderBy: [{ sequence: { debut: 'asc' } }, { id: 'asc' }],
  })
}
