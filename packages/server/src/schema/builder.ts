import SchemaBuilder from '@pothos/core'
import ComplexityPlugin from '@pothos/plugin-complexity'
import PrismaPlugin from '@pothos/plugin-prisma'
import ScopeAuthPlugin from '@pothos/plugin-scope-auth'
import { getDatamodel, prisma, type PrismaTypes } from '@relaytour/database'
import {
  DateResolver,
  DateTimeResolver,
  JSONObjectResolver,
} from 'graphql-scalars'

import type { AppContext } from '../context.ts'
import {
  accesRefuse,
  organisationEnLectureSeule,
  porteeInsuffisante,
  requeteTropLourde,
} from '../lib/erreurs.ts'

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes
  Context: AppContext
  Scalars: {
    Date: { Input: Date; Output: Date }
    DateTime: { Input: Date; Output: Date }
    JSONObject: {
      Input: Record<string, unknown>
      Output: Record<string, unknown>
    }
  }
  DefaultFieldNullability: false
  AuthScopes: {
    authentifie: boolean
    connecte: boolean
    admin: boolean
    gestion: boolean
    ecriture: boolean
    administration: boolean
    session: boolean
    toutesActivites: boolean
  }
}>({
  plugins: [ScopeAuthPlugin, ComplexityPlugin, PrismaPlugin],
  defaultFieldNullability: false,
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
  scopeAuth: {
    // ADR 0008 : connecte exige une personne et une organisation active ; admin, le
    // rôle ADMIN dans cette organisation ; ecriture, une organisation qui n'est pas
    // en lecture seule. Le type Mutation exige ecriture pour chacun de ses champs.
    // ADR 0010 : gestion ouvre la porte aux admins d'au moins une activité ; chaque
    // résolveur vérifie ensuite l'activité concernée (ctx.exigerAdminDe).
    authScopes: ctx => ({
      // Une personne connectée, avec ou sans organisation active : elle peut choisir
      // l'organisation où elle travaille. Un jeton d'accès ne vaut que pour son
      // organisation (ADR 0064) : il n'ouvre pas les opérations du compte.
      authentifie: ctx.personne !== null && ctx.jeton === null,
      connecte: ctx.personne !== null && ctx.organisation !== null,
      admin:
        ctx.personne !== null &&
        ctx.organisation !== null &&
        ctx.organisation.role === 'ADMIN',
      // Un admin de l'organisation y entre toujours, même sans aucune activité.
      gestion: async () =>
        ctx.personne !== null &&
        ctx.organisation !== null &&
        (ctx.organisation.role === 'ADMIN' ||
          (await ctx.activitesAdministrees()).size > 0),
      // ADR 0064 : un jeton en lecture n'écrit pas.
      ecriture:
        ctx.organisation?.statut !== 'LECTURE_SEULE' &&
        ctx.jeton?.portee !== 'LECTURE',
      administration: ctx.administration,
      // Une session ouverte dans le navigateur, sans jeton d'accès : la gestion des
      // jetons, les secrets (abonnements, push) et les réglages du compte.
      session: ctx.personne !== null && ctx.jeton === null,
      // Une session, ou un jeton sans liste d'activités : pour les lectures de toute
      // l'organisation qui ne passent pas par les activités (notifications).
      toutesActivites: ctx.personne !== null && ctx.jeton?.activites == null,
    }),
    unauthorizedError: (_parent, ctx, info) => {
      // Un jeton d'accès refusé répond sa cause sur tout champ protégé.
      if (ctx.refus !== null) return ctx.refus
      if (info.parentType.name === 'Mutation') {
        if (ctx.organisation?.statut === 'LECTURE_SEULE') {
          return organisationEnLectureSeule()
        }
        if (ctx.jeton?.portee === 'LECTURE') return porteeInsuffisante()
      }
      return accesRefuse()
    },
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
// Un thème déclaré : un objet que le serveur valide avec son schéma zod.
builder.addScalarType('JSONObject', JSONObjectResolver, {})

builder.queryType({})
builder.mutationType({ authScopes: { ecriture: true } })
