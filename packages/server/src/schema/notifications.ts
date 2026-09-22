import { FrequenceResume, prisma, TypeNotification } from '@relaytour/database'

import {
  lienNotification,
  messageNotification,
  preferencesDe,
} from '../lib/notifications.ts'

import { builder } from './builder.ts'

const TypeNotificationEnum = builder.enumType(TypeNotification, {
  name: 'TypeNotification',
})
const FrequenceResumeEnum = builder.enumType(FrequenceResume, {
  name: 'FrequenceResume',
})

const SELECTION_TACHE = {
  select: {
    titre: true,
    echeance: true,
    perimetre: { select: { nom: true, slug: true } },
  },
} as const

const NotificationRef = builder.prismaObject('Notification', {
  fields: t => ({
    id: t.exposeID('id'),
    type: t.expose('type', { type: TypeNotificationEnum }),
    lue: t.boolean({ resolve: n => n.lueLe !== null }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    message: t.string({
      select: {
        type: true,
        jours: true,
        acteurId: true,
        personneId: true,
        userId: true,
        tache: SELECTION_TACHE,
      },
      resolve: async n => {
        const ids = [n.acteurId, n.personneId].filter(id => id !== null)
        const personnes = await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
        return messageNotification(
          n,
          new Map(personnes.map(p => [p.id, p.name])),
          n.userId
        )
      },
    }),
    lien: t.string({
      select: {
        type: true,
        jours: true,
        acteurId: true,
        personneId: true,
        tache: SELECTION_TACHE,
      },
      resolve: n => lienNotification(n),
    }),
  }),
})

const PreferencesRef = builder
  .objectRef<{
    frequenceResume: FrequenceResume
    mailModification: boolean
    mailEcheance: boolean
  }>('PreferencesNotification')
  .implement({
    fields: t => ({
      frequenceResume: t.expose('frequenceResume', {
        type: FrequenceResumeEnum,
      }),
      mailModification: t.exposeBoolean('mailModification'),
      mailEcheance: t.exposeBoolean('mailEcheance'),
    }),
  })

// Chaque personne ne lit et ne modifie que ses propres notifications et préférences :
// toutes les requêtes filtrent sur l'identifiant de la session.

builder.queryFields(t => ({
  notifications: t.prismaField({
    type: [NotificationRef],
    authScopes: { connecte: true },
    args: {
      nonLuesSeulement: t.arg.boolean({ defaultValue: false }),
      limite: t.arg.int({ defaultValue: 30 }),
    },
    resolve: (query, _root, args, ctx) =>
      prisma.notification.findMany({
        ...query,
        where: {
          userId: ctx.personne!.id,
          organisationId: ctx.organisation!.id,
          ...(args.nonLuesSeulement ? { lueLe: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(args.limite ?? 30, 1), 100),
      }),
  }),

  nombreNotificationsNonLues: t.int({
    authScopes: { connecte: true },
    resolve: (_root, _args, ctx) =>
      prisma.notification.count({
        where: {
          userId: ctx.personne!.id,
          organisationId: ctx.organisation!.id,
          lueLe: null,
        },
      }),
  }),

  mesPreferencesNotification: t.field({
    type: PreferencesRef,
    authScopes: { connecte: true },
    resolve: (_root, _args, ctx) => preferencesDe(prisma, ctx.personne!.id),
  }),
}))

builder.mutationFields(t => ({
  marquerNotificationsLues: t.int({
    authScopes: { connecte: true },
    description:
      'Sans identifiants, marque toutes les notifications comme lues.',
    args: { ids: t.arg.idList() },
    resolve: async (_root, { ids }, ctx) => {
      const { count } = await prisma.notification.updateMany({
        where: {
          userId: ctx.personne!.id,
          organisationId: ctx.organisation!.id,
          lueLe: null,
          ...(ids ? { id: { in: ids.map(String) } } : {}),
        },
        data: { lueLe: new Date() },
      })
      return count
    },
  }),

  modifierPreferencesNotification: t.field({
    type: PreferencesRef,
    authScopes: { connecte: true },
    args: {
      frequenceResume: t.arg({ type: FrequenceResumeEnum, required: true }),
      mailModification: t.arg.boolean({ required: true }),
      mailEcheance: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const donnees = {
        frequenceResume: args.frequenceResume,
        mailModification: args.mailModification,
        mailEcheance: args.mailEcheance,
      }
      return prisma.preferenceNotification.upsert({
        where: { userId: ctx.personne!.id },
        update: donnees,
        create: {
          userId: ctx.personne!.id,
          organisationId: ctx.organisation!.id,
          ...donnees,
        },
      })
    },
  }),
}))
