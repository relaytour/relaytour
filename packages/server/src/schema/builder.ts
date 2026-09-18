import SchemaBuilder from '@pothos/core'
import PrismaPlugin from '@pothos/plugin-prisma'
import ScopeAuthPlugin from '@pothos/plugin-scope-auth'
import { getDatamodel, prisma, type PrismaTypes } from '@relaytour/database'
import { DateResolver, DateTimeResolver } from 'graphql-scalars'

import type { AppContext } from '../context.ts'
import { accesRefuse } from '../lib/erreurs.ts'

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
  plugins: [ScopeAuthPlugin, PrismaPlugin],
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
})

builder.addScalarType('Date', DateResolver, {})
builder.addScalarType('DateTime', DateTimeResolver, {})

builder.queryType({})
builder.mutationType({})
