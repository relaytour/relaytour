import {
  FrequenceResume,
  MailPriorites,
  NiveauNotification,
  prisma,
  type Prisma,
  SuiviAdmin,
  SuiviPerimetres,
  TypeNotification,
} from '@relaytour/database'

import {
  composerNotifications,
  type NotificationComposee,
  SELECTION_NOTIFICATION,
} from '../lib/composition-notifications.ts'
import { accesRefuse } from '../lib/erreurs.ts'
import {
  type Modele,
  MODELES,
  modeleDe,
  modeleRecommande,
  propositionModele,
  REGLAGES_DES_MODELES,
} from '../lib/modeles-notification.ts'
import { preferencesDe } from '../lib/notifications.ts'
import { filtreNotificationsAdmin } from '../lib/notifications-admin.ts'

import { builder } from './builder.ts'

const TypeNotificationEnum = builder.enumType(TypeNotification, {
  name: 'TypeNotification',
})
const NiveauNotificationEnum = builder.enumType(NiveauNotification, {
  name: 'NiveauNotification',
  description:
    'À quel titre la personne reçoit la notification (ADR 0033). Le niveau REFERENT reste dans la cloche ; les niveaux d’admin ont leur écran.',
})
const FrequenceResumeEnum = builder.enumType(FrequenceResume, {
  name: 'FrequenceResume',
})

const SuiviPerimetresEnum = builder.enumType(SuiviPerimetres, {
  name: 'SuiviPerimetres',
  description:
    'Ce que la personne suit de ses périmètres (ADR 0065) : ce qui la concerne, l’essentiel du périmètre, ou tout le détail.',
})

const SuiviAdminEnum = builder.enumType(SuiviAdmin, {
  name: 'SuiviAdmin',
  description:
    'Ce qu’un admin suit de ses rôles d’admin (ADR 0065) : les actions à mener, ou tout le détail.',
})

const ModeleNotificationEnum = builder.enumType('ModeleNotification', {
  values: MODELES,
  description:
    'Modèle de réglages des notifications (ADR 0065) : Essentiel, Référent·e, Contact principal ou Admin d’activité.',
})

const MailPrioritesEnum = builder.enumType(MailPriorites, {
  name: 'MailPriorites',
  description:
    'Mail des priorités (ADR 0063) : aucun, celles des périmètres où la personne est affectée, ou celles de toute l’activité.',
})

// Chaque personne ne lit et ne modifie que ses propres notifications et préférences :
// toutes les requêtes filtrent sur l'identifiant de la session et sur l'organisation
// active.

interface NotificationVue extends NotificationComposee {
  type: TypeNotification
  niveau: NiveauNotification
  lue: boolean
  creeLe: Date
}

const ActiviteNotifieeRef = builder
  .objectRef<{ id: string; slug: string; nom: string }>('ActiviteNotifiee')
  .implement({
    description:
      'L’activité d’une notification, pour la ranger et l’afficher (ADR 0032).',
    fields: t => ({
      id: t.exposeID('id'),
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
    }),
  })

const PerimetreNotifieRef = builder
  .objectRef<{
    id: string
    slug: string
    nom: string
    couleur: string | null
  }>('PerimetreNotifie')
  .implement({
    description:
      'Le périmètre d’une notification, pour la ranger et l’afficher (ADR 0032 et 0033).',
    fields: t => ({
      id: t.exposeID('id'),
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
      couleur: t.exposeString('couleur', { nullable: true }),
    }),
  })

const NotificationRef = builder
  .objectRef<NotificationVue>('Notification')
  .implement({
    fields: t => ({
      id: t.exposeID('id'),
      type: t.expose('type', { type: TypeNotificationEnum }),
      niveau: t.expose('niveau', { type: NiveauNotificationEnum }),
      lue: t.exposeBoolean('lue'),
      creeLe: t.expose('creeLe', { type: 'DateTime' }),
      message: t.exposeString('message', {
        description:
          'Le texte affiché dans l’espace organisateur. L’activité et le périmètre s’affichent à part.',
      }),
      lien: t.exposeString('lien'),
      activite: t.field({
        type: ActiviteNotifieeRef,
        nullable: true,
        resolve: n => n.activite,
      }),
      perimetre: t.field({
        type: PerimetreNotifieRef,
        nullable: true,
        resolve: n => n.perimetre,
      }),
      periode: t.exposeString('periode', {
        nullable: true,
        description:
          'Le nom de la période, quand l’activité en a plusieurs qui ne sont pas archivées.',
      }),
    }),
  })

