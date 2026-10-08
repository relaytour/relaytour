// Regroupement des tâches par phase, par fiche et par périmètre (ADR 0025).
//
// Une tâche ne porte aucune phase : elle se range par son échéance, comptée en
// jours depuis le premier jour de la période. Les deux dates sont des jours
// calendaires, lus dans leur texte : aucun fuseau horaire ne peut les décaler.

import { dateCourte } from './erreurs'

/** Une phase déclarée par l'activité. La dernière ne porte pas de borne. */
export interface Phase {
  cle: string
  libelle: string
  /** Dernier jour de la phase : J-120, J+30. */
  jusquA?: string | null
}

const RELATIVE = /^J([-+])(\d{1,3})$/
const JOUR = 86_400_000

/** Le nombre de jours d'une borne : -120 pour J-120, 30 pour J+30. */
export function joursRelatifs(
  relative: string | null | undefined
): number | null {
  const lu = RELATIVE.exec(relative ?? '')
  if (lu === null) return null
  const jours = Number(lu[2])
  return lu[1] === '-' && jours !== 0 ? -jours : jours
}

function instantUTC(date: string): number {
  const [annee, mois, jour] = date.slice(0, 10).split('-').map(Number)
  return Date.UTC(annee ?? 0, (mois ?? 1) - 1, jour ?? 1)
}

/** Le nombre de jours entre le premier jour de la période et une échéance. */
export function joursDepuisDebut(echeance: string, debut: string): number {
  return Math.round((instantUTC(echeance) - instantUTC(debut)) / JOUR)
}

/** Le jour situé à `jours` du premier jour de la période, au format AAAA-MM-JJ. */
export function jourRelatif(debut: string, jours: number): string {
  return new Date(instantUTC(debut) + jours * JOUR).toISOString().slice(0, 10)
}

/**
 * La phase d'une échéance : la première dont la borne n'est pas dépassée. La
 * dernière phase, sans borne, reçoit tout ce qui suit.
 */
export function phaseDe<P extends Phase>(
  jours: number,
  phases: readonly P[]
): P | undefined {
  return (
    phases.find(phase => {
      const borne = joursRelatifs(phase.jusquA)
      return borne === null || jours <= borne
    }) ?? phases[phases.length - 1]
  )
}

export interface GroupePhase<T, P extends Phase = Phase> {
  /** La phase, ou null pour les tâches sans échéance. */
  phase: P | null
  taches: T[]
}

/**
 * Regroupe les tâches par phase, dans l'ordre que déclare l'activité. L'ordre des
 * tâches d'un groupe est celui de la liste reçue. Une phase sans tâche ne forme pas
 * de groupe. Le groupe des tâches sans échéance arrive en dernier.
 */
export function grouperParPhase<
  T extends { echeance?: string | null },
  P extends Phase = Phase,
>(
  taches: readonly T[],
  phases: readonly P[],
  debut: string
): GroupePhase<T, P>[] {
  const parCle = new Map<string, T[]>()
  const sansEcheance: T[] = []
  for (const tache of taches) {
    const phase = tache.echeance
      ? phaseDe(joursDepuisDebut(tache.echeance, debut), phases)
      : undefined
    if (phase === undefined) {
      sansEcheance.push(tache)
      continue
    }
    const groupe = parCle.get(phase.cle)
    if (groupe) groupe.push(tache)
    else parCle.set(phase.cle, [tache])
  }
  const groupes: GroupePhase<T, P>[] = phases
    .filter(phase => parCle.has(phase.cle))
    .map(phase => ({ phase, taches: parCle.get(phase.cle)! }))
  if (sansEcheance.length > 0) {
    groupes.push({ phase: null, taches: sansEcheance })
  }
  return groupes
}

/**
 * Les jours que couvre une phase, en clair : « jusqu’au 12 mars 2027 · J-120 »,
 * puis « à partir du 13 mars 2027 » pour la dernière.
 */
