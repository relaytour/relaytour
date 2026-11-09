import { PorteeJeton, prisma, type JetonAcces } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { apiInactive, erreurSaisie } from '../lib/erreurs.ts'
import {
  apiOuverte,
  causeFermeture,
  creerJetonAcces,
  etatApi,
  finDuJeton,
  NOM_JETON_MAX,
  type EtatApi,
} from '../lib/jetons-acces.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import { texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'

// Jetons d'accès et module « API » de l'organisation (ADR 0064).
//
// Une personne crée ses jetons depuis l'espace organisateur, avec sa session : un
// jeton ne crée, ne lit ni ne révoque aucun jeton. Le jeton s'affiche une seule
// fois. Un admin de l'organisation active ou désactive le module ; l'administration
// de l'installation l'autorise, l'impose ou le suspend (schema/installation.ts).

/** Une personne choisit 50 activités au plus pour un jeton. */
const ACTIVITES_MAX = 50

const PorteeJetonEnum = builder.enumType(PorteeJeton, {
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

const JetonAccesRef = builder.objectRef<JetonAcces>('JetonAcces').implement({
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
  }),
})

const JetonCreeRef = builder
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
      activiteIds: t.idList({
        nullable: true,
        description: 'Nul : toutes les activités que la personne voit.',
        resolve: j => (j.activites === null ? null : [...j.activites]),
      }),
      expireLe: t.expose('expireLe', { type: 'DateTime' }),
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
async function activitesChoisies(
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
      'Les jetons d’accès de la personne dans l’organisation active : les jetons actifs, puis ceux révoqués ou expirés depuis moins de 30 jours.',
    resolve: (_root, _args, ctx) => {
      const recents = new Date(Date.now() - 30 * 86_400_000)
      return prisma.jetonAcces.findMany({
        where: {
          organisationId: ctx.organisation!.id,
          userId: ctx.personne!.id,
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
      })
      journal.info(
        {
          evenement: 'jeton-acces-cree',
          jetonId: ligne.id,
          organisationId,
          userId: ctx.personne!.id,
          portee: ligne.portee,
        },
        'Un jeton d’accès a été créé.'
      )
      return { jeton, jetonAcces: ligne }
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
