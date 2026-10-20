import { prisma, type TypeNotification } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { publierNotification } from './flux.ts'
import { journal } from './journal.ts'
import { pousser } from './push-file.ts'

// Mails et notifications des réunions (ADR 0037).
//
// La file ne porte que des identifiants : le processeur relit la réunion et la
// convocation au moment d'envoyer. Les modifications rapprochées d'une réunion
// produisent un seul mail : l'envoi attend deux minutes, et un mail déjà parti
// pour la version courante ne repart pas.

export const DELAI_CONVOCATION_MS = 2 * 60 * 1000

interface ReunionAnnoncee {
  id: string
  organisationId: string
  activiteId: string
  sequence: number
}

/** Met en file la convocation de chaque personne, pour la version courante. */
export function envoyerConvocations(
  reunion: ReunionAnnoncee,
  userIds: readonly string[]
): void {
  for (const userId of new Set(userIds)) {
    void mettreEnFile(
      'convocation-reunion',
      { userId },
      {
        // Un identifiant par version : une nouvelle version repart, une
        // modification qui ne change pas la version ne double pas le mail.
        jobId: `convocation-${reunion.id}-${userId}-${reunion.sequence}`,
        delai: DELAI_CONVOCATION_MS,
        reunionId: reunion.id,
        organisationId: reunion.organisationId,
        activiteId: reunion.activiteId,
      }
    )
  }
}

/**
 * Met en file l'annulation de chaque personne : une réunion annulée, ou une
 * personne qui ne fait plus partie des personnes convoquées. Elle ne part qu'à
 * une personne qui a reçu la convocation.
 */
export function envoyerAnnulations(
  reunion: ReunionAnnoncee,
  userIds: readonly string[]
): void {
  for (const userId of new Set(userIds)) {
    void mettreEnFile(
      'annulation-reunion',
      { userId },
      {
        jobId: `annulation-${reunion.id}-${userId}-${reunion.sequence}`,
        reunionId: reunion.id,
        organisationId: reunion.organisationId,
        activiteId: reunion.activiteId,
      }
    )
  }
}

/**
 * Prévient les personnes convoquées dans l'application et en push (famille
 * « agenda »). L'auteur de l'action n'est jamais prévenu.
 */
export async function notifierReunion(
  type: Extract<
    TypeNotification,
    'REUNION_CONVOQUEE' | 'REUNION_MODIFIEE' | 'REUNION_ANNULEE'
  >,
  reunion: {
    id: string
    organisationId: string
    activiteId: string
    perimetreId: string | null
    editionId: string
  },
  destinataires: readonly string[],
  acteurId: string
): Promise<void> {
  const personnes = [...new Set(destinataires)].filter(id => id !== acteurId)
  try {
    for (const userId of personnes) {
      const creee = await prisma.notification.create({
        data: {
          organisationId: reunion.organisationId,
          userId,
          type,
          acteurId,
          reunionId: reunion.id,
          activiteId: reunion.activiteId,
          perimetreId: reunion.perimetreId,
          editionId: reunion.editionId,
        },
        select: { id: true },
      })
      publierNotification(reunion.organisationId, userId)
      await pousser(creee.id)
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type,
        message: (erreur as Error).message,
      },
      'Une notification de réunion n’a pas pu être créée.'
    )
  }
}
