// Programme du jour J (ADR 0040), côté navigateur : la grille d'un jour, une
// colonne par lieu et une ligne par tranche de 30 minutes. Les heures se lisent en
// texte HH:MM, dans le fuseau de l'organisation que le serveur applique.

export const TRANCHE_MINUTES = 30

export function minutes(heure: string): number {
  const [h, m] = heure.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** « 9 h », « 9 h 30 ». */
export function heureCourte(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

export interface SequenceDuJour {
  id: string
  jour: string
  jourFin: string
  heureDebut: string
  heureFin: string
  lieuId: string | null
}

export interface Placement<T> {
  sequence: T
  /** Colonne de la grille, à partir de 1. */
  colonne: number
  /** Lignes de la grille, à partir de 1 : début compris, fin exclue. */
  ligneDebut: number
  ligneFin: number
}

export interface ColonneLieu {
  lieuId: string | null
  /** Nombre de couloirs : les séquences qui se chevauchent dans le lieu. */
  couloirs: number
  premiere: number
}

export interface Grille<T> {
  /** Première minute de la grille, alignée sur une heure pleine. */
  debut: number
  tranches: number
  colonnes: ColonneLieu[]
  placements: Placement<T>[]
}

/**
 * La part d'une séquence dans un jour, en minutes depuis minuit : du début à
 * minuit le premier jour, de minuit à la fin le lendemain pour une séquence de
 * nuit. Null si la séquence ne touche pas ce jour, ou finit à minuit pile.
 */
export function segmentDuJour(
  s: { jour: string; jourFin: string; heureDebut: string; heureFin: string },
  jour: string
): { debut: number; fin: number } | null {
  if (s.jour === jour) {
    return {
      debut: minutes(s.heureDebut),
      fin: s.jourFin !== s.jour ? 24 * 60 : minutes(s.heureFin),
    }
  }
  if (s.jourFin === jour && minutes(s.heureFin) > 0) {
    return { debut: 0, fin: minutes(s.heureFin) }
  }
  return null
}

/**
 * La grille d'un jour : les lieux dans l'ordre reçu, puis « sans lieu » s'il sert.
 * Une séquence de nuit paraît sur ses deux jours, coupée à minuit. Les bornes
 * affichées s'arrondissent à la tranche de 30 minutes : une ligne de grille est
 * toujours un entier. Dans un lieu, deux séquences qui se chevauchent à
 * l'affichage prennent deux couloirs voisins.
 */
export function grilleDuJour<T extends SequenceDuJour>(
  sequences: readonly T[],
  lieuIds: readonly string[],
  jour: string
): Grille<T> {
  const duJour = sequences
    .flatMap(s => {
      const segment = segmentDuJour(s, jour)
      if (segment === null) return []
      const debut =
        Math.floor(segment.debut / TRANCHE_MINUTES) * TRANCHE_MINUTES
      const fin = Math.max(
        Math.ceil(segment.fin / TRANCHE_MINUTES) * TRANCHE_MINUTES,
        debut + TRANCHE_MINUTES
      )
      return [{ sequence: s, debut, fin }]
    })
    .sort((a, b) => a.debut - b.debut || b.fin - a.fin)
  if (duJour.length === 0) {
    return { debut: 8 * 60, tranches: 0, colonnes: [], placements: [] }
  }
  const debut = Math.floor(Math.min(...duJour.map(s => s.debut)) / 60) * 60
  const fin = Math.ceil(Math.max(...duJour.map(s => s.fin)) / 60) * 60
  const lieux: (string | null)[] = [...lieuIds]
  if (
    duJour.some(
      s => s.sequence.lieuId === null || !lieuIds.includes(s.sequence.lieuId)
    )
  ) {
    lieux.push(null)
  }
  const colonnes: ColonneLieu[] = []
  const placements: Placement<T>[] = []
  let suivante = 1
  for (const lieuId of lieux) {
    const ici = duJour.filter(s =>
      lieuId === null
        ? s.sequence.lieuId === null || !lieuIds.includes(s.sequence.lieuId)
        : s.sequence.lieuId === lieuId
    )
    if (ici.length === 0 && lieuId === null) continue
    // Chaque couloir garde la fin de sa dernière séquence.
    const couloirs: number[] = []
    const places = ici.map(s => {
      let couloir = couloirs.findIndex(finCouloir => finCouloir <= s.debut)
      if (couloir === -1) {
        couloir = couloirs.length
        couloirs.push(s.fin)
      } else {
        couloirs[couloir] = s.fin
      }
      return { ...s, couloir }
    })
    const largeur = Math.max(1, couloirs.length)
    colonnes.push({ lieuId, couloirs: largeur, premiere: suivante })
    for (const p of places) {
      placements.push({
        sequence: p.sequence,
        colonne: suivante + p.couloir,
        ligneDebut: (p.debut - debut) / TRANCHE_MINUTES + 1,
        ligneFin: (p.fin - debut) / TRANCHE_MINUTES + 1,
      })
    }
    suivante += largeur
  }
  return {
    debut,
    tranches: (fin - debut) / TRANCHE_MINUTES,
    colonnes,
    placements,
  }
}

/**
 * Les jours où le programme a au moins une séquence, dans l'ordre. Une séquence
 * de nuit compte aussi son jour de fin, sauf si elle finit à minuit pile.
 */
export function joursDuProgramme(
  sequences: readonly {
    jour: string
    jourFin: string
    heureDebut: string
    heureFin: string
  }[]
): string[] {
  return [
    ...new Set(
      sequences.flatMap(s =>
        segmentDuJour(s, s.jourFin) !== null && s.jourFin !== s.jour
          ? [s.jour, s.jourFin]
          : [s.jour]
      )
    ),
  ].sort()
}
