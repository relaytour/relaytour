import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { minutes, segmentDuJour } from './programme'

// Vue « Répartition » du programme (ADR 0041), côté navigateur : l'axe des heures
// d'un jour, la position d'un intervalle sur cet axe, et les avertissements d'un
// placement. Les heures se lisent en texte HH:MM, dans le fuseau de
// l'organisation que le serveur applique.

export interface Intervalle {
  /** Minutes depuis minuit. */
  debut: number
  fin: number
}

export interface Horaire {
  jour: string
  jourFin: string
  heureDebut: string
  heureFin: string
}

/** L'axe d'un jour : de l'heure pleine avant le premier intervalle à celle après le dernier. */
export function axeDuJour(intervalles: readonly Intervalle[]): Intervalle {
  if (intervalles.length === 0) return { debut: 8 * 60, fin: 20 * 60 }
  return {
    debut: Math.floor(Math.min(...intervalles.map(i => i.debut)) / 60) * 60,
    fin: Math.ceil(Math.max(...intervalles.map(i => i.fin)) / 60) * 60,
  }
}

/** La position d'un intervalle sur l'axe, en pourcentages, coupée aux bornes. */
export function position(
  i: Intervalle,
  axe: Intervalle
): { gauche: number; largeur: number } {
  const duree = axe.fin - axe.debut
  const debut = Math.max(i.debut, axe.debut)
  const fin = Math.min(i.fin, axe.fin)
  return {
    gauche: ((debut - axe.debut) / duree) * 100,
    largeur: (Math.max(0, fin - debut) / duree) * 100,
  }
}

/**
 * Un horaire sur un axe commun à tous les jours, en minutes. Les avertissements et
 * les chevauchements comparent les horaires entiers, après minuit compris ; le
 * découpage par jour ne sert qu'à l'affichage.
 */
export function intervalleAbsolu(h: Horaire): Intervalle {
  const jour = (j: string) => Date.parse(`${j}T00:00:00Z`) / 60_000
  return {
    debut: jour(h.jour) + minutes(h.heureDebut),
    fin: jour(h.jourFin) + minutes(h.heureFin),
  }
}

/** Les parts d'horaires qui touchent un jour. */
export function intervallesDuJour(
  horaires: readonly Horaire[],
  jour: string
): Intervalle[] {
  return horaires.flatMap(h => {
    const segment = segmentDuJour(h, jour)
    return segment === null ? [] : [segment]
  })
}

export function chevauchent(a: Intervalle, b: Intervalle): boolean {
  return a.debut < b.fin && b.debut < a.fin
}

export type Avertissement =
  'HORS_PLAGES' | 'PLAGE_PARTIELLE' | 'CHEVAUCHEMENT' | 'BESOIN_ATTEINT'

/**
 * Les avertissements d'un placement : la personne n'a pas de plage sur la
 * séquence, ou seulement une partie ; elle tient déjà une place à la même heure ;
 * le besoin est déjà atteint. Aucun ne bloque le placement.
 */
export function avertissements(entree: {
  sequence: Intervalle
  plages: readonly Intervalle[]
  places: readonly Intervalle[]
  besoin: number | null
  renforts: number
}): Avertissement[] {
  const { sequence, plages } = entree
  const liste: Avertissement[] = []
  const couvre = plages.some(
    p => p.debut <= sequence.debut && p.fin >= sequence.fin
  )
  if (!couvre) {
    liste.push(
      plages.some(p => chevauchent(p, sequence))
        ? 'PLAGE_PARTIELLE'
        : 'HORS_PLAGES'
    )
  }
  if (entree.places.some(p => chevauchent(p, sequence))) {
    liste.push('CHEVAUCHEMENT')
  }
  if (entree.besoin !== null && entree.renforts >= entree.besoin) {
    liste.push('BESOIN_ATTEINT')
  }
  return liste
}

export const LIBELLES_AVERTISSEMENT: Record<Avertissement, MessageDescriptor> =
  {
    HORS_PLAGES: msg`La personne n’a donné aucune disponibilité sur cet horaire.`,
    PLAGE_PARTIELLE: msg`La disponibilité de la personne ne couvre qu’une partie de la séquence.`,
    CHEVAUCHEMENT: msg`La personne tient déjà une place à la même heure.`,
    BESOIN_ATTEINT: msg`Le besoin de la séquence est déjà atteint.`,
  }

/** Une tranche de couverture manque de monde quand ses renforts restent sous le besoin. */
export function enManque(t: {
  besoin: number
  confirmees: number
  aConfirmer: number
}): boolean {
  return t.confirmees + t.aConfirmer < t.besoin
}
