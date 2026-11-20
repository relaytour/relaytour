import { PorteeJeton, prisma, type JetonAcces } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { mettreEnFile } from '../courriel/file.ts'
import { apiInactive, erreurSaisie } from '../lib/erreurs.ts'
import {
  apiOuverte,
  causeFermeture,
  creerJetonAcces,
  etatApi,
  finDuJeton,
  NOM_JETON_MAX,
  revoquerJetonDeLOrganisation,
  revoquerJetonsDe,
  type EtatApi,
} from '../lib/jetons-acces.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import { texteRequis } from '../lib/saisie.ts'

import { ApplicationTierceRef } from './application-tierce.ts'
import { builder } from './builder.ts'

// Jetons d'accès et module « API » de l'organisation (ADR 0064).
//
// Une personne crée ses jetons depuis l'espace organisateur, avec sa session : un
// jeton ne crée, ne lit ni ne révoque aucun jeton. Le jeton s'affiche une seule
// fois, et sa création se signale par un mail qui porte un lien de révocation. Un
// admin de l'organisation voit les jetons de tous les membres et les révoque ; la
// porteuse l'apprend par mail. Un admin active ou désactive le module ;
// l'administration de l'installation l'autorise, l'impose ou le suspend
// (schema/installation.ts).

/** Une personne choisit 50 activités au plus pour un jeton. */
const ACTIVITES_MAX = 50

export const PorteeJetonEnum = builder.enumType(PorteeJeton, {
  name: 'PorteeJeton',
  description:
    'LECTURE : le jeton lit, et toute mutation est refusée. LECTURE_ECRITURE : le jeton lit et écrit, avec les droits de la personne.',
})

export const EtatApiEnum = builder.enumType('EtatApi', {
  values: ['INACTIVE', 'ACTIVE', 'IMPOSEE', 'INTERDITE', 'SUSPENDUE'] as const,
  description:
    'INACTIVE : un admin de l’organisation peut l’activer. ACTIVE : activée par l’organisation. IMPOSEE : activée par l’administration de l’installation. INTERDITE : l’administration de l’installation ne la propose pas. SUSPENDUE : l’administration de l’installation l’a suspendue.',
})

const activitesDe = (j: Pick<JetonAcces, 'activiteIds'>) =>
  Array.isArray(j.activiteIds) ? (j.activiteIds as unknown[]).map(String) : null

export const JetonAccesRef = builder
  .objectRef<JetonAcces>('JetonAcces')
  .implement({
    description:
      'Un jeton d’accès d’un programme tiers. Sa valeur ne se relit pas : elle s’affiche une seule fois, à sa création.',
    fields: t => ({
      id: t.exposeID('id'),
      nom: t.exposeString('nom'),
      apercu: t.exposeString('apercu', {
        description:
          'Les huit caractères qui suivent « rt_ », pour reconnaître le jeton.',
      }),
      portee: t.expose('portee', { type: PorteeJetonEnum }),
      gestionMembres: t.exposeBoolean('gestionMembres', {
        description:
          'Le jeton ouvre la gestion des membres : inviter, retirer et promouvoir une personne, dans la limite des droits de sa personne. Faux par défaut, et toujours pour un robot.',
      }),
      activiteIds: t.idList({
        nullable: true,
        description:
          'Les activités ouvertes au jeton. Nul : toutes celles que la personne voit.',
        resolve: activitesDe,
      }),
      expireLe: t.expose('expireLe', { type: 'DateTime' }),
      dernierAccesLe: t.expose('dernierAccesLe', {
        type: 'DateTime',
        nullable: true,
      }),
      revoqueLe: t.expose('revoqueLe', { type: 'DateTime', nullable: true }),
      creeLe: t.expose('createdAt', { type: 'DateTime' }),
      application: t.field({
        type: ApplicationTierceRef,
        nullable: true,
        description:
          'L’application tierce autorisée par la personne (ADR 0067). Nulle pour un jeton créé dans « Jetons et API ».',
        resolve: async j =>
          j.clientApplicationId === null
            ? null
            : prisma.clientApplication.findUnique({
                where: { id: j.clientApplicationId },
              }),
      }),
    }),
  })

