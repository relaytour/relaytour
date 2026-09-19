import SchemaBuilder from '@pothos/core'
import ComplexityPlugin from '@pothos/plugin-complexity'
import PrismaPlugin from '@pothos/plugin-prisma'
import ScopeAuthPlugin from '@pothos/plugin-scope-auth'
import { getDatamodel, prisma, type PrismaTypes } from '@relaytour/database'
import { DateResolver, DateTimeResolver } from 'graphql-scalars'

import type { AppContext } from '../context.ts'
import { accesRefuse, requeteTropLourde } from '../lib/erreurs.ts'

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes
  Context: AppContext
  Scalars: {
    Date: { Input: Date; Output: Date }
    DateTime: { Input: Date; Output: Date }
  }
  DefaultFieldNullability: false
  AuthScopes: {
    connecte: boolean
    admin: boolean
  }
}>({
  plugins: [ScopeAuthPlugin, ComplexityPlugin, PrismaPlugin],
  defaultFieldNullability: false,
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
  scopeAuth: {
    authScopes: ctx => ({
      connecte: ctx.personne !== null,
      admin: ctx.personne?.estAdmin === true,
    }),
    unauthorizedError: () => accesRefuse(),
  },
  // Le schéma comporte des cycles (périmètre ↔ tâches, personne → affectations → périmètre).
  // Ces limites bornent le coût d'une requête imbriquée avant tout résolveur.
  complexity: {
    defaultComplexity: 1,
    defaultListMultiplier: 10,
    limit: {
      depth: 8,
      breadth: 100,
      complexity: 2_000,
    },
    complexityError: (nature, mesure) => requeteTropLourde(nature, mesure),
  },
})

builder.addScalarType('Date', DateResolver, {})
builder.addScalarType('DateTime', DateTimeResolver, {})

builder.queryType({})
builder.mutationType({})
