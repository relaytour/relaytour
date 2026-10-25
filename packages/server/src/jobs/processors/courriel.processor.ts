import { DelayedError, UnrecoverableError, type Job } from 'bullmq'

import { prisma } from '@relaytour/database'

import { composer } from '../../courriel/messages.ts'
import { expedier } from '../../courriel/transport.ts'
import { env } from '../../env.ts'
import { archiveePourCeMail } from '../../lib/appartenances.ts'
import { CODE_VALIDITE_SECONDES } from '../../lib/connexion.ts'
import { courrielTronque, journal, sansAdresses } from '../../lib/journal.ts'
import { avecLangue } from '../../lib/langue.ts'
import { langueDuDestinataire } from '../../lib/langue-destinataire.ts'
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

  // L'adresse se relit en base au dernier moment. Une personne archivée entre-temps
  // dans l'organisation du mail ne le reçoit pas (ADR 0031) ; ses autres
  // organisations lui écrivent toujours. Le code de connexion part pour tout compte.
  let destinataire = job.data.destinataire
  // Une fiche bénévole supprimée entre-temps ne reçoit rien (ADR 0041).
  if (job.data.benevoleId !== undefined) {
    const fiche = await prisma.benevole.findUnique({
      where: { id: job.data.benevoleId },
      select: { courriel: true },
    })
    destinataire = fiche?.courriel ?? undefined
  }
  if (userId !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        appartenances: { select: { organisationId: true, archiveLe: true } },
      },
    })
    destinataire =
      user === null ||
      (sorte !== 'code-connexion' &&
        archiveePourCeMail(
          user.appartenances,
          await organisationDuJob(job.data)
        ))
        ? undefined
        : user.email
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

  // Le mail se compose dans la langue de son destinataire (ADR 0047).
  const langue = await langueDuDestinataire(
    prisma,
    userId,
    await organisationDuJob(job.data)
  )
  const message = await avecLangue(langue, () => composer(prisma, job.data))
  if (message === null) {
    journal.debug(
      { evenement: 'courriel-sans-objet', sorte, userId: userId ?? null },
      'Rien à envoyer (préférence désactivée ou contenu vide).'
    )
    return
  }
  const { sujet, html, texte, desabonnement, repondreA, icalEvent } = message

  // Plafond quotidien de l’installation (ADR 0034) : au-delà, le mail attend le
  // lendemain. Le job garde ses essais : un report n'en consomme aucun.
  const plafond = env.COURRIEL_PLAFOND_QUOTIDIEN
  // Un seul instant pour la réservation, le report et la restitution : un envoi
  // qui franchit minuit UTC rend sa place au jour où il l'a prise.
  const reserveLe = new Date()
  if ((await reserverEnvoi(sorte, plafond, reserveLe)) === 'atteint') {
    const maintenant = reserveLe
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
    icalEvent,
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
    // Le mail n'est pas parti : sa place est rendue au jour de la réservation, et
    // le nouvel essai la réservera. Un refus définitif garde la sienne : le serveur
    // de mail l'a compté.
    await rendreEnvoi(plafond, reserveLe)
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

/** L'organisation qui écrit : celle du job, sinon celle de la tâche qu'il annonce. */
async function organisationDuJob(
  donnees: CourrielJobData
): Promise<string | undefined> {
  if (donnees.organisationId !== undefined) return donnees.organisationId
  if (donnees.reunionId !== undefined) {
    const reunion = await prisma.reunion.findUnique({
      where: { id: donnees.reunionId },
      select: { organisationId: true },
    })
    return reunion?.organisationId
  }
  if (donnees.tache === undefined) return undefined
  const tache = await prisma.tache.findUnique({
    where: { id: donnees.tache.tacheId },
    select: { perimetre: { select: { organisationId: true } } },
  })
  return tache?.perimetre.organisationId
}
