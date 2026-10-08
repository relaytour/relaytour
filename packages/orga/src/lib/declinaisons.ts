// Tâches partagées et déclinaisons (ADR 0026) : libellés et regroupements, sans
// accès au réseau.

/** L'état des déclinaisons d'une tâche partagée, en nombres. */
export interface ResumeDeclinaisons {
  total: number
  enAttente: number
  refusees: number
  acceptees: number
  faites: number
  abandonnees: number
}

const perimetres = (n: number) => `${n} ${n > 1 ? 'périmètres' : 'périmètre'}`

/**
 * Le résumé d'une tâche partagée en deux temps : où elle est déclinée, puis où en
 * sont ses déclinaisons. Une déclinaison abandonnée ne reste pas à faire : le
 * compte des tâches faites porte sur celles que les périmètres gardent.
 */
export function libelleDeclinaisons(resume: ResumeDeclinaisons): {
  titre: string
  details: string[]
} {
  const details: string[] = []
  const gardees = resume.acceptees - resume.abandonnees
  if (gardees > 0) {
    details.push(
      resume.faites === gardees
        ? gardees > 1
          ? 'toutes faites'
          : 'faite'
        : `${resume.faites} ${resume.faites > 1 ? 'faites' : 'faite'} sur ${gardees}`
    )
  }
  if (resume.abandonnees > 0) {
    details.push(
      `${resume.abandonnees} ${resume.abandonnees > 1 ? 'abandonnées' : 'abandonnée'}`
    )
  }
  if (resume.enAttente > 0) {
    details.push(`${resume.enAttente} en attente d’accord`)
  }
  if (resume.refusees > 0) {
    details.push(
      `${resume.refusees} ${resume.refusees > 1 ? 'refusées' : 'refusée'}`
    )
  }
  return { titre: `Déclinée dans ${perimetres(resume.total)}`, details }
}

/** Les étapes de l'accord d'une déclinaison, pour l'historique lu par les admins. */
export const ETAPES_ACCORD = {
  PROPOSEE: 'Proposée',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
  IMPOSEE: 'Ajoutée sans accord',
} as const

export interface LigneRegroupable {
  id: string
  titre: string
  echeance?: string | null
  origine?: { id: string } | null
}

/** Une tâche seule, ou plusieurs déclinaisons d'une même tâche partagée. */
export type LigneOuGroupe<T> =
  | { sorte: 'tache'; tache: T }
  | { sorte: 'declinaisons'; cle: string; titre: string; taches: T[] }

/**
 * Réunit en une ligne les déclinaisons d'une même tâche partagée qui tombent à la
 * même échéance : le rétroplanning ne répète pas neuf fois la même tâche le même
 * jour. Le groupe prend la place de sa première déclinaison ; l'ordre des autres
 * lignes ne change pas. Une déclinaison seule reste une ligne ordinaire.
 */
export function regrouperDeclinaisons<T extends LigneRegroupable>(
  taches: readonly T[]
): LigneOuGroupe<T>[] {
  const cleDe = (tache: T) =>
    tache.origine ? `${tache.origine.id}|${tache.echeance ?? ''}` : null
  const parCle = new Map<string, T[]>()
  for (const tache of taches) {
    const cle = cleDe(tache)
    if (cle === null) continue
    const groupe = parCle.get(cle)
    if (groupe) groupe.push(tache)
    else parCle.set(cle, [tache])
  }
  const lignes: LigneOuGroupe<T>[] = []
  const places = new Set<string>()
  for (const tache of taches) {
    const cle = cleDe(tache)
    const groupe = cle === null ? undefined : parCle.get(cle)
    if (cle === null || groupe === undefined || groupe.length < 2) {
      lignes.push({ sorte: 'tache', tache })
      continue
    }
    if (places.has(cle)) continue
    places.add(cle)
    lignes.push({
      sorte: 'declinaisons',
      cle,
      // Les déclinaisons portent le plus souvent le même titre. Sinon, le groupe
      // prend celui de la première.
      titre: groupe[0]!.titre,
      taches: groupe,
    })
  }
  return lignes
}
