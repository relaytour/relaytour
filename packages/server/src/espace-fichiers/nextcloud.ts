import { isIP } from 'node:net'

import { DOMParser, type Element as ElementXml } from '@xmldom/xmldom'

import { adressePublique, agentNomme, agentPublic } from './reseau.ts'
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

// Nextcloud par WebDAV (ADR 0038). L'association héberge son Nextcloud : son
// adresse vient de l'admin de l'organisation, dans les limites que l'exploitant
// fixe par NEXTCLOUD_HOTES. L'admin se connecte par le « Login Flow v2 » de
// Nextcloud, qui crée un mot de passe d'application propre à Relaytour ; il le
// révoque depuis ses réglages de sécurité. WebDAV adresse un élément par son
// chemin : un dossier lié se retrouve par son identifiant (`oc:fileid`), même
// déplacé, grâce à une recherche WebDAV. Les numéros de fichier ne valent que
// sur une instance : l'emplacement d'un élément est l'adresse de son instance, et
// une position sur une autre instance est introuvable.

export interface ConfigurationNextcloud {
  /** Tout hôte en https dont les adresses sont publiques. */
  tous: boolean
  /** Hôtes nommés par l'exploitant, port compris : admis même sur un réseau privé. */
  hotes: readonly string[]
}

/** Ce que Relaytour garde, chiffré, d'une connexion à Nextcloud. */
export interface SecretNextcloud {
  base: string
  /** Identifiant interne du compte, qui forme les chemins WebDAV. */
  utilisateur: string
  /** Nom de connexion, parfois une adresse : il accompagne le mot de passe. */
  identifiant: string
  motDePasse: string
}

const DELAI_MS = 15_000
const DELAI_CONTENU_MS = 120_000
/** Une réponse WebDAV plus lourde ne se lit pas. */
const XML_MAX = 20 * 1024 * 1024
/** Une réponse JSON de connexion ou de compte tient en quelques kilo-octets. */
const JSON_MAX = 64 * 1024
/** L'adresse de base sert d'emplacement : elle tient dans sa colonne. */
const BASE_MAX = 200
const PROFONDEUR_MAX = 40
const AGENT = 'Relaytour'

// ── Adresse ──────────────────────────────────────────────────────────────────

/**
 * L'adresse de base d'un Nextcloud, sans barre finale, ou null quand
 * l'exploitant ne l'admet pas. Une adresse de page (« …/apps/files »)
 * se ramène à la base.
 */
