import { i18n } from '../lib/langue.ts'

import { convertibleParMicrosoft } from './chemin.ts'
import { appelSortant, type HotesAdmis } from './sortant.ts'
import {
  AccesRetire,
  FournisseurIndisponible,
  type AnnuaireFournisseur,
  type Beneficiaire,
  type CompteAnnuaire,
  type DroitElement,
  type ElementEspace,
  type Emplacement,
  type EspaceFichiers,
  type ListeElements,
  type Portee,
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
// bibliothèques de documents. La vérification des accès lit les comptes et les
// membres des groupes ; la gestion les modifie (ADR 0044). Ces autorisations
// demandent le consentement d'un admin Microsoft Entra.
const FICHIERS = 'offline_access User.Read Files.ReadWrite.All Sites.Read.All'
export const PORTEES_MICROSOFT: Record<Portee, string> = {
  FICHIERS,
  ANNUAIRE: `${FICHIERS} User.Read.All GroupMember.Read.All`,
  GESTION: `${FICHIERS} User.Read.All GroupMember.ReadWrite.All`,
}
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
  defi: string,
  portee: Portee = 'FICHIERS'
): string {
  const parametres = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: c.retour,
    response_mode: 'query',
    scope: PORTEES_MICROSOFT[portee],
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
  corps: Record<string, string>,
  portee: Portee
): Promise<Jetons> {
  const reponse = await appelSortant(
    adresseJeton(c),
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        scope: PORTEES_MICROSOFT[portee],
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
  verificateur: string,
  portee: Portee = 'FICHIERS'
): Promise<Jetons> {
  return demanderJetons(
    c,
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: c.retour,
      code_verifier: verificateur,
    },
    portee
  )
}

/** De nouveaux jetons, pour la portée accordée à la connexion. */
export function rafraichir(
  c: ConfigurationMicrosoft,
  rafraichissement: string,
  portee: Portee = 'FICHIERS'
): Promise<Jetons> {
  return demanderJetons(
    c,
    { grant_type: 'refresh_token', refresh_token: rafraichissement },
    portee
  )
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
/** Graph limite le débit : Relaytour attend au plus 30 secondes, trois fois. */
const ATTENTE_MAX_S = 30
const ESSAIS_LIMITE = 3

/** L'attente demandée par `Retry-After`, en secondes, bornée ; 2 s sans indication. */
export function attenteDemandee(valeur: string | null | undefined): number {
  const secondes = Number(valeur)
  if (valeur != null && valeur !== '' && Number.isFinite(secondes)) {
    return Math.min(Math.max(secondes, 0), ATTENTE_MAX_S)
  }
  const date = valeur == null ? NaN : Date.parse(valeur)
  if (Number.isFinite(date)) {
    return Math.min(Math.max((date - Date.now()) / 1000, 0), ATTENTE_MAX_S)
  }
  return 2
}

const attendre = (secondes: number) =>
  new Promise(resolve => setTimeout(resolve, secondes * 1000))

async function graph(
  adresse: string,
  jeton: Jeton,
  delaiMs = DELAI_MS,
  requete: { method?: string; body?: string; type?: string } = {}
): Promise<Response> {
  for (let essai = 1; ; essai++) {
    const reponse = await graphUneFois(adresse, jeton, delaiMs, requete)
    // Une limite de débit se respecte : Graph dit combien de temps attendre.
    if (
      (reponse.status !== 429 && reponse.status !== 503) ||
      essai >= ESSAIS_LIMITE
    ) {
      return reponse
    }
    await reponse.body?.cancel()
    await attendre(attenteDemandee(reponse.headers.get('retry-after')))
  }
}

async function graphUneFois(
  adresse: string,
  jeton: Jeton,
  delaiMs: number,
  requete: { method?: string; body?: string; type?: string }
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
  eTag?: string
  folder?: unknown
  file?: { mimeType?: string }
  size?: number
  lastModifiedDateTime?: string
  webUrl?: string
}

const CHAMPS = 'id,name,folder,file,size,lastModifiedDateTime,webUrl,eTag'

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
    etag: e.eTag ?? null,
  }
}

