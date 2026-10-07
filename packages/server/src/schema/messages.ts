import { ChampDestinataires, prisma, StatutMessage } from '@relaytour/database'

import { dansLEquipe } from '../lib/appartenances.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierMessage } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'
import {
  CORPS_MAX,
  destinatairesValides,
  MESSAGES_LUS_MAX,
  modeleValide,
  OBJET_MAX,
} from '../lib/messages.ts'
import { texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { PersonneRef } from './personnes.ts'

// Messages (ADR 0020). Un admin prépare un message dans l'application, puis l'envoie
// depuis sa propre messagerie : le serveur n'envoie rien. Il garde le texte préparé,
// les destinataires et l'état que l'auteur déclare. Un message d'une activité se lit
// par ses admins ; un message écrit depuis l'annuaire, sans activité, par les admins
// de l'organisation.

const StatutMessageEnum = builder.enumType(StatutMessage, {
  name: 'StatutMessage',
})
const ChampDestinatairesEnum = builder.enumType(ChampDestinataires, {
  name: 'ChampDestinataires',
  description:
    'Le champ de la messagerie qui reçoit les destinataires : « À » pour une seule personne, « Cc » (adresses visibles) ou « Cci » (adresses cachées).',
})

// ── Types ────────────────────────────────────────────────────────────────────

const MessageDestinataireRef = builder.prismaObject('MessageDestinataire', {
  fields: t => ({
    id: t.exposeID('id'),
    personne: t.relation('user', { type: PersonneRef }),
    enCopie: t.exposeBoolean('enCopie', {
      description:
        'Vrai quand la personne figure en copie visible d’un message en copie cachée.',
    }),
  }),
})

// Ce type n'est rendu que par les opérations réservées aux admins.
const MessageRef = builder.prismaObject('Message', {
  fields: t => ({
    id: t.exposeID('id'),
    modele: t.exposeString('modele', {
      description: 'Clé du modèle de départ, connue de l’espace organisateur.',
    }),
    objet: t.exposeString('objet'),
    corps: t.exposeString('corps'),
    champ: t.expose('champ', { type: ChampDestinatairesEnum }),
    statut: t.expose('statut', { type: StatutMessageEnum }),
    statutLe: t.expose('statutLe', {
      type: 'DateTime',
      nullable: true,
      description: 'Moment où l’auteur a déclaré le message envoyé ou annulé.',
    }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    activiteId: t.exposeID('activiteId', {
      nullable: true,
      description: 'Null pour un message écrit depuis l’annuaire.',
    }),
    editionId: t.exposeID('editionId', { nullable: true }),
    perimetreId: t.exposeID('perimetreId', { nullable: true }),
    auteur: t.relation('auteur', { type: PersonneRef, nullable: true }),
    estLeMien: t.boolean({
      description:
        'Vrai pour l’auteur du message, qui seul en change le statut.',
      resolve: (message, _args, ctx) => message.auteurId === ctx.personne?.id,
    }),
    destinataires: t.relation('destinataires', {
      type: MessageDestinataireRef,
      query: { orderBy: { user: { name: 'asc' } } },
    }),
  }),
})

const MessageInput = builder.inputType('MessageInput', {
  fields: t => ({
    activiteId: t.id({
      description:
        'L’activité du message. Sans elle, le message vient de l’annuaire : seul un admin de l’organisation l’écrit.',
    }),
    editionId: t.id(),
    perimetreId: t.id(),
    modele: t.string({ required: true }),
    objet: t.string({ required: true }),
    corps: t.string({ required: true }),
    champ: t.field({ type: ChampDestinatairesEnum, required: true }),
    destinataireIds: t.idList({ required: true }),
    enCopieIds: t.idList({
      description:
        'Parmi les destinataires d’un message en copie cachée, les personnes placées en copie visible.',
    }),
  }),
})

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  // L'historique des messages, les plus récents d'abord.
  messages: t.prismaField({
    type: [MessageRef],
    authScopes: { gestion: true },
    description:
      'Les messages d’une activité, lus par ses admins. Sans activité : tous les messages de l’organisation, lus par ses admins seulement.',
    args: { activiteId: t.arg.id() },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      let activiteId: string | undefined
      if (args.activiteId === null || args.activiteId === undefined) {
        if (ctx.personne?.estAdmin !== true) throw accesRefuse()
      } else {
        activiteId = await ctx.exigerActivite(args.activiteId)
        await ctx.exigerAdminDe(activiteId)
      }
      return prisma.message.findMany({
        ...query,
        where: { organisationId, ...(activiteId ? { activiteId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: MESSAGES_LUS_MAX,
      })
    },
  }),
}))

// ── Écriture ─────────────────────────────────────────────────────────────────

builder.mutationFields(t => ({
  // L'admin garde le message qu'il vient de préparer, au moment où il ouvre sa
  // messagerie. Chaque destinataire est une personne qu'il peut lire : un membre de
  // l'organisation pour un message de l'annuaire, une personne de l'équipe pour un
  // message d'une activité. Un compte inconnu, archivé, d'une autre organisation ou
  // hors de l'équipe donne le même refus.
  creerMessage: t.prismaField({
    type: MessageRef,
    authScopes: { gestion: true },
    args: { message: t.arg({ type: MessageInput, required: true }) },
    resolve: async (query, _root, { message: saisie }, ctx) => {
      const organisationId = ctx.organisation!.id
      const modele = modeleValide(saisie.modele)
      const objet = texteRequis(saisie.objet, 'L’objet', OBJET_MAX)
      const corps = texteRequis(saisie.corps, 'Le texte', CORPS_MAX)
      const ids = destinatairesValides(saisie.destinataireIds)

      let activiteId: string | null = null
      if (saisie.activiteId !== null && saisie.activiteId !== undefined) {
        activiteId = await ctx.exigerActivite(saisie.activiteId)
        await ctx.exigerAdminDe(activiteId)
      } else if (ctx.personne?.estAdmin !== true) {
        throw accesRefuse()
      }

      // La période et le périmètre situent le message dans son activité.
      let editionId: string | null = null
      if (saisie.editionId !== null && saisie.editionId !== undefined) {
        const edition = await ctx.exigerEdition(saisie.editionId)
        if (edition.activiteId !== activiteId) throw accesRefuse()
        editionId = edition.id
      }
      let perimetreId: string | null = null
      if (saisie.perimetreId !== null && saisie.perimetreId !== undefined) {
        const perimetre =
          activiteId === null
            ? null
            : await prisma.perimetre.findFirst({
                where: {
                  id: String(saisie.perimetreId),
                  organisationId,
                  activiteId,
                },
                select: { id: true },
              })
        if (perimetre === null) throw accesRefuse()
        perimetreId = perimetre.id
      }

      const lisibles = await prisma.user.count({
        where: {
          id: { in: ids },
          archivedAt: null,
          appartenances: { some: { organisationId } },
          ...(activiteId === null ? {} : dansLEquipe([activiteId])),
        },
      })
      if (lisibles !== ids.length) throw accesRefuse()

      // L'auteur reçoit déjà son message : il ne figure pas parmi ses destinataires.
      if (ids.includes(ctx.personne!.id)) {
        throw erreurSaisie(
          'Vous ne pouvez pas figurer parmi les destinataires de votre message.'
        )
      }
      // Le champ « À » va avec une seule personne, et avec elle seulement.
      if ((saisie.champ === 'A') !== (ids.length === 1)) {
        throw erreurSaisie(
          ids.length === 1
            ? 'Un message à une seule personne utilise le champ « À ».'
            : 'Le champ « À » convient à un seul destinataire.'
        )
      }
      const enCopie = new Set((saisie.enCopieIds ?? []).map(String))
      if (enCopie.size > 0 && saisie.champ !== 'CCI') {
        throw erreurSaisie(
          'Une copie visible accompagne seulement un message en copie cachée.'
        )
      }
      if ([...enCopie].some(id => !ids.includes(id))) {
        throw erreurSaisie(
          'Une personne en copie visible fait partie des destinataires.'
        )
      }

      const message = await prisma.message.create({
        ...query,
        data: {
          organisationId,
          activiteId,
          editionId,
          perimetreId,
          auteurId: ctx.personne!.id,
          modele,
          objet,
          corps,
          champ: saisie.champ,
          destinataires: {
            createMany: {
              data: ids.map(userId => ({
                userId,
                enCopie: enCopie.has(userId),
              })),
            },
          },
        },
      })
      journal.info(
        {
          evenement: 'message-prepare',
          messageId: message.id,
          destinataires: ids.length,
          par: ctx.personne?.id,
        },
        'Un message a été préparé.'
      )
      publierMessage(organisationId, activiteId, message.id)
      return message
    },
  }),

  // L'auteur déclare ce qu'il a fait du message dans sa messagerie. Lui seul le
  // sait : un message inconnu, d'une autre organisation ou d'une autre personne
  // donne le même refus.
  definirStatutMessage: t.prismaField({
    type: MessageRef,
    authScopes: { gestion: true },
    args: {
      id: t.arg.id({ required: true }),
      statut: t.arg({ type: StatutMessageEnum, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const message = await prisma.message.findFirst({
        where: { id: String(args.id), organisationId },
        select: { id: true, auteurId: true, activiteId: true },
      })
      if (message === null || message.auteurId !== ctx.personne!.id) {
        throw accesRefuse()
      }
      const suivant = await prisma.message.update({
        ...query,
        where: { id: message.id },
        data: {
          statut: args.statut,
          statutLe: args.statut === 'EN_COURS' ? null : new Date(),
        },
      })
      publierMessage(organisationId, message.activiteId, message.id)
      return suivant
    },
  }),
}))
