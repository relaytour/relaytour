import { DelayedError, UnrecoverableError, type Job } from 'bullmq'

import { prisma } from '@relaytour/database'

import { composer } from '../../courriel/messages.ts'
import { expedier } from '../../courriel/transport.ts'
import { env } from '../../env.ts'
import { CODE_VALIDITE_SECONDES } from '../../lib/connexion.ts'
import { courrielTronque, journal, sansAdresses } from '../../lib/journal.ts'
import {
  attenteJusquAuLendemain,
  rendreEnvoi,
  reserverEnvoi,
} from '../../lib/plafond-courriel.ts'
import type { CourrielJobData } from '../queues.ts'

// Les mails reportés par le plafond repartent étalés sur ce délai, et non tous à minuit.
const ETALEMENT_DU_REPORT_MS = 30 * 60 * 1000

export async function courrielProcessor(
  job: Job<CourrielJobData>,
  token?: string
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
  const { sujet, html, texte, desabonnement, repondreA } = message

  // Plafond quotidien de l'installation (ADR 0031) : au-delà, le mail attend le
  // lendemain. Le job garde ses essais : un report n'en consomme aucun.
  const plafond = env.COURRIEL_PLAFOND_QUOTIDIEN
  if ((await reserverEnvoi(sorte, plafond)) === 'atteint') {
    const maintenant = new Date()
    journal.warn(
      {
        evenement: 'courriel-plafond-atteint',
        sorte,
        userId: userId ?? null,
        plafond,
      },
      'Plafond quotidien des mails atteint : le mail est reporté au lendemain.'
    )
    await job.moveToDelayed(
      maintenant.getTime() +
        attenteJusquAuLendemain(maintenant) +
        Math.floor(Math.random() * ETALEMENT_DU_REPORT_MS),
      token
    )
    throw new DelayedError()
  }
  const issue = await expedier({
    destinataire,
    sujet,
    html,
    texte,
    desabonnement,
    repondreA,
  })
  if (issue === 'parti' && message.apresEnvoi !== undefined) {
    // Le mail est parti : un échec de la suite (date d'envoi, notification) se
    // journalise sans faire rejouer le job, qui renverrait le mail.
    try {
      await message.apresEnvoi()
    } catch (erreur) {
      journal.error(
        {
          evenement: 'courriel-suite-en-echec',
          sorte,
          userId: userId ?? null,
          message: sansAdresses((erreur as Error).message),
        },
        'Le mail est parti, mais la suite de l’envoi a échoué.'
      )
    }
  }

  if (issue === 'refuse') {
    // Un refus définitif arrête les essais restants.
    throw new UnrecoverableError(`Adresse refusée définitivement (${sorte}).`)
  }
  if (issue === 'panne') {
    // Le mail n'est pas parti : sa place est rendue, le nouvel essai la réservera.
    await rendreEnvoi(sorte, plafond)
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
