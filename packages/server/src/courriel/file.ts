import type { CourrielJobData, SorteCourriel } from '../jobs/queues.ts'
import { avecDelai } from '../lib/delai.ts'
import { courrielTronque, journal } from '../lib/journal.ts'

export type CibleCourriel = { userId: string } | { destinataire: string }

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
    }
    await avecDelai(
      courrielQueue.add(sorte, data, {
        ...(options.jobId === undefined ? {} : { jobId: options.jobId }),
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