const AutreOrganisationRef = builder
  .objectRef<{ slug: string; nom: string; nonLues: number }>(
    'NotificationsAutreOrganisation'
  )
  .implement({
    description:
      'Une autre organisation de la personne qui a des notifications non lues (ADR 0032).',
    fields: t => ({
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
      nonLues: t.exposeInt('nonLues'),
    }),
  })

const NonLuesActiviteRef = builder
  .objectRef<{ activiteId: string | null; nonLues: number }>(
    'NotificationsNonLuesActivite'
  )
  .implement({
    description:
      'Le nombre de notifications non lues de la cloche pour une activité, ou pour l’organisation quand elles ne concernent aucune activité.',
    fields: t => ({
      activiteId: t.exposeID('activiteId', { nullable: true }),
      nonLues: t.exposeInt('nonLues'),
    }),
  })

interface Preferences {
  userId: string
  organisationId: string
  frequenceResume: FrequenceResume
  mailModification: boolean
  mailEcheance: boolean
  mailDemandes: boolean
  suiviPerimetres: SuiviPerimetres
  detailContactPrincipal: boolean
  suiviAdmin: SuiviAdmin
  modeleEcarte: Modele | null
  pushTaches: boolean
  pushEcheances: boolean
  pushDemandes: boolean
  pushEquipe: boolean
  pushAgenda: boolean
  resumeAdmin: boolean
  mailPriorites: MailPriorites
}

const PreferencesRef = builder
  .objectRef<Preferences>('PreferencesNotification')
  .implement({
    description:
      'Les préférences de la personne dans l’organisation active (ADR 0032).',
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
      suiviPerimetres: t.expose('suiviPerimetres', {
        type: SuiviPerimetresEnum,
        description:
          'Ce que la personne reçoit de l’activité de ses périmètres, au-delà de ce qui la concerne (ADR 0065).',
      }),
      detailContactPrincipal: t.exposeBoolean('detailContactPrincipal', {
        description:
          'Tout le détail des périmètres dont la personne est contact principal (ADR 0065).',
      }),
      suiviAdmin: t.expose('suiviAdmin', {
        type: SuiviAdminEnum,
        description:
          'Les notifications d’admin reçues : les actions à mener, ou tout le détail (ADR 0065).',
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
          'Notification push pour les demandes et les invitations des activités que la personne administre.',
      }),
      pushEquipe: t.exposeBoolean('pushEquipe', {
        description:
          'Notification push pour les nouvelles d’admin sur l’équipe.',
      }),
      pushAgenda: t.exposeBoolean('pushAgenda', {
        description:
          'Notification push quand la personne est convoquée à une réunion, ou quand une de ses réunions change ou s’annule (ADR 0037).',
      }),
      resumeAdmin: t.exposeBoolean('resumeAdmin', {
        description:
          'La section « Pour vos rôles d’admin » du résumé par mail (ADR 0033).',
      }),
      mailPriorites: t.expose('mailPriorites', {
        type: MailPrioritesEnum,
        description:
          'Mail des priorités, la veille de chaque point d’équipe ou le lundi sans point dans la semaine (ADR 0063).',
      }),
      modele: t.field({
        type: ModeleNotificationEnum,
        nullable: true,
        description:
          'Le modèle que les réglages reproduisent, ou null pour des réglages personnalisés (ADR 0065).',
        resolve: p => modeleDe(p),
      }),
      modeleRecommande: t.field({
        type: ModeleNotificationEnum,
        description:
          'Le modèle du rôle le plus large de la personne dans l’organisation. La recommandation ne change aucun réglage (ADR 0065).',
        resolve: p => modeleRecommande(prisma, p.userId, p.organisationId),
      }),
      propositionModele: t.field({
        type: ModeleNotificationEnum,
        nullable: true,
        description:
          'Le modèle à proposer à la personne : celui de son rôle, quand ses réglages ne le suivent pas et qu’elle ne l’a pas refusé (ADR 0065).',
        resolve: p => propositionModele(prisma, p),
      }),
    }),
  })