/**
 * Un jeton de l'organisation, avec sa porteuse, l'admin qui l'a révoqué et le
 * nombre de messages en cours qu'il a préparés (ADR 0071).
 */
type JetonDeLOrganisation = JetonAcces & {
  user: { id: string; name: string; robot: boolean }
  revoquePar: { name: string } | null
  messagesEnCours: number
}

const PorteurDeJetonRef = builder
  .objectRef<JetonDeLOrganisation['user']>('PorteurDeJeton')
  .implement({
    description: 'La personne ou le robot au nom de qui un jeton agit.',
    fields: t => ({
      id: t.exposeID('id'),
      nom: t.exposeString('name'),
      robot: t.exposeBoolean('robot'),
    }),
  })

const JetonOrganisationRef = builder
  .objectRef<JetonDeLOrganisation>('JetonOrganisation')
  .implement({
    description:
      'Un jeton d’accès de l’organisation, vu par un admin : ses bornes et sa porteuse, jamais sa valeur.',
    fields: t => ({
      jeton: t.field({ type: JetonAccesRef, resolve: j => j }),
      porteur: t.field({ type: PorteurDeJetonRef, resolve: j => j.user }),
      revoquePar: t.string({
        nullable: true,
        description:
          'Le nom de l’admin qui a révoqué le jeton. Nul quand la porteuse l’a révoqué elle-même, par l’écran ou par le lien de son mail.',
        resolve: j => j.revoquePar?.name ?? null,
      }),
      messagesEnCours: t.exposeInt('messagesEnCours', {
        description:
          'Les messages en cours que le jeton a préparés, ou que l’application a préparés pour sa personne, réautorisations comprises (ADR 0071). L’admin qui révoque un accès sait ainsi quels messages relire.',
      }),
    }),
  })

export const JetonCreeRef = builder
  .objectRef<{ jeton: string; jetonAcces: JetonAcces }>('JetonCree')
  .implement({
    description:
      'Un jeton qui vient d’être créé. `jeton` est sa valeur, rendue cette seule fois.',
    fields: t => ({
      jeton: t.exposeString('jeton'),
      jetonAcces: t.field({ type: JetonAccesRef, resolve: c => c.jetonAcces }),
    }),
  })

interface ApiOrganisation {
  etat: EtatApi
  suspendueLe: Date | null
  suspensionMotif: string | null
}

const ApiOrganisationRef = builder
  .objectRef<ApiOrganisation>('ApiOrganisation')
  .implement({
    description:
      'L’état du module « API » de l’organisation active : les jetons d’accès ne répondent que s’il vaut ACTIVE ou IMPOSEE.',
    fields: t => ({
      etat: t.expose('etat', { type: EtatApiEnum }),
      suspendueLe: t.expose('suspendueLe', {
        type: 'DateTime',
        nullable: true,
      }),
      suspensionMotif: t.exposeString('suspensionMotif', { nullable: true }),
    }),
  })

const JetonCourantRef = builder
  .objectRef<NonNullable<AppContext['jeton']>>('JetonCourant')
  .implement({
    description:
      'Les bornes du jeton qui porte la requête : un programme tiers les lit pour savoir ce qu’il peut faire.',
    fields: t => ({
      portee: t.expose('portee', { type: PorteeJetonEnum }),
      gestionMembres: t.exposeBoolean('gestionMembres', {
        description:
          'Vrai quand le jeton ouvre la gestion des membres : inviter, retirer et promouvoir une personne.',
      }),
      activiteIds: t.idList({
        nullable: true,
        description: 'Nul : toutes les activités que la personne voit.',
        resolve: j => (j.activites === null ? null : [...j.activites]),
      }),
      expireLe: t.expose('expireLe', { type: 'DateTime' }),
      application: t.string({
        nullable: true,
        description:
          'Le nom de l’application tierce qui porte la requête (ADR 0067). Nul pour un jeton d’accès.',
        resolve: j => j.application?.nom ?? null,
      }),
    }),
  })

