import { prisma } from '@relaytour/database'

import { buildContext, type AppContext } from '../context.ts'
import { GROUPES_PAR_DEFAUT } from '../lib/activites.ts'
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

let activiteParDefautEnCache: string | null = null

/**
 * La première activité de l'organisation par défaut, créée si elle manque. Les tests
 * qui partagent la base de développement y rangent leurs périodes et périmètres.
 */
export async function activiteParDefaut(): Promise<string> {
  if (activiteParDefautEnCache !== null) return activiteParDefautEnCache
  const organisationId = await organisationParDefaut()
  const existante = await prisma.activite.findFirst({
    where: { organisationId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  if (existante !== null) {
    activiteParDefautEnCache = existante.id
    return existante.id
  }
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { slug: true, nom: true },
  })
  const creee = await prisma.activite.create({
    data: {
      organisationId,
      slug: organisation.slug,
      nom: organisation.nom,
      groupes: GROUPES_PAR_DEFAUT,
    },
    select: { id: true },
  })
  activiteParDefautEnCache = creee.id
  return creee.id
}
