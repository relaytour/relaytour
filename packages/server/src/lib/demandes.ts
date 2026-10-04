import type { PrismaClient } from '@relaytour/database'

import { aujourdhui } from './droits.ts'
import { erreurSaisie } from './erreurs.ts'
import { journal } from './journal.ts'

// Demandes pour rejoindre l'équipe d'une période (ADR 0015).
//
// Une demande porte le nom et l'adresse d'une personne qui n'est pas encore dans
// l'équipe : un·e référent·e la propose pour son périmètre, ou elle vient du
// formulaire public. Aucun compte n'existe avant qu'un admin de l'activité accepte la
// demande. Une demande ne donne aucun accès, et lib/droits.ts ne lit jamais ces
// tables. Les admins de l'activité lisent ses demandes ; la personne qui propose ne
// lit que ses propres propositions, sans adresse. Les demandes vivent en base
// seulement : elles ne sont jamais exportées dans Git.

/** Propositions en attente qu'une même personne peut avoir en cours. */
export const PROPOSITIONS_EN_ATTENTE_MAX = 20

const MOT_MAX = 280

/** Le mot facultatif d'une proposition : rogné, 280 caractères au plus, ou null. */
export function motValide(brut: string | null | undefined): string | null {
  const mot = (brut ?? '').trim()
  if (mot === '') return null
  if (mot.length > MOT_MAX) {
    throw erreurSaisie(`Le mot compte ${MOT_MAX} caractères au plus.`)
  }
  return mot
}

/**
 * Prévient les admins qu'une demande attend leur revue : les admins de l'activité,
 * sinon ceux de l'organisation. Chaque admin reçoit au plus une notification par
 * activité et par jour, garantie par sa clé. Ne lève jamais : une notification
 * manquée ne doit pas faire échouer la demande.
 */
export async function signalerDemande(
  prisma: PrismaClient,
  demande: { organisationId: string; activiteId: string; acteurId: string },
  maintenant = new Date()
): Promise<void> {
  const { organisationId, activiteId, acteurId } = demande
  try {
    const actif = { archivedAt: null }
    const deLActivite = await prisma.adminActivite.findMany({
      where: { activiteId, organisationId, user: actif },
      select: { userId: true },
    })
    const admins =
      deLActivite.length > 0
        ? deLActivite
        : await prisma.appartenance.findMany({
            where: { organisationId, role: 'ADMIN', user: actif },
            select: { userId: true },
          })
    // Le jour se compte dans le fuseau de l'organisation, comme ses rappels.
    const { fuseauHoraire } = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { fuseauHoraire: true },
    })
    const jour = aujourdhui(maintenant, fuseauHoraire)
    for (const { userId } of admins) {
      if (userId === acteurId) continue
      try {
        await prisma.notification.create({
          data: {
            organisationId,
            userId,
            type: 'DEMANDE_RECUE',
            acteurId,
            activiteId,
            cle: `DEMANDE_RECUE-${activiteId}-${userId}-${jour}`,
          },
        })
      } catch (erreur) {
        // P2002 : cet admin est déjà prévenu aujourd'hui pour cette activité.
        if ((erreur as { code?: string }).code !== 'P2002') throw erreur
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type: 'DEMANDE_RECUE',
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}