export function baseAdmise(
  adresse: string,
  c: ConfigurationNextcloud
): string | null {
  let url: URL
  try {
    url = new URL(adresse.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    return null
  }
  const hote = url.host.toLowerCase()
  if (!c.hotes.includes(hote)) {
    const nom = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (!c.tous || url.port !== '') return null
    if (isIP(nom) !== 0 && !adressePublique(nom)) return null
    if (nom === 'localhost' || nom.endsWith('.localhost')) return null
  }
  const chemin = url.pathname
    .replace(/\/(index\.php|apps|login|remote\.php|s)(\/.*)?$/, '')
    .replace(/\/+$/, '')
  const base = `https://${hote}${chemin}`
  return base.length > BASE_MAX ? null : base
}

function agentDe(base: string, c: ConfigurationNextcloud) {
  return c.hotes.includes(new URL(base).host.toLowerCase())
    ? agentNomme
    : agentPublic
}

/**
 * Un appel vers ce Nextcloud. L'adresse doit rester sous sa base, que
 * l'exploitant admet toujours. Une redirection ne se suit pas : elle mènerait
 * hors de l'hôte contrôlé.
 */
export async function appelNextcloud(
  c: ConfigurationNextcloud,
  base: string,
  adresse: string,
  init: RequestInit & { delaiMs?: number }
): Promise<Response> {
  if (baseAdmise(base, c) !== base || !adresse.startsWith(`${base}/`)) {
    throw new FournisseurIndisponible(
      'L’hébergeur n’admet plus l’adresse de ce Nextcloud.'
    )
  }
  const { delaiMs = DELAI_MS, headers, ...options } = init
  let reponse: Response
  try {
    reponse = await fetch(adresse, {
      ...options,
      headers: { 'user-agent': AGENT, ...(headers as Record<string, string>) },
      redirect: 'manual',
      signal: AbortSignal.timeout(delaiMs),
      dispatcher: agentDe(base, c),
    } as unknown as RequestInit)
  } catch (erreur) {
    const cause = (erreur as { cause?: Error }).cause
    throw new FournisseurIndisponible(
      `Nextcloud ne répond pas : ${(cause ?? (erreur as Error)).message}`
    )
  }
  if (reponse.status >= 300 && reponse.status < 400) {
    await reponse.body?.cancel()
    throw new FournisseurIndisponible(
      'Nextcloud renvoie vers une autre adresse. Vérifiez l’adresse saisie.'
    )
  }
  return reponse
}

/** Le texte d'une réponse, borné : au-delà, la réponse est refusée. */
async function texteBorne(reponse: Response, max = XML_MAX): Promise<string> {
  if (reponse.body === null) return ''
  const lecteur: ReadableStreamDefaultReader<Uint8Array> =
    reponse.body.getReader()
  const morceaux: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    total += value.length
    if (total > max) {
      await lecteur.cancel().catch(() => undefined)
      throw new FournisseurIndisponible('Nextcloud répond trop longuement.')
    }
    morceaux.push(value)
  }
  return Buffer.concat(morceaux).toString('utf8')
}

/**
 * Le JSON d'une réponse, borné avant son décodage : l'hôte vient d'une
 * organisation, et un corps sans limite épuiserait la mémoire du serveur. Un
 * corps illisible donne un objet vide ; un corps trop lourd lève.
 */
async function jsonBorne(reponse: Response): Promise<unknown> {
  const texte = await texteBorne(reponse, JSON_MAX)
  try {
    return JSON.parse(texte) as unknown
  } catch {
    return {}
  }
}

// ── Connexion par le Login Flow v2 ───────────────────────────────────────────

export interface DebutConnexionNextcloud {
  /** Page où l'admin se connecte et accorde l'accès. */
  connexion: string
  /** Adresse et jeton que Relaytour interroge jusqu'à la réponse. */
  sondage: string
  jeton: string
}

export async function commencerLoginNextcloud(
  c: ConfigurationNextcloud,
  base: string
): Promise<DebutConnexionNextcloud> {
  const reponse = await appelNextcloud(c, base, `${base}/index.php/login/v2`, {
    method: 'POST',
  })
  const donnees = (await jsonBorne(reponse)) as {
    login?: string
    poll?: { token?: string; endpoint?: string }
  }
  const { login, poll } = donnees
  if (
    !reponse.ok ||
    typeof login !== 'string' ||
    typeof poll?.token !== 'string' ||
    typeof poll.endpoint !== 'string'
  ) {
    throw new FournisseurIndisponible(
      `Cette adresse ne répond pas comme un Nextcloud (${reponse.status}).`
    )
  }
  // Nextcloud annonce ses adresses d'après son propre réglage : elles doivent
  // rester sous la base que l'admin a saisie.
  if (!login.startsWith(`${base}/`) || !poll.endpoint.startsWith(`${base}/`)) {
    throw new FournisseurIndisponible(
      'Ce Nextcloud annonce une autre adresse que celle saisie. Saisissez l’adresse qu’il utilise (réglage overwrite.cli.url).'
    )
  }
  return { connexion: login, sondage: poll.endpoint, jeton: poll.token }
}

