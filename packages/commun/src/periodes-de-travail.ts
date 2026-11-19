// Périodes de travail des tâches (ADR 0068).
//
// Une tâche porte une durée estimée facultative, choisie parmi quatre valeurs. Sa
// période de travail va de l'échéance moins la durée jusqu'à l'échéance. Les jours
// s'écrivent au format AAAA-MM-JJ et se comparent comme des chaînes.

export const DUREES_TACHE = [
  'QUELQUES_JOURS',
  'DEUX_A_TROIS_SEMAINES',
  'UN_A_DEUX_MOIS',
  'DEUX_A_TROIS_MOIS',
] as const

export type DureeTache = (typeof DUREES_TACHE)[number]

/** Les jours retenus pour chaque durée : la borne haute de l'intervalle. */
export const JOURS_DUREE: Readonly<Record<DureeTache, number>> = {
  QUELQUES_JOURS: 7,
  DEUX_A_TROIS_SEMAINES: 21,
  UN_A_DEUX_MOIS: 60,
  DEUX_A_TROIS_MOIS: 90,
}

/** La valeur de chaque durée dans le contenu d'une organisation (clé `duree`). */
export const DUREE_CONTENU: Readonly<Record<DureeTache, string>> = {
  QUELQUES_JOURS: 'quelques-jours',
  DEUX_A_TROIS_SEMAINES: 'deux-a-trois-semaines',
  UN_A_DEUX_MOIS: 'un-a-deux-mois',
  DEUX_A_TROIS_MOIS: 'deux-a-trois-mois',
}

/** La durée qu'une valeur du contenu désigne, ou null pour une valeur inconnue. */
export function dureeDuContenu(valeur: string): DureeTache | null {
  const trouvee = DUREES_TACHE.find(d => DUREE_CONTENU[d] === valeur)
  return trouvee ?? null
}

/**
 * Le premier jour de la période de travail (AAAA-MM-JJ), ou null quand la tâche n'a
 * pas de durée ou pas d'échéance. Le calcul se fait en jours calendaires, en UTC,
 * sans fuseau horaire.
 */
export function debutTravail(
  echeance: string | null | undefined,
  duree: DureeTache | null | undefined
): string | null {
  if (!echeance || !duree) return null
  const jour = new Date(`${echeance.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(jour.getTime())) return null
  jour.setUTCDate(jour.getUTCDate() - JOURS_DUREE[duree])
  return jour.toISOString().slice(0, 10)
}

export type SignalEcheance = 'retard' | 'aCommencer' | 'proche' | 'normale'

/** Le nombre de jours pendant lesquels une échéance sans période de travail est proche. */
export const JOURS_ECHEANCE_PROCHE = 7

/**
 * Le signal d'une échéance (ADR 0068). Le retard garde sa règle : une échéance
 * dépassée sur une tâche ouverte. Une tâche qui a une période de travail reçoit
 * « À commencer » quand elle est à faire et que sa période a commencé, et aucun
 * signal quand elle est en cours. Une tâche sans période de travail reçoit
 * « Échéance proche » dans les sept jours.
 */
export function signalEcheance(
  tache: {
    statut: string
    echeance?: string | null
    duree?: DureeTache | null
  },
  aujourdhui: string
): SignalEcheance {
  const ouverte = tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS'
  if (!ouverte || !tache.echeance) return 'normale'
  const echeance = tache.echeance.slice(0, 10)
  if (echeance < aujourdhui) return 'retard'
  const debut = debutTravail(echeance, tache.duree)
  if (debut !== null) {
    return tache.statut === 'A_FAIRE' && debut <= aujourdhui
      ? 'aCommencer'
      : 'normale'
  }
  const limite = new Date(`${aujourdhui}T00:00:00.000Z`)
  limite.setUTCDate(limite.getUTCDate() + JOURS_ECHEANCE_PROCHE)
  return echeance <= limite.toISOString().slice(0, 10) ? 'proche' : 'normale'
}
