import { prisma, type JetonAcces } from '@relaytour/database'

import { buildContext, type AppContext } from '../context.ts'
import { accesRefuse, apiInactive, erreurSaisie } from '../lib/erreurs.ts'
import {
  apiOuverte,
  causeFermeture,
  creerJetonAcces,
  etatApi,
  finDuJeton,
  NOM_JETON_MAX,
} from '../lib/jetons-acces.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import { creerRobot } from '../lib/robots.ts'
import { texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { JetonAccesRef, JetonCreeRef, PorteeJetonEnum } from './jetons-acces.ts'

// Robots (ADR 0064) : des membres sans connexion, créés par un admin de
// l'organisation, qui portent les jetons d'une automatisation partagée. Toutes
// ces opérations exigent une session d'un admin de l'organisation : un jeton ne
// crée ni robot ni jeton de robot.

/** Jetons actifs d'un robot. */
const JETONS_ROBOT_MAX = 5

interface Robot {
  id: string
  nom: string
  archive: boolean
  activites: { id: string; nom: string }[]
  jetons: JetonAcces[]
}

const ActiviteDuRobotRef = builder
  .objectRef<{ id: string; nom: string }>('ActiviteDuRobot')
  .implement({
    fields: t => ({ id: t.exposeID('id'), nom: t.exposeString('nom') }),
  })

const RobotRef = builder.objectRef<Robot>('Robot').implement({
  description:
    'Un robot de l’organisation : un membre sans connexion qui porte des jetons d’accès. Il reçoit ses droits comme une personne.',
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('nom'),
    archive: t.exposeBoolean('archive'),
    activites: t.field({
      type: [ActiviteDuRobotRef],
      description: 'Les activités où le robot est rattaché.',
      resolve: r => r.activites,
    }),
    jetons: t.field({
      type: [JetonAccesRef],
      description:
        'Les jetons du robot : actifs, puis révoqués ou expirés depuis moins de 30 jours.',
      resolve: r => r.jetons,
    }),
  }),
})