/** Les identifiants accordés, ou null tant que l'admin n'a pas terminé. */
export async function sonderLoginNextcloud(
  c: ConfigurationNextcloud,
  base: string,
  sondage: string,
  jeton: string
): Promise<{ identifiant: string; motDePasse: string } | null> {
  const reponse = await appelNextcloud(c, base, sondage, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: jeton }).toString(),
  })
  if (reponse.status === 404) {
    await reponse.body?.cancel()
    return null
  }
  const donnees = (await jsonBorne(reponse)) as {
    loginName?: string
    appPassword?: string
  }
  if (
    !reponse.ok ||
    typeof donnees.loginName !== 'string' ||
    typeof donnees.appPassword !== 'string'
  ) {
    throw new FournisseurIndisponible(
      `Nextcloud refuse la connexion (${reponse.status}).`
    )
  }
  // Nextcloud indique aussi l'adresse où l'admin a accordé l'accès (`server`).
  // Relaytour ne s'en sert pas : il garde la base qu'il a contrôlée.
  return { identifiant: donnees.loginName, motDePasse: donnees.appPassword }
}

const autorisation = (identifiant: string, motDePasse: string) =>
  `Basic ${Buffer.from(`${identifiant}:${motDePasse}`).toString('base64')}`

/** Le compte connecté : son identifiant interne et son nom affiché. */
export async function compteNextcloud(
  c: ConfigurationNextcloud,
  base: string,
  identifiant: string,
  motDePasse: string
): Promise<{ utilisateur: string; nom: string }> {
  const reponse = await appelNextcloud(
    c,
    base,
    `${base}/ocs/v2.php/cloud/user?format=json`,
    {
      headers: {
        authorization: autorisation(identifiant, motDePasse),
        'ocs-apirequest': 'true',
        accept: 'application/json',
      },
    }
  )
  if (reponse.status === 401) {
    await reponse.body?.cancel()
    throw new AccesRetire('Nextcloud refuse le mot de passe d’application.')
  }
  const donnees = (await jsonBorne(reponse)) as {
    ocs?: { data?: { id?: string; 'display-name'?: string } }
  }
  const id = donnees.ocs?.data?.id
  if (!reponse.ok || typeof id !== 'string' || id === '') {
    throw new FournisseurIndisponible(
      `Nextcloud ne décrit pas le compte (${reponse.status}).`
    )
  }
  return {
    utilisateur: id,
    nom: (donnees.ocs?.data?.['display-name']?.trim() || id).slice(0, 200),
  }
}

// ── WebDAV ───────────────────────────────────────────────────────────────────

const DAV = 'DAV:'
const OC = 'http://owncloud.org/ns'

const PROPRIETES = `<d:prop><d:getcontenttype/><d:getcontentlength/><d:getlastmodified/><d:getetag/><d:resourcetype/><oc:fileid/></d:prop>`

const xml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    c =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!
  )

export interface EntreeDav {
  /** Noms depuis la racine des fichiers du compte. */
  chemin: string[]
  fileid: string
  dossier: boolean
  taille: number | null
  modifieLe: Date | null
  typeMime: string | null
  etag: string | null
}

const sansGuillemets = (etag: string | null) =>
  etag === null ? null : etag.replace(/^(W\/)?"(.*)"$/, '$2')

function enfant(
  parent: ElementXml,
  ns: string,
  nom: string
): ElementXml | null {
  const liste = parent.getElementsByTagNameNS(ns, nom)
  return liste.length === 0 ? null : liste.item(0)
}

const texte = (e: ElementXml | null) => e?.textContent?.trim() || null

/**
 * Les entrées d'une réponse WebDAV « multistatus ». `racine` est le chemin
 * décodé, en segments, des fichiers du compte : une entrée hors de cette racine
 * est ignorée.
 */
