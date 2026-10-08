import type {
  AccordDeclinaison,
  Prisma,
  StatutTache,
} from '@relaytour/database'

// Tâches partagées et déclinaisons (ADR 0026).
//
// Une déclinaison proposée à un périmètre attend son accord. Tant qu'elle n'est pas
// acceptée, elle ne compte pas parmi les tâches du périmètre : ni dans ses listes,
// ni dans son avancement, ni dans les rappels, ni dans le score.

/**
 * Les tâches qui comptent dans leur périmètre : les tâches ordinaires, les tâches
 * partagées et les déclinaisons acceptées. Le filtre se place sous `AND`, pour ne
 * pas écraser un `OR` de la requête qui le reçoit.
 */
export const TACHES_ACTIVES: Prisma.TacheWhereInput = {
  OR: [{ accord: null }, { accord: 'ACCEPTE' }],
}

/** Le nombre de périmètres cibles qu'une tâche partagée accepte en une fois. */
export const CIBLES_MAX = 60

/** L'état des déclinaisons d'une tâche partagée, en nombres. */
export interface ResumeDeclinaisons {
  /** Toutes les déclinaisons, quel que soit leur accord. */
  total: number
  enAttente: number
  refusees: number
  /** Les déclinaisons acceptées : elles comptent parmi les tâches de leur périmètre. */
  acceptees: number
  /** Parmi les déclinaisons acceptées. */
  faites: number
  abandonnees: number
}

/** Compte les déclinaisons d'une tâche partagée par accord, puis par statut. */
export function resumerDeclinaisons(
  declinaisons: readonly {
    accord: AccordDeclinaison | null
    statut: StatutTache
  }[]
): ResumeDeclinaisons {
  const resume: ResumeDeclinaisons = {
    total: declinaisons.length,
    enAttente: 0,
    refusees: 0,
    acceptees: 0,
    faites: 0,
    abandonnees: 0,
  }
  for (const declinaison of declinaisons) {
    if (declinaison.accord === 'EN_ATTENTE') resume.enAttente += 1
    else if (declinaison.accord === 'REFUSE') resume.refusees += 1
    else {
      resume.acceptees += 1
      if (declinaison.statut === 'FAITE') resume.faites += 1
      if (declinaison.statut === 'ABANDONNEE') resume.abandonnees += 1
    }
  }
  return resume
}
