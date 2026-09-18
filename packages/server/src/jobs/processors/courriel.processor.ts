import { UnrecoverableError, type Job } from 'bullmq'

import { prisma } from '@relaytour/database'

import { composer } from '../../courriel/messages.ts'
import { expedier } from '../../courriel/transport.ts'
import { CODE_VALIDITE_SECONDES } from '../../lib/connexion.ts'
import { courrielTronque, journal } from '../../lib/journal.ts'
import type { CourrielJobData } from '../queues.ts'

export async function courrielProcessor(
  job: Job<CourrielJobData>
): Promise<void> {
  const { sorte, userId } = job.data

  // Un code expiré ne sert plus à rien : il n'est pas envoyé.
  if (
    sorte === 'code-connexion' &&
    Date.now() - job.timestamp > CODE_VALIDITE_SECONDES * 1000
  ) {
    journal.info(
      { evenement: 'courriel-code-expire', userId: userId ?? null },
      'Code de connexion expiré avant l’envoi : rien n’est envoyé.'
    )
    return
  }

  // L'adresse se relit en base au dernier moment : un compte archivé entre-temps ne reçoit rien.
  let destinataire = job.data.destinataire
  if (userId !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, archivedAt: true },
    })
    destinataire =
      user === null || user.archivedAt !== null ? undefined : user.email
  }

  if (destinataire === undefined) {
    journal.info(
      {
        evenement: 'courriel-sans-destinataire',
        sorte,
        userId: userId ?? null,
      },
      'Aucun destinataire pour ce mail : rien n’est envoyé.'
    )
    return
  }

  const message = await composer(prisma, job.data)
  if (message === null) {
    journal.debug(
      { evenement: 'courriel-sans-objet', sorte, userId: userId ?? null },
      'Rien à envoyer (préférence désactivée ou contenu vide).'
    )
    return
  }
  const { sujet, html, texte, desabonnement } = message
  const issue = await expedier({
    destinataire,
    sujet,
    html,
    texte,
    desabonnement,
  })
  if (issue === 'parti') await message.apresEnvoi?.()

  if (issue === 'refuse') {
    // Un refus définitif arrête les essais restants.
    throw new UnrecoverableError(`Adresse refusée définitivement (${sorte}).`)
  }
  if (issue === 'panne') {
    throw new Error(`Envoi impossible (${sorte}), nouvel essai prévu.`)
  }
  journal.debug(
    {
      evenement: 'courriel-traite',
      sorte,
      destinataire: courrielTronque(destinataire),
      issue,
    },
    'Mail traité.'
  )
}
