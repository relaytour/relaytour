import type { Prisma } from '@relaytour/database'

// Affectation d'une personne à des périmètres d'une période.
//
// L'affectation par un admin et l'import d'une équipe (ADR 0013) créent leurs
// affectations ici. Chaque appelant vérifie d'abord ses droits, et que les
// périmètres et la période relèvent de la même activité.

export interface AffectationsCreees {
  /** Périmètres où l'affectation vient d'être créée, dans l'ordre demandé. */
  creees: string[]
  /** Périmètres où la personne était déjà affectée pour cette période. */
  existantes: string[]
}

/**
 * Affecte une personne à des périmètres pour une période. Une affectation déjà
 * présente reste telle quelle : l'opération est additive et rejouable. `db` est le
 * client Prisma ou la transaction de l'appelant. `instant` date les affectations ;
 * l'appelant le réutilise pour choisir la fenêtre du mail d'équipe (ADR 0012). En
 * `simulation`, la fonction lit et décide sans rien écrire.
 */
export async function creerAffectations(
  db: Prisma.TransactionClient,
  demande: {
    userId: string
    perimetreIds: string[]
    editionId: string
    creeParId: string | null
    instant: Date
    simulation?: boolean
  }
): Promise<AffectationsCreees> {
  const { userId, editionId, creeParId, instant } = demande
  const perimetreIds = [...new Set(demande.perimetreIds)]
  if (perimetreIds.length === 0) return { creees: [], existantes: [] }
  const presentes = new Set(
    (
      await db.affectation.findMany({
        where: { userId, editionId, perimetreId: { in: perimetreIds } },
        select: { perimetreId: true },
      })
    ).map(a => a.perimetreId)
  )
  const creees = perimetreIds.filter(id => !presentes.has(id))
  if (creees.length > 0 && demande.simulation !== true) {
    await db.affectation.createMany({
      data: creees.map(perimetreId => ({
        userId,
        perimetreId,
        editionId,
        creeParId,
        createdAt: instant,
      })),
    })
  }
  return { creees, existantes: perimetreIds.filter(id => presentes.has(id)) }
}
