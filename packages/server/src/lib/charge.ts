import { decalerJour, ecartEnJours } from './agenda.ts'
import { joursRelatifs, type Phase } from './phases.ts'

// Charge des personnes de l'équipe pour une édition (ADR 0055).
//
// Ce module ne lit pas la base : le schéma lui passe les tâches, les places et les
// affectations de l'édition, et il compte. La charge se compte en tâches et en
// places, sans estimation d'effort. Les jours s'entendent dans le fuseau de
// l'organisation, comme les échéances.

/** Une échéance est « proche » jusqu'à ce nombre de jours après aujourd'hui. */
export const JOURS_PROCHES = 7

export type StatutTache = 'A_FAIRE' | 'EN_COURS' | 'FAITE' | 'ABANDONNEE'

export interface TacheDeCharge {
  statut: StatutTache
  echeance: Date | null
  assignes: readonly string[]
  /** Les personnes créditées de la tâche faite : réalisatrices, sinon qui a coché. */
  credites: readonly string[]
}

export interface PlaceDeCharge {
  userId: string
  debut: Date
  fin: Date
}

export interface AffectationDeCharge {
  userId: string
  perimetreId: string
  contactPrincipal: boolean
}

export interface ChargeMaintenant {
  total: number
  enRetard: number
  proches: number
  plusTard: number
  sansEcheance: number
  /** Tâches ouvertes qui ont aussi d'autres personnes assignées. */
  partagees: number
}

export interface ChargeEdition {
  total: number
  aFaire: number
  enCours: number
  faites: number
  abandonnees: number
  /** Tâches assignées par phase, dans l'ordre des phases ; sans échéance : `null`. */
  parPhase: { cle: string | null; total: number }[]
}

export interface ChargePlaces {
  total: number
  aVenir: number
  prochaine: Date | null
}

export interface Charge {
  userId: string
  affectations: AffectationDeCharge[]
  maintenant: ChargeMaintenant
  edition: ChargeEdition
  places: ChargePlaces
  /** Tâches faites où la personne est créditée. Le schéma décide qui le lit. */
  realisees: number
}

function chargeVide(userId: string, phases: readonly Phase[]): Charge {
  return {
    userId,
    affectations: [],
    maintenant: {
      total: 0,
      enRetard: 0,
      proches: 0,
      plusTard: 0,
      sansEcheance: 0,
      partagees: 0,
    },
    edition: {
      total: 0,
      aFaire: 0,
      enCours: 0,
      faites: 0,
      abandonnees: 0,
      parPhase: [
        ...phases.map(p => ({ cle: p.cle, total: 0 })),
        { cle: null, total: 0 },
      ],
    },
    places: { total: 0, aVenir: 0, prochaine: null },
    realisees: 0,
  }
}

/**
 * La phase d'une échéance : la première dont la borne n'est pas dépassée, sinon la
 * dernière. Même règle que l'espace organisateur (ADR 0025).
 */
export function phaseDeLEcheance(
  echeance: string,
  debutEdition: string,
  phases: readonly Phase[]
): Phase | undefined {
  const jours = ecartEnJours(debutEdition, echeance)
  return (
    phases.find(
      p => p.jusquA === undefined || jours <= joursRelatifs(p.jusquA)
    ) ?? phases[phases.length - 1]
  )
}

const jourDe = (date: Date) => date.toISOString().slice(0, 10)

/**
 * La charge de chaque personne concernée : affectée à l'édition, assignée à une de
 * ses tâches ou placée sur une de ses séquences. Les personnes sont triées par
 * charge actuelle décroissante.
 */
export function calculerCharges(entree: {
  taches: readonly TacheDeCharge[]
  places: readonly PlaceDeCharge[]
  affectations: readonly AffectationDeCharge[]
  /** Le jour présent dans le fuseau de l'organisation (AAAA-MM-JJ). */
  aujourdhui: string
  maintenant: Date
  debutEdition: Date
  phases: readonly Phase[]
}): Charge[] {
  const charges = new Map<string, Charge>()
  const de = (userId: string) => {
    let charge = charges.get(userId)
    if (!charge) {
      charge = chargeVide(userId, entree.phases)
      charges.set(userId, charge)
    }
    return charge
  }
  const limiteProche = decalerJour(entree.aujourdhui, JOURS_PROCHES)
  const debut = jourDe(entree.debutEdition)

  for (const a of entree.affectations) de(a.userId).affectations.push(a)

  for (const tache of entree.taches) {
    const echeance = tache.echeance ? jourDe(tache.echeance) : null
    const phase = echeance
      ? phaseDeLEcheance(echeance, debut, entree.phases)
      : undefined
    const ouverte = tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS'
    for (const userId of tache.assignes) {
      const charge = de(userId)
      const e = charge.edition
      e.total += 1
      if (tache.statut === 'A_FAIRE') e.aFaire += 1
      else if (tache.statut === 'EN_COURS') e.enCours += 1
      else if (tache.statut === 'FAITE') e.faites += 1
      else e.abandonnees += 1
      const groupe = e.parPhase.find(g => g.cle === (phase?.cle ?? null))
      if (groupe) groupe.total += 1
      if (!ouverte) continue
      const m = charge.maintenant
      m.total += 1
      if (tache.assignes.length > 1) m.partagees += 1
      if (echeance === null) m.sansEcheance += 1
      else if (echeance < entree.aujourdhui) m.enRetard += 1
      else if (echeance <= limiteProche) m.proches += 1
      else m.plusTard += 1
    }
  }

  for (const place of entree.places) {
    const p = de(place.userId).places
    p.total += 1
    if (place.fin >= entree.maintenant) {
      p.aVenir += 1
      if (p.prochaine === null || place.debut < p.prochaine) {
        p.prochaine = place.debut
      }
    }
  }

  // Les tâches réalisées se comptent en dernier, pour les seules personnes déjà
  // listées : une personne seulement créditée n'entre pas dans la charge.
  for (const tache of entree.taches) {
    if (tache.statut !== 'FAITE') continue
    for (const userId of tache.credites) {
      const charge = charges.get(userId)
      if (charge) charge.realisees += 1
    }
  }

  return [...charges.values()].sort(
    (a, b) =>
      b.maintenant.total - a.maintenant.total ||
      b.places.aVenir - a.places.aVenir ||
      b.edition.total - a.edition.total
  )
}