/**
 * Le filtre des notifications d'un niveau : la cloche, ou l'écran des admins. Null
 * pour l'écran des admins d'une personne sans rôle d'admin.
 */
async function filtreDuNiveau(
  userId: string,
  organisationId: string,
  admin: boolean
): Promise<Prisma.NotificationWhereInput | null> {
  // Une notification de tâche en attente de sa fenêtre ne s'affiche pas (ADR 0065).
  const base = { userId, organisationId, disponibleLe: null }
  if (!admin) return { ...base, niveau: 'REFERENT' }
  const filtre = await filtreNotificationsAdmin(prisma, userId, organisationId)
  return filtre === null ? null : { ...base, ...filtre }
}

/** Restreint un filtre à une activité ou à un périmètre, pour marquer un groupe. */
function dansLeGroupe(
  activiteId: string | null | undefined,
  perimetreId: string | null | undefined
): Prisma.NotificationWhereInput {
  const conditions: Prisma.NotificationWhereInput[] = []
  if (activiteId) {
    conditions.push({
      OR: [
        { activiteId },
        { tache: { perimetre: { activiteId } } },
        { fiche: { activiteId } },
      ],
    })
  }
  if (perimetreId) {
    conditions.push({
      OR: [
        { perimetreId },
        { tache: { perimetreId } },
        { fiche: { perimetreId } },
      ],
    })
  }
  return conditions.length === 0 ? {} : { AND: conditions }
}

