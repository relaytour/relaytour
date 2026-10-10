import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import {
  accepterInvitation,
  annoncerInvitation,
  lireLots,
  perimetresProposes,
  refuserInvitation,
  vivante,
  type LotInvitation,
} from '../lib/invitations.ts'
import { journal } from '../lib/journal.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'

// Invitations entre organisations (ADR 0030).
//
// Deux regards, qui ne se croisent pas. La personne invitée lit le nom de
// l'organisation et ce qu'on lui propose. L'organisation lit ce qu'elle a saisi :
// le nom, l'adresse et les périmètres. Elle ne lit ni l'identifiant du compte, ni
// son nom, ni ses autres organisations. Une invitation expirée n'existe plus.

// ── Vue de la personne invitée ───────────────────────────────────────────────

interface InvitationRecue {
  id: string
  organisationNom: string
  estAdmin: boolean
  expireLe: Date
  perimetres: string[]
}

const InvitationRecueRef = builder
  .objectRef<InvitationRecue>('InvitationRecue')
  .implement({
    description:
      'Une invitation à rejoindre une organisation, vue par la personne invitée. Rien n’est partagé avec cette organisation avant son accord.',
    fields: t => ({
      id: t.exposeID('id'),
      organisationNom: t.exposeString('organisationNom'),
      estAdmin: t.exposeBoolean('estAdmin', {
        description: 'Vrai quand l’invitation propose le rôle d’admin.',
      }),
      perimetres: t.exposeStringList('perimetres', {
        description:
          'Les périmètres proposés, avec leur période : « Football (Rencontres 2027) ».',
      }),
      expireLe: t.expose('expireLe', { type: 'DateTime' }),
    }),
  })

// ── Vue de l'organisation qui invite ─────────────────────────────────────────

interface InvitationEnAttente {
  id: string
  organisationId: string
  nom: string
  email: string
  estAdmin: boolean
  creeLe: Date
  expireLe: Date
  affectes: string[]
  souhaites: string[]
}

const perimetresDe = (ids: string[], organisationId: string) =>
  ids.length === 0
    ? []
    : prisma.perimetre.findMany({
        where: { id: { in: ids }, organisationId },
        orderBy: { ordre: 'asc' },
      })

const InvitationEnAttenteRef = builder
  .objectRef<InvitationEnAttente>('InvitationEnAttente')
  .implement({
    description:
      'Une invitation qui attend l’accord de la personne, vue par l’organisation : ce qu’elle a saisi, et rien du compte invité.',
    fields: t => ({
      id: t.exposeID('id'),
      nom: t.exposeString('nom', {
        description: 'Le nom saisi par la personne qui a invité.',
      }),
      email: t.exposeString('email', {
        description: 'L’adresse saisie par la personne qui a invité.',
      }),
      estAdmin: t.exposeBoolean('estAdmin'),
      creeLe: t.expose('creeLe', { type: 'DateTime' }),
      expireLe: t.expose('expireLe', { type: 'DateTime' }),
      perimetresAffectes: t.field({
        type: [PerimetreRef],
        resolve: i => perimetresDe(i.affectes, i.organisationId),
      }),
      perimetresSouhaites: t.field({
        type: [PerimetreRef],
        resolve: i => perimetresDe(i.souhaites, i.organisationId),
      }),
    }),
  })

/**
 * Les lots qu'une personne peut lire : tous pour un admin de l'organisation, ceux
 * des activités qu'elle administre pour un admin d'activité.
 */
async function lotsLisibles(
  ctx: AppContext,
  lots: LotInvitation[]
): Promise<LotInvitation[]> {
  if (ctx.personne!.estAdmin) return lots
  const administrees = await ctx.activitesAdministrees()
  return lots.filter(l => administrees.has(l.activiteId))
}

const SELECTION = {
  id: true,
  organisationId: true,
  userId: true,
  nom: true,
  role: true,
  globale: true,
  lots: true,
  createdAt: true,
  expireLe: true,
  user: { select: { email: true } },
} as const

/**
 * L'invitation de l'organisation active, avec ses lots lisibles. Une invitation
 * expirée, d'une autre organisation, inconnue ou sans lot lisible pour un admin
 * d'activité reçoit le même refus.
 */
async function exigerInvitation(ctx: AppContext, id: string) {
  const invitation = await prisma.invitationOrganisation.findFirst({
    where: { id, organisationId: ctx.organisation!.id, ...vivante() },
    select: SELECTION,
  })
  if (invitation === null) throw accesRefuse()
  const lots = lireLots(invitation.lots)
  const lisibles = await lotsLisibles(ctx, lots)
  if (!ctx.personne!.estAdmin && lisibles.length === 0) throw accesRefuse()
  return { invitation, lots, lisibles }
}

