import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

import { env } from '../env.ts'

export const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

// La file des mails. La logique métier met en file et n'expédie jamais elle-même :
// une lenteur SMTP ne doit pas bloquer une requête.
export const COURRIEL_QUEUE = 'courriel'

export type SorteCourriel =
  | 'essai'
  | 'invitation'
  | 'code-connexion'
  | 'tache-modifiee'
  | 'rappels-echeance'
  | 'resume'

// La charge utile ne contient ni corps de mail ni jeton. Le processeur relit l'adresse
// en base au moment de l'envoi. `destinataire` sert seulement quand aucun compte n'existe.
// Seule exception : `code` pour la sorte `code-connexion` (ADR 0002).
export interface CourrielJobData {
  sorte: SorteCourriel
  userId?: string
  destinataire?: string
  code?: string
  // Pour `tache-modifiee` : identifiants seulement, le contenu se relit à l'envoi.
  tache?: {
    tacheId: string
    acteurId: string
    changement: 'contenu' | 'statut'
  }
  // Notification liée : sa date d'envoi est posée après le départ du mail.
  notificationId?: string
  // Pour `rappels-echeance` : les notifications regroupées dans le mail.
  notificationIds?: string[]
}

export const courrielQueue = new Queue<CourrielJobData>(COURRIEL_QUEUE, {
  connection,
  defaultJobOptions: {
    // Cinq essais espacés couvrent le greylisting, première cause des erreurs 4xx.
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 24 * 3600, count: 200 },
  },
})

// Les tâches planifiées : rappels d'échéance et résumés, une fois par jour.
// La planification vit dans le worker, et nulle part ailleurs.
export const PLANIFICATION_QUEUE = 'planification'

export type TachePlanifiee = 'rappels' | 'resumes'

export const planificationQueue = new Queue<
  Record<string, never>,
  unknown,
  TachePlanifiee
>(PLANIFICATION_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
})