export function lireMultistatus(
  corps: string,
  racine: readonly string[]
): EntreeDav[] {
  let doc
  try {
    doc = new DOMParser().parseFromString(corps, 'text/xml')
  } catch {
    throw new FournisseurIndisponible('Nextcloud répond un XML illisible.')
  }
  const reponses = doc.getElementsByTagNameNS(DAV, 'response')
  const entrees: EntreeDav[] = []
  for (let i = 0; i < reponses.length; i++) {
    const r = reponses.item(i) as ElementXml
    const href = texte(enfant(r, DAV, 'href'))
    if (href === null) continue
    let segments: string[]
    try {
      segments = new URL(href, 'https://h.invalid').pathname
        .split('/')
        .filter(Boolean)
        .map(s => decodeURIComponent(s))
    } catch {
      continue
    }
    if (
      segments.length < racine.length ||
      racine.some((s, j) => segments[j] !== s)
    ) {
      continue
    }
    // Seules les propriétés trouvées (statut 200) comptent.
    const propstats = r.getElementsByTagNameNS(DAV, 'propstat')
    let prop: ElementXml | null = null
    for (let j = 0; j < propstats.length; j++) {
      const ps = propstats.item(j) as ElementXml
      if (/\s200\s/.test(` ${texte(enfant(ps, DAV, 'status')) ?? ''} `)) {
        prop = enfant(ps, DAV, 'prop')
      }
    }
    const fileid = prop === null ? null : texte(enfant(prop, OC, 'fileid'))
    if (prop === null || fileid === null) continue
    const typeRessource = enfant(prop, DAV, 'resourcetype')
    const dossier =
      typeRessource !== null &&
      typeRessource.getElementsByTagNameNS(DAV, 'collection').length > 0
    const taille = Number(texte(enfant(prop, DAV, 'getcontentlength')))
    const modifie = texte(enfant(prop, DAV, 'getlastmodified'))
    entrees.push({
      chemin: segments.slice(racine.length),
      fileid,
      dossier,
      taille: !dossier && Number.isFinite(taille) ? taille : null,
      modifieLe: modifie === null ? null : new Date(modifie),
      typeMime: dossier ? null : texte(enfant(prop, DAV, 'getcontenttype')),
      etag: sansGuillemets(texte(enfant(prop, DAV, 'getetag'))),
    })
  }
  return entrees
}