builder.queryFields(t => ({
  mesInvitations: t.field({
    type: [InvitationRecueRef],
    authScopes: { authentifie: true },
    description:
      'Les invitations qui attendent l’accord de la personne connectée (ADR 0030).',
    resolve: async (_root, _args, ctx) => {
      const invitations = await prisma.invitationOrganisation.findMany({
        where: {
          userId: ctx.personne!.id,
          organisation: { statut: 'ACTIVE' },
          ...vivante(),
        },
        select: {
          id: true,
          organisationId: true,
          role: true,
          lots: true,
          expireLe: true,
          organisation: { select: { nom: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
      return Promise.all(
        invitations.map(async i => ({
          id: i.id,
          organisationNom: i.organisation.nom,
          estAdmin: i.role === 'ADMIN',
          expireLe: i.expireLe,
          perimetres: await perimetresProposes(
            prisma,
            i.organisationId,
            lireLots(i.lots)
          ),
        }))
      )
    },
  }),

  invitationsEnAttente: t.field({
    type: [InvitationEnAttenteRef],
    authScopes: { gestion: true },
    description:
      'Les invitations de l’organisation qui attendent un accord (ADR 0030). Un admin d’activité lit celles de ses activités, avec leurs seuls périmètres.',
    args: { activiteId: t.arg.id() },
    resolve: async (_root, args, ctx) => {
      // Une activité invisible se refuse comme une activité inconnue (ADR 0010).
      const activiteId =
        args.activiteId == null
          ? null
          : await ctx.exigerActivite(String(args.activiteId))
      const invitations = await prisma.invitationOrganisation.findMany({
        where: { organisationId: ctx.organisation!.id, ...vivante() },
        select: SELECTION,
        orderBy: { createdAt: 'desc' },
      })
      const lues: InvitationEnAttente[] = []
      for (const i of invitations) {
        const lisibles = (await lotsLisibles(ctx, lireLots(i.lots))).filter(
          l => activiteId === null || l.activiteId === activiteId
        )
        // Sans lot lisible, seul un admin de l'organisation lit l'invitation, et
        // seulement hors du filtre d'une activité.
        if (
          lisibles.length === 0 &&
          (!ctx.personne!.estAdmin || activiteId !== null)
        ) {
          continue
        }
        lues.push({
          id: i.id,
          organisationId: i.organisationId,
          nom: i.nom,
          email: i.user.email,
          estAdmin: ctx.personne!.estAdmin && i.role === 'ADMIN',
          creeLe: i.createdAt,
          expireLe: i.expireLe,
          affectes: lisibles.flatMap(l => l.affectes),
          souhaites: lisibles.flatMap(l => l.souhaites),
        })
      }
      return lues
    },
  }),
}))

builder.mutationFields(t => ({
  accepterInvitation: t.string({
    authScopes: { authentifie: true },
    // L'acceptation n'écrit pas dans l'organisation active de la personne : son
    // statut ne la concerne pas. Celui de l'organisation qui invite est contrôlé.
    skipTypeScopes: true,
    description:
      'La personne accepte une invitation : elle devient membre de l’organisation, avec les périmètres proposés. Renvoie le slug de l’organisation.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { organisationSlug } = await accepterInvitation(prisma, {
        invitationId: String(args.id),
        userId: ctx.personne!.id,
      })
      return organisationSlug
    },
  }),

  refuserInvitation: t.boolean({
    authScopes: { authentifie: true },
    skipTypeScopes: true,
    description:
      'La personne refuse une invitation. L’organisation n’en est pas informée : une invitation refusée et une invitation expirée ne se distinguent pas.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, args, ctx) =>
      refuserInvitation(prisma, {
        invitationId: String(args.id),
        userId: ctx.personne!.id,
      }),
  }),

  relancerInvitation: t.boolean({
    authScopes: { gestion: true },
    description:
      'Renvoie le mail d’une invitation en attente, une fois par heure au plus.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { invitation, lisibles } = await exigerInvitation(
        ctx,
        String(args.id)
      )
      // La même limite que la relance d'un membre : une par personne et par heure.
      const partie = await annoncerInvitation(invitation.userId, {
        organisationId: invitation.organisationId,
        activiteId: lisibles[0]?.activiteId,
      })
      if (!partie) {
        throw erreurSaisie(
          'Cette personne a déjà reçu un mail d’invitation il y a moins d’une heure.'
        )
      }
      return true
    },
  }),

  retirerInvitation: t.boolean({
    authScopes: { gestion: true },
    description:
      'Retire une invitation en attente. Un admin d’activité retire les périmètres de ses activités ; l’invitation disparaît quand il n’en reste aucun.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { invitation, lots, lisibles } = await exigerInvitation(
        ctx,
        String(args.id)
      )
      const retires = new Set(lisibles.map(l => l.editionId))
      const restants = ctx.personne!.estAdmin
        ? []
        : lots.filter(l => !retires.has(l.editionId))
      // Une invitation faite au niveau de l'organisation, ou au rôle d'admin,
      // demeure quand un admin d'activité retire ses périmètres.
      const demeure =
        !ctx.personne!.estAdmin &&
        (restants.length > 0 ||
          invitation.globale ||
          invitation.role === 'ADMIN')
      if (demeure) {
        await prisma.invitationOrganisation.updateMany({
          where: { id: invitation.id },
          data: { lots: restants },
        })
      } else {
        await prisma.invitationOrganisation.deleteMany({
          where: { id: invitation.id },
        })
      }
      journal.info(
        {
          evenement: 'invitation-retiree',
          organisationId: invitation.organisationId,
          entiere: !demeure,
          par: ctx.personne!.id,
        },
        'Une invitation en attente a été retirée.'
      )
      for (const lot of lisibles) {
        publierPourActivite(
          'EQUIPE',
          invitation.organisationId,
          lot.activiteId,
          { editionId: lot.editionId }
        )
      }
      return true
    },
  }),
}))
