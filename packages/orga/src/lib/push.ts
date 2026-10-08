import { estInstallee, appareil } from './installation'

// Notifications push (ADR 0024) : état de l'appareil, abonnement et retrait. Le
// service worker reçoit les messages (src/sw.ts). L'abonnement vit dans le
// navigateur ; le serveur en garde une copie pour lui écrire.

export type EtatPush =
  /** Le canal est fermé sur l'installation, ou le navigateur ne le connaît pas. */
  | 'indisponible'
  /** Sur iPhone, le push n'existe que dans l'application installée. */
  | 'installation-requise'
  /** La personne a refusé les notifications dans son navigateur. */
  | 'refuse'
  | 'a-activer'
  | 'active'

/** Vrai quand le navigateur sait recevoir une notification push. */
export function pushPrisEnCharge(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * L'état de l'appareil, hors abonnement : ce que la personne peut faire ici.
 * `abonne` dit si le serveur connaît l'abonnement de ce navigateur.
 */
export function etatPush(
  cle: string | null,
  permission: NotificationPermission | undefined,
  abonne: boolean,
  contexte: { prisEnCharge: boolean; iphone: boolean; installee: boolean }
): EtatPush {
  if (cle === null) return 'indisponible'
  if (!contexte.prisEnCharge)
    return contexte.iphone && !contexte.installee
      ? 'installation-requise'
      : 'indisponible'
  if (permission === 'denied') return 'refuse'
  return permission === 'granted' && abonne ? 'active' : 'a-activer'
}

export function contexteAppareil() {
  return {
    prisEnCharge: pushPrisEnCharge(),
    iphone: appareil() === 'iphone',
    installee: estInstallee(),
  }
}

/** La clé publique VAPID sous la forme que `pushManager.subscribe` attend. */
export function cleEnOctets(cle: string): Uint8Array<ArrayBuffer> {
  const base64 = (cle + '='.repeat((4 - (cle.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const brut = atob(base64)
  const octets = new Uint8Array(new ArrayBuffer(brut.length))
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i)
  return octets
}

export interface AbonnementAEnvoyer {
  adresse: string
  p256dh: string
  auth: string
}

function versServeur(abonnement: PushSubscription): AbonnementAEnvoyer | null {
  const { endpoint, keys } = abonnement.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) return null
  return { adresse: endpoint, p256dh: keys.p256dh, auth: keys.auth }
}

/** L'abonnement de ce navigateur, ou null. Ne lève jamais. */
export async function abonnementCourant(): Promise<AbonnementAEnvoyer | null> {
  if (!pushPrisEnCharge()) return null
  try {
    const enregistrement = await navigator.serviceWorker.getRegistration()
    const abonnement = await enregistrement?.pushManager.getSubscription()
    return abonnement ? versServeur(abonnement) : null
  } catch {
    return null
  }
}

/**
 * Demande l'autorisation, puis abonne ce navigateur. L'appel suit un appui de la
 * personne : un iPhone refuse toute demande faite sans geste. Rend null quand la
 * personne refuse.
 */
export async function abonner(cle: string): Promise<AbonnementAEnvoyer | null> {
  if ((await Notification.requestPermission()) !== 'granted') return null
  const enregistrement = await navigator.serviceWorker.ready
  let abonnement: PushSubscription
  try {
    abonnement =
      (await enregistrement.pushManager.getSubscription()) ??
      (await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleEnOctets(cle),
      }))
  } catch {
    // Le navigateur n'a pas joint son service de push : appareil hors ligne,
    // service bloqué par le réseau, ou simulateur sans service de push.
    throw new ErreurAbonnement()
  }
  const pourLeServeur = versServeur(abonnement)
  if (pourLeServeur === null) throw new ErreurAbonnement()
  return pourLeServeur
}

/** L'appareil a accordé l'autorisation, mais son navigateur n'a pas pu s'abonner. */
export class ErreurAbonnement extends Error {
  constructor() {
    super(
      'Votre appareil n’a pas pu s’abonner aux notifications. Vérifiez votre connexion, puis réessayez.'
    )
  }
}

/** Retire l'abonnement de ce navigateur et rend son adresse, pour le serveur. */
export async function desabonner(): Promise<string | null> {
  if (!pushPrisEnCharge()) return null
  try {
    const enregistrement = await navigator.serviceWorker.getRegistration()
    const abonnement = await enregistrement?.pushManager.getSubscription()
    if (!abonnement) return null
    const adresse = abonnement.endpoint
    await abonnement.unsubscribe()
    return adresse
  } catch {
    return null
  }
}

/** Pose le nombre de non-lus sur l'icône de l'application, là où le système le permet. */
export function poserPastille(nonLues: number): void {
  const n = navigator as Navigator & {
    setAppBadge?: (nombre?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (nonLues > 0) void n.setAppBadge?.(nonLues).catch(() => undefined)
  else void n.clearAppBadge?.().catch(() => undefined)
}
