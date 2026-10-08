import { FrequenceResume, prisma, TypeNotification } from '@relaytour/database'

import {
  lienNotification,
  messageNotification,
  preferencesDe,
  SELECTION_ACTIVITE_NOTIFIEE,
  SELECTION_FICHE_NOTIFIEE,
  SELECTION_TACHE_NOTIFIEE,
} from '../lib/notifications.ts'

import { builder } from './builder.ts'

const TypeNotificationEnum = builder.enumType(TypeNotification, {
  name: 'TypeNotification',
})
const FrequenceResumeEnum = builder.enumType(FrequenceResume, {
  name: 'FrequenceResume',
})

// Ce que le message et le lien d'une notification lisent d'elle.
const SELECTION_NOTIFICATION = {
  type: true,
  jours: true,
  acteurId: true,
  personneId: true,
  statut: true,
  tache: SELECTION_TACHE_NOTIFIEE,
  fiche: SELECTION_FICHE_NOTIFIEE,
  activite: SELECTION_ACTIVITE_NOTIFIEE,
} as const

const NotificationRef = builder.prismaObject('Notification', {
  fields: t => ({
    id: t.exposeID('id'),
    type: t.expose('type', { type: TypeNotificationEnum }),
    lue: t.boolean({ resolve: n => n.lueLe !== null }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    message: t.string({
      select: { ...SELECTION_NOTIFICATION, userId: true },
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
      select: SELECTION_NOTIFICATION,
      resolve: n => lienNotification(n),
    }),
  }),
})

const PreferencesRef = builder
  .objectRef<{
    frequenceResume: FrequenceResume
    mailModification: boolean
    mailEcheance: boolean
    mailDemandes: boolean
    applicationPerimetre: boolean
    pushTaches: boolean
    pushEcheances: boolean
    pushDemandes: boolean
  }>('PreferencesNotification')
  .implement({
    fields: t => ({
      frequenceResume: t.expose('frequenceResume', {
        type: FrequenceResumeEnum,
      }),
      mailModification: t.exposeBoolean('mailModification'),
      mailEcheance: t.exposeBoolean('mailEcheance'),
      mailDemandes: t.exposeBoolean('mailDemandes', {
        description:
          'Mail regroupé par heure quand une activité que la personne administre reçoit des demandes pour rejoindre son équipe.',
      }),
      applicationPerimetre: t.exposeBoolean('applicationPerimetre', {
        description:
          'Notification dans l’application quand une autre personne agit sur une tâche ou une fiche d’un périmètre où la personne est affectée.',
      }),
      pushTaches: t.exposeBoolean('pushTaches', {
        description:
          'Notification push quand une tâche est assignée à la personne, lui est retirée, ou quand une autre personne modifie une de ses tâches (ADR 0024).',
      }),
      pushEcheances: t.exposeBoolean('pushEcheances', {
        description:
          'Notification push pour les échéances proches et les retards.',
      }),
      pushDemandes: t.exposeBoolean('pushDemandes', {
        description:
          'Notification push quand une activité que la personne administre reçoit une demande.',
      }),
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
    // Lire une notification ne modifie aucune donnée de l'organisation : une
    // organisation en lecture seule le permet, à la différence des autres mutations.
    skipTypeScopes: true,
    description:
      'Sans identifiants, marque toutes les notifications comme lues. Reste possible dans une organisation en lecture seule.',
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
      mailDemandes: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      applicationPerimetre: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      pushTaches: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      pushEcheances: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      pushDemandes: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const donnees = {
        frequenceResume: args.frequenceResume,
        mailModification: args.mailModification,
        mailEcheance: args.mailEcheance,
        ...(typeof args.mailDemandes === 'boolean'
          ? { mailDemandes: args.mailDemandes }
          : {}),
        ...(typeof args.applicationPerimetre === 'boolean'
          ? { applicationPerimetre: args.applicationPerimetre }
          : {}),
        ...(typeof args.pushTaches === 'boolean'
          ? { pushTaches: args.pushTaches }
          : {}),
        ...(typeof args.pushEcheances === 'boolean'
          ? { pushEcheances: args.pushEcheances }
          : {}),
        ...(typeof args.pushDemandes === 'boolean'
          ? { pushDemandes: args.pushDemandes }
          : {}),
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
