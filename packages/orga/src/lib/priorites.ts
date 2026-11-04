import { useLingui } from '@lingui/react/macro'

import type { AjustementPriorite } from '../gql/graphql'

import { langueActive } from './langue'

// Priorités d'une période (ADR 0059). Le serveur calcule le score ; l'espace
// organisateur filtre seulement l'affichage. Le filtre se garde dans le navigateur
// et ne change ni le score ni l'ordre.

/** Le nombre de priorités qu'un périmètre montre avant « Voir les autres ». */
export const PRIORITES_VISIBLES = 3

export interface FiltrePriorites {
  /** Vrai : les seuls périmètres de la personne. */
  mesPerimetres: boolean
  /** Vrai : les seules tâches que personne n'a prises. */
  aPrendre: boolean
  /** La clé d'un groupe de périmètres, ou null pour tous. */
  groupe: string | null
}

export const FILTRE_PAR_DEFAUT: FiltrePriorites = {
  mesPerimetres: false,
  aPrendre: false,
  groupe: null,
}

const cleStockage = (activite: string) => `relaytour.priorites.${activite}`

function stockage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Le filtre enregistré pour une activité. Une valeur illisible donne le filtre par défaut. */
export function lireFiltre(
  activite: string,
  depot = stockage()
): FiltrePriorites {
  try {
    const brut: unknown = JSON.parse(
      depot?.getItem(cleStockage(activite)) ?? 'null'
    )
    if (brut === null || typeof brut !== 'object') return FILTRE_PAR_DEFAUT
    const lu = brut as Record<string, unknown>
    return {
      mesPerimetres: lu.mesPerimetres === true,
      aPrendre: lu.aPrendre === true,
      groupe: typeof lu.groupe === 'string' ? lu.groupe : null,
    }
  } catch {
    return FILTRE_PAR_DEFAUT
  }
}

/** Enregistre le filtre d'une activité sur le poste de la personne. */
export function ecrireFiltre(
  activite: string,
  filtre: FiltrePriorites,
  depot = stockage()
): void {
  try {
    depot?.setItem(cleStockage(activite), JSON.stringify(filtre))
  } catch {
    // Un stockage plein ou refusé n'empêche pas de filtrer.
  }
}

export interface PerimetreAFiltrer<T> {
  perimetre: { id: string; groupe: string }
  priorites: T[]
}

/**
 * Les périmètres et les priorités que le filtre laisse voir. Avec « À prendre »,
 * un périmètre dont aucune priorité n'est à prendre disparaît.
 */
export function filtrerPriorites<
  T extends { tache: { assignes: readonly unknown[] } },
  P extends PerimetreAFiltrer<T>,
>(
  perimetres: readonly P[],
  filtre: FiltrePriorites,
  miens: ReadonlySet<string>
) {
  return perimetres
    .filter(p => !filtre.mesPerimetres || miens.has(p.perimetre.id))
    .filter(p => filtre.groupe === null || p.perimetre.groupe === filtre.groupe)
    .flatMap(p => {
      if (!filtre.aPrendre) return [p]
      const priorites = p.priorites.filter(x => x.tache.assignes.length === 0)
      return priorites.length > 0 ? [{ ...p, priorites }] : []
    })
}

/** « lundi 9 novembre » : un jour AAAA-MM-JJ, sans décalage de fuseau. */
export function jourAvecNom(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number)
  return new Date(annee ?? 0, (mois ?? 1) - 1, jour ?? 1).toLocaleDateString(
    langueActive(),
    { weekday: 'long', day: 'numeric', month: 'long' }
  )
}

/** Le libellé d'un niveau d'ajustement. */
export function useLibelleAjustement() {
  const { t } = useLingui()
  return (niveau: AjustementPriorite) =>
    niveau === 'EPINGLEE'
      ? t`Épinglée`
      : niveau === 'HAUTE'
        ? t`Priorité haute`
        : t`Priorité basse`
}
