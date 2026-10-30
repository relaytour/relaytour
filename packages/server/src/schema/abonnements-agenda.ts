import {
  prisma,
  Prisma,
  SorteAbonnement,
  type AbonnementAgenda,
} from '@relaytour/database'

import type { AppContext } from '../context.ts'
import {
  adresseAbonnement,
  empreinteJeton,
  nouveauJeton,
} from '../lib/abonnements-agenda.ts'
import { perimetresLisibles } from '../lib/droits.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { i18n } from '../lib/langue.ts'
import { configurationOrganisation } from '../lib/organisation.ts'

import { builder } from './builder.ts'
import { exigerModule } from '../lib/modules.ts'

// Abonnements à l'agenda (ADR 0037). Une adresse secrète sert un agenda au format
// iCalendar, en lecture seule. L'adresse complète ne sort qu'une fois, dans la
// réponse qui la crée : le serveur ne garde que l'empreinte de son jeton.

/** Un abonnement personnel choisit 200 périmètres au plus. */
const PERIMETRES_CHOISIS_MAX = 200

const SorteAbonnementEnum = builder.enumType(SorteAbonnement, {
  name: 'SorteAbonnement',
})

const AbonnementAgendaRef = builder
  .objectRef<AbonnementAgenda>('AbonnementAgenda')
  .implement({
    description:
      'Un abonnement à l’agenda. Son adresse ne se relit pas : elle s’affiche une seule fois, à sa création.',
    fields: t => ({
      id: t.exposeID('id'),
      sorte: t.expose('sorte', { type: SorteAbonnementEnum }),
      fin: t.exposeString('fin', {
        description:
          'Les derniers caractères de l’adresse, pour la reconnaître.',
      }),
      perimetreIds: t.idList({
        nullable: true,
        description:
          'Les périmètres choisis. Nul : tous les périmètres que la personne lit.',
        resolve: a =>
          Array.isArray(a.perimetreIds)
            ? (a.perimetreIds as unknown[]).map(String)
            : null,
      }),
      inclurePhases: t.exposeBoolean('inclurePhases', {
        description: 'Les phases des périodes.',
      }),
      inclureDatesCles: t.exposeBoolean('inclureDatesCles', {
        description: 'Les dates clés et les jours de chaque période.',
      }),
      inclureReunions: t.exposeBoolean('inclureReunions', {
        description: 'Les réunions de l’activité, hors réunions de périmètre.',
      }),
      inclureEcheances: t.exposeBoolean('inclureEcheances', {
        description:
          'Abonnement personnel : les échéances des tâches assignées à la personne.',
      }),
      creeLe: t.field({ type: 'DateTime', resolve: a => a.createdAt }),
      dernierAccesLe: t.field({
        type: 'DateTime',
        nullable: true,
        description: 'La dernière lecture par un agenda, à une heure près.',
        resolve: a => a.dernierAccesLe,
      }),
    }),
  })

const AdresseAbonnementRef = builder
  .objectRef<{ adresse: string; abonnement: AbonnementAgenda }>(
    'AdresseAbonnement'
  )
  .implement({
    fields: t => ({
      adresse: t.exposeString('adresse', {
        description: 'L’adresse complète, affichée une seule fois.',
      }),
      abonnement: t.field({
        type: AbonnementAgendaRef,
        resolve: a => a.abonnement,
      }),
    }),
  })

/** Les périmètres choisis, vérifiés : chacun doit être lu par la personne. */
async function perimetresChoisis(
  ctx: AppContext,
  ids: readonly (string | number)[] | null | undefined
): Promise<string[] | null> {
  if (ids === null || ids === undefined) return null
  const uniques = [...new Set(ids.map(String))]
  if (uniques.length > PERIMETRES_CHOISIS_MAX) {
    throw erreurSaisie(
      i18n._('Choisissez {max} périmètres au plus.', {
        max: PERIMETRES_CHOISIS_MAX,
      })
    )
  }
  const lisibles = new Set(await perimetresLisibles(ctx))
  if (uniques.some(id => !lisibles.has(id))) throw accesRefuse()
  return uniques
}

