import { comparer, contient } from './tableau'

// Réglages de l'écran « Équipe » : la vue, la période, le filtre, la recherche et le
// tri se lisent dans l'adresse. Ils restent ainsi en place au changement de vue et
// au retour depuis la page d'un périmètre.

export const VUES = ['equipe', 'avancement'] as const
export type Vue = (typeof VUES)[number]

export const TRIS = [
  'priorite',
  'ordre',
  'nom',
  'retard',
  'avancement',
] as const
export type Tri = (typeof TRIS)[number]

export type Filtre = 'tous' | 'aPourvoir' | 'retard' | 'sansPersonne'

/** Les filtres proposés par chaque vue. Le premier est la valeur par défaut. */
export const FILTRES: Record<Vue, readonly Filtre[]> = {
  equipe: ['tous', 'aPourvoir'],
  avancement: ['tous', 'retard', 'sansPersonne'],
}

/**
 * Valeur du filtre de groupe qui garde tous les périmètres. Une clé de groupe est
 * un identifiant : elle ne peut pas valoir « * ».
 */
export const TOUS_LES_GROUPES = '*'

export interface Reglages {
  vue: Vue
  /** La période demandée par l'adresse, quand elle en nomme une. */
  edition: string | undefined
  /** La clé d'un groupe de l'activité, ou `TOUS_LES_GROUPES`. */
  groupe: string
  q: string
  tri: Tri
  filtre: Filtre
}

const DEFAUTS: Record<Exclude<keyof Reglages, 'edition'>, string> = {
  vue: 'equipe',
  groupe: TOUS_LES_GROUPES,
  q: '',
  tri: 'priorite',
  filtre: 'tous',
}

function parmi<T extends string>(
  admis: readonly T[],
  valeur: string | null,
  defaut: T
): T {
  return admis.includes(valeur as T) ? (valeur as T) : defaut
}

/**
 * Lit les réglages dans les paramètres de l'adresse. Une valeur inconnue, un groupe
 * que l'activité ne déclare pas ou un filtre d'une autre vue retombent sur la valeur
 * par défaut.
 */
export function lireReglages(
  parametres: URLSearchParams,
  groupes: readonly string[]
): Reglages {
  const vue = parmi(VUES, parametres.get('vue'), 'equipe')
  return {
    vue,
    edition: parametres.get('edition') ?? undefined,
    groupe: parmi(groupes, parametres.get('groupe'), TOUS_LES_GROUPES),
    q: parametres.get('q') ?? '',
    tri: parmi(TRIS, parametres.get('tri'), 'priorite'),
    filtre: parmi(FILTRES[vue], parametres.get('filtre'), 'tous'),
  }
}

/**
 * Renvoie les paramètres de l'adresse après un changement de réglages. Une valeur
 * par défaut ou vide sort de l'adresse.
 */
export function ecrireReglages(
  parametres: URLSearchParams,
  changements: Partial<Reglages>
): URLSearchParams {
  const suivants = new URLSearchParams(parametres)
  for (const [cle, valeur] of Object.entries(changements)) {
    if (valeur === undefined || valeur === DEFAUTS[cle as keyof typeof DEFAUTS])
      suivants.delete(cle)
    else suivants.set(cle, valeur)
  }
  return suivants
}

/** Ce que le filtre, la recherche et le tri lisent d'un périmètre. */
export interface LignePerimetre {
  id: string
  nom: string
  groupe: string
  /** Rang du groupe dans la déclaration de l'activité. */
  rangGroupe: number
  ordre: number
  /** Les noms des personnes affectées pour la période. */
  personnes: readonly string[]
  aPourvoir: number
  /** Tâches en retard. */
  enRetard: number
  /** Tâches sans personne assignée. */
  sansPersonne: number
  /** Part des tâches faites, de 0 à 1. Nulle sans tâche à faire. */
  part: number | null
}

/** Part des tâches faites parmi les tâches qui ne sont pas abandonnées. */
export function partFaite(avancement: {
  total: number
  faites: number
  abandonnees: number
}): number | null {
  const utiles = avancement.total - avancement.abandonnees
  return utiles > 0 ? avancement.faites / utiles : null
}

const GARDES: Record<Filtre, (ligne: LignePerimetre) => boolean> = {
  tous: () => true,
  aPourvoir: ligne => ligne.aPourvoir > 0,
  retard: ligne => ligne.enRetard > 0,
  sansPersonne: ligne => ligne.sansPersonne > 0,
}

/**
 * Garde les périmètres du groupe et du filtre choisis. La recherche compare le nom
 * du périmètre et les noms des personnes affectées.
 */
export function filtrer<T extends LignePerimetre>(
  lignes: readonly T[],
  { groupe, q, filtre }: Pick<Reglages, 'groupe' | 'q' | 'filtre'>
): T[] {
  const saisie = q.trim()
  return lignes.filter(
    ligne =>
      (groupe === TOUS_LES_GROUPES || ligne.groupe === groupe) &&
      GARDES[filtre](ligne) &&
      (saisie === '' ||
        contient(ligne.nom, saisie) ||
        ligne.personnes.some(nom => contient(nom, saisie)))
  )
}

const parOrdre = (a: LignePerimetre, b: LignePerimetre) =>
  a.rangGroupe - b.rangGroupe || a.ordre - b.ordre || comparer(a.nom, b.nom)

const COMPARAISONS: Record<
  Exclude<Tri, 'priorite'>,
  (a: LignePerimetre, b: LignePerimetre) => number
> = {
  ordre: parOrdre,
  nom: (a, b) => comparer(a.nom, b.nom),
  retard: (a, b) => b.enRetard - a.enRetard,
  // Les périmètres les moins avancés viennent en premier, ceux sans tâche en dernier.
  avancement: (a, b) => comparer(a.part, b.part),
}

/**
 * Trie les périmètres. « priorite » garde l'ordre reçu : le serveur place en premier
 * les périmètres qui manquent de référentes et de référents. À égalité, les autres
 * tris suivent l'ordre de l'activité.
 */
export function trier<T extends LignePerimetre>(
  lignes: readonly T[],
  tri: Tri
): T[] {
  if (tri === 'priorite') return [...lignes]
  const comparaison = COMPARAISONS[tri]
  return [...lignes].sort((a, b) => comparaison(a, b) || parOrdre(a, b))
}