async function reglageApi(organisationId: string) {
  return prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: {
      apiActivee: true,
      apiAutorisee: true,
      apiImposee: true,
      apiSuspendueLe: true,
      apiSuspensionMotif: true,
    },
  })
}

async function apiDeLOrganisation(
  organisationId: string
): Promise<ApiOrganisation> {
  const r = await reglageApi(organisationId)
  return {
    etat: etatApi(r),
    suspendueLe: r.apiSuspendueLe,
    suspensionMotif: r.apiSuspensionMotif,
  }
}

/** Les activités choisies pour un jeton, chacune vérifiée. Nulle : aucune restriction. */
export async function activitesChoisies(
  ctx: AppContext,
  ids: readonly (string | number)[] | null | undefined
): Promise<string[] | null> {
  if (ids === null || ids === undefined) return null
  const uniques = [...new Set(ids.map(String))]
  if (uniques.length === 0) {
    throw erreurSaisie(
      i18n._(
        'Choisissez au moins une activité, ou laissez le jeton ouvert à toutes vos activités.'
      )
    )
  }
  if (uniques.length > ACTIVITES_MAX) {
    throw erreurSaisie(
      i18n._('Un jeton porte {max} activités au plus.', { max: ACTIVITES_MAX })
    )
  }
  // Une activité que la personne ne voit pas vaut une activité d'une autre
  // organisation : la création est refusée sans dire laquelle.
  for (const id of uniques) await ctx.exigerActivite(id)
  return uniques
}

