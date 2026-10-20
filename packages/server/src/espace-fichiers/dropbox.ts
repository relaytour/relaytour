import { appelSortant, type HotesAdmis } from './sortant.ts'
import {
  AccesRetire,
  FournisseurIndisponible,
  type ElementEspace,
  type Emplacement,
  type EspaceFichiers,
  type Jeton,
  type ListeElements,
  type Position,
} from './types.ts'

// Dropbox par son API v2 (ADR 0038). Un admin de l'organisation se connecte avec
// son compte (OAuth avec PKCE, accès hors ligne). Dropbox adresse un élément par
// son chemin, ou par un chemin relatif à son identifiant (« id:…/sous/dossier »)
// pour la lecture. L'écriture veut un chemin complet : Relaytour le reconstitue.
// L'espace d'équipe de Dropbox Business se lit par l'en-tête
// `Dropbox-API-Path-Root`. Il contient le dossier du membre : un compte d'équipe
// se parcourt donc depuis cet espace seulement, pour qu'un dossier n'ait qu'une
// adresse et qu'un dossier lié ne puisse pas contenir le dossier d'export sous
// une autre vue.

export interface ConfigurationDropbox {
  clientId: string
  clientSecret: string
  /** Adresse de retour inscrite dans l'application Dropbox. */
  retour: string
}

export const HOTES_DROPBOX: HotesAdmis = {
  exacts: ['api.dropboxapi.com', 'content.dropboxapi.com'],
  suffixes: [],
}

const PORTEES =
  'account_info.read files.metadata.read files.content.read files.content.write'
const API = 'https://api.dropboxapi.com/2'
const CONTENU = 'https://content.dropboxapi.com/2'
const ADRESSE_JETON = 'https://api.dropboxapi.com/oauth2/token'
const DELAI_MS = 15_000
const DELAI_CONTENU_MS = 120_000
const PAGES_MAX = 5

/** Le Dropbox du compte connecté, et la racine d'un espace d'équipe. */
export const MON_DROPBOX = 'dropbox'
const RACINE = 'racine'
const prefixeEquipe = 'equipe:'

/** Formats dont Dropbox fabrique un aperçu PDF. Un tableur reçoit un aperçu HTML, que Relaytour ne sert pas. */
const CONVERTIBLES = new Set([
  'doc',
  'docx',
  'docm',
  'odt',
  'odp',
  'rtf',
  'ppt',
  'pptx',
  'pptm',
  'pps',
  'ppsx',
  'ppsm',
])

export function convertibleParDropbox(nom: string): boolean {
  const point = nom.lastIndexOf('.')
  return point > 0 && CONVERTIBLES.has(nom.slice(point + 1).toLowerCase())
}

// ── Connexion ────────────────────────────────────────────────────────────────

export interface Jetons {
  acces: string
  rafraichissement: string
  expireLe: number
}

export function adresseAutorisationDropbox(
  c: ConfigurationDropbox,
  etat: string,
  defi: string
): string {
  const parametres = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: c.retour,
    state: etat,
    token_access_type: 'offline',
    scope: PORTEES,
    code_challenge: defi,
    code_challenge_method: 'S256',
  })
  return `https://www.dropbox.com/oauth2/authorize?${parametres.toString()}`
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
    HOTES_DROPBOX
  )
  const donnees = (await reponse.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }
  if (donnees.error === 'invalid_grant') {
    throw new AccesRetire('Dropbox refuse le jeton de rafraîchissement.')
  }
  if (!reponse.ok || donnees.access_token === undefined) {
    throw new FournisseurIndisponible(
      `Dropbox refuse la demande de jeton (${reponse.status}${donnees.error ? `, ${donnees.error}` : ''}).`
    )
  }
  return {
    acces: donnees.access_token,
    rafraichissement: donnees.refresh_token,
    expireLe: Date.now() + (donnees.expires_in ?? 14_400) * 1000,
  }
}

