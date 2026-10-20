import { createSign, randomBytes } from 'node:crypto'

import { appelSortant, type HotesAdmis } from './sortant.ts'
import {
  AccesRetire,
  FournisseurIndisponible,
  type ElementEspace,
  type Emplacement,
  type EspaceFichiers,
  type ListeElements,
  type Position,
} from './types.ts'

// Google Drive par l'API Drive v3 (ADR 0038). Deux modes de connexion :
// - un admin de l'organisation se connecte avec son compte (OAuth délégué) ;
// - l'organisation dépose la clé d'un compte de service et partage ses dossiers
//   avec lui ; Relaytour signe alors lui-même ses demandes de jeton.
// Drive n'adresse pas un élément par son chemin : Relaytour descend de la base,
// nom par nom.

export interface ConfigurationGoogle {
  clientId: string
  clientSecret: string
  /** Adresse de retour inscrite dans le projet Google Cloud. */
  retour: string
}

export const HOTES_GOOGLE: HotesAdmis = {
  exacts: [
    'www.googleapis.com',
    'oauth2.googleapis.com',
    'accounts.google.com',
  ],
  suffixes: [],
}

const PORTEE = 'https://www.googleapis.com/auth/drive'
const ADRESSE_JETON = 'https://oauth2.googleapis.com/token'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const ENVOI = 'https://www.googleapis.com/upload/drive/v3'
const DOSSIER = 'application/vnd.google-apps.folder'
const CHAMPS =
  'id,name,mimeType,size,modifiedTime,webViewLink,version,parents,driveId'
const TOUS = 'supportsAllDrives=true&includeItemsFromAllDrives=true'
const DELAI_MS = 15_000
const DELAI_CONTENU_MS = 120_000
const PAGES_MAX = 5

/** Emplacements qui ne sont pas des Drive partagés. */
export const MON_DRIVE = 'mon-drive'
export const PARTAGES = 'partages'

/** Documents Google natifs : ils s'exportent en PDF, en bureautique ou en Markdown. */
const NATIFS: Record<string, { bureautique: string; pdf: boolean }> = {
  'application/vnd.google-apps.document': {
    bureautique:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: true,
  },
  'application/vnd.google-apps.spreadsheet': {
    bureautique:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: true,
  },
  'application/vnd.google-apps.presentation': {
    bureautique:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: true,
  },
  'application/vnd.google-apps.drawing': {
    bureautique: 'application/pdf',
    pdf: true,
  },
}

export const DOCUMENT_GOOGLE = 'application/vnd.google-apps.document'

/** Vrai pour un document Google natif, que Drive sait rendre en PDF. */
export function convertibleParGoogle(
  _nom: string,
  typeMime?: string | null
): boolean {
  return typeMime != null && NATIFS[typeMime]?.pdf === true
}

// ── Connexion par le compte de l'admin ───────────────────────────────────────

export interface Jetons {
  acces: string
  rafraichissement: string
  expireLe: number
}

