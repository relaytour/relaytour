import type { Prisma } from '@relaytour/database'

// Rattachement d'une personne à une activité, sans périmètre ni période (ADR 0045).
// Il fait entrer la personne dans l'équipe de l'activité et lui ouvre la page
// « Tous les périmètres ». Chaque entrée dans une activité le crée : affectation,
// invitation, demande acceptée, import, ou geste d'un admin. Chaque appelant
// vérifie d'abord ses droits, et que l'activité relève de l'organisation.

/**
 * Rattache une personne à des activités d'une organisation. Un rattachement déjà
 * présent reste tel quel : l'opération est additive et rejouable. `db` est le
 * client Prisma ou la transaction de l'appelant. Rend les activités où le
 * rattachement vient d'être créé.
 */
export async function rattacher(
  db: Prisma.TransactionClient,
  demande: {
    userId: string
    activiteIds: string[]
    organisationId: string
    creeParId: string | null
    instant?: Date
  }
): Promise<string[]> {
  const { userId, organisationId, creeParId } = demande
  const activiteIds = [...new Set(demande.activiteIds)]
  if (activiteIds.length === 0) return []
  const presents = new Set(
    (
      await db.rattachementActivite.findMany({
        where: { userId, activiteId: { in: activiteIds } },
        select: { activiteId: true },
      })
    ).map(r => r.activiteId)
  )
  const nouveaux = activiteIds.filter(id => !presents.has(id))
  if (nouveaux.length === 0) return []
  await db.rattachementActivite.createMany({
    data: nouveaux.map(activiteId => ({
      userId,
      activiteId,
      organisationId,
      creeParId,
      ...(demande.instant === undefined ? {} : { createdAt: demande.instant }),
    })),
    // Deux entrées simultanées dans la même activité ne se gênent pas.
    skipDuplicates: true,
  })
  return nouveaux
}

/** Vrai quand la personne est rattachée à l'activité. */
export async function estRattachee(
  db: Prisma.TransactionClient,
  userId: string,
  activiteId: string
): Promise<boolean> {
  return (
    (await db.rattachementActivite.count({ where: { userId, activiteId } })) > 0
  )
}
