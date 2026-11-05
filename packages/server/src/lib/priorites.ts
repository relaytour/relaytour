import { decalerJour, ecartEnJours } from './agenda.ts'

// Priorités d'une période (ADR 0059).
//
// Ce module ne lit pas la base : le schéma lui passe les tâches ouvertes de la
// période, et il retient, note et classe. Les jours s'écrivent au format AAAA-MM-JJ,
// dans le fuseau de l'organisation, et se comparent comme des chaînes.

/** Durée minimale de l'horizon, en jours. */
export const HORIZON_MIN = 14
/** Durée maximale de l'horizon, en jours. */
export const HORIZON_MAX = 30
/** Sans prochain point, l'échéance « avant le point » tombe dans ce nombre de jours. */
export const JOURS_SANS_POINT = 7
/** Le nombre de priorités qu'un périmètre montre au plus. */
export const PRIORITES_PAR_PERIMETRE = 5

export type NiveauAjustement = 'BASSE' | 'HAUTE' | 'EPINGLEE'

export type CodeRaison =
  | 'RETARD'
  | 'RETARD_A_REVOIR'
  | 'ECHEANCE_PROCHE'
  | 'AVANT_LE_POINT'
  | 'REUNION_A_VENIR'
  | 'DECLINAISONS'
  | 'ACCORD_ATTENDU'
  | 'A_PRENDRE'
  | 'EN_COURS'
  | 'AJUSTEMENT'

/** Une raison du score : un code, ses points et la valeur qu'elle cite. */
export interface Raison {
  code: CodeRaison
  points: number
  /** Jours de retard ou jours avant l'échéance, selon le code. */
  jours?: number
  /** Nombre de déclinaisons actives, pour DECLINAISONS. */
  nombre?: number
  /** Le niveau, pour AJUSTEMENT. */
  niveau?: NiveauAjustement
}

export interface AjustementEnCours {
  niveau: NiveauAjustement
  /** Dernier jour où l'ajustement compte. */
  jusquAu: string
}

export interface TacheAClasser {
  id: string
  perimetreId: string
  statut: 'A_FAIRE' | 'EN_COURS'
  echeance: string | null
  /** Nombre de personnes assignées. */
  assignes: number
  /** Pour une tâche partagée : ses déclinaisons ouvertes et acceptées. */
  declinaisonsActives: number
  /** Pour une tâche partagée : ses déclinaisons qui attendent l'accord. */
  declinaisonsEnAttente: number
  /** Pour une tâche partagée : les échéances de ses déclinaisons ouvertes. */
  echeancesDeclinaisons: readonly string[]
  /** Réunions à venir, non annulées, liées à la tâche. */
  reunionsAVenir: number
  ajustement: AjustementEnCours | null
}

export interface Horizon {
  /** Premier jour : aujourd'hui. */
  debut: string
  /** Dernier jour couvert par les priorités. */
  fin: string
  /** Jour du prochain point, s'il existe. */
  prochainPoint: string | null
}

export interface TacheNotee<T extends TacheAClasser = TacheAClasser> {
  tache: T
  score: number
  raisons: Raison[]
  /** L'échéance qui sert au calcul : celle de la tâche, ou celle d'une déclinaison. */
  echeanceRetenue: string | null
  epinglee: boolean
}

export interface PrioritesDuPerimetre<T extends TacheAClasser = TacheAClasser> {
  perimetreId: string
  priorites: TacheNotee<T>[]
  /** Priorités au-delà du plafond. */
  autres: number
  /** La prochaine tâche ouverte, quand le périmètre n'a aucune priorité. */
  ensuite: T | null
}

/**
 * L'horizon : d'aujourd'hui au jour du prochain point, entre 14 et 30 jours. Sans
 * prochain point, il dure 14 jours.
 */
export function horizon(
  aujourdhui: string,
  prochainPoint: string | null
): Horizon {
  const min = decalerJour(aujourdhui, HORIZON_MIN)
  const max = decalerJour(aujourdhui, HORIZON_MAX)
  let fin = min
  if (prochainPoint !== null) {
    fin = prochainPoint < min ? min : prochainPoint > max ? max : prochainPoint
  }
  return { debut: aujourdhui, fin, prochainPoint }
}

/** L'échéance de calcul : la plus proche entre la tâche et ses déclinaisons. */
function echeanceRetenue(tache: TacheAClasser): string | null {
  const jours = [tache.echeance, ...tache.echeancesDeclinaisons].filter(
    (j): j is string => j !== null
  )
  return jours.length === 0 ? null : jours.sort()[0]!
}

/** L'ajustement qui compte encore aujourd'hui, ou rien. */
export function ajustementActif(
  ajustement: AjustementEnCours | null,
  aujourdhui: string
): AjustementEnCours | null {
  return ajustement !== null && ajustement.jusquAu >= aujourdhui
    ? ajustement
    : null
}