builder.queryFields(t => ({
  notifications: t.field({
    type: [NotificationRef],
    authScopes: { connecte: true },
    args: {
      nonLuesSeulement: t.arg.boolean({ defaultValue: false }),
      limite: t.arg.int({ defaultValue: 30 }),
      admin: t.arg.boolean({
        defaultValue: false,
        description:
          'Les notifications d’admin plutôt que celles de la cloche (ADR 0033).',
      }),
      activiteId: t.arg.id({
        description:
          'Les seules notifications de cette activité : la cloche les charge à part, pour que la limite ne les coupe pas.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const where = await filtreDuNiveau(
        ctx.personne!.id,
        ctx.organisation!.id,
        args.admin ?? false
      )
      // Une personne sans rôle d'admin n'ouvre pas l'écran des admins (ADR 0033).
      if (where === null) throw accesRefuse()
      const lignes = await prisma.notification.findMany({
        where: {
          ...where,
          ...(args.nonLuesSeulement ? { lueLe: null } : {}),
          ...(args.activiteId === null || args.activiteId === undefined
            ? {}
            : dansLeGroupe(String(args.activiteId), null)),
        },
        select: { ...SELECTION_NOTIFICATION, lueLe: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        // L'écran des admins range ses notifications par périmètre : il en lit plus.
        take: Math.min(Math.max(args.limite ?? 30, 1), args.admin ? 200 : 100),
      })
      const composees = await composerNotifications(
        prisma,
        lignes,
        ctx.personne!.id
      )
      return lignes.map((l, i) => ({
        ...composees[i]!,
        type: l.type,
        niveau: l.niveau,
        lue: l.lueLe !== null,
        creeLe: l.createdAt,
      }))
    },
  }),

  nombreNotificationsNonLues: t.int({
    authScopes: { connecte: true },
    args: {
      admin: t.arg.boolean({
        defaultValue: false,
        description:
          'Compte les notifications d’admin plutôt que celles de la cloche (ADR 0033). Zéro pour une personne sans rôle d’admin.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const where = await filtreDuNiveau(
        ctx.personne!.id,
        ctx.organisation!.id,
        args.admin ?? false
      )
      // Le menu demande ce nombre à toute personne : sans rôle d'admin, il vaut zéro.
      if (where === null) return 0
      return prisma.notification.count({ where: { ...where, lueLe: null } })
    },
  }),

  nombreNotificationsNonLuesParActivite: t.field({
    type: [NonLuesActiviteRef],
    authScopes: { connecte: true },
    description:
      'Les notifications non lues de la cloche, comptées par activité. La cloche affiche celles de l’activité ouverte et signale les autres activités.',
    resolve: async (_root, _args, ctx) => {
      const where = await filtreDuNiveau(
        ctx.personne!.id,
        ctx.organisation!.id,
        false
      )
      const lignes = await prisma.notification.findMany({
        where: { ...where, lueLe: null },
        select: {
          activiteId: true,
          tache: { select: { perimetre: { select: { activiteId: true } } } },
          fiche: { select: { activiteId: true } },
        },
      })
      const comptes = new Map<string | null, number>()
      for (const l of lignes) {
        // La même règle que le rangement du tiroir (activiteIdDe).
        const activiteId =
          l.activiteId ??
          l.tache?.perimetre.activiteId ??
          l.fiche?.activiteId ??
          null
        comptes.set(activiteId, (comptes.get(activiteId) ?? 0) + 1)
      }
      return [...comptes].map(([activiteId, nonLues]) => ({
        activiteId,
        nonLues,
      }))
    },
  }),

  notificationsAutresOrganisations: t.field({
    type: [AutreOrganisationRef],
    authScopes: { connecte: true },
    description:
      'Les autres organisations de la personne qui ont des notifications non lues : celles de la cloche, et celles des rôles d’admin qu’elle y tient encore (ADR 0032).',
    resolve: async (_root, _args, ctx) => {
      const userId = ctx.personne!.id
      const appartenances = await prisma.appartenance.findMany({
        where: {
          userId,
          archiveLe: null,
          organisationId: { not: ctx.organisation!.id },
          organisation: { statut: { in: ['ACTIVE', 'LECTURE_SEULE'] } },
        },
        select: {
          organisation: { select: { id: true, slug: true, nom: true } },
        },
      })
      const comptes = await Promise.all(
        appartenances.map(async ({ organisation }) => {
          const filtreAdmin = await filtreNotificationsAdmin(
            prisma,
            userId,
            organisation.id
          )
          const nonLues = await prisma.notification.count({
            where: {
              userId,
              organisationId: organisation.id,
              lueLe: null,
              disponibleLe: null,
              OR: [
                { niveau: 'REFERENT' },
                ...(filtreAdmin === null ? [] : [filtreAdmin]),
              ],
            },
          })
          return { slug: organisation.slug, nom: organisation.nom, nonLues }
        })
      )
      return comptes
        .filter(c => c.nonLues > 0)
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    },
  }),

  mesPreferencesNotification: t.field({
    type: PreferencesRef,
    authScopes: { connecte: true },
    resolve: (_root, _args, ctx) =>
      preferencesDe(prisma, ctx.personne!.id, ctx.organisation!.id),
  }),
}))

builder.mutationFields(t => ({
  marquerNotificationsLues: t.int({
    authScopes: { connecte: true },
    // Lire une notification ne modifie aucune donnée de l'organisation : une
    // organisation en lecture seule le permet, à la différence des autres mutations.
    skipTypeScopes: true,
    description:
      'Sans identifiants, marque comme lues toutes les notifications du niveau choisi, ou celles d’une activité ou d’un périmètre. Reste possible dans une organisation en lecture seule.',
    args: {
      ids: t.arg.idList(),
      admin: t.arg.boolean({
        defaultValue: false,
        description:
          'Sans identifiants : les notifications d’admin plutôt que celles de la cloche.',
      }),
      activiteId: t.arg.id(),
      perimetreId: t.arg.id(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = ctx.personne!.id
      const organisationId = ctx.organisation!.id
      const niveau = args.ids
        ? null
        : await filtreDuNiveau(userId, organisationId, args.admin ?? false)
      if (!args.ids && niveau === null) throw accesRefuse()
      const where: Prisma.NotificationWhereInput = args.ids
        ? { userId, organisationId, id: { in: args.ids.map(String) } }
        : {
            ...niveau,
            ...dansLeGroupe(
              args.activiteId === null || args.activiteId === undefined
                ? null
                : String(args.activiteId),
              args.perimetreId === null || args.perimetreId === undefined
                ? null
                : String(args.perimetreId)
            ),
          }
      const { count } = await prisma.notification.updateMany({
        where: { ...where, lueLe: null },
        data: { lueLe: new Date() },
      })
      return count
    },
  }),

  modifierPreferencesNotification: t.field({
    type: PreferencesRef,
    authScopes: { connecte: true },
    description:
      'Modifie les préférences de la personne dans l’organisation active (ADR 0032).',
    args: {
      frequenceResume: t.arg({ type: FrequenceResumeEnum, required: true }),
      mailModification: t.arg.boolean({ required: true }),
      mailEcheance: t.arg.boolean({ required: true }),
      mailDemandes: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      suiviPerimetres: t.arg({
        type: SuiviPerimetresEnum,
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      detailContactPrincipal: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      suiviAdmin: t.arg({
        type: SuiviAdminEnum,
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
      pushEquipe: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      pushAgenda: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      resumeAdmin: t.arg.boolean({
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
      mailPriorites: t.arg({
        type: MailPrioritesEnum,
        description: 'Sans valeur, ce réglage ne change pas.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const facultatifs = [
        'mailDemandes',
        'detailContactPrincipal',
        'pushTaches',
        'pushEcheances',
        'pushDemandes',
        'pushEquipe',
        'pushAgenda',
        'resumeAdmin',
      ] as const
      const reglages: Partial<Record<(typeof facultatifs)[number], boolean>> =
        {}
      for (const cle of facultatifs) {
        const valeur = args[cle]
        if (typeof valeur === 'boolean') reglages[cle] = valeur
      }
      const donnees = {
        frequenceResume: args.frequenceResume,
        mailModification: args.mailModification,
        mailEcheance: args.mailEcheance,
        ...reglages,
        ...(args.mailPriorites ? { mailPriorites: args.mailPriorites } : {}),
        ...(args.suiviPerimetres
          ? { suiviPerimetres: args.suiviPerimetres }
          : {}),
        ...(args.suiviAdmin ? { suiviAdmin: args.suiviAdmin } : {}),
      }
      const userId = ctx.personne!.id
      const organisationId = ctx.organisation!.id
      return prisma.preferenceOrganisation.upsert({
        where: { userId_organisationId: { userId, organisationId } },
        update: donnees,
        create: { userId, organisationId, ...donnees },
      })
    },
  }),

  appliquerModeleNotification: t.field({
    type: PreferencesRef,
    authScopes: { connecte: true },
    description:
      'Applique un modèle de réglages aux préférences de la personne dans l’organisation active (ADR 0065). Les familles de push autres que l’équipe ne changent pas.',
    args: {
      modele: t.arg({ type: ModeleNotificationEnum, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = ctx.personne!.id
      const organisationId = ctx.organisation!.id
      // Un modèle appliqué efface un refus passé (ADR 0065).
      const donnees = {
        ...REGLAGES_DES_MODELES[args.modele],
        modeleEcarte: null,
      }
      return prisma.preferenceOrganisation.upsert({
        where: { userId_organisationId: { userId, organisationId } },
        update: donnees,
        create: { userId, organisationId, ...donnees },
      })
    },
  }),

  ecarterPropositionModele: t.field({
    type: PreferencesRef,
    authScopes: { connecte: true },
    description:
      'Refuse le modèle proposé pour le rôle de la personne. La proposition revient avec une autre recommandation (ADR 0065).',
    resolve: async (_root, _args, ctx) => {
      const userId = ctx.personne!.id
      const organisationId = ctx.organisation!.id
      // Seule une proposition faite se refuse : des réglages déjà conformes ne
      // retiennent aucun refus.
      const modeleEcarte = await propositionModele(
        prisma,
        await preferencesDe(prisma, userId, organisationId)
      )
      if (modeleEcarte === null) {
        return preferencesDe(prisma, userId, organisationId)
      }
      return prisma.preferenceOrganisation.upsert({
        where: { userId_organisationId: { userId, organisationId } },
        update: { modeleEcarte },
        create: { userId, organisationId, modeleEcarte },
      })
    },
  }),
}))