export function adresseAutorisationGoogle(
  c: ConfigurationGoogle,
  etat: string,
  defi: string
): string {
  const parametres = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.retour,
    response_type: 'code',
    scope: PORTEE,
    // Un jeton de rafraîchissement n'arrive qu'avec un accès hors ligne et un
    // consentement demandé à chaque connexion.
    access_type: 'offline',
    prompt: 'consent select_account',
    state: etat,
    code_challenge: defi,
    code_challenge_method: 'S256',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${parametres.toString()}`
}

async function demanderJeton(
  corps: Record<string, string>
): Promise<{ acces: string; rafraichissement?: string; expireLe: number }> {
  const reponse = await appelSortant(
    ADRESSE_JETON,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(corps).toString(),
      delaiMs: DELAI_MS,
    },
    HOTES_GOOGLE
  )
  const donnees = (await reponse.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }
  if (
    donnees.error === 'invalid_grant' ||
    donnees.error === 'unauthorized_client'
  ) {
    throw new AccesRetire('Google refuse l’accès.')
  }
  if (!reponse.ok || donnees.access_token === undefined) {
    throw new FournisseurIndisponible(
      `Google refuse la demande de jeton (${reponse.status}${donnees.error ? `, ${donnees.error}` : ''}).`
    )
  }
  return {
    acces: donnees.access_token,
    rafraichissement: donnees.refresh_token,
    expireLe: Date.now() + (donnees.expires_in ?? 3600) * 1000,
  }
}

export async function echangerCodeGoogle(
  c: ConfigurationGoogle,
  code: string,
  verificateur: string
): Promise<Jetons> {
  const jetons = await demanderJeton({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: 'authorization_code',
    code,
    code_verifier: verificateur,
    redirect_uri: c.retour,
  })
  if (jetons.rafraichissement === undefined) {
    throw new FournisseurIndisponible(
      'Google n’a pas donné de jeton de rafraîchissement.'
    )
  }
  return { ...jetons, rafraichissement: jetons.rafraichissement }
}

/** Google ne fait pas tourner le jeton de rafraîchissement : l'ancien reste valable. */
export async function rafraichirGoogle(
  c: ConfigurationGoogle,
  rafraichissement: string
): Promise<Jetons> {
  const jetons = await demanderJeton({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: rafraichissement,
  })
  return {
    ...jetons,
    rafraichissement: jetons.rafraichissement ?? rafraichissement,
  }
}

// ── Connexion par un compte de service ───────────────────────────────────────

export interface CleCompteService {
  client_email: string
  private_key: string
}

/**
 * La clé JSON d'un compte de service Google, réduite à ce que Relaytour garde.
 * Lève une erreur lisible pour une clé qui ne convient pas.
 */
export function lireCleCompteService(texte: string): CleCompteService {
  let lu: unknown
  try {
    lu = JSON.parse(texte)
  } catch {
    throw new Error('La clé n’est pas un fichier JSON.')
  }
  const cle = lu as Partial<Record<string, unknown>>
  if (cle.type !== 'service_account')
    throw new Error('La clé n’est pas celle d’un compte de service.')
  if (
    typeof cle.client_email !== 'string' ||
    !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(cle.client_email)
  )
    throw new Error('La clé ne donne pas l’adresse du compte de service.')
  if (
    typeof cle.private_key !== 'string' ||
    !cle.private_key.includes('PRIVATE KEY')
  )
    throw new Error('La clé ne contient pas de clé privée.')
  if (cle.token_uri !== undefined && cle.token_uri !== ADRESSE_JETON)
    throw new Error('La clé désigne un autre service de jetons que Google.')
  return { client_email: cle.client_email, private_key: cle.private_key }
}

const base64url = (texte: string | Buffer) =>
  Buffer.from(texte).toString('base64url')

/** L'assertion signée qu'un compte de service échange contre un jeton d'accès. */
export function assertionCompteService(
  cle: CleCompteService,
  maintenant = Math.floor(Date.now() / 1000)
): string {
  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const contenu = base64url(
    JSON.stringify({
      iss: cle.client_email,
      scope: PORTEE,
      aud: ADRESSE_JETON,
      iat: maintenant,
      exp: maintenant + 3600,
      jti: randomBytes(8).toString('hex'),
    })
  )
  const signature = createSign('RSA-SHA256')
    .update(`${entete}.${contenu}`)
    .sign(cle.private_key)
  return `${entete}.${contenu}.${base64url(signature)}`
}

export async function jetonCompteService(
  cle: CleCompteService
): Promise<{ acces: string; expireLe: number }> {
  return demanderJeton({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: assertionCompteService(cle),
  })
}

// ── Lecture et écriture ──────────────────────────────────────────────────────

type Jeton = (forcer?: boolean) => Promise<string>

async function drive(
  adresse: string,
  jeton: Jeton,
  requete: {
    method?: string
    body?: string | Buffer
    type?: string
    delaiMs?: number
  } = {}
): Promise<Response> {
  for (const forcer of [false, true]) {
    const reponse = await appelSortant(
      adresse,
      {
        method: requete.method ?? 'GET',
        body: requete.body,
        headers: {
          authorization: `Bearer ${await jeton(forcer)}`,
          ...(requete.type === undefined
            ? {}
            : { 'content-type': requete.type }),
        },
        delaiMs: requete.delaiMs ?? DELAI_MS,
      },
      HOTES_GOOGLE
    )
    if (reponse.status !== 401) return reponse
    await reponse.body?.cancel()
  }
  throw new AccesRetire('Google refuse le jeton d’accès.')
}

async function lireJson<T>(adresse: string, jeton: Jeton): Promise<T | null> {
  const reponse = await drive(adresse, jeton)
  if (reponse.status === 404) {
    await reponse.body?.cancel()
    return null
  }
  if (!reponse.ok) {
    await reponse.body?.cancel()
    throw new FournisseurIndisponible(`Google Drive répond ${reponse.status}.`)
  }
  return (await reponse.json()) as T
}

async function ecritureJson<T>(reponse: Response, quoi: string): Promise<T> {
  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => '')
    throw new FournisseurIndisponible(
      /storageQuotaExceeded/.test(corps)
        ? 'Un compte de service n’écrit que dans un Drive partagé.'
        : `Google Drive refuse ${quoi} (${reponse.status}).`
    )
  }
  return (await reponse.json()) as T
}

interface FichierDrive {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
  version?: string
  parents?: string[]
}

function versElement(f: FichierDrive): ElementEspace {
  const taille = Number(f.size)
  return {
    id: f.id,
    nom: f.name,
    dossier: f.mimeType === DOSSIER,
    taille: Number.isFinite(taille) && f.size !== undefined ? taille : null,
    modifieLe: f.modifiedTime === undefined ? null : new Date(f.modifiedTime),
    typeMime: f.mimeType,
    lienWeb: f.webViewLink ?? null,
    etag: f.version ?? null,
  }
}

/** Une chaîne dans une requête de Drive : l'antislash et l'apostrophe s'échappent. */
export function litteral(texte: string): string {
  return `'${texte.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** Le dossier parent d'une requête, ou la vue des éléments partagés. */
function dansDossier(parent: string): string {
  return parent === PARTAGES
    ? 'sharedWithMe = true'
    : `${litteral(parent)} in parents`
}

export function espaceGoogleDrive(
  jeton: Jeton,
  options: { compteService: boolean }
): EspaceFichiers {
  const corpora = (emplacement: string) =>
    emplacement === MON_DRIVE || emplacement === PARTAGES
      ? `corpora=user&${TOUS}`
      : `corpora=drive&driveId=${encodeURIComponent(emplacement)}&${TOUS}`

  const racine = (emplacement: string) =>
    emplacement === MON_DRIVE ? 'root' : emplacement

  /** Les enfants d'un dossier, page par page, jusqu'à la borne. */
  async function enfants(
    emplacement: string,
    parent: string,
    filtre = ''
  ): Promise<{ fichiers: FichierDrive[]; complet: boolean }> {
    const q = encodeURIComponent(
      `${dansDossier(parent)} and trashed = false${filtre}`
    )
    const fichiers: FichierDrive[] = []
    let jetonPage: string | undefined
    for (let page = 0; page < PAGES_MAX; page++) {
      const reponse: {
        files: FichierDrive[]
        nextPageToken?: string
      } | null = await lireJson(
        `${DRIVE}/files?q=${q}&${corpora(emplacement)}&pageSize=1000&orderBy=folder,name&fields=nextPageToken,files(${CHAMPS})${jetonPage === undefined ? '' : `&pageToken=${encodeURIComponent(jetonPage)}`}`,
        jeton
      )
      if (reponse === null) return { fichiers, complet: page > 0 }
      fichiers.push(...reponse.files)
      jetonPage = reponse.nextPageToken
      if (jetonPage === undefined) return { fichiers, complet: true }
    }
    return { fichiers, complet: false }
  }

  async function fichier(id: string): Promise<FichierDrive | null> {
    return lireJson<FichierDrive>(
      `${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=${CHAMPS}`,
      jeton
    )
  }

  /** L'élément de base d'une position : la racine de l'emplacement, ou un dossier connu. */
  async function base(p: Position): Promise<FichierDrive | null> {
    if (p.base === null && p.emplacement === PARTAGES) {
      return { id: PARTAGES, name: 'Partagés avec moi', mimeType: DOSSIER }
    }
    if (p.base === null && p.emplacement !== MON_DRIVE) {
      const d = await lireJson<{ id: string; name: string }>(
        `${DRIVE}/drives/${encodeURIComponent(p.emplacement)}?fields=id,name`,
        jeton
      )
      return d === null ? null : { id: d.id, name: d.name, mimeType: DOSSIER }
    }
    return fichier(p.base ?? racine(p.emplacement))
  }

  /** L'élément à cette position : la base, puis un enfant par nom. */
  async function resoudre(p: Position): Promise<FichierDrive | null> {
    let courant = await base(p)
    for (const nom of p.chemin) {
      if (courant === null || courant.mimeType !== DOSSIER) return null
      const { fichiers } = await enfants(
        p.emplacement,
        courant.id,
        ` and name = ${litteral(nom)}`
      )
      // Drive admet deux éléments du même nom : le premier, par ordre de Drive.
      courant = fichiers[0] ?? null
    }
    return courant
  }

  async function exiger(p: Position): Promise<FichierDrive> {
    const f = await resoudre(p)
    if (f === null) throw new FournisseurIndisponible('Élément introuvable.')
    return f
  }

  async function contenu(
    f: FichierDrive,
    typeExport: string | null
  ): Promise<{ flux: ReadableStream<Uint8Array>; taille: number | null }> {
    const adresse =
      typeExport === null
        ? `${DRIVE}/files/${encodeURIComponent(f.id)}?alt=media&supportsAllDrives=true`
        : `${DRIVE}/files/${encodeURIComponent(f.id)}/export?mimeType=${encodeURIComponent(typeExport)}`
    const reponse = await drive(adresse, jeton, { delaiMs: DELAI_CONTENU_MS })
    if (!reponse.ok || reponse.body === null) {
      await reponse.body?.cancel()
      throw new FournisseurIndisponible(
        `Google Drive répond ${reponse.status} pour le contenu.`
      )
    }
    const taille = Number(reponse.headers.get('content-length'))
    return {
      flux: reponse.body,
      taille: Number.isFinite(taille) && taille > 0 ? taille : null,
    }
  }

  return {
    fournisseur: 'GOOGLE_DRIVE',
    convertitEnPdf: convertibleParGoogle,

    async emplacements(): Promise<Emplacement[]> {
      const liste: Emplacement[] = []
      // Un compte de service n'a pas de Drive à lui : il lit ce qu'on lui partage.
      if (!options.compteService) {
        liste.push({ id: MON_DRIVE, nom: 'Mon Drive', site: null })
      }
      liste.push({ id: PARTAGES, nom: 'Partagés avec moi', site: null })
      let jetonPage: string | undefined
      for (let page = 0; page < PAGES_MAX; page++) {
        const reponse: {
          drives: { id: string; name: string }[]
          nextPageToken?: string
        } | null = await lireJson(
          `${DRIVE}/drives?pageSize=100&fields=nextPageToken,drives(id,name)${jetonPage === undefined ? '' : `&pageToken=${encodeURIComponent(jetonPage)}`}`,
          jeton
        )
        for (const d of reponse?.drives ?? []) {
          liste.push({ id: d.id, nom: d.name, site: 'Drive partagé' })
        }
        jetonPage = reponse?.nextPageToken
        if (jetonPage === undefined) break
      }
      return liste
    },

    async ancetres(emplacement, element) {
      const chaine: { id: string; nom: string }[] = []
      let courant: string | undefined = element
      for (let i = 0; courant !== undefined && i < 40; i++) {
        const f = await fichier(courant)
        if (f === null) break
        chaine.push({ id: f.id, nom: f.name })
        courant = f.parents?.[0]
      }
      if (chaine.length === 0) return null
      // Un élément partagé remonte jusqu'à un dossier que le compte ne voit pas :
      // la vue « Partagés avec moi » le coiffe.
      if (emplacement === PARTAGES) {
        chaine.push({ id: PARTAGES, nom: 'Partagés avec moi' })
      }
      return chaine
    },

    async element(p) {
      const f = await resoudre(p)
      return f === null ? null : versElement(f)
    },

    async lister(p): Promise<ListeElements | null> {
      const dossier = await resoudre(p)
      if (dossier === null || dossier.mimeType !== DOSSIER) return null
      const { fichiers, complet } = await enfants(p.emplacement, dossier.id)
      return {
        // Un raccourci Drive ne s'ouvre pas dans Relaytour.
        elements: fichiers
          .filter(f => f.mimeType !== 'application/vnd.google-apps.shortcut')
          .map(versElement),
        complet,
      }
    },

    async ouvrir(p, { pdf }) {
      const f = await exiger(p)
      const natif = NATIFS[f.mimeType]
      if (natif !== undefined) {
        return contenu(f, pdf ? 'application/pdf' : natif.bureautique)
      }
      return contenu(f, null)
    },

    async lireMarkdown(p) {
      const f = await exiger(p)
      if (f.mimeType !== DOCUMENT_GOOGLE)
        throw new FournisseurIndisponible(
          'Ce fichier n’est pas un document Google.'
        )
      const { flux } = await contenu(f, 'text/markdown')
      return new Response(flux).text()
    },

    async creerDossier(parent, nom, { renommer }) {
      const dossier = await exiger(parent)
      if (dossier.id === PARTAGES) {
        throw new FournisseurIndisponible(
          'Choisissez un dossier : la vue des éléments partagés ne reçoit rien.'
        )
      }
      const { fichiers } = await enfants(parent.emplacement, dossier.id)
      const pris = new Set(fichiers.map(f => f.name))
      if (pris.has(nom) && !renommer) {
        return versElement(fichiers.find(f => f.name === nom)!)
      }
      let libre = nom
      for (let n = 1; pris.has(libre); n++) libre = `${nom} ${n}`
      const reponse = await drive(
        `${DRIVE}/files?supportsAllDrives=true&fields=${CHAMPS}`,
        jeton,
        {
          method: 'POST',
          type: 'application/json',
          body: JSON.stringify({
            name: libre,
            mimeType: DOSSIER,
            parents: [dossier.id],
          }),
        }
      )
      return versElement(
        await ecritureJson<FichierDrive>(reponse, 'la création du dossier')
      )
    },

    async ecrire(p, texte) {
      const nom = p.chemin[p.chemin.length - 1]
      if (nom === undefined) throw new FournisseurIndisponible('Nom manquant.')
      const dossier = await exiger({ ...p, chemin: p.chemin.slice(0, -1) })
      const existant = (
        await enfants(p.emplacement, dossier.id, ` and name = ${litteral(nom)}`)
      ).fichiers[0]
      if (existant !== undefined) {
        const reponse = await drive(
          `${ENVOI}/files/${encodeURIComponent(existant.id)}?uploadType=media&supportsAllDrives=true&fields=version`,
          jeton,
          {
            method: 'PATCH',
            type: 'text/markdown; charset=utf-8',
            body: texte,
          }
        )
        const f = await ecritureJson<{ version?: string }>(
          reponse,
          'l’écriture'
        )
        return { etag: f.version ?? null }
      }
      const frontiere = `relaytour-${randomBytes(12).toString('hex')}`
      const corps = Buffer.concat([
        Buffer.from(
          `--${frontiere}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nom, parents: [dossier.id] })}\r\n--${frontiere}\r\ncontent-type: text/markdown; charset=UTF-8\r\n\r\n`
        ),
        Buffer.from(texte),
        Buffer.from(`\r\n--${frontiere}--`),
      ])
      const reponse = await drive(
        `${ENVOI}/files?uploadType=multipart&supportsAllDrives=true&fields=version`,
        jeton,
        {
          method: 'POST',
          type: `multipart/related; boundary=${frontiere}`,
          body: corps,
        }
      )
      const f = await ecritureJson<{ version?: string }>(reponse, 'l’écriture')
      return { etag: f.version ?? null }
    },

    async supprimer(p) {
      const f = await resoudre(p)
      if (f === null) return
      // Une suppression passe par la corbeille de Drive : elle se rattrape.
      const reponse = await drive(
        `${DRIVE}/files/${encodeURIComponent(f.id)}?supportsAllDrives=true`,
        jeton,
        {
          method: 'PATCH',
          type: 'application/json',
          body: JSON.stringify({ trashed: true }),
        }
      )
      await reponse.body?.cancel()
      if (!reponse.ok && reponse.status !== 404) {
        throw new FournisseurIndisponible(
          `Google Drive refuse la suppression (${reponse.status}).`
        )
      }
    },
  }
}

/** Le nom affiché du compte connecté, jamais son adresse. */
export async function nomDuCompteGoogle(acces: string): Promise<string> {
  const reponse = await lireJson<{ user?: { displayName?: string } }>(
    `${DRIVE}/about?fields=user(displayName)`,
    () => Promise.resolve(acces)
  )
  return (reponse?.user?.displayName?.trim() || 'Compte Google').slice(0, 255)
}
