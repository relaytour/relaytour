import { createHash } from 'node:crypto'

import type { TypeNotification } from '@relaytour/database'

// Notifications push (ADR 0024). Ce module est pur : il n'importe ni Prisma ni
// l'environnement, pour que le schéma s'imprime sans `.env`.

/** Les familles de notifications que la personne coupe une par une. */
export type FamillePush = 'taches' | 'echeances' | 'demandes'

export interface PreferencesPush {
  pushTaches: boolean
  pushEcheances: boolean
  pushDemandes: boolean
}

/**
 * La famille d'une notification, ou null quand son type ne part jamais en push :
 * la création d'une tâche et les changements de fiche s'annoncent à tout un
 * périmètre, et restent dans la cloche.
 */
export function famillePush(type: TypeNotification): FamillePush | null {
  switch (type) {
    case 'TACHE_ASSIGNEE':
    case 'TACHE_DESASSIGNEE':
    case 'TACHE_MODIFIEE':
    case 'TACHE_STATUT':
    case 'TACHE_COMMENTEE':
      return 'taches'
    case 'ECHEANCE_PROCHE':
    case 'TACHE_EN_RETARD':
      return 'echeances'
    case 'DEMANDE_RECUE':
      return 'demandes'
    default:
      return null
  }
}

/** Vrai quand les préférences de la personne laissent partir cette notification. */
export function pushAutorise(
  preferences: PreferencesPush,
  type: TypeNotification
): boolean {
  switch (famillePush(type)) {
    case 'taches':
      return preferences.pushTaches
    case 'echeances':
      return preferences.pushEcheances
    case 'demandes':
      return preferences.pushDemandes
    default:
      return false
  }
}

// Le worker appelle l'adresse qu'un navigateur lui a donnée. Elle ne peut désigner
// que le service de push d'un navigateur : sans cette liste, une personne ferait
// appeler une adresse de son choix par le serveur.
const SERVICES_DE_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
]

export const LONGUEUR_ADRESSE_MAX = 2000

/** Vrai pour une adresse en https d'un service de push connu, sans port ni identifiants. */
export function adressePushAcceptee(adresse: string): boolean {
  if (adresse.length > LONGUEUR_ADRESSE_MAX) return false
  let url: URL
  try {
    url = new URL(adresse)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    SERVICES_DE_PUSH.some(service => service.test(url.hostname))
  )
}

/** L'empreinte qui désigne un abonnement : SHA-256 de son adresse, en hexadécimal. */
export function empreinteAdresse(adresse: string): string {
  return createHash('sha256').update(adresse).digest('hex')
}

/** Une clé d'abonnement : du base64 adapté aux adresses, de longueur bornée. */
export function clePushValide(cle: string): boolean {
  return /^[A-Za-z0-9_-]{16,200}={0,2}$/.test(cle)
}

/** Libellé d'appareil déduit de l'agent de navigation, pour la liste de la personne. */
export function libelleAppareil(agent: string | undefined): string {
  const a = agent ?? ''
  if (/iPhone/.test(a)) return 'iPhone'
  if (/iPad/.test(a)) return 'iPad'
  if (/Android/.test(a)) return 'Android'
  if (/Macintosh/.test(a)) return 'Mac'
  if (/Windows/.test(a)) return 'Windows'
  if (/Linux/.test(a)) return 'Linux'
  return 'Appareil'
}

/** Abonnements gardés par personne : au-delà, le plus ancien est retiré. */
export const ABONNEMENTS_MAX = 10

/** Ce que le service worker reçoit et affiche. */
export interface MessagePush {
  titre: string
  corps: string
  /** Chemin de l'espace organisateur ouvert par un appui. */
  lien: string
  /**
   * Slug de l'organisation de la notification. Une personne reçoit sur un même
   * appareil les notifications de toutes ses organisations : l'application
   * sélectionne celle-ci avant d'ouvrir le lien.
   */
  organisation: string
  /** Regroupe les messages d'une même notification : un renvoi remplace l'affichage. */
  etiquette: string
  icone: string
  /** Nombre de notifications non lues, pour la pastille de l'icône. */
  nonLues: number
}

export interface ClesVapid {
  publique: string
  privee: string
  sujet: string
}

/** Les clés VAPID de l'installation, ou null quand le canal est fermé. */
export function clesVapid(env: {
  PUSH_VAPID_PUBLIQUE?: string | undefined
  PUSH_VAPID_PRIVEE?: string | undefined
  PUSH_VAPID_SUJET?: string | undefined
}): ClesVapid | null {
  if (
    env.PUSH_VAPID_PUBLIQUE === undefined ||
    env.PUSH_VAPID_PRIVEE === undefined ||
    env.PUSH_VAPID_SUJET === undefined
  )
    return null
  return {
    publique: env.PUSH_VAPID_PUBLIQUE,
    privee: env.PUSH_VAPID_PRIVEE,
    sujet: env.PUSH_VAPID_SUJET,
  }
}
