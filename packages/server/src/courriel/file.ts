import type { CourrielJobData, SorteCourriel } from '../jobs/queues.ts'
import { avecDelai } from '../lib/delai.ts'
import { courrielTronque, journal } from '../lib/journal.ts'
import { SORTES_JAMAIS_REPORTEES } from '../lib/plafond-courriel.ts'

// BullMQ traite d'abord les jobs sans priorité. Tous les mails en portent une, sauf
// le code de connexion : il passe devant un envoi groupé et arrive avant d'expirer.
const PRIORITE_DES_AUTRES_MAILS = 10

export type CibleCourriel =
  | { userId: string }
  | { destinataire: string }
  // Une fiche bénévole : son adresse se relit à l'envoi (ADR 0041).
  | { benevoleId: string }

/**
 * Met un mail en file. Ne lève jamais : une file indisponible est journalisée,
 * et l'action métier qui a demandé l'envoi aboutit quand même.
 *
 * L'import de la file est paresseux : queues.ts valide l'environnement au chargement,
 * et le schéma doit pouvoir s'imprimer sans .env.
 */
export async function mettreEnFile(
  sorte: SorteCourriel,
  cible: CibleCourriel,
  options: {
    jobId?: string
    code?: string
    tache?: CourrielJobData['tache']
    notificationId?: string
    notificationIds?: string[]
    organisationId?: string
    activiteId?: string
    // Délai avant l'envoi, en millisecondes (mails regroupés, ADR 0012 et 0016).
    delai?: number
    fenetre?: CourrielJobData['fenetre']
    reunionId?: string
    convocationId?: string
    sequenceReunion?: number
  } = {}
): Promise<void> {
  try {
    const { courrielQueue } = await import('../jobs/queues.ts')
    const data: CourrielJobData = {
      sorte,
      ...cible,
      ...(options.code === undefined ? {} : { code: options.code }),
      ...(options.tache === undefined ? {} : { tache: options.tache }),
      ...(options.notificationId === undefined
        ? {}
        : { notificationId: options.notificationId }),
      ...(options.notificationIds === undefined
        ? {}
        : { notificationIds: options.notificationIds }),
      ...(options.organisationId === undefined
        ? {}
        : { organisationId: options.organisationId }),
      ...(options.activiteId === undefined
        ? {}
        : { activiteId: options.activiteId }),
      ...(options.fenetre === undefined ? {} : { fenetre: options.fenetre }),
      ...(options.reunionId === undefined
        ? {}
        : { reunionId: options.reunionId }),
      ...(options.convocationId === undefined
        ? {}
        : { convocationId: options.convocationId }),
      ...(options.sequenceReunion === undefined
        ? {}
        : { sequenceReunion: options.sequenceReunion }),
    }
    await avecDelai(
      courrielQueue.add(sorte, data, {
        ...(options.jobId === undefined ? {} : { jobId: options.jobId }),
        ...(options.delai === undefined
          ? {}
          : { delay: Math.max(0, options.delai) }),
        ...(SORTES_JAMAIS_REPORTEES.has(sorte)
          ? {}
          : { priority: PRIORITE_DES_AUTRES_MAILS }),
        // Un job qui porte un code disparaît de Redis dès son traitement, réussi ou non.
        ...(options.code === undefined
          ? {}
          : { attempts: 3, removeOnComplete: true, removeOnFail: true }),
      }),
      2_000,
      'File des mails'
    )
    journal.debug(
      {
        evenement: 'courriel-mis-en-file',
        sorte,
        ...('userId' in cible
          ? { userId: cible.userId }
          : 'benevoleId' in cible
            ? { benevoleId: cible.benevoleId }
            : { destinataire: courrielTronque(cible.destinataire) }),
      },
      'Mail mis en file.'
    )
  } catch (erreur) {
    journal.error(
      {
        evenement: 'courriel-file-indisponible',
        sorte,
        message: (erreur as Error).message,
      },
      'La file des mails ne répond pas : ce mail ne partira pas.'
    )
  }
}