/** Révoque les abonnements actifs, puis en crée un et renvoie son adresse. */
async function creerAbonnement(
  ctx: AppContext,
  cible: { userId: string } | { activiteId: string },
  reglages: {
    perimetreIds?: string[] | null
    inclurePhases?: boolean | null
    inclureDatesCles?: boolean | null
    inclureReunions?: boolean | null
    inclureEcheances?: boolean | null
  } = {}
) {
  const organisationId = ctx.organisation!.id
  const jeton = nouveauJeton()
  const maintenant = new Date()
  const abonnement = await prisma.$transaction(async tx => {
    await tx.abonnementAgenda.updateMany({
      where: { organisationId, ...cible, revoqueLe: null },
      data: { revoqueLe: maintenant },
    })
    return tx.abonnementAgenda.create({
      data: {
        organisationId,
        sorte: 'userId' in cible ? 'PERSONNEL' : 'ACTIVITE',
        ...cible,
        empreinte: empreinteJeton(jeton),
        fin: jeton.slice(-6),
        perimetreIds: reglages.perimetreIds ?? undefined,
        inclurePhases: reglages.inclurePhases ?? false,
        inclureDatesCles: reglages.inclureDatesCles ?? true,
        inclureReunions: reglages.inclureReunions ?? true,
        inclureEcheances: reglages.inclureEcheances ?? false,
        creeParId: ctx.personne!.id,
      },
    })
  })
  const { origineOrga } = await configurationOrganisation(organisationId)
  return { adresse: adresseAbonnement(origineOrga, jeton), abonnement }
}

/** L'activité, si la personne l'administre. */
async function activiteAdministree(ctx: AppContext, id: string | number) {
  const activiteId = await ctx.exigerActivite(id)
  await ctx.exigerAdminDe(activiteId)
  await exigerModule(activiteId, 'AGENDA')
  return activiteId
}

builder.queryFields(t => ({
  monAbonnementAgenda: t.field({
    type: AbonnementAgendaRef,
    nullable: true,
    authScopes: { connecte: true },
    description:
      'L’abonnement personnel actif de la personne dans l’organisation active.',
    resolve: (_root, _args, ctx) =>
      prisma.abonnementAgenda.findFirst({
        where: {
          organisationId: ctx.organisation!.id,
          userId: ctx.personne!.id,
          revoqueLe: null,
        },
      }),
  }),
  abonnementAgendaActivite: t.field({
    type: AbonnementAgendaRef,
    nullable: true,
    authScopes: { gestion: true },
    description:
      'L’abonnement actif à l’agenda global d’une activité, pour ses admins.',
    args: { activiteId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const activiteId = await activiteAdministree(ctx, args.activiteId)
      return prisma.abonnementAgenda.findFirst({
        where: {
          organisationId: ctx.organisation!.id,
          activiteId,
          revoqueLe: null,
        },
      })
    },
  }),
}))