builder.queryFields(t => ({
  mesJetonsAcces: t.field({
    type: [JetonAccesRef],
    authScopes: { $all: { connecte: true, session: true } },
    description:
      'Les jetons d’accès de la personne dans l’organisation active : les jetons actifs, puis ceux révoqués ou expirés depuis moins de 30 jours. Les autorisations d’application se lisent par `mesAutorisationsApplications`.',
    resolve: (_root, _args, ctx) => {
      const recents = new Date(Date.now() - 30 * 86_400_000)
      return prisma.jetonAcces.findMany({
        where: {
          organisationId: ctx.organisation!.id,
          userId: ctx.personne!.id,
          clientApplicationId: null,
          OR: [
            { revoqueLe: null, expireLe: { gt: recents } },
            { revoqueLe: { gt: recents } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 50,
      })
    },
  }),

  jetonsAccesOrganisation: t.field({
    type: [JetonOrganisationRef],
    authScopes: { $all: { admin: true, session: true } },
    description:
      'Les jetons d’accès de toute l’organisation, pour ses admins : les jetons actifs, puis ceux révoqués ou expirés depuis moins de 30 jours. La valeur d’un jeton ne se relit jamais.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const recents = new Date(Date.now() - 30 * 86_400_000)
      const jetons = await prisma.jetonAcces.findMany({
        where: {
          organisationId,
          OR: [
            { revoqueLe: null, expireLe: { gt: recents } },
            { revoqueLe: { gt: recents } },
          ],
        },
        include: {
          user: { select: { id: true, name: true, robot: true } },
          revoquePar: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 200,
      })
      // Deux comptages groupés pour toute la liste (ADR 0071). Un jeton d'accès
      // compte ses propres messages. Une autorisation d'application compte ceux
      // de son application pour sa personne : une réautorisation du même client
      // remplace la ligne, et les messages préparés avant restent à relire.
      const acces = jetons.filter(j => j.clientApplicationId === null)
      const applications = jetons.flatMap(j =>
        j.clientApplicationId === null ? [] : [j.clientApplicationId]
      )
      const enCours = { organisationId, statut: 'EN_COURS' as const }
      const [parAcces, parApplication] = await Promise.all([
        prisma.message.groupBy({
          by: ['jetonAccesId'],
          where: { ...enCours, jetonAccesId: { in: acces.map(j => j.id) } },
          _count: { _all: true },
        }),
        prisma.message.groupBy({
          by: ['auteurId', 'clientApplicationId'],
          where: { ...enCours, clientApplicationId: { in: applications } },
          _count: { _all: true },
        }),
      ])
      const parJeton = new Map(
        parAcces.map(c => [c.jetonAccesId, c._count._all])
      )
      const cleApplication = (userId: string | null, clientId: string | null) =>
        `${userId ?? ''}:${clientId ?? ''}`
      const parPersonneEtApplication = new Map(
        parApplication.map(c => [
          cleApplication(c.auteurId, c.clientApplicationId),
          c._count._all,
        ])
      )
      const compte = (j: (typeof jetons)[number]) =>
        j.clientApplicationId === null
          ? (parJeton.get(j.id) ?? 0)
          : (parPersonneEtApplication.get(
              cleApplication(j.userId, j.clientApplicationId)
            ) ?? 0)
      return jetons.map(j => ({ ...j, messagesEnCours: compte(j) }))
    },
  }),

  apiOrganisation: t.field({
    type: ApiOrganisationRef,
    authScopes: { connecte: true },
    description: 'L’état du module « API » de l’organisation active.',
    resolve: (_root, _args, ctx) => apiDeLOrganisation(ctx.organisation!.id),
  }),

  jetonCourant: t.field({
    type: JetonCourantRef,
    nullable: true,
    authScopes: { connecte: true },
    description:
      'Le jeton d’accès qui porte la requête. Nul pour une session de l’espace organisateur.',
    resolve: (_root, _args, ctx) => ctx.jeton,
  }),
}))

builder.mutationFields(t => ({
  creerJetonAcces: t.field({
    type: JetonCreeRef,
    authScopes: { $all: { connecte: true, session: true } },
    // Un jeton appartient à la personne : une organisation en lecture seule permet
    // d'en créer un, pour lire et exporter par un programme.
    skipTypeScopes: true,
    description:
      'Crée un jeton d’accès pour la personne connectée, dans l’organisation active. Sa valeur n’est rendue qu’ici.',
    args: {
      nom: t.arg.string({ required: true }),
      portee: t.arg({ type: PorteeJetonEnum, required: true }),
      activiteIds: t.arg.idList(),
      expireLe: t.arg({ type: 'DateTime' }),
      gestionMembres: t.arg.boolean({
        description:
          'Ouvre au jeton la gestion des membres : inviter, retirer et promouvoir une personne, dans la limite des droits de la personne. Faux par défaut.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const reglage = await reglageApi(organisationId)
      if (!apiOuverte(reglage)) {
        const cause = causeFermeture(etatApi(reglage))
        throw apiInactive(
          cause,
          cause === 'suspendue' ? reglage.apiSuspensionMotif : null
        )
      }
      const nom = texteRequis(
        args.nom,
        i18n._('Le nom du jeton'),
        NOM_JETON_MAX
      )
      const activiteIds = await activitesChoisies(ctx, args.activiteIds)
      const { jeton, ligne } = await creerJetonAcces({
        organisationId,
        userId: ctx.personne!.id,
        creeParId: ctx.personne!.id,
        nom,
        portee: args.portee,
        activiteIds,
        expireLe: finDuJeton(args.expireLe),
        gestionMembres: args.gestionMembres ?? false,
      })
      journal.info(
        {
          evenement: 'jeton-acces-cree',
          jetonId: ligne.id,
          organisationId,
          userId: ctx.personne!.id,
          portee: ligne.portee,
          gestionMembres: ligne.gestionMembres,
        },
        'Un jeton d’accès a été créé.'
      )
      // La personne apprend la création par mail, avec un lien de révocation : une
      // session volée ne crée pas un accès d'un an en silence.
      await mettreEnFile(
        'jeton-cree',
        { userId: ctx.personne!.id },
        { organisationId, jetonAccesId: ligne.id }
      )
      return { jeton, jetonAcces: ligne }
    },
  }),

  revoquerMesJetonsAcces: t.int({
    authScopes: { $all: { connecte: true, session: true } },
    // Des jetons compromis se révoquent même dans une organisation en lecture seule.
    skipTypeScopes: true,
    description:
      'Révoque tous les jetons d’accès actifs de la personne connectée dans l’organisation active. Rend leur nombre.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const nombre = await revoquerJetonsDe(prisma, {
        organisationId,
        userId: ctx.personne!.id,
      })
      if (nombre > 0) {
        journal.info(
          {
            evenement: 'jetons-acces-revoques',
            organisationId,
            userId: ctx.personne!.id,
            nombre,
          },
          'Une personne a révoqué tous ses jetons d’accès.'
        )
      }
      return nombre
    },
  }),

  revoquerJetonOrganisation: t.boolean({
    authScopes: { $all: { admin: true, session: true } },
    // Un jeton compromis se révoque même dans une organisation en lecture seule.
    skipTypeScopes: true,
    description:
      'Révoque un jeton d’accès de l’organisation, au nom d’un admin. La porteuse l’apprend par mail. Rend faux pour un jeton inconnu, d’une autre organisation ou déjà révoqué.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const id = String(args.id)
      const revoque = await revoquerJetonDeLOrganisation(prisma, {
        organisationId,
        id,
        parId: ctx.personne!.id,
      })
      if (revoque === null) return false
      journal.info(
        {
          evenement: 'jeton-acces-revoque',
          jetonId: id,
          organisationId,
          par: ctx.personne!.id,
        },
        'Un jeton d’accès a été révoqué par un admin de l’organisation.'
      )
      // Un robot ne lit pas de mail, et un admin qui révoque son propre jeton le sait.
      if (!revoque.robot && revoque.userId !== ctx.personne!.id) {
        await mettreEnFile(
          'jeton-revoque',
          { userId: revoque.userId },
          { organisationId, jetonAccesId: id }
        )
      }
      return true
    },
  }),

  revoquerJetonAcces: t.boolean({
    authScopes: { $all: { connecte: true, session: true } },
    // Un jeton compromis se révoque même dans une organisation en lecture seule.
    skipTypeScopes: true,
    description:
      'Révoque un jeton d’accès de la personne connectée. Rend faux pour un jeton inconnu, déjà révoqué ou d’une autre personne.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { count } = await prisma.jetonAcces.updateMany({
        where: {
          id: String(args.id),
          organisationId: ctx.organisation!.id,
          userId: ctx.personne!.id,
          revoqueLe: null,
        },
        data: { revoqueLe: new Date() },
      })
      if (count > 0) {
        journal.info(
          { evenement: 'jeton-acces-revoque', jetonId: String(args.id) },
          'Un jeton d’accès a été révoqué.'
        )
      }
      return count > 0
    },
  }),

  activerApi: t.field({
    type: ApiOrganisationRef,
    authScopes: { $all: { admin: true, session: true } },
    description:
      'Active le module « API » de l’organisation. Refusé quand l’administration de l’installation l’interdit ou le suspend.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const reglage = await reglageApi(organisationId)
      const etat = etatApi(reglage)
      if (etat === 'INTERDITE' || etat === 'SUSPENDUE') {
        throw apiInactive(
          causeFermeture(etat),
          etat === 'SUSPENDUE' ? reglage.apiSuspensionMotif : null
        )
      }
      await prisma.organisation.update({
        where: { id: organisationId },
        data: { apiActivee: true },
      })
      journal.info(
        { evenement: 'api-activee', organisationId, userId: ctx.personne!.id },
        'Le module API a été activé par un admin de l’organisation.'
      )
      return apiDeLOrganisation(organisationId)
    },
  }),

  desactiverApi: t.field({
    type: ApiOrganisationRef,
    authScopes: { $all: { admin: true, session: true } },
    description:
      'Désactive le module « API » de l’organisation. Les jetons ne sont pas révoqués : ils cessent de répondre, puis répondent de nouveau à la réactivation. Une activation imposée par l’administration de l’installation reste en vigueur.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      await prisma.organisation.update({
        where: { id: organisationId },
        data: { apiActivee: false },
      })
      journal.info(
        {
          evenement: 'api-desactivee',
          organisationId,
          userId: ctx.personne!.id,
        },
        'Le module API a été désactivé par un admin de l’organisation.'
      )
      return apiDeLOrganisation(organisationId)
    },
  }),
}))
