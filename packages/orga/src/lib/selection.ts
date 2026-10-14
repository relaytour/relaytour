// Organisation et activité choisies (ADR 0008).
//
// L'espace organisateur envoie ces deux slugs en en-tête de chaque requête
// (lib/apollo.ts) : le serveur limite ses réponses à cette organisation et, sans
// autre précision, à cette activité. Chaque onglet garde son organisation, et le
// navigateur se souvient du dernier choix (ADR 0032) ; ce souvenir n'est qu'une
// commodité, le serveur vérifie chaque appartenance.

const CLE_ORGANISATION = 'relaytour.organisation'
const cleActivite = (organisation: string | null) =>
  `relaytour.activite.${organisation ?? 'unique'}`

type Stockage = 'navigateur' | 'onglet'

function stockage(type: Stockage): Storage {
  return type === 'navigateur' ? window.localStorage : window.sessionStorage
}

function lire(cle: string, type: Stockage = 'navigateur'): string | null {
  try {
    return stockage(type).getItem(cle)
  } catch {
    return null
  }
}

function ecrire(
  cle: string,
  valeur: string | null,
  type: Stockage = 'navigateur'
) {
  try {
    if (valeur === null) stockage(type).removeItem(cle)
    else stockage(type).setItem(cle, valeur)
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la page.
  }
}

/**
 * L'organisation que désigne l'adresse d'ouverture de l'application installée
 * (`/?organisation=<slug>`, ADR 0023). Sur iPhone, l'application installée ne
 * partage pas le stockage du navigateur : elle ne connaît que cette adresse.
 */
export function organisationDeLAdresse(recherche: string): string | null {
  const slug = new URLSearchParams(recherche).get('organisation')
  return slug !== null && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null
}

/**
 * L'organisation d'un onglet qui s'ouvre (ADR 0032) : celle de l'adresse, sinon celle
 * que l'onglet a déjà choisie (un rechargement), sinon le dernier choix du
 * navigateur. Chaque onglet garde ainsi son organisation : un onglet ouvert sur une
 * autre organisation ne change pas celle des onglets déjà ouverts.
 */
export function organisationRetenue(sources: {
  adresse: string | null
  onglet: string | null
  navigateur: string | null
}): string | null {
  return sources.adresse ?? sources.onglet ?? sources.navigateur
}

function organisationInitiale(): string | null {
  if (typeof window === 'undefined') return null
  const retenue = organisationRetenue({
    adresse: organisationDeLAdresse(window.location.search),
    onglet: lire(CLE_ORGANISATION, 'onglet'),
    navigateur: lire(CLE_ORGANISATION),
  })
  if (retenue !== null) {
    ecrire(CLE_ORGANISATION, retenue, 'onglet')
    ecrire(CLE_ORGANISATION, retenue)
  }
  return retenue
}

let organisation: string | null = organisationInitiale()
let activite: string | null = null

/** Le slug de l'organisation choisie, ou null pour laisser le serveur décider. */
export function organisationChoisie(): string | null {
  return organisation
}

export function choisirOrganisation(slug: string | null) {
  organisation = slug
  activite = null
  // L'onglet garde son choix ; le navigateur le retient pour la prochaine ouverture.
  ecrire(CLE_ORGANISATION, slug, 'onglet')
  ecrire(CLE_ORGANISATION, slug)
}

/** Le slug de l'activité affichée, envoyé en en-tête. */
export function activiteAffichee(): string | null {
  return activite
}

/** Retient l'activité affichée, pour les requêtes et pour la prochaine visite. */
export function afficherActivite(slug: string) {
  activite = slug
  ecrire(cleActivite(organisation), slug)
}

/** La dernière activité affichée dans l'organisation choisie, si le navigateur la connaît. */
export function derniereActivite(): string | null {
  return lire(cleActivite(organisation))
}
