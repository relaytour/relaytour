import { randomBytes } from 'node:crypto'

import { prisma, type ClientApplication } from '@relaytour/database'

import { env } from '../env.ts'
import { agentPublic } from '../espace-fichiers/reseau.ts'

// Clients des applications tierces (ADR 0067).
//
// Une application s'identifie d'abord par un document de métadonnées de client
// (CIMD) : son `client_id` est l'adresse https de ce document. L'installation le
// lit au moment de l'autorisation, sur une adresse publique seulement, sans suivre
// de redirection, en 5 secondes et 16 Ko au plus. La copie suit les en-têtes de
// cache, 24 heures au plus. L'enregistrement dynamique (RFC 7591), fermé par
// défaut, crée un client dont le nom n'est pas vérifié.

export const DELAI_CIMD_MS = 5_000
export const TAILLE_CIMD_MAX = 16 * 1024
export const CACHE_CIMD_MAX_S = 86_400
export const NOM_CLIENT_MAX = 80
export const ADRESSE_MAX = 512
export const ADRESSES_RETOUR_MAX = 10
const PREFIXE_DCR = 'dcr_'

export type RefusClient =
  /** Le client n'existe pas, ou son identifiant n'a pas la forme attendue. */
  | 'inconnu'
  /** Le document CIMD ne se lit pas : adresse privée, délai, redirection, statut. */
  | 'injoignable'
  /** Le document CIMD se lit mais ne décrit pas un client acceptable. */
  | 'invalide'

export type ResolutionClient =
  { issue: 'ok'; client: ClientApplication } | { issue: RefusClient }

/** Vrai pour une adresse de boucle locale, dont le port est libre (RFC 8252). */
function boucleLocale(u: URL): boolean {
  return (
    u.protocol === 'http:' &&
    (u.hostname === '127.0.0.1' || u.hostname === '[::1]')
  )
}

/** Une adresse de retour acceptable : https, ou http sur la boucle locale. */
export function adresseRetourAcceptable(adresse: string): boolean {
  if (adresse.length > ADRESSE_MAX) return false
  let u: URL
  try {
    u = new URL(adresse)
  } catch {
    return false
  }
  if (u.hash !== '' || adresse.includes('#')) return false
  if (u.username !== '' || u.password !== '') return false
  return u.protocol === 'https:' || boucleLocale(u)
}

/**
 * Vrai quand l'adresse demandée correspond à une adresse déclarée. La comparaison
 * est exacte, sauf le port d'une adresse de boucle locale.
 */
export function adresseRetourAdmise(
  declarees: readonly string[],
  demandee: string
): boolean {
  if (!adresseRetourAcceptable(demandee)) return false
  if (declarees.includes(demandee)) return true
  const d = new URL(demandee)
  if (!boucleLocale(d)) return false
  return declarees.some(brut => {
    let e: URL
    try {
      e = new URL(brut)
    } catch {
      return false
    }
    if (!boucleLocale(e) || e.hostname !== d.hostname) return false
    e.port = d.port
    return e.href === d.href
  })
}

/** Un identifiant CIMD : une adresse https avec un chemin, sans fragment. */
export function identifiantCimd(clientId: string): URL | null {
  if (clientId.length > ADRESSE_MAX) return null
  let u: URL
  try {
    u = new URL(clientId)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.hash !== '' || clientId.includes('#'))
    return null
  if (u.username !== '' || u.password !== '') return null
  if (u.pathname === '/' || /\/\.\.?(\/|$)/.test(u.pathname)) return null
  // L'adresse doit être écrite sous sa forme normalisée : le document la répète.
  return u.href === clientId ? u : null
}

/** Un nom lisible : 80 caractères au plus, sans retour à la ligne ni caractère de contrôle. */
export function nomClient(brut: unknown): string | null {
  if (typeof brut !== 'string') return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\u2028\u2029]/.test(brut)) return null
  const nom = brut.trim()
  return nom.length === 0 || nom.length > NOM_CLIENT_MAX ? null : nom
}

export interface DescriptionClient {
  nom: string
  redirectUris: string[]
}

/** La description d'un client, ou null si elle ne convient pas. */
export function decrireClient(
  doc: Record<string, unknown>
): DescriptionClient | null {
  const nom = nomClient(doc.client_name)
  const uris = doc.redirect_uris
  if (
    nom === null ||
    !Array.isArray(uris) ||
    uris.length === 0 ||
    uris.length > ADRESSES_RETOUR_MAX ||
    !uris.every(u => typeof u === 'string' && adresseRetourAcceptable(u))
  ) {
    return null
  }
  const methode = doc.token_endpoint_auth_method
  if (methode !== undefined && methode !== 'none') return null
  const types = doc.grant_types
  if (
    types !== undefined &&
    (!Array.isArray(types) ||
      !types.every(t => t === 'authorization_code' || t === 'refresh_token'))
  ) {
    return null
  }
  const reponses = doc.response_types
  if (
    reponses !== undefined &&
    (!Array.isArray(reponses) || !reponses.every(r => r === 'code'))
  ) {
    return null
  }
  return { nom, redirectUris: [...new Set(uris as string[])] }
}

