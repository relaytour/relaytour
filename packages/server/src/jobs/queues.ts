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
  | 'equipe'
  | 'demandes'
  | 'convocation-reunion'
  | 'annulation-reunion'
  // Mails aux bénévoles (ADR 0041) : le lien personnel, et les places changées.
  | 'benevole-lien'
  | 'benevole-places'
  // Rappel de l'adresse de l'espace, demandé par l'hébergeur (ADR 0054).
  | 'rappel-adresse'
  // Lien de l'export d'une installation en sommeil (ADR 0055). Envoyé tout de suite
  // par l'API, jamais mis en file : le worker ne tourne pas pendant le réveil.
  | 'lien-export'

// La charge utile ne contient ni corps de mail ni jeton. Le processeur relit l'adresse
// en base au moment de l'envoi. `destinataire` sert seulement quand aucun compte n'existe.
// Seule exception : `code` pour la sorte `code-connexion` (ADR 0002).
export interface CourrielJobData {
  sorte: SorteCourriel
  userId?: string
  destinataire?: string
  code?: string
  // Pour `tache-modifiee` : identifiants seulement, le contenu se relit à l'envoi.
  // Sans `acteurId` pour un passage à « faite » : qui a coché une tâche reste
  // réservé à la personne qui a coché et aux admins, et le mail ne le nomme pas.
  tache?: {
    tacheId: string
    acteurId?: string
    changement: 'contenu' | 'statut'
  }
  // Notification liée : sa date d'envoi est posée après le départ du mail.
  notificationId?: string
  // Pour `rappels-echeance` : les notifications regroupées dans le mail.
  notificationIds?: string[]
  // Organisation dont le mail porte le nom et les couleurs (ADR 0008). Sans elle,
  // l'unique organisation de la personne, sinon celle de l'installation.
  organisationId?: string
  // Activité qui porte le mail (ADR 0009) : son identité et son contact, qui reçoit
  // les réponses.
  activiteId?: string
  // Fenêtre des changements annoncés par un mail d'équipe (ADR 0012), en ISO 8601.
  fenetre?: { debut: string; fin: string }
  // Pour `convocation-reunion` et `annulation-reunion` (ADR 0037) : la réunion,
  // relue au moment de l'envoi.
  reunionId?: string
  // La convocation et la version de la réunion au moment de la demande : seul le
  // job de la version courante envoie.
  convocationId?: string
  sequenceReunion?: number
  // Pour `benevole-lien` et `benevole-places` (ADR 0041) : la fiche, dont l'adresse
  // se relit à l'envoi. Le jeton du lien se crée à l'envoi, jamais dans la file.
  benevoleId?: string
  // Pour `lien-export` (ADR 0055) : le jeton du lien de téléchargement, et le dernier
  // export envoyé à tous les admins. Cette sorte ne passe jamais par la file.
  exportPourAdmin?: { jeton: string; dernier: boolean }
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

// Les tâches planifiées : rappels d'échéance et résumés, une fois par jour et par
// organisation, à l'heure de son fuseau (ADR 0008). `synchro` ajuste chaque heure les
// planifications aux organisations actives. `purge` supprime chaque nuit les demandes
// des périodes archivées, dans toutes les organisations (ADR 0015), les images que
// l'identité ne cite plus, et les données techniques échues (sessions, vérifications,
// compteurs, notifications lues). `espace-fichiers` renouvelle chaque nuit l'accès
// aux espaces de fichiers et réconcilie l'export des fiches ; `export-fiches` exporte
// les fiches d'une organisation après une modification (ADR 0038) ;
// `acces-fournisseur` vérifie les accès chez le fournisseur (ADR 0044). La planification
// vit dans le worker, et nulle part ailleurs.
export const PLANIFICATION_QUEUE = 'planification'

export type TachePlanifiee =
  | 'rappels'
  | 'resumes'
  | 'synchro'
  | 'purge'
  | 'espace-fichiers'
  | 'export-fiches'
  | 'acces-fournisseur'

export interface PlanificationJobData {
  organisationId?: string
}

export const planificationQueue = new Queue<
  PlanificationJobData,
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

// La file des notifications push (ADR 0024). La charge utile ne porte que
// l'identifiant de la notification : le processeur relit en base son texte, ses
// destinataires et leurs préférences au moment de l'envoi.
export const PUSH_QUEUE = 'push'

export interface PushJobData {
  notificationId: string
}

export const pushQueue = new Queue<PushJobData>(PUSH_QUEUE, {
  connection,
  defaultJobOptions: {
    // Un service de push indisponible se rétablit en quelques minutes. Au-delà,
    // la notification reste dans la cloche et dans le résumé.
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 24 * 3600, count: 200 },
  },
})
