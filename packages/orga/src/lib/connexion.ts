// Appels à Better Auth (/api/auth). Ils passent par fetch : l'interface n'a besoin que
// de quatre routes, sans la bibliothèque cliente.

const CLE_ADRESSE = 'relaytour.connexion.adresse'

export class ErreurConnexion extends Error {
  constructor(
    message: string,
    readonly code: string | undefined
  ) {
    super(message)
  }
}

const MESSAGES: Record<string, string> = {
  INVALID_OTP: 'Le code est incorrect.',
  OTP_EXPIRED: 'Le code a expiré. Demandez un nouveau code.',
  TOO_MANY_ATTEMPTS: 'Trop d’essais avec ce code. Demandez un nouveau code.',
}

async function appeler(chemin: string, corps: unknown): Promise<void> {
  const reponse = await fetch(`/api/auth${chemin}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  if (reponse.ok) return
  if (reponse.status === 429) {
    throw new ErreurConnexion(
      'Trop de demandes. Réessayez dans quelques minutes.',
      'TOO_MANY_REQUESTS'
    )
  }
  const detail = (await reponse.json().catch(() => ({}))) as { code?: string }
  throw new ErreurConnexion(
    MESSAGES[detail.code ?? ''] ?? 'La connexion a échoué. Réessayez.',
    detail.code
  )
}

export async function demanderCode(adresse: string): Promise<void> {
  const email = adresse.trim().toLowerCase()
  // L'adresse reste dans l'onglet, pour que le lien reçu par mail suffise à se connecter.
  sessionStorage.setItem(CLE_ADRESSE, email)
  await appeler('/email-otp/send-verification-otp', { email, type: 'sign-in' })
}

export async function seConnecter(
  adresse: string,
  code: string
): Promise<void> {
  await appeler('/sign-in/email-otp', {
    email: adresse.trim().toLowerCase(),
    otp: code.trim(),
  })
  sessionStorage.removeItem(CLE_ADRESSE)
}

export async function seDeconnecter(): Promise<void> {
  await appeler('/sign-out', {})
}

export function adresseMemorisee(): string {
  return sessionStorage.getItem(CLE_ADRESSE) ?? ''
}

export interface LienConnexion {
  code: string
  /** L'adresse du compte, quand le lien vient du mail de code. */
  adresse: string | null
}

/**
 * Lit le code et l'adresse placés après « # » dans le lien du mail, puis les efface
 * de la barre d'adresse. Le fragment n'atteint jamais le serveur.
 */
export function lireLienConnexion(): LienConnexion | null {
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  const code = fragment.get('code')
  const adresse = fragment.get('adresse')?.trim().toLowerCase() ?? null
  if (code !== null) {
    history.replaceState(null, '', window.location.pathname)
  }
  if (code === null || !/^\d{6}$/.test(code)) return null
  return { code, adresse: adresse && adresse.includes('@') ? adresse : null }
}
