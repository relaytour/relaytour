import { comparerTextes } from './langue'
import { contient } from './tableau'

// Réglages et calculs de la page « Charge » (ADR 0055). Les réglages vivent dans
// l'adresse, comme ceux de l'écran Équipe : un lien partagé montre la même vue.

export const TEMPS = ['maintenant', 'edition'] as const
export type Temps = (typeof TEMPS)[number]

export const TRIS = ['charge', 'nom'] as const
export type TriCharge = (typeof TRIS)[number]

export interface ReglagesCharge {
  temps: Temps
  tri: TriCharge
  groupe: string
  q: string
}

function parmi<T extends string>(
  valeur: string | null,
  valeurs: readonly T[],
  defaut: T
): T {
  return valeurs.includes(valeur as T) ? (valeur as T) : defaut
}

/** Les réglages lus dans l'adresse. Un groupe inconnu de l'activité vaut « tous ». */
export function lireReglagesCharge(
  parametres: URLSearchParams,
  groupes: readonly string[]
): ReglagesCharge {
  return {
    temps: parmi(parametres.get('temps'), TEMPS, 'maintenant'),
    tri: parmi(parametres.get('tri'), TRIS, 'charge'),
    groupe: parmi(parametres.get('groupe'), ['tous', ...groupes], 'tous'),
    q: parametres.get('q') ?? '',
  }
}

export interface LigneDeCharge {
  personne: { id: string; nom: string }
  affectations: { perimetre: { nom: string; groupe: string } }[]
  maintenant: { total: number }
  edition: { total: number }
  places: { aVenir: number; total: number }
}

/** Le nombre de tâches que la barre montre, selon le temps choisi. */
export function poids(ligne: LigneDeCharge, temps: Temps): number {
  return temps === 'maintenant' ? ligne.maintenant.total : ligne.edition.total
}

/** Le nombre de places au programme, selon le temps choisi. */
export function places(ligne: LigneDeCharge, temps: Temps): number {
  return temps === 'maintenant' ? ligne.places.aVenir : ligne.places.total
}

/**
 * Les lignes retenues par le groupe et la recherche, triées. La recherche porte
 * sur le nom de la personne et sur ses périmètres. Un groupe garde les personnes
 * affectées à un périmètre de ce groupe.
 */
export function filtrerCharges<T extends LigneDeCharge>(
  lignes: readonly T[],
  reglages: ReglagesCharge
): T[] {
  const q = reglages.q.trim()
  return lignes
    .filter(
      l =>
        reglages.groupe === 'tous' ||
        l.affectations.some(a => a.perimetre.groupe === reglages.groupe)
    )
    .filter(
      l =>
        q === '' ||
        contient(l.personne.nom, q) ||
        l.affectations.some(a => contient(a.perimetre.nom, q))
    )
    .sort((a, b) =>
      reglages.tri === 'nom'
        ? comparerTextes(a.personne.nom, b.personne.nom)
        : poids(b, reglages.temps) - poids(a, reglages.temps) ||
          places(b, reglages.temps) - places(a, reglages.temps) ||
          comparerTextes(a.personne.nom, b.personne.nom)
    )
}

/** Une part d'une barre, en pourcentage de l'échelle commune. */
export const part = (valeur: number, echelle: number) =>
  `${echelle === 0 ? 0 : (100 * valeur) / echelle}%`
