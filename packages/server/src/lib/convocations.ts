import { prisma, type Prisma, type TypeNotification } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { publierNotification } from './flux.ts'
import { journal } from './journal.ts'
import { pousser } from './push-file.ts'

// Mails et notifications des réunions (ADR 0037).
//
// La file ne porte que des identifiants et la version de la réunion : le
// processeur relit la réunion et la convocation au moment d'envoyer. Les
// modifications rapprochées d'une réunion produisent un seul mail : l'envoi
// attend deux minutes, seul le job de la version courante envoie, et un mail
// déjà parti pour cette version ne repart pas. Le délai couvre aussi la fin de
// la transaction qui a demandé l'envoi : le processeur lit l'état validé.

export const DELAI_CONVOCATION_MS = 2 * 60 * 1000

interface ReunionAnnoncee {
  id: string
  organisationId: string
  activiteId: string
  sequence: number
}

/** Une convocation : sa ligne, et la personne convoquée. */
export interface ConvocationAnnoncee {
  id: string
  userId: string
}

function mettreEnFileReunion(
  sorte: 'convocation-reunion' | 'annulation-reunion',
  reunion: ReunionAnnoncee,
  convocations: readonly ConvocationAnnoncee[]
): void {
  const prefixe = sorte === 'convocation-reunion' ? 'convocation' : 'annulation'
  for (const convocation of convocations) {
    void mettreEnFile(
      sorte,
      { userId: convocation.userId },
      {
        // Une clé par convocation et par version : une nouvelle version
        // repart, et une personne retirée puis convoquée de nouveau reçoit une
        // nouvelle convocation, même sans changement de version.
        jobId: `${prefixe}-${convocation.id}-${reunion.sequence}`,
        delai: DELAI_CONVOCATION_MS,
        reunionId: reunion.id,
        convocationId: convocation.id,
        sequenceReunion: reunion.sequence,
        organisationId: reunion.organisationId,
        activiteId: reunion.activiteId,
      }
    )
  }
}

/** Met en file la convocation de chaque personne, pour la version courante. */
export function envoyerConvocations(
  reunion: ReunionAnnoncee,
  convocations: readonly ConvocationAnnoncee[]
): void {
  mettreEnFileReunion('convocation-reunion', reunion, convocations)
}

/**
 * Met en file l'annulation de chaque personne : une réunion annulée, ou une
 * personne qui ne fait plus partie des personnes convoquées. L'appelant ne la
 * demande que pour une personne qui a reçu la convocation ; le processeur
 * rattrape une convocation partie pendant le retrait (`concilierApresEnvoi`).
 */
export function envoyerAnnulations(
  reunion: ReunionAnnoncee,
  convocations: readonly ConvocationAnnoncee[]
): void {
  mettreEnFileReunion('annulation-reunion', reunion, convocations)
}

/**
 * Verrouille des réunions jusqu'à la fin de la transaction, dans un ordre fixe.
 * Tout changement des convocations d'une réunion passe sous ce verrou :
 * modification, annulation, affectation, retrait, et l'enregistrement d'un
 * envoi. Chacun relit donc les convocations validées par les autres.
 */
export async function verrouillerReunions(
  db: Prisma.TransactionClient,
  ids: readonly string[]
): Promise<void> {
  for (const id of [...new Set(ids)].sort()) {
    await db.$queryRaw`SELECT id FROM Reunion WHERE id = ${id} FOR UPDATE`
  }
}

/**
 * Enregistre l'envoi d'une convocation, puis rattrape les changements faits
 * pendant l'envoi. Une personne retirée entre-temps, ou convoquée à une réunion
 * annulée entre-temps, reçoit l'annulation de la convocation qu'elle vient de
 * recevoir : le retrait et l'annulation ne l'avaient pas comptée, faute d'envoi
 * enregistré.
 */
export async function concilierApresEnvoi(
  convocation: ConvocationAnnoncee & { reunionId: string },
  sequence: number
): Promise<void> {
  const { retiree, reunion } = await prisma.$transaction(async tx => {
    await verrouillerReunions(tx, [convocation.reunionId])
    const { count } = await tx.convocationReunion.updateMany({
      where: { id: convocation.id },
      data: { envoyeeLe: new Date(), sequenceEnvoyee: sequence },
    })
    return {
      retiree: count === 0,
      reunion: await tx.reunion.findUnique({
        where: { id: convocation.reunionId },
        select: {
          id: true,
          organisationId: true,
          activiteId: true,
          sequence: true,
          statut: true,
        },
      }),
    }
  })
  if (reunion !== null && (retiree || reunion.statut === 'ANNULEE')) {
    envoyerAnnulations(reunion, [convocation])
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