/** La durée de la copie d'un document, d'après `Cache-Control`, bornée à 24 heures. */
export function dureeDeCache(cacheControl: string | null): number {
  if (cacheControl === null) return 0
  if (/\b(no-store|no-cache)\b/i.test(cacheControl)) return 0
  const age = /\bmax-age=(\d+)/i.exec(cacheControl)?.[1]
  if (age === undefined) return 0
  return Math.min(Number(age), CACHE_CIMD_MAX_S)
}

async function lireBorne(reponse: Response): Promise<string | null> {
  if (reponse.body === null) return ''
  const lecteur: ReadableStreamDefaultReader<Uint8Array> =
    reponse.body.getReader()
  const morceaux: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    total += value.length
    if (total > TAILLE_CIMD_MAX) {
      await lecteur.cancel().catch(() => undefined)
      return null
    }
    morceaux.push(value)
  }
  return Buffer.concat(morceaux).toString('utf8')
}

type LectureCimd =
  | { issue: 'ok'; description: DescriptionClient; cacheS: number }
  | { issue: 'injoignable' | 'invalide' }

/** Lit un document CIMD sur Internet, avec les bornes de l'ADR 0067. */
export async function lireDocumentCimd(adresse: string): Promise<LectureCimd> {
  let reponse: Response
  try {
    reponse = await fetch(adresse, {
      headers: { accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(DELAI_CIMD_MS),
      dispatcher: agentPublic,
    } as unknown as RequestInit)
  } catch {
    return { issue: 'injoignable' }
  }
  if (reponse.status !== 200) {
    await reponse.body?.cancel().catch(() => undefined)
    return { issue: 'injoignable' }
  }
  let texte: string | null
  try {
    texte = await lireBorne(reponse)
  } catch {
    return { issue: 'injoignable' }
  }
  if (texte === null) return { issue: 'invalide' }
  let doc: unknown
  try {
    doc = JSON.parse(texte)
  } catch {
    return { issue: 'invalide' }
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { issue: 'invalide' }
  }
  const objet = doc as Record<string, unknown>
  // Le document répète son adresse : un document copié ailleurs ne vaut rien.
  if (objet.client_id !== adresse) return { issue: 'invalide' }
  const description = decrireClient(objet)
  if (description === null) return { issue: 'invalide' }
  return {
    issue: 'ok',
    description,
    cacheS: dureeDeCache(reponse.headers.get('cache-control')),
  }
}

/** Le client d'un `client_id`, lu dans sa copie ou relu sur Internet. */
export async function resoudreClient(
  clientId: string,
  maintenant = new Date()
): Promise<ResolutionClient> {
  if (clientId.startsWith(PREFIXE_DCR)) {
    if (!env.APPLICATIONS_ENREGISTREMENT_DYNAMIQUE) return { issue: 'inconnu' }
    const client = await prisma.clientApplication.findUnique({
      where: { clientId },
    })
    return client === null || client.source !== 'DCR'
      ? { issue: 'inconnu' }
      : { issue: 'ok', client }
  }
  if (identifiantCimd(clientId) === null) return { issue: 'inconnu' }
  const copie = await prisma.clientApplication.findUnique({
    where: { clientId },
  })
  if (copie !== null && copie.valideJusquau.getTime() > maintenant.getTime()) {
    return { issue: 'ok', client: copie }
  }
  const lecture = await lireDocumentCimd(clientId)
  if (lecture.issue !== 'ok') return { issue: lecture.issue }
  const donnees = {
    nom: lecture.description.nom,
    redirectUris: lecture.description.redirectUris,
    valideJusquau: new Date(maintenant.getTime() + lecture.cacheS * 1000),
  }
  const client = await prisma.clientApplication.upsert({
    where: { clientId },
    create: { clientId, source: 'CIMD', ...donnees },
    update: donnees,
  })
  return { issue: 'ok', client }
}

/** Les adresses de retour d'un client, telles que la base les garde. */
export function adressesRetourDe(
  client: Pick<ClientApplication, 'redirectUris'>
) {
  return Array.isArray(client.redirectUris)
    ? (client.redirectUris as unknown[]).filter(
        (u): u is string => typeof u === 'string'
      )
    : []
}

/** Enregistre un client par DCR. Rend null si la description ne convient pas. */
export async function enregistrerClient(
  doc: Record<string, unknown>,
  maintenant = new Date()
): Promise<ClientApplication | null> {
  const description = decrireClient(doc)
  if (description === null) return null
  return prisma.clientApplication.create({
    data: {
      clientId: `${PREFIXE_DCR}${randomBytes(24).toString('base64url')}`,
      source: 'DCR',
      nom: description.nom,
      redirectUris: description.redirectUris,
      // Un client enregistré ne se relit pas : sa copie n'expire pas.
      valideJusquau: new Date(maintenant.getTime() + 100 * 365 * 86_400_000),
    },
  })
}