export function libelleBorne(
  phase: Phase,
  phases: readonly Phase[],
  debut: string
): string {
  const borne = joursRelatifs(phase.jusquA)
  if (borne !== null) {
    return `jusqu’au ${dateCourte(jourRelatif(debut, borne))} · ${phase.jusquA}`
  }
  const rang = phases.findIndex(p => p.cle === phase.cle)
  const precedente = rang > 0 ? joursRelatifs(phases[rang - 1]?.jusquA) : null
  return precedente === null
    ? 'toute la période'
    : `à partir du ${dateCourte(jourRelatif(debut, precedente + 1))}`
}

export interface FicheLiee {
  id: string
  slug: string
  titre: string
}

export interface GroupeFiche<T> {
  /** La fiche méthode, ou null pour les tâches sans fiche. */
  fiche: FicheLiee | null
  taches: T[]
}

/**
 * Regroupe les tâches par fiche méthode liée. Les groupes suivent l'ordre de la
 * liste reçue : la fiche de la première tâche vient en tête. Le groupe des tâches
 * sans fiche arrive en dernier.
 */
export function grouperParFiche<T extends { fiche?: FicheLiee | null }>(
  taches: readonly T[]
): GroupeFiche<T>[] {
  const groupes = new Map<string, GroupeFiche<T>>()
  const sansFiche: T[] = []
  for (const tache of taches) {
    if (!tache.fiche) {
      sansFiche.push(tache)
      continue
    }
    const groupe = groupes.get(tache.fiche.id)
    if (groupe) groupe.taches.push(tache)
    else groupes.set(tache.fiche.id, { fiche: tache.fiche, taches: [tache] })
  }
  return [
    ...groupes.values(),
    ...(sansFiche.length > 0 ? [{ fiche: null, taches: sansFiche }] : []),
  ]
}

export interface PerimetreRange {
  id: string
  nom: string
  groupe: string
  ordre?: number | null
}

export interface GroupePerimetre<T, P extends PerimetreRange = PerimetreRange> {
  perimetre: P
  taches: T[]
}

/**
 * Regroupe les tâches par périmètre. Les périmètres suivent l'ordre des groupes de
 * l'activité, puis leur ordre déclaré, puis leur nom.
 */
export function grouperParPerimetre<T extends { perimetre: PerimetreRange }>(
  taches: readonly T[],
  clesDesGroupes: readonly string[]
): GroupePerimetre<T, T['perimetre']>[] {
  const groupes = new Map<string, GroupePerimetre<T, T['perimetre']>>()
  for (const tache of taches) {
    const groupe = groupes.get(tache.perimetre.id)
    if (groupe) groupe.taches.push(tache)
    else {
      groupes.set(tache.perimetre.id, {
        perimetre: tache.perimetre,
        taches: [tache],
      })
    }
  }
  const rang = (cle: string) => {
    const r = clesDesGroupes.indexOf(cle)
    return r === -1 ? clesDesGroupes.length : r
  }
  return [...groupes.values()].sort(
    (a, b) =>
      rang(a.perimetre.groupe) - rang(b.perimetre.groupe) ||
      (a.perimetre.ordre ?? 0) - (b.perimetre.ordre ?? 0) ||
      a.perimetre.nom.localeCompare(b.perimetre.nom, 'fr')
  )
}

// Le regroupement choisi est une commodité propre au navigateur.

/** Clé du regroupement des tâches d'un périmètre. */
export const CLE_REGROUPEMENT_TACHES = 'relaytour.taches.regroupement'
/** Clé du regroupement du rétroplanning. */
export const CLE_REGROUPEMENT_RETROPLANNING =
  'relaytour.retroplanning.regroupement'

function stockage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Lit un regroupement gardé par le navigateur. Une valeur inconnue vaut le défaut. */
export function lireRegroupement<T extends string>(
  cle: string,
  admis: readonly T[],
  defaut: T,
  depot = stockage()
): T {
  try {
    const lu = depot?.getItem(cle)
    return admis.includes(lu as T) ? (lu as T) : defaut
  } catch {
    return defaut
  }
}

/** Garde un regroupement dans le navigateur. Un dépôt indisponible est ignoré. */
export function ecrireRegroupement(
  cle: string,
  valeur: string,
  depot = stockage()
): void {
  try {
    depot?.setItem(cle, valeur)
  } catch {
    // Le navigateur refuse l'écriture (navigation privée, quota) : le choix vaut
    // pour l'écran affiché seulement.
  }
}
