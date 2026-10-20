// Programme du jour J (ADR 0038), côté navigateur : la grille d'un jour, une
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
 * La grille d'un jour : les lieux dans l'ordre reçu, puis « sans lieu » s'il sert.
 * Une séquence qui finit un autre jour s'arrête à minuit. Dans un lieu, deux
 * séquences qui se chevauchent prennent deux couloirs voisins.
 */
export function grilleDuJour<T extends SequenceDuJour>(
  sequences: readonly T[],
  lieuIds: readonly string[],
  jour: string
): Grille<T> {
  const duJour = sequences
    .filter(s => s.jour === jour)
    .map(s => ({
      sequence: s,
      debut: minutes(s.heureDebut),
      fin:
        s.jourFin !== s.jour
          ? 24 * 60
          : Math.max(
              minutes(s.heureFin),
              minutes(s.heureDebut) + TRANCHE_MINUTES
            ),
    }))
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
        ligneFin: Math.ceil((p.fin - debut) / TRANCHE_MINUTES) + 1,
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

/** Les jours où le programme a au moins une séquence, dans l'ordre. */
export function joursDuProgramme(
  sequences: readonly { jour: string }[]
): string[] {
  return [...new Set(sequences.map(s => s.jour))].sort()
}
