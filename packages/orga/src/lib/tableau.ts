import { normaliser } from './recherche'

/** Valeur qu'une colonne fournit pour trier ses lignes. */
export type ValeurTri = string | number | boolean | null | undefined

/** Largeur minimale d'une colonne redimensionnée, en pixels. */
export const LARGEUR_MIN = 64
/** Largeur maximale d'une colonne redimensionnée, en pixels. */
export const LARGEUR_MAX = 960

const comparateur = new Intl.Collator('fr', {
  sensitivity: 'base',
  numeric: true,
})

function estVide(valeur: ValeurTri): valeur is null | undefined | '' {
  return valeur === null || valeur === undefined || valeur === ''
}

/**
 * Compare deux valeurs de tri. Les textes suivent l'ordre alphabétique français,
 * sans tenir compte des accents ni de la casse. Une valeur vide se place après
 * les autres.
 */
export function comparer(a: ValeurTri, b: ValeurTri): number {
  if (estVide(a) || estVide(b)) return Number(estVide(a)) - Number(estVide(b))
  if (typeof a === 'string' || typeof b === 'string') {
    return comparateur.compare(String(a), String(b))
  }
  return Number(a) - Number(b)
}

/** Indique si un texte contient la saisie, sans tenir compte des accents ni de la casse. */
export function contient(texte: string, saisie: string): boolean {
  return normaliser(texte).includes(normaliser(saisie.trim()))
}

/** Ramène une largeur de colonne entre les bornes admises. */
export function bornerLargeur(largeur: number): number {
  return Math.round(Math.min(LARGEUR_MAX, Math.max(LARGEUR_MIN, largeur)))
}

/** Largeurs choisies par l'utilisateur, par clé de colonne. */
export type Largeurs = Record<string, number>

const cleStockage = (id: string) => `relaytour.tableau.${id}.largeurs`

function stockage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Lit les largeurs enregistrées pour un tableau. Une valeur illisible est ignorée. */
export function lireLargeurs(id: string, depot = stockage()): Largeurs {
  try {
    const brut: unknown = JSON.parse(depot?.getItem(cleStockage(id)) ?? '{}')
    if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) {
      return {}
    }
    const largeurs: Largeurs = {}
    for (const [cle, valeur] of Object.entries(brut)) {
      if (typeof valeur === 'number' && Number.isFinite(valeur)) {
        largeurs[cle] = bornerLargeur(valeur)
      }
    }
    return largeurs
  } catch {
    return {}
  }
}

/** Enregistre les largeurs d'un tableau sur le poste de l'utilisateur. */
export function ecrireLargeurs(
  id: string,
  largeurs: Largeurs,
  depot = stockage()
): void {
  try {
    if (Object.keys(largeurs).length === 0) depot?.removeItem(cleStockage(id))
    else depot?.setItem(cleStockage(id), JSON.stringify(largeurs))
  } catch {
    // Le stockage peut être plein ou interdit : les largeurs restent alors en mémoire.
  }
}

/**
 * Largeur d'un tableau à partir de laquelle ses premières colonnes se figent
 * d'office, en pixels. En dessous, elles occuperaient trop de place : la
 * personne les épingle elle-même.
 */
export const LARGEUR_COLONNES_FIGEES = 900

const cleEpingle = (id: string) => `relaytour.tableau.${id}.epingle`

/** Vrai quand la personne a épinglé les premières colonnes de ce tableau. */
export function lireEpingle(id: string, depot = stockage()): boolean {
  try {
    return depot?.getItem(cleEpingle(id)) === 'oui'
  } catch {
    return false
  }
}

export function ecrireEpingle(
  id: string,
  epingle: boolean,
  depot = stockage()
): void {
  try {
    if (epingle) depot?.setItem(cleEpingle(id), 'oui')
    else depot?.removeItem(cleEpingle(id))
  } catch {
    // Stockage indisponible : le choix vaut pour la page.
  }
}

/**
 * Vrai quand les premières colonnes restent visibles pendant le défilement
 * horizontal : d'office dans un tableau large, sur choix dans un tableau étroit.
 */
export function colonnesFigees(
  largeur: number | null,
  epingle: boolean
): boolean {
  return (largeur !== null && largeur >= LARGEUR_COLONNES_FIGEES) || epingle
}