builder.mutationFields(t => ({
  creerMonAbonnementAgenda: t.field({
    type: AdresseAbonnementRef,
    authScopes: { connecte: true },
    description:
      'Crée l’abonnement personnel, et révoque le précédent : son adresse cesse de servir.',
    args: {
      perimetreIds: t.arg.idList(),
      // Les phases sont décochées par défaut : elles chargent beaucoup un agenda.
      inclurePhases: t.arg.boolean({ defaultValue: false }),
      inclureDatesCles: t.arg.boolean({ defaultValue: true }),
      inclureReunions: t.arg.boolean({ defaultValue: true }),
      inclureEcheances: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (_root, args, ctx) =>
      creerAbonnement(
        ctx,
        { userId: ctx.personne!.id },
        {
          ...args,
          perimetreIds: await perimetresChoisis(ctx, args.perimetreIds),
        }
      ),
  }),

  reglerMonAbonnementAgenda: t.field({
    type: AbonnementAgendaRef,
    authScopes: { connecte: true },
    description:
      'Change le contenu de l’abonnement personnel. L’adresse ne change pas.',
    args: {
      perimetreIds: t.arg.idList(),
      inclurePhases: t.arg.boolean({ required: true }),
      inclureDatesCles: t.arg.boolean({ required: true }),
      inclureReunions: t.arg.boolean({ required: true }),
      inclureEcheances: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const actuel = await prisma.abonnementAgenda.findFirst({
        where: {
          organisationId: ctx.organisation!.id,
          userId: ctx.personne!.id,
          revoqueLe: null,
        },
      })
      if (actuel === null) {
        throw erreurSaisie(i18n._('Créez d’abord votre abonnement.'))
      }
      const perimetreIds = await perimetresChoisis(ctx, args.perimetreIds)
      return prisma.abonnementAgenda.update({
        where: { id: actuel.id },
        data: {
          // Null en base : tous les périmètres que la personne lit.
          perimetreIds: perimetreIds ?? Prisma.DbNull,
          inclurePhases: args.inclurePhases,
          inclureDatesCles: args.inclureDatesCles,
          inclureReunions: args.inclureReunions,
          inclureEcheances: args.inclureEcheances,
        },
      })
    },
  }),

  revoquerMonAbonnementAgenda: t.boolean({
    // Une adresse compromise se révoque même dans une organisation en lecture
    // seule, qui continue de servir ses abonnements.
    skipTypeScopes: true,
    authScopes: { connecte: true },
    description:
      'Révoque l’abonnement personnel : son adresse cesse de servir.',
    resolve: async (_root, _args, ctx) => {
      const { count } = await prisma.abonnementAgenda.updateMany({
        where: {
          organisationId: ctx.organisation!.id,
          userId: ctx.personne!.id,
          revoqueLe: null,
        },
        data: { revoqueLe: new Date() },
      })
      return count > 0
    },
  }),

  creerAbonnementAgendaActivite: t.field({
    type: AdresseAbonnementRef,
    authScopes: { gestion: true },
    description:
      'Crée l’abonnement à l’agenda global d’une activité, et révoque le précédent.',
    args: {
      activiteId: t.arg.id({ required: true }),
      inclurePhases: t.arg.boolean({ defaultValue: false }),
      inclureDatesCles: t.arg.boolean({ defaultValue: true }),
      inclureReunions: t.arg.boolean({ defaultValue: true }),
    },
    resolve: async (_root, { activiteId, ...types }, ctx) =>
      creerAbonnement(
        ctx,
        { activiteId: await activiteAdministree(ctx, activiteId) },
        types
      ),
  }),

  reglerAbonnementAgendaActivite: t.field({
    type: AbonnementAgendaRef,
    authScopes: { gestion: true },
    description:
      'Change les types d’événements de l’abonnement d’une activité. L’adresse ne change pas.',
    args: {
      activiteId: t.arg.id({ required: true }),
      inclurePhases: t.arg.boolean({ required: true }),
      inclureDatesCles: t.arg.boolean({ required: true }),
      inclureReunions: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, { activiteId: id, ...types }, ctx) => {
      const activiteId = await activiteAdministree(ctx, id)
      const actuel = await prisma.abonnementAgenda.findFirst({
        where: {
          organisationId: ctx.organisation!.id,
          activiteId,
          revoqueLe: null,
        },
      })
      if (actuel === null) {
        throw erreurSaisie(i18n._('Créez d’abord l’adresse de l’activité.'))
      }
      return prisma.abonnementAgenda.update({
        where: { id: actuel.id },
        data: types,
      })
    },
  }),

  revoquerAbonnementAgendaActivite: t.boolean({
    // Une adresse compromise se révoque même dans une organisation en lecture
    // seule, qui continue de servir ses abonnements.
    skipTypeScopes: true,
    authScopes: { gestion: true },
    args: { activiteId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const activiteId = await activiteAdministree(ctx, args.activiteId)
      const { count } = await prisma.abonnementAgenda.updateMany({
        where: {
          organisationId: ctx.organisation!.id,
          activiteId,
          revoqueLe: null,
        },
        data: { revoqueLe: new Date() },
      })
      return count > 0
    },
  }),
}))
