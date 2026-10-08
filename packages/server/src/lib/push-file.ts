import { avecDelai } from './delai.ts'
import { journal } from './journal.ts'

/**
 * Met en file l'envoi push d'une notification (ADR 0024). Ne lève jamais : une
 * file indisponible est journalisée, et l'action qui a créé la notification
 * aboutit. Sans clés VAPID, le canal est fermé et rien n'entre en file.
 *
 * Les imports sont paresseux : `env.ts` et `queues.ts` valident l'environnement
 * au chargement, et le schéma doit pouvoir s'imprimer sans `.env`.
 */
export async function pousser(notificationId: string): Promise<void> {
  try {
    const [{ env }, { clesVapid }] = await Promise.all([
      import('../env.ts'),
      import('./push.ts'),
    ])
    if (clesVapid(env) === null) return
    const { pushQueue } = await import('../jobs/queues.ts')
    await avecDelai(
      // BullMQ refuse « : » dans un identifiant de job. L'identifiant évite un
      // second envoi pour la même notification.
      pushQueue.add(
        'push',
        { notificationId },
        { jobId: `push-${notificationId}` }
      ),
      2_000,
      'File des notifications push'
    )
  } catch (erreur) {
    journal.error(
      {
        evenement: 'push-file-indisponible',
        notificationId,
        message: (erreur as Error).message,
      },
      'La file des notifications push ne répond pas : cette notification ne partira pas en push.'
    )
  }
}
