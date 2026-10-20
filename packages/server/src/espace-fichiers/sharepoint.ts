import { convertibleParMicrosoft } from './chemin.ts'
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

// SharePoint et OneDrive par Microsoft Graph (ADR 0038). Un admin de
// l'organisation se connecte avec son compte professionnel ; Relaytour agit
// ensuite avec les droits de ce compte, par un jeton délégué.

export interface ConfigurationMicrosoft {
  clientId: string
  clientSecret: string
  locataire: string
  /** Adresse de retour inscrite dans l'application Microsoft. */
  retour: string
}

export const HOTES_MICROSOFT: HotesAdmis = {
  exacts: ['graph.microsoft.com', 'login.microsoftonline.com'],
  // Les téléchargements et les conversions en PDF passent par des adresses
  // signées de SharePoint et du service de rendu de Microsoft.
  suffixes: ['.sharepoint.com', '.svc.ms'],
}

// L'écriture sert à l'export des fiches. La lecture des sites liste leurs
// bibliothèques de documents.
const PORTEES = 'offline_access User.Read Files.ReadWrite.All Sites.Read.All'
const GRAPH = 'https://graph.microsoft.com/v1.0'
const DELAI_MS = 15_000
const DELAI_CONTENU_MS = 120_000
// Un dossier se lit par pages de 200 éléments, 25 pages au plus : au-delà, la
// liste se dit incomplète. Les sites et leurs bibliothèques suivent la même règle.
const PAGES_MAX = 25
const PAGES_SITES_MAX = 10

// ── Connexion ────────────────────────────────────────────────────────────────

const adresseJeton = (c: ConfigurationMicrosoft) =>
  `https://login.microsoftonline.com/${encodeURIComponent(c.locataire)}/oauth2/v2.0/token`

export function adresseAutorisation(
  c: ConfigurationMicrosoft,
  etat: string,
  defi: string
): string {
  const parametres = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: c.retour,
    response_mode: 'query',
    scope: PORTEES,
    state: etat,
    code_challenge: defi,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return `https://login.microsoftonline.com/${encodeURIComponent(c.locataire)}/oauth2/v2.0/authorize?${parametres.toString()}`
}

export interface Jetons {
  acces: string
  rafraichissement: string
  expireLe: number
}

async function demanderJetons(
  c: ConfigurationMicrosoft,
  corps: Record<string, string>
): Promise<Jetons> {
  const reponse = await appelSortant(
    adresseJeton(c),
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        scope: PORTEES,
        ...corps,
      }).toString(),
      delaiMs: DELAI_MS,
    },
    HOTES_MICROSOFT
  )
  const donnees = (await reponse.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }
  if (
    donnees.error === 'invalid_grant' ||
    donnees.error === 'interaction_required'
  ) {
    throw new AccesRetire('Microsoft refuse le jeton de rafraîchissement.')
  }
  if (
    !reponse.ok ||
    donnees.access_token === undefined ||
    donnees.refresh_token === undefined
  ) {
    throw new FournisseurIndisponible(
      `Microsoft refuse la demande de jeton (${reponse.status}${donnees.error ? `, ${donnees.error}` : ''}).`
    )
  }
  return {
    acces: donnees.access_token,
    rafraichissement: donnees.refresh_token,
    expireLe: Date.now() + (donnees.expires_in ?? 3600) * 1000,
  }
}

export function echangerCode(
  c: ConfigurationMicrosoft,
  code: string,
  verificateur: string
): Promise<Jetons> {
  return demanderJetons(c, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: c.retour,
    code_verifier: verificateur,
  })
}

export function rafraichir(
  c: ConfigurationMicrosoft,
  rafraichissement: string
): Promise<Jetons> {
  return demanderJetons(c, {
    grant_type: 'refresh_token',
    refresh_token: rafraichissement,
  })
}

/** Le nom affiché du compte connecté, jamais son adresse. */
export async function nomDuCompte(acces: string): Promise<string> {
  const moi = await lireJson<{ displayName?: string }>(
    `${GRAPH}/me?$select=displayName`,
    () => Promise.resolve(acces)
  )
  return (moi?.displayName?.trim() || 'Compte Microsoft').slice(0, 255)
}

// ── Lecture ──────────────────────────────────────────────────────────────────

type Jeton = (forcer?: boolean) => Promise<string>

/**
 * Appel à Graph avec le jeton d'accès. Un 401 renouvelle le jeton une fois : un
 * second refus signifie que l'accès a été retiré.
 */
async function graph(
  adresse: string,
  jeton: Jeton,
  delaiMs = DELAI_MS
): Promise<Response> {
  for (const forcer of [false, true]) {
    const reponse = await appelSortant(
      adresse,
      {
        headers: { authorization: `Bearer ${await jeton(forcer)}` },
        delaiMs,
      },
      HOTES_MICROSOFT
    )
    if (reponse.status !== 401) return reponse
    await reponse.body?.cancel()
  }
  throw new AccesRetire('Microsoft refuse le jeton d’accès.')
}

