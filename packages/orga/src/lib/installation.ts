/**
 * Vrai dans l'application installée (ADR 0023) : l'espace organisateur s'affiche
 * sans barre d'adresse. Safari sur iPhone l'annonce par `navigator.standalone`.
 */
export function estInstallee(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Le téléphone ou l'ordinateur de la personne, pour choisir les étapes d'installation. */
export type Appareil = 'iphone' | 'android' | 'ordinateur'

/**
 * Déduit l'appareil de l'agent de navigation. Un iPad récent se présente comme
 * un Mac : l'écran tactile le distingue.
 */
export function appareil(
  agent: string = navigator.userAgent,
  pointsTactiles: number = navigator.maxTouchPoints
): Appareil {
  if (/iPhone|iPad|iPod/.test(agent)) return 'iphone'
  if (/Macintosh/.test(agent) && pointsTactiles > 1) return 'iphone'
  if (/Android/.test(agent)) return 'android'
  return 'ordinateur'
}

// Chrome et les navigateurs voisins annoncent qu'ils peuvent installer
// l'application par l'événement `beforeinstallprompt`. L'espace organisateur le
// retient, et le déclenche quand la personne appuie sur « Installer ».
interface InviteInstallation extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let invite: InviteInstallation | null = null
const abonnes = new Set<() => void>()

function retenir(evenement: InviteInstallation | null) {
  invite = evenement
  for (const prevenir of abonnes) prevenir()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', evenement => {
    // Sans cela, Chrome affiche sa propre bannière au premier passage.
    evenement.preventDefault()
    retenir(evenement as InviteInstallation)
  })
  window.addEventListener('appinstalled', () => retenir(null))
}

export function abonnerInvite(prevenir: () => void): () => void {
  abonnes.add(prevenir)
  return () => abonnes.delete(prevenir)
}

/** Vrai quand le navigateur peut installer l'application sur un appui. */
export function inviteDisponible(): boolean {
  return invite !== null
}

/** Ouvre la fenêtre d'installation du navigateur. Vrai si la personne accepte. */
export async function installer(): Promise<boolean> {
  if (invite === null) return false
  const { outcome } = await invite.prompt()
  // Une invite ne sert qu'une fois.
  retenir(null)
  return outcome === 'accepted'
}

/**
 * Adresse du guide d'installation, à côté de la liste des modes d'emploi. La
 * liste peut être un dossier, avec ou sans barre finale, ou une page.
 */
export function lienGuideInstallation(modesDEmploi: string): string {
  const liste = new URL(modesDEmploi)
  liste.search = ''
  liste.hash = ''
  const dernier = liste.pathname.split('/').at(-1) ?? ''
  if (dernier !== '' && !dernier.includes('.')) liste.pathname += '/'
  return new URL('installer.html', liste).toString()
}