/** Le score d'une tâche et ses raisons. */
export function noter<T extends TacheAClasser>(
  tache: T,
  h: Horizon
): TacheNotee<T> {
  const raisons: Raison[] = []
  const echeance = echeanceRetenue(tache)
  if (echeance !== null) {
    const jours = ecartEnJours(h.debut, echeance)
    if (jours < 0 && -jours <= 14) {
      raisons.push({ code: 'RETARD', points: 45, jours: -jours })
    } else if (jours < 0) {
      raisons.push({ code: 'RETARD_A_REVOIR', points: 30, jours: -jours })
    } else if (jours <= 7) {
      raisons.push({ code: 'ECHEANCE_PROCHE', points: 35, jours })
    } else if (jours <= 14) {
      raisons.push({ code: 'ECHEANCE_PROCHE', points: 25, jours })
    } else if (jours <= 30) {
      raisons.push({ code: 'ECHEANCE_PROCHE', points: 12, jours })
    }
    const limite = h.prochainPoint ?? decalerJour(h.debut, JOURS_SANS_POINT)
    if (jours >= 0 && echeance <= limite) {
      raisons.push({ code: 'AVANT_LE_POINT', points: 15 })
    }
  }
  if (tache.reunionsAVenir > 0) {
    raisons.push({ code: 'REUNION_A_VENIR', points: 10 })
  }
  if (tache.declinaisonsActives > 0) {
    raisons.push({
      code: 'DECLINAISONS',
      points: Math.min(5 * tache.declinaisonsActives, 15),
      nombre: tache.declinaisonsActives,
    })
  }
  if (tache.declinaisonsEnAttente > 0) {
    raisons.push({ code: 'ACCORD_ATTENDU', points: 5 })
  }
  if (tache.assignes === 0) raisons.push({ code: 'A_PRENDRE', points: 8 })
  if (tache.statut === 'EN_COURS') raisons.push({ code: 'EN_COURS', points: 3 })

  const ajustement = ajustementActif(tache.ajustement, h.debut)
  if (ajustement !== null) {
    const points =
      ajustement.niveau === 'BASSE'
        ? -20
        : ajustement.niveau === 'HAUTE'
          ? 20
          : 0
    raisons.push({ code: 'AJUSTEMENT', points, niveau: ajustement.niveau })
  }
  const score = Math.max(
    0,
    raisons.reduce((s, r) => s + r.points, 0)
  )
  return {
    tache,
    score,
    raisons,
    echeanceRetenue: echeance,
    epinglee: ajustement?.niveau === 'EPINGLEE',
  }
}

/**
 * Une tâche entre dans les priorités quand son échéance est dépassée ou tombe dans
 * l'horizon, ou qu'un ajustement la marque haute ou épinglée.
 */
export function estRetenue(notee: TacheNotee, h: Horizon): boolean {
  const niveau = ajustementActif(notee.tache.ajustement, h.debut)?.niveau
  if (niveau === 'HAUTE' || niveau === 'EPINGLEE') return true
  return notee.echeanceRetenue !== null && notee.echeanceRetenue <= h.fin
}

function comparer(a: TacheNotee, b: TacheNotee): number {
  if (a.epinglee !== b.epinglee) return a.epinglee ? -1 : 1
  if (a.score !== b.score) return b.score - a.score
  const ea = a.echeanceRetenue ?? '9999-12-31'
  const eb = b.echeanceRetenue ?? '9999-12-31'
  if (ea !== eb) return ea < eb ? -1 : 1
  return a.tache.id < b.tache.id ? -1 : a.tache.id > b.tache.id ? 1 : 0
}

/**
 * Les priorités de chaque périmètre, dans l'ordre des périmètres reçus. Chaque
 * périmètre garde au plus `PRIORITES_PAR_PERIMETRE` priorités. Un périmètre sans
 * priorité reçoit sa prochaine tâche ouverte qui porte une échéance.
 */
export function classerPriorites<T extends TacheAClasser>(
  taches: readonly T[],
  perimetreIds: readonly string[],
  h: Horizon
): PrioritesDuPerimetre<T>[] {
  const parPerimetre = new Map<string, T[]>(perimetreIds.map(id => [id, []]))
  for (const tache of taches) parPerimetre.get(tache.perimetreId)?.push(tache)
  return perimetreIds.map(perimetreId => {
    const siennes = parPerimetre.get(perimetreId) ?? []
    const notees = siennes.map(t => noter(t, h))
    const retenues = notees.filter(n => estRetenue(n, h)).sort(comparer)
    const ensuite =
      retenues.length > 0
        ? null
        : (notees
            .filter(n => n.echeanceRetenue !== null)
            .sort((a, b) =>
              a.echeanceRetenue! < b.echeanceRetenue!
                ? -1
                : a.echeanceRetenue! > b.echeanceRetenue!
                  ? 1
                  : 0
            )[0]?.tache ?? null)
    return {
      perimetreId,
      priorites: retenues.slice(0, PRIORITES_PAR_PERIMETRE),
      autres: Math.max(0, retenues.length - PRIORITES_PAR_PERIMETRE),
      ensuite,
    }
  })
}