export async function echangerCodeDropbox(
  c: ConfigurationDropbox,
  code: string,
  verificateur: string
): Promise<Jetons> {
  const jetons = await demanderJeton({
    grant_type: 'authorization_code',
    code,
    redirect_uri: c.retour,
    code_verifier: verificateur,
    client_id: c.clientId,
    client_secret: c.clientSecret,
  })
  if (jetons.rafraichissement === undefined) {
    throw new FournisseurIndisponible(
      'Dropbox n’a pas donné de jeton de rafraîchissement.'
    )
  }
  return { ...jetons, rafraichissement: jetons.rafraichissement }
}

/** Dropbox ne fait pas tourner le jeton de rafraîchissement : l'ancien reste valable. */
export async function rafraichirDropbox(
  c: ConfigurationDropbox,
  rafraichissement: string
): Promise<Jetons> {
  const jetons = await demanderJeton({
    grant_type: 'refresh_token',
    refresh_token: rafraichissement,
    client_id: c.clientId,
    client_secret: c.clientSecret,
  })
  return {
    ...jetons,
    rafraichissement: jetons.rafraichissement ?? rafraichissement,
  }
}

// ── Lecture et écriture ──────────────────────────────────────────────────────

/** L'argument JSON d'un en-tête Dropbox : les caractères hors ASCII s'échappent. */
export function argumentEnTete(valeur: unknown): string {
  return JSON.stringify(valeur).replace(
    /[\u007f-￿]/g,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

function racineEnTete(emplacement: string): Record<string, string> {
  return emplacement.startsWith(prefixeEquipe)
    ? {
        'Dropbox-API-Path-Root': argumentEnTete({
          '.tag': 'root',
          root: emplacement.slice(prefixeEquipe.length),
        }),
      }
    : {}
}

async function appel(
  adresse: string,
  jeton: Jeton,
  requete: {
    emplacement: string
    corps?: string
    arg?: unknown
    type?: string
    delaiMs?: number
  }
): Promise<Response> {
  for (const forcer of [false, true]) {
    const reponse = await appelSortant(
      adresse,
      {
        method: 'POST',
        body: requete.corps,
        headers: {
          authorization: `Bearer ${await jeton(forcer)}`,
          ...racineEnTete(requete.emplacement),
          ...(requete.type === undefined
            ? {}
            : { 'content-type': requete.type }),
          ...(requete.arg === undefined
            ? {}
            : { 'Dropbox-API-Arg': argumentEnTete(requete.arg) }),
        },
        delaiMs: requete.delaiMs ?? DELAI_MS,
      },
      HOTES_DROPBOX
    )
    if (reponse.status !== 401) return reponse
    await reponse.body?.cancel()
  }
  throw new AccesRetire('Dropbox refuse le jeton d’accès.')
}

/** Un appel RPC de Dropbox. Null pour un chemin absent ; lève pour toute autre erreur. */
async function rpc<T>(
  route: string,
  args: unknown,
  jeton: Jeton,
  emplacement: string
): Promise<T | null> {
  const reponse = await appel(`${API}/${route}`, jeton, {
    emplacement,
    corps: JSON.stringify(args),
    type: 'application/json',
  })
  if (reponse.status === 409) {
    const erreur = (await reponse.json().catch(() => ({}))) as {
      error_summary?: string
    }
    if (/not_found/.test(erreur.error_summary ?? '')) return null
    throw new FournisseurIndisponible(
      `Dropbox refuse ${route} (${erreur.error_summary ?? 'conflit'}).`
    )
  }
  if (!reponse.ok) {
    await reponse.body?.cancel()
    throw new FournisseurIndisponible(`Dropbox répond ${reponse.status}.`)
  }
  return (await reponse.json()) as T
}

interface MetaDropbox {
  '.tag': 'file' | 'folder' | 'deleted'
  id: string
  name: string
  path_lower?: string
  path_display?: string
  size?: number
  server_modified?: string
  rev?: string
}

interface PageDropbox {
  entries: MetaDropbox[]
  cursor: string
  has_more: boolean
}

/** Un chemin Dropbox dans une adresse web : chaque nom s'encode, « # » compris. */
const versAdresse = (chemin: string) =>
  chemin.split('/').map(encodeURIComponent).join('/')

function versElement(m: MetaDropbox): ElementEspace {
  const chemin = m.path_display ?? ''
  const dossier = m['.tag'] === 'folder'
  const parent = chemin.slice(0, chemin.lastIndexOf('/'))
  return {
    id: m.id,
    nom: m.name,
    dossier,
    taille: m.size ?? null,
    modifieLe:
      m.server_modified === undefined ? null : new Date(m.server_modified),
    typeMime: null,
    lienWeb:
      chemin === ''
        ? null
        : dossier
          ? `https://www.dropbox.com/home${versAdresse(chemin)}`
          : `https://www.dropbox.com/home${versAdresse(parent)}?preview=${encodeURIComponent(m.name)}`,
    etag: m.rev ?? null,
  }
}

/** Le chemin de lecture d'une position : relatif à l'identifiant de la base. */
export function cheminDeLecture(p: Position): string {
  const relatif = p.chemin.map(n => `/${n}`).join('')
  return p.base === null || p.base === RACINE ? relatif : `${p.base}${relatif}`
}

export function espaceDropbox(jeton: Jeton): EspaceFichiers {
  const meta = (chemin: string, emplacement: string) =>
    rpc<MetaDropbox>('files/get_metadata', { path: chemin }, jeton, emplacement)

  /** Le chemin complet d'une position, pour une écriture. */
  async function cheminComplet(p: Position): Promise<string> {
    const relatif = p.chemin.map(n => `/${n}`).join('')
    if (p.base === null || p.base === RACINE) return relatif
    const base = await meta(p.base, p.emplacement)
    if (base?.path_lower === undefined)
      throw new FournisseurIndisponible('Dossier introuvable.')
    return `${base.path_lower}${relatif}`
  }

  const racineVirtuelle = (emplacement: string): ElementEspace => ({
    id: RACINE,
    nom: emplacement === MON_DROPBOX ? 'Mon Dropbox' : 'Espace d’équipe',
    dossier: true,
    taille: null,
    modifieLe: null,
    typeMime: null,
    lienWeb: 'https://www.dropbox.com/home',
    etag: null,
  })

  return {
    fournisseur: 'DROPBOX',
    convertitEnPdf: convertibleParDropbox,

    async emplacements(): Promise<Emplacement[]> {
      const compte = await rpc<{
        root_info?: {
          '.tag'?: string
          root_namespace_id?: string
          home_namespace_id?: string
        }
      }>('users/get_current_account', null, jeton, MON_DROPBOX)
      const racine = compte?.root_info
      if (
        racine?.root_namespace_id !== undefined &&
        racine.root_namespace_id !== racine.home_namespace_id
      ) {
        return [
          {
            id: `${prefixeEquipe}${racine.root_namespace_id}`,
            nom: 'Espace d’équipe',
            site: 'Dropbox Business',
          },
        ]
      }
      return [{ id: MON_DROPBOX, nom: 'Mon Dropbox', site: null }]
    },

    async ancetres(emplacement, element) {
      if (element === RACINE) return [{ id: RACINE, nom: 'Dropbox' }]
      const depart = await meta(element, emplacement)
      if (depart?.path_display === undefined) return null
      const segments = depart.path_display.split('/').filter(Boolean)
      const chaine: { id: string; nom: string }[] = [
        { id: depart.id, nom: depart.name },
      ]
      for (let i = segments.length - 1; i >= 1; i--) {
        const parent = await meta(
          `/${segments.slice(0, i).join('/')}`,
          emplacement
        )
        if (parent === null) break
        chaine.push({ id: parent.id, nom: parent.name })
      }
      chaine.push({ id: RACINE, nom: 'Dropbox' })
      return chaine
    },

    async element(p) {
      const chemin = cheminDeLecture(p)
      if (chemin === '') return racineVirtuelle(p.emplacement)
      const m = await meta(chemin, p.emplacement)
      return m === null || m['.tag'] === 'deleted' ? null : versElement(m)
    },

    async lister(p): Promise<ListeElements | null> {
      const elements: ElementEspace[] = []
      let page = await rpc<PageDropbox>(
        'files/list_folder',
        { path: cheminDeLecture(p), limit: 2000 },
        jeton,
        p.emplacement
      )
      if (page === null) return null
      for (let n = 1; ; n++) {
        elements.push(
          ...page.entries.filter(e => e['.tag'] !== 'deleted').map(versElement)
        )
        if (!page.has_more) return { elements, complet: true }
        if (n === PAGES_MAX) return { elements, complet: false }
        const suite: PageDropbox | null = await rpc<PageDropbox>(
          'files/list_folder/continue',
          { cursor: page.cursor },
          jeton,
          p.emplacement
        )
        if (suite === null) return { elements, complet: false }
        page = suite
      }
    },

    async ouvrir(p, { pdf }) {
      const reponse = await appel(
        `${CONTENU}/files/${pdf ? 'get_preview' : 'download'}`,
        jeton,
        {
          emplacement: p.emplacement,
          arg: { path: cheminDeLecture(p) },
          delaiMs: DELAI_CONTENU_MS,
        }
      )
      if (!reponse.ok || reponse.body === null) {
        await reponse.body?.cancel()
        throw new FournisseurIndisponible(
          `Dropbox répond ${reponse.status} pour le contenu.`
        )
      }
      const taille = Number(reponse.headers.get('content-length'))
      return {
        flux: reponse.body,
        taille: Number.isFinite(taille) && taille > 0 ? taille : null,
      }
    },

    async creerDossier(parent, nom, { renommer }) {
      const chemin = `${await cheminComplet(parent)}/${nom}`
      if (!renommer) {
        const existant = await meta(chemin, parent.emplacement)
        if (existant?.['.tag'] === 'folder') return versElement(existant)
      }
      const cree = await rpc<{ metadata: MetaDropbox }>(
        'files/create_folder_v2',
        { path: chemin, autorename: renommer },
        jeton,
        parent.emplacement
      )
      if (cree === null)
        throw new FournisseurIndisponible('Le dossier parent est introuvable.')
      return versElement({ ...cree.metadata, '.tag': 'folder' })
    },

    async ecrire(p, texte) {
      const reponse = await appel(`${CONTENU}/files/upload`, jeton, {
        emplacement: p.emplacement,
        arg: {
          path: await cheminComplet(p),
          mode: 'overwrite',
          mute: true,
          autorename: false,
        },
        corps: texte,
        type: 'application/octet-stream',
      })
      if (!reponse.ok) {
        await reponse.body?.cancel()
        throw new FournisseurIndisponible(
          `Dropbox refuse l’écriture (${reponse.status}).`
        )
      }
      const m = (await reponse.json()) as MetaDropbox
      return { etag: m.rev ?? null }
    },

    async supprimer(p) {
      // Dropbox garde un fichier supprimé, qui se restaure depuis son site.
      await rpc(
        'files/delete_v2',
        { path: await cheminComplet(p) },
        jeton,
        p.emplacement
      )
    },
  }
}

/** Le nom affiché du compte connecté, jamais son adresse. */
export async function nomDuCompteDropbox(acces: string): Promise<string> {
  const compte = await rpc<{ name?: { display_name?: string } }>(
    'users/get_current_account',
    null,
    () => Promise.resolve(acces),
    MON_DROPBOX
  )
  return (compte?.name?.display_name?.trim() || 'Compte Dropbox').slice(0, 255)
}
