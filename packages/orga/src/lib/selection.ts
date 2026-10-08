// Organisation et activité choisies (ADR 0008).
//
// L'espace organisateur envoie ces deux slugs en en-tête de chaque requête
// (lib/apollo.ts) : le serveur limite ses réponses à cette organisation et, sans
// autre précision, à cette activité. Le navigateur se souvient du dernier choix ;
// ce souvenir n'est qu'une commodité, le serveur vérifie chaque appartenance.

const CLE_ORGANISATION = 'relaytour.organisation'
const cleActivite = (organisation: string | null) =>
  `relaytour.activite.${organisation ?? 'unique'}`

function lire(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle)
  } catch {
    return null
  }
}

function ecrire(cle: string, valeur: string | null) {
  try {
    if (valeur === null) window.localStorage.removeItem(cle)
    else window.localStorage.setItem(cle, valeur)
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

function organisationInitiale(): string | null {
  const designee =
    typeof window === 'undefined'
      ? null
      : organisationDeLAdresse(window.location.search)
  if (designee === null) return lire(CLE_ORGANISATION)
  ecrire(CLE_ORGANISATION, designee)
  return designee
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
