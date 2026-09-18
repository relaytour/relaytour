// Regroupement des tâches du rétroplanning par mois d'échéance.

export interface GroupeMois<T> {
  /** Mois au format AAAA-MM, ou null pour les tâches sans échéance. */
  mois: string | null
  taches: T[]
}

/**
 * Regroupe les tâches par mois d'échéance, du plus proche au plus lointain. Le mois
 * se lit dans le texte de la date : aucun fuseau horaire ne peut le décaler. Le
 * groupe des tâches sans échéance arrive en dernier.
 */
export function grouperParMois<T extends { echeance?: string | null }>(
  taches: readonly T[]
): GroupeMois<T>[] {
  const groupes = new Map<string | null, T[]>()
  for (const tache of taches) {
    const mois = tache.echeance ? tache.echeance.slice(0, 7) : null
    const groupe = groupes.get(mois)
    if (groupe) groupe.push(tache)
    else groupes.set(mois, [tache])
  }
  return [...groupes]
    .map(([mois, contenu]) => ({ mois, taches: contenu }))
    .sort((a, b) => {
      if (a.mois === null) return 1
      if (b.mois === null) return -1
      return a.mois.localeCompare(b.mois)
    })
}

/** Libellé d'un mois « AAAA-MM » en français, par exemple « mars 2027 ». */
export function libelleMois(mois: string): string {
  const [annee, numero] = mois.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(annee ?? 0, (numero ?? 1) - 1, 1))
}