export function espaceNextcloud(
  jeton: Jeton,
  c: ConfigurationNextcloud
): EspaceFichiers {
  const secret = async (forcer: boolean) =>
    JSON.parse(await jeton(forcer)) as SecretNextcloud

  const racineDav = (s: SecretNextcloud) => [
    ...new URL(s.base).pathname
      .split('/')
      .filter(Boolean)
      .map(n => decodeURIComponent(n)),
    'remote.php',
    'dav',
    'files',
    s.utilisateur,
  ]

  const adresseDe = (s: SecretNextcloud, chemin: readonly string[]) =>
    `${s.base}/remote.php/dav/files/${encodeURIComponent(s.utilisateur)}${chemin
      .map(n => `/${encodeURIComponent(n)}`)
      .join('')}`

  /** Un appel authentifié. Un refus renouvelle l'accès une fois, qui vérifie le compte. */
  async function appel(
    requete: (s: SecretNextcloud) => {
      adresse: string
      init: RequestInit & { delaiMs?: number }
    }
  ): Promise<{ reponse: Response; secret: SecretNextcloud }> {
    for (const forcer of [false, true]) {
      const s = await secret(forcer)
      const { adresse, init } = requete(s)
      const reponse = await appelNextcloud(c, s.base, adresse, {
        ...init,
        headers: {
          authorization: autorisation(s.identifiant, s.motDePasse),
          ...(init.headers as Record<string, string> | undefined),
        },
      })
      if (reponse.status !== 401) return { reponse, secret: s }
      await reponse.body?.cancel()
    }
    throw new AccesRetire('Nextcloud refuse le mot de passe d’application.')
  }

  async function propfind(
    chemin: readonly string[],
    profondeur: 0 | 1
  ): Promise<EntreeDav[] | null> {
    const { reponse, secret: s } = await appel(s => ({
      adresse: adresseDe(s, chemin),
      init: {
        method: 'PROPFIND',
        headers: {
          depth: String(profondeur),
          'content-type': 'application/xml; charset=utf-8',
        },
        body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="${OC}">${PROPRIETES}</d:propfind>`,
      },
    }))
    if (reponse.status === 404) {
      await reponse.body?.cancel()
      return null
    }
    if (reponse.status !== 207) {
      await reponse.body?.cancel()
      throw new FournisseurIndisponible(`Nextcloud répond ${reponse.status}.`)
    }
    return lireMultistatus(await texteBorne(reponse), racineDav(s))
  }

  /** Le chemin actuel d'un élément connu par son identifiant, ou null. */
  async function cheminDe(fileid: string): Promise<string[] | null> {
    if (!/^\d+$/.test(fileid)) return null
    const { reponse, secret: s } = await appel(s => ({
      adresse: `${s.base}/remote.php/dav/`,
      init: {
        method: 'SEARCH',
        headers: { 'content-type': 'text/xml; charset=utf-8' },
        body: `<?xml version="1.0" encoding="UTF-8"?><d:searchrequest xmlns:d="DAV:" xmlns:oc="${OC}"><d:basicsearch><d:select>${PROPRIETES}</d:select><d:from><d:scope><d:href>/files/${xml(s.utilisateur)}</d:href><d:depth>infinity</d:depth></d:scope></d:from><d:where><d:eq><d:prop><oc:fileid/></d:prop><d:literal>${fileid}</d:literal></d:eq></d:where></d:basicsearch></d:searchrequest>`,
      },
    }))
    if (reponse.status !== 207) {
      await reponse.body?.cancel()
      if (reponse.status === 404) return null
      throw new FournisseurIndisponible(
        `Nextcloud refuse la recherche (${reponse.status}).`
      )
    }
    const entrees = lireMultistatus(await texteBorne(reponse), racineDav(s))
    return entrees.find(e => e.fileid === fileid)?.chemin ?? null
  }

  /** Vrai quand l'emplacement désigne l'instance connectée. */
  const surCetteInstance = async (emplacement: string) =>
    emplacement === (await secret(false)).base

  /**
   * Le chemin complet d'une position, ou null quand sa base n'existe plus ou
   * qu'elle appartient à une autre instance.
   */
  async function cheminComplet(p: Position): Promise<string[] | null> {
    if (!(await surCetteInstance(p.emplacement))) return null
    if (p.base === null) return [...p.chemin]
    const base = await cheminDe(p.base)
    return base === null ? null : [...base, ...p.chemin]
  }

  async function exiger(p: Position): Promise<string[]> {
    const chemin = await cheminComplet(p)
    if (chemin === null)
      throw new FournisseurIndisponible('Élément introuvable.')
    return chemin
  }

  const versElement = (s: SecretNextcloud, e: EntreeDav): ElementEspace => ({
    id: e.fileid,
    nom: e.chemin[e.chemin.length - 1] ?? 'Fichiers',
    dossier: e.dossier,
    taille: e.taille,
    modifieLe: e.modifieLe,
    typeMime: e.typeMime,
    lienWeb: `${s.base}/index.php/f/${e.fileid}`,
    etag: e.etag,
  })

  async function lireElement(
    chemin: readonly string[]
  ): Promise<ElementEspace | null> {
    const entree = (await propfind(chemin, 0))?.[0]
    if (entree === undefined) return null
    return versElement(await secret(false), entree)
  }

  return {
    fournisseur: 'NEXTCLOUD',
    // Nextcloud ne fabrique pas de PDF : un document bureautique se télécharge.
    convertitEnPdf: () => false,

    async emplacements(): Promise<Emplacement[]> {
      const s = await secret(false)
      return [{ id: s.base, nom: 'Fichiers', site: new URL(s.base).host }]
    },

    async ancetres(emplacement, element) {
      if (!(await surCetteInstance(emplacement))) return null
      const chemin = await cheminDe(element)
      if (chemin === null) return null
      const chaine: { id: string; nom: string }[] = []
      for (
        let i = chemin.length;
        i >= 0 && chaine.length < PROFONDEUR_MAX;
        i--
      ) {
        const entree = (await propfind(chemin.slice(0, i), 0))?.[0]
        if (entree === undefined) break
        chaine.push({ id: entree.fileid, nom: chemin[i - 1] ?? 'Fichiers' })
      }
      return chaine.length === 0 ? null : chaine
    },

    async element(p) {
      const chemin = await cheminComplet(p)
      return chemin === null ? null : lireElement(chemin)
    },

    async lister(p): Promise<ListeElements | null> {
      const chemin = await cheminComplet(p)
      if (chemin === null) return null
      const entrees = await propfind(chemin, 1)
      const soi = entrees?.find(e => e.chemin.length === chemin.length)
      if (entrees === null || soi === undefined || !soi.dossier) return null
      const s = await secret(false)
      return {
        elements: entrees
          .filter(e => e.chemin.length === chemin.length + 1)
          .map(e => versElement(s, e)),
        complet: true,
      }
    },

    async ouvrir(p, { pdf }) {
      if (pdf) {
        throw new FournisseurIndisponible('Nextcloud ne convertit pas en PDF.')
      }
      const chemin = await exiger(p)
      const { reponse } = await appel(s => ({
        adresse: adresseDe(s, chemin),
        init: { method: 'GET', delaiMs: DELAI_CONTENU_MS },
      }))
      if (!reponse.ok || reponse.body === null) {
        await reponse.body?.cancel()
        throw new FournisseurIndisponible(
          `Nextcloud répond ${reponse.status} pour le contenu.`
        )
      }
      const taille = Number(reponse.headers.get('content-length'))
      return {
        flux: reponse.body,
        taille: Number.isFinite(taille) && taille > 0 ? taille : null,
      }
    },

    async creerDossier(parent, nom, { renommer }) {
      const dossier = await exiger(parent)
      for (let n = 0; n < 50; n++) {
        const libre = n === 0 ? nom : `${nom} ${n}`
        const chemin = [...dossier, libre]
        const { reponse } = await appel(s => ({
          adresse: adresseDe(s, chemin),
          init: { method: 'MKCOL' },
        }))
        await reponse.body?.cancel()
        if (reponse.status === 201) {
          const cree = await lireElement(chemin)
          if (cree === null)
            throw new FournisseurIndisponible('Dossier introuvable.')
          return cree
        }
        // 405 : un élément de ce nom existe déjà.
        if (reponse.status !== 405) {
          throw new FournisseurIndisponible(
            `Nextcloud refuse la création du dossier (${reponse.status}).`
          )
        }
        if (!renommer) {
          const existant = await lireElement(chemin)
          if (existant?.dossier === true) return existant
          throw new FournisseurIndisponible(
            'Un fichier porte déjà le nom de ce dossier.'
          )
        }
      }
      throw new FournisseurIndisponible('Aucun nom libre pour ce dossier.')
    },

    async ecrire(p, texte) {
      const chemin = await exiger(p)
      const { reponse } = await appel(s => ({
        adresse: adresseDe(s, chemin),
        init: {
          method: 'PUT',
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
          body: texte,
        },
      }))
      await reponse.body?.cancel()
      if (reponse.status !== 201 && reponse.status !== 204) {
        throw new FournisseurIndisponible(
          `Nextcloud refuse l’écriture (${reponse.status}).`
        )
      }
      const etag = sansGuillemets(
        reponse.headers.get('oc-etag') ?? reponse.headers.get('etag')
      )
      return { etag: etag ?? (await lireElement(chemin))?.etag ?? null }
    },

    async supprimer(p) {
      // Nextcloud place un fichier supprimé dans sa corbeille.
      const chemin = await cheminComplet(p)
      if (chemin === null) return
      const { reponse } = await appel(s => ({
        adresse: adresseDe(s, chemin),
        init: { method: 'DELETE' },
      }))
      await reponse.body?.cancel()
      if (!reponse.ok && reponse.status !== 404) {
        throw new FournisseurIndisponible(
          `Nextcloud refuse la suppression (${reponse.status}).`
        )
      }
    },
  }
}