/** Corps JSON d'une écriture, ou une erreur du fournisseur. */
async function resultatEcriture<T>(
  reponse: Response,
  quoi: string
): Promise<T> {
  if (!reponse.ok) {
    await reponse.body?.cancel()
    throw new FournisseurIndisponible(
      `Microsoft Graph refuse ${quoi} (${reponse.status}).`
    )
  }
  return (await reponse.json()) as T
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

// ── Annuaire (ADR 0044) ──────────────────────────────────────────────────────

interface UtilisateurGraph {
  id: string
  displayName?: string
  mail?: string | null
  userPrincipalName?: string
  userType?: string
}

const CHAMPS_UTILISATEUR = 'id,displayName,mail,userPrincipalName,userType'
// Graph regroupe vingt requêtes au plus dans un lot.
const LOT_MAX = 20

function versCompte(u: UtilisateurGraph): CompteAnnuaire {
  return {
    identifiant: u.id,
    adresse: (u.mail ?? u.userPrincipalName ?? '').toLowerCase(),
    nom: u.displayName?.trim() || i18n._('Compte Microsoft'),
    invite: u.userType === 'Guest',
  }
}

/** L'adresse d'un compte SharePoint (`i:0#.f|membership|nom@exemple.org`). */
function adresseDuLogin(login: string | undefined): string | null {
  const fin = login?.split('|').pop()
  return fin?.includes('@') ? fin.toLowerCase() : null
}

interface IdentiteGraph {
  user?: { id?: string; displayName?: string; email?: string }
  group?: { id?: string; displayName?: string }
  siteGroup?: { id?: string | number; displayName?: string }
  siteUser?: { displayName?: string; loginName?: string; email?: string }
}

export interface PermissionGraph {
  id: string
  roles?: string[]
  inheritedFrom?: unknown
  link?: { scope?: string }
  grantedToV2?: IdentiteGraph
  grantedToIdentitiesV2?: IdentiteGraph[]
}

/** Les bénéficiaires d'un droit de Graph. Un groupe de site se préfixe de `site:`. */
export function beneficiaires(p: PermissionGraph): Beneficiaire[] {
  const identites = [
    ...(p.grantedToV2 === undefined ? [] : [p.grantedToV2]),
    ...(p.grantedToIdentitiesV2 ?? []),
  ]
  const nommes = identites.flatMap((i): Beneficiaire[] => {
    if (i.user !== undefined) {
      return [
        {
          type: 'personne',
          identifiant: i.user.id ?? null,
          adresse: i.user.email?.toLowerCase() ?? null,
          nom: i.user.displayName ?? i18n._('Personne'),
        },
      ]
    }
    if (i.group?.id !== undefined) {
      return [
        {
          type: 'groupe',
          identifiant: i.group.id,
          nom: i.group.displayName ?? i18n._('Groupe'),
        },
      ]
    }
    if (i.siteGroup?.id !== undefined) {
      return [
        {
          type: 'groupe',
          identifiant: `site:${i.siteGroup.id}`,
          nom: i.siteGroup.displayName ?? i18n._('Groupe du site'),
        },
      ]
    }
    // « Tout le monde sauf les utilisateurs externes » : tous les comptes de
    // l'organisation, invités exclus.
    if (i.siteUser?.loginName?.includes('spo-grid-all-users') === true) {
      return [
        { type: 'domaine', nom: i18n._('Tout le monde sauf les externes') },
      ]
    }
    if (i.siteUser !== undefined) {
      return [
        {
          type: 'personne',
          identifiant: null,
          adresse:
            i.siteUser.email?.toLowerCase() ??
            adresseDuLogin(i.siteUser.loginName),
          nom: i.siteUser.displayName ?? i18n._('Personne'),
        },
      ]
    }
    return []
  })
  if (nommes.length > 0) return nommes
  // Un lien, même limité à l'organisation, n'ouvre le dossier qu'à qui le reçoit.
  if (p.link?.scope === 'organization') {
    return [{ type: 'lien', nom: i18n._('Lien de l’organisation') }]
  }
  return p.link === undefined
    ? []
    : [{ type: 'lien', nom: i18n._('Lien de partage') }]
}

/** Une écriture de Graph qui tolère un élément déjà absent, ou déjà présent. */
async function ecritureTolerante(
  reponse: Response,
  quoi: string,
  toleres: number[]
): Promise<void> {
  if (reponse.ok || toleres.includes(reponse.status)) {
    await reponse.body?.cancel()
    return
  }
  // Un membre déjà présent dans un groupe répond 400 avec ce message.
  const texte = await reponse.text().catch(() => '')
  if (reponse.status === 400 && /already exist/i.test(texte)) return
  throw new FournisseurIndisponible(
    `Microsoft Graph refuse ${quoi} (${reponse.status}).`
  )
}

export function annuaireSharePoint(
  jeton: Jeton,
  options: { gestion?: boolean } = {}
): AnnuaireFournisseur {
  const gestion = options.gestion === true
  const ecritures: Pick<
    AnnuaireFournisseur,
    'partager' | 'retirerPartage' | 'ajouterAuGroupe' | 'retirerDuGroupe'
  > = !gestion
    ? {}
    : {
        async partager(position, personne, { role, invitation }) {
          const reponse = await graph(
            `${adresseGraph(position)}/invite`,
            jeton,
            DELAI_MS,
            {
              method: 'POST',
              type: 'application/json',
              body: JSON.stringify({
                recipients: [{ email: personne.adresse }],
                requireSignIn: true,
                sendInvitation: invitation,
                roles: [role === 'ECRITURE' ? 'write' : 'read'],
              }),
            }
          )
          const corps = await resultatEcriture<{ value?: { id: string }[] }>(
            reponse,
            'le partage'
          )
          const identifiant = corps.value?.[0]?.id
          if (identifiant === undefined) {
            throw new FournisseurIndisponible(
              'Microsoft Graph ne rend aucun droit après le partage.'
            )
          }
          return { identifiant }
        },
        async retirerPartage(position, identifiant) {
          const reponse = await graph(
            `${adresseGraph(position)}/permissions/${segment(identifiant)}`,
            jeton,
            DELAI_MS,
            { method: 'DELETE' }
          )
          await ecritureTolerante(reponse, 'le retrait du partage', [404])
        },
        async ajouterAuGroupe(groupe, compte) {
          const reponse = await graph(
            `${GRAPH}/groups/${segment(groupe)}/members/$ref`,
            jeton,
            DELAI_MS,
            {
              method: 'POST',
              type: 'application/json',
              body: JSON.stringify({
                '@odata.id': `${GRAPH}/directoryObjects/${segment(compte)}`,
              }),
            }
          )
          await ecritureTolerante(reponse, 'l’ajout au groupe', [])
        },
        async retirerDuGroupe(groupe, compte) {
          const reponse = await graph(
            `${GRAPH}/groups/${segment(groupe)}/members/${segment(compte)}/$ref`,
            jeton,
            DELAI_MS,
            { method: 'DELETE' }
          )
          await ecritureTolerante(reponse, 'le retrait du groupe', [404])
        },
      }
  return {
    ...ecritures,
    capacites: {
      comptes: true,
      droits: true,
      membresDeGroupe: true,
      partage: gestion,
      gestionDeGroupe: gestion,
    },

    async chercherComptes(adresses) {
      const resultat = new Map<string, CompteAnnuaire | null>()
      for (let debut = 0; debut < adresses.length; debut += LOT_MAX) {
        const lot = adresses.slice(debut, debut + LOT_MAX)
        // Les adresses secondaires (`otherMails`) demandent une requête avancée.
        const requests = lot.map((adresse, i) => {
          const q = adresse.toLowerCase().replaceAll("'", "''")
          const filtre = `mail eq '${q}' or userPrincipalName eq '${q}' or otherMails/any(x:x eq '${q}')`
          return {
            id: String(i),
            method: 'GET',
            url: `/users?$filter=${encodeURIComponent(filtre)}&$select=${CHAMPS_UTILISATEUR}&$count=true&$top=1`,
            headers: { ConsistencyLevel: 'eventual' },
          }
        })
        // Une requête du lot limitée par Graph se renvoie après l'attente demandée.
        let restantes = requests
        for (let essai = 1; restantes.length > 0; essai++) {
          const reponse = await graph(`${GRAPH}/$batch`, jeton, DELAI_MS, {
            method: 'POST',
            body: JSON.stringify({ requests: restantes }),
            type: 'application/json',
          })
          const corps = await resultatEcriture<{
            responses: {
              id: string
              status: number
              headers?: Record<string, string>
              body?: { value?: UtilisateurGraph[] }
            }[]
          }>(reponse, 'la recherche de comptes')
          const limitees = corps.responses.filter(r => r.status === 429)
          for (const r of corps.responses) {
            const adresse = lot[Number(r.id)]
            if (adresse === undefined || r.status === 429) continue
            if (r.status !== 200) {
              throw new FournisseurIndisponible(
                `Microsoft Graph refuse la recherche d’un compte (${r.status}).`
              )
            }
            const trouve = r.body?.value?.[0]
            resultat.set(
              adresse,
              trouve === undefined ? null : versCompte(trouve)
            )
          }
          if (limitees.length === 0) break
          if (essai >= ESSAIS_LIMITE) {
            throw new FournisseurIndisponible(
              'Microsoft Graph limite le débit de la recherche de comptes.'
            )
          }
          await attendre(
            Math.max(
              ...limitees.map(r =>
                attenteDemandee(
                  r.headers?.['Retry-After'] ?? r.headers?.['retry-after']
                )
              )
            )
          )
          restantes = requests.filter(q => limitees.some(r => r.id === q.id))
        }
      }
      return resultat
    },

    async droits(position) {
      const pages = await toutesLesPages<PermissionGraph>(
        `${adresseGraph(position)}/permissions`,
        jeton,
        PAGES_SITES_MAX
      )
      // Un refus, un dossier absent ou une liste coupée : les droits ne se
      // lisent pas, et Relaytour ne conclut à aucune absence de droit.
      if (pages === null || !pages.complet) return null
      return pages.valeurs.flatMap(p =>
        beneficiaires(p).map((beneficiaire): DroitElement => ({
          identifiant: p.id,
          beneficiaire,
          role: (p.roles ?? []).some(r => r === 'write' || r === 'owner')
            ? 'ECRITURE'
            : 'LECTURE',
          herite: p.inheritedFrom !== undefined,
        }))
      )
    },

    groupeGerable: identifiant => !identifiant.startsWith('site:'),

    async membresDuGroupe(identifiant) {
      // Graph ne lit pas les membres d'un groupe d'un site SharePoint.
      if (identifiant.startsWith('site:')) return null
      const pages = await toutesLesPages<UtilisateurGraph>(
        `${GRAPH}/groups/${segment(identifiant)}/transitiveMembers/microsoft.graph.user?$select=${CHAMPS_UTILISATEUR}&$top=999`,
        jeton,
        PAGES_SITES_MAX
      )
      if (pages === null || !pages.complet) return null
      return pages.valeurs.map(versCompte)
    },
  }
}

export function espaceSharePoint(
  jeton: Jeton,
  options: { annuaire?: boolean; gestion?: boolean } = {}
): EspaceFichiers {
  return {
    fournisseur: 'SHAREPOINT',
    ...(options.annuaire === true
      ? {
          annuaire: annuaireSharePoint(jeton, {
            gestion: options.gestion === true,
          }),
        }
      : {}),
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

    async ancetres(emplacement, element) {
      const chaine: { id: string; nom: string }[] = []
      let courant: string | undefined = element
      for (let i = 0; courant !== undefined && i < 40; i++) {
        const e: {
          id: string
          name: string
          parentReference?: { id?: string }
        } | null = await lireJson(
          `${GRAPH}/drives/${segment(emplacement)}/items/${segment(courant)}?$select=id,name,parentReference`,
          jeton
        )
        if (e === null) return i === 0 ? null : chaine
        chaine.push({ id: e.id, nom: e.name })
        courant = e.parentReference?.id
      }
      return chaine
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

    async creerDossier(parent, nom, { renommer }) {
      const reponse = await graph(
        `${adresseGraph(parent)}/children`,
        jeton,
        DELAI_MS,
        {
          method: 'POST',
          type: 'application/json',
          body: JSON.stringify({
            name: nom,
            folder: {},
            '@microsoft.graph.conflictBehavior': renommer ? 'rename' : 'fail',
          }),
        }
      )
      // Sans renommage, un dossier déjà présent est rendu tel quel.
      if (reponse.status === 409 && !renommer) {
        await reponse.body?.cancel()
        const existant = await lireJson<ElementGraph>(
          `${adresseGraph({ ...parent, chemin: [...parent.chemin, nom] })}?$select=${CHAMPS}`,
          jeton
        )
        if (existant === null) {
          throw new FournisseurIndisponible('Le dossier créé est introuvable.')
        }
        return versElement(existant)
      }
      return versElement(
        await resultatEcriture<ElementGraph>(reponse, 'la création du dossier')
      )
    },

    async ecrire(position, texte) {
      const reponse = await graph(
        `${adresseGraph(position)}/content`,
        jeton,
        DELAI_MS,
        { method: 'PUT', type: 'text/markdown; charset=utf-8', body: texte }
      )
      const e = await resultatEcriture<ElementGraph>(reponse, 'l’écriture')
      return { etag: e.eTag ?? null }
    },

    async supprimer(position) {
      const reponse = await graph(adresseGraph(position), jeton, DELAI_MS, {
        method: 'DELETE',
      })
      await reponse.body?.cancel()
      if (!reponse.ok && reponse.status !== 404) {
        throw new FournisseurIndisponible(
          `Microsoft Graph refuse la suppression (${reponse.status}).`
        )
      }
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
