import {
  prisma,
  type AccordDeclinaison,
  type StatutTache,
} from '@relaytour/database'

import { estEnRetard } from './droits.ts'
import { publierPourPerimetre } from './flux.ts'

// Jalons (ADR 0062).
//
// Un jalon est une tâche qui porte un marqueur facultatif (`jalonLe`). Il lie
// d'autres tâches de la même période, dans son périmètre ou dans un autre périmètre
// de l'activité. Le lien ne change pas la tâche liée. Le décompte ne se propage
// jamais : un jalon lié compte avec son seul statut.

/** Le nombre de tâches qu'un jalon lie au plus. */
export const LIENS_JALON_MAX = 100

/** L'état des tâches liées d'un jalon, en nombres. */
export interface ResumeJalon {
  /** Toutes les tâches liées, abandonnées comprises. */
  total: number
  /** À faire ou en cours. */
  ouvertes: number
  faites: number
  abandonnees: number
  /** Parmi les tâches ouvertes : celles dont l'échéance est dépassée. */
  enRetard: number
  /** Parmi les tâches ouvertes : celles assignées à la personne qui consulte. */
  assigneesAMoi: number
}

/** Compte les tâches liées d'un jalon par statut. */
export function resumerJalon(
  taches: readonly {
    statut: StatutTache
    echeance: Date | null
    assignations: readonly { userId: string }[]
  }[],
  jour: string,
  moiId: string | null
): ResumeJalon {
  const resume: ResumeJalon = {
    total: taches.length,
    ouvertes: 0,
    faites: 0,
    abandonnees: 0,
    enRetard: 0,
    assigneesAMoi: 0,
  }
  for (const tache of taches) {
    if (tache.statut === 'FAITE') resume.faites += 1
    else if (tache.statut === 'ABANDONNEE') resume.abandonnees += 1
    else {
      resume.ouvertes += 1
      if (estEnRetard(tache, jour)) resume.enRetard += 1
      if (moiId !== null && tache.assignations.some(a => a.userId === moiId)) {
        resume.assigneesAMoi += 1
      }
    }
  }
  return resume
}

/**
 * Une tâche active compte parmi les tâches de son périmètre : une tâche ordinaire,
 * une tâche partagée ou une déclinaison acceptée. Seule une tâche active se marque
 * ou se lie (ADR 0026, 0062).
 */
export function estActive(tache: {
  accord: AccordDeclinaison | null
}): boolean {
  return tache.accord === null || tache.accord === 'ACCEPTE'
}

/**
 * Prévient les pages des périmètres des jalons qu'une tâche sert : son statut, son
 * échéance et ses personnes assignées comptent dans leur décompte. Le périmètre de
 * la tâche reçoit déjà son propre signal.
 */
export async function publierJalonsDe(tache: {
  id: string
  perimetreId: string
  editionId: string
}): Promise<void> {
  const liens = await prisma.lienJalon.findMany({
    where: { tacheId: tache.id },
    select: { jalon: { select: { id: true, perimetreId: true } } },
  })
  for (const { jalon } of liens) {
    publierPourPerimetre('TACHE', jalon.perimetreId, {
      id: jalon.id,
      editionId: tache.editionId,
    })
  }
}