async function lireRobots(
  organisationId: string,
  id?: string
): Promise<Robot[]> {
  const recents = new Date(Date.now() - 30 * 86_400_000)
  const comptes = await prisma.user.findMany({
    where: {
      robot: true,
      ...(id === undefined ? {} : { id }),
      appartenances: { some: { organisationId } },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      appartenances: {
        where: { organisationId },
        select: { archiveLe: true },
      },
      rattachementsActivite: {
        where: { organisationId },
        select: { activite: { select: { id: true, nom: true } } },
      },
      jetonsAcces: {
        where: {
          organisationId,
          OR: [
            { revoqueLe: null, expireLe: { gt: recents } },
            { revoqueLe: { gt: recents } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      },
    },
  })
  return comptes.map(c => ({
    id: c.id,
    nom: c.name,
    archive: c.appartenances[0]?.archiveLe !== null,
    activites: c.rattachementsActivite.map(r => r.activite),
    jetons: c.jetonsAcces,
  }))
}

/** Le robot de l'organisation active, sinon un refus qui ne dit pas s'il existe. */
async function exigerRobot(ctx: AppContext, id: string): Promise<Robot> {
  const [robot] = await lireRobots(ctx.organisation!.id, id)
  if (robot === undefined) throw accesRefuse()
  return robot
}

builder.queryFields(t => ({
  robots: t.field({
    type: [RobotRef],
    authScopes: { $all: { admin: true, session: true } },
    description: 'Les robots de l’organisation active, archivés compris.',
    resolve: (_root, _args, ctx) => lireRobots(ctx.organisation!.id),
  }),
}))

builder.mutationFields(t => ({
  creerRobot: t.field({
    type: RobotRef,
    authScopes: { $all: { admin: true, session: true } },
    description:
      'Crée un robot, rattaché aux activités choisies. Il prend une place de membre. Cinq robots actifs au plus par organisation.',
    args: {
      nom: t.arg.string({ required: true }),
      activiteIds: t.arg.idList({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const nom = texteRequis(args.nom, i18n._('Le nom du robot'))
      const activiteIds = [...new Set(args.activiteIds.map(String))]
      if (activiteIds.length === 0) {
        throw erreurSaisie(i18n._('Choisissez au moins une activité.'))
      }
      for (const id of activiteIds) await ctx.exigerActivite(id)
      const { id } = await creerRobot({
        organisationId: ctx.organisation!.id,
        nom,
        activiteIds,
        creeParId: ctx.personne!.id,
      })
      journal.info(
        {
          evenement: 'robot-cree',
          robotId: id,
          organisationId: ctx.organisation!.id,
          par: ctx.personne!.id,
        },
        'Un robot a été créé.'
      )
      return exigerRobot(ctx, id)
    },
  }),

  creerJetonRobot: t.field({
    type: JetonCreeRef,
    authScopes: { $all: { admin: true, session: true } },
    description:
      'Crée un jeton d’accès pour un robot. Ses activités se vérifient contre celles que le robot voit. Cinq jetons actifs au plus par robot.',
    args: {
      robotId: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      portee: t.arg({ type: PorteeJetonEnum, required: true }),
      activiteIds: t.arg.idList(),
      expireLe: t.arg({ type: 'DateTime' }),
    },
    resolve: async (_root, args, ctx) => {
      const organisation = ctx.organisation!
      const robot = await exigerRobot(ctx, String(args.robotId))
      if (robot.archive) {
        throw erreurSaisie(
          i18n._(
            'Ce robot est archivé : rétablissez-le avant de lui créer un jeton.'
          )
        )
      }
      const reglage = await prisma.organisation.findUniqueOrThrow({
        where: { id: organisation.id },
        select: {
          apiActivee: true,
          apiAutorisee: true,
          apiImposee: true,
          apiSuspendueLe: true,
          apiSuspensionMotif: true,
        },
      })
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
      let activiteIds: string[] | null = null
      if (args.activiteIds !== null && args.activiteIds !== undefined) {
        activiteIds = [...new Set(args.activiteIds.map(String))]
        if (activiteIds.length === 0) {
          throw erreurSaisie(
            i18n._(
              'Choisissez au moins une activité, ou laissez le jeton ouvert à toutes les activités du robot.'
            )
          )
        }
        // Les activités du jeton se vérifient avec les droits du robot, jamais
        // avec ceux de l'admin qui crée le jeton.
        const duRobot = await buildContext(ctx.ip, robot.id, organisation.slug)
        for (const id of activiteIds) await duRobot.exigerActivite(id)
      }
      const { jeton, ligne } = await creerJetonAcces({
        organisationId: organisation.id,
        userId: robot.id,
        creeParId: ctx.personne!.id,
        nom,
        portee: args.portee,
        activiteIds,
        expireLe: finDuJeton(args.expireLe),
        max: JETONS_ROBOT_MAX,
      })
      journal.info(
        {
          evenement: 'jeton-acces-cree',
          jetonId: ligne.id,
          organisationId: organisation.id,
          userId: robot.id,
          par: ctx.personne!.id,
          portee: ligne.portee,
        },
        'Un jeton d’accès de robot a été créé.'
      )
      return { jeton, jetonAcces: ligne }
    },
  }),

  revoquerJetonRobot: t.boolean({
    authScopes: { $all: { admin: true, session: true } },
    // Un jeton compromis se révoque même dans une organisation en lecture seule.
    skipTypeScopes: true,
    description:
      'Révoque un jeton d’un robot de l’organisation. Rend faux pour un jeton inconnu, déjà révoqué ou qui n’appartient pas à un robot.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { count } = await prisma.jetonAcces.updateMany({
        where: {
          id: String(args.id),
          organisationId: ctx.organisation!.id,
          revoqueLe: null,
          user: { robot: true },
        },
        data: { revoqueLe: new Date() },
      })
      if (count > 0) {
        journal.info(
          {
            evenement: 'jeton-acces-revoque',
            jetonId: String(args.id),
            par: ctx.personne!.id,
          },
          'Un jeton d’accès de robot a été révoqué.'
        )
      }
      return count > 0
    },
  }),
}))
