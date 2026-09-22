import { prisma } from '@relaytour/database'

import { buildContext, type AppContext } from '../context.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

// Contexte des tests d'intégration (ADR 0008).
//
// Les tests créent leurs comptes avec `isAdmin`. Un compte sans appartenance est
// rattaché ici à l'organisation par défaut, avec le rôle ADMIN ou MEMBRE tiré de
// `isAdmin`, puis le contexte se construit comme pour une vraie requête. Les tests
// qui prouvent les refus entre organisations créent leurs appartenances eux-mêmes.

export async function contexteDeTest(
  userId: string | null,
  organisation: string | null = null
): Promise<AppContext> {
  if (userId !== null) {
    const compte = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, _count: { select: { appartenances: true } } },
    })
    if (compte !== null && compte._count.appartenances === 0) {
      await prisma.appartenance.create({
        data: {
          userId,
          organisationId: await organisationParDefaut(),
          role: compte.isAdmin ? 'ADMIN' : 'MEMBRE',
        },
      })
    }
  }
  return buildContext('127.0.0.1', userId, organisation)
}