/** Corps JSON d'une réponse de Graph. Null pour un élément absent ou inaccessible. */
async function lireJson<T>(adresse: string, jeton: Jeton): Promise<T | null> {
  const reponse = await graph(adresse, jeton)
  if (reponse.status === 404 || reponse.status === 403) {
    await reponse.body?.cancel()
    return null
  }
  if (!reponse.ok) {
    await reponse.body?.cancel()
    throw new FournisseurIndisponible(
      `Microsoft Graph répond ${reponse.status}.`
    )
  }
  return (await reponse.json()) as T
}

interface ElementGraph {
  id: string
  name: string
  folder?: unknown
  file?: { mimeType?: string }
  size?: number
  lastModifiedDateTime?: string
  webUrl?: string
}

const CHAMPS = 'id,name,folder,file,size,lastModifiedDateTime,webUrl'

/**
 * Suit les pages d'une collection de Graph (`@odata.nextLink`), jusqu'à une borne.
 * Null si la première page n'existe pas.
 */
async function toutesLesPages<T>(
  adresse: string,
  jeton: Jeton,
  pagesMax: number
): Promise<{ valeurs: T[]; complet: boolean } | null> {
  const valeurs: T[] = []
  let suivante: string | undefined = adresse
  for (let page = 0; suivante !== undefined; page++) {
    if (page === pagesMax) return { valeurs, complet: false }
    const reponse: { value: T[]; '@odata.nextLink'?: string } | null =
      await lireJson(suivante, jeton)
    if (reponse === null) return page === 0 ? null : { valeurs, complet: false }
    valeurs.push(...reponse.value)
    suivante = reponse['@odata.nextLink']
  }
  return { valeurs, complet: true }
}

function versElement(e: ElementGraph): ElementEspace {
  return {
    id: e.id,
    nom: e.name,
    dossier: e.folder !== undefined,
    taille: e.size ?? null,
    modifieLe:
      e.lastModifiedDateTime === undefined
        ? null
        : new Date(e.lastModifiedDateTime),
    typeMime: e.file?.mimeType ?? null,
    lienWeb: e.webUrl ?? null,
  }
}

// Un identifiant de site contient des virgules (« hôte,collection,site ») : Graph
// les attend telles quelles.
const segment = (valeur: string) =>
  encodeURIComponent(valeur).replaceAll('%2C', ',')

/** L'adresse Graph d'une position : sa base, puis son chemin de noms. */
export function adresseGraph(p: Position): string {
  const racine =
    p.base === null
      ? `${GRAPH}/drives/${segment(p.emplacement)}/root`
      : `${GRAPH}/drives/${segment(p.emplacement)}/items/${segment(p.base)}`
  return p.chemin.length === 0
    ? racine
    : `${racine}:/${p.chemin.map(encodeURIComponent).join('/')}:`
}

export function espaceSharePoint(jeton: Jeton): EspaceFichiers {
  return {
    fournisseur: 'SHAREPOINT',
    convertitEnPdf: convertibleParMicrosoft,

    async emplacements(): Promise<Emplacement[]> {
      const resultat: Emplacement[] = []
      const personnel = await lireJson<{ id: string; name?: string }>(
        `${GRAPH}/me/drive?$select=id,name`,
        jeton
      )
      if (personnel !== null) {
        resultat.push({ id: personnel.id, nom: 'OneDrive', site: null })
      }
      const sites = await toutesLesPages<{ id: string; displayName?: string }>(
        `${GRAPH}/sites?search=*&$select=id,displayName&$top=50`,
        jeton,
        PAGES_SITES_MAX
      )
      const parSite = await Promise.all(
        (sites?.valeurs ?? []).map(async site => {
          const bibliotheques = await toutesLesPages<{
            id: string
            name: string
          }>(
            `${GRAPH}/sites/${segment(site.id)}/drives?$select=id,name`,
            jeton,
            PAGES_SITES_MAX
          ).catch(() => null)
          return (bibliotheques?.valeurs ?? []).map(b => ({
            id: b.id,
            nom: b.name,
            site: site.displayName ?? null,
          }))
        })
      )
      return [...resultat, ...parSite.flat()]
    },

    async element(position) {
      const e = await lireJson<ElementGraph>(
        `${adresseGraph(position)}?$select=${CHAMPS}`,
        jeton
      )
      return e === null ? null : versElement(e)
    },

    async lister(position): Promise<ListeElements | null> {
      const pages = await toutesLesPages<ElementGraph>(
        `${adresseGraph(position)}/children?$select=${CHAMPS}&$top=200`,
        jeton,
        PAGES_MAX
      )
      return pages === null
        ? null
        : { elements: pages.valeurs.map(versElement), complet: pages.complet }
    },

    async ouvrir(position, { pdf }) {
      const reponse = await graph(
        `${adresseGraph(position)}/content${pdf ? '?format=pdf' : ''}`,
        jeton,
        DELAI_CONTENU_MS
      )
      if (!reponse.ok || reponse.body === null) {
        await reponse.body?.cancel()
        throw new FournisseurIndisponible(
          `Microsoft Graph répond ${reponse.status} pour le contenu.`
        )
      }
      const taille = Number(reponse.headers.get('content-length'))
      return {
        flux: reponse.body,
        taille: Number.isFinite(taille) && taille > 0 ? taille : null,
      }
    },
  }
}
