import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'
import { exigerMembre } from '../lib/appartenances.ts'
import { exigerEcriture } from '../lib/droits.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
import { adresseValide, sansDoublon, texteRequis } from '../lib/saisie.ts'
import {
  exigerEditionOuverte,
  perimetresSouhaitesValides,
} from '../lib/souhaits.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'

// Les données personnelles d'un compte (adresse, affectations) ne sont lisibles que
// par la personne elle-même et par les admins.
const soiOuAdmin = (
  personne: { id: string },
  _args: unknown,
  ctx: { personne: { id: string } | null }
) => (ctx.personne?.id === personne.id ? true : { admin: true })

export const PersonneRef = builder.prismaObject('User', {
  name: 'Personne',
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('name'),
    email: t.exposeString('email', { authScopes: soiOuAdmin }),
    // Rôle ADMIN dans l'organisation active (ADR 0008), pas un droit global.
    estAdmin: t.boolean({
      select: (_args, ctx) => ({
        appartenances: {
          where: { organisationId: ctx.organisation?.id ?? '' },
          select: { role: true },
        },
      }),
      resolve: u => u.appartenances[0]?.role === 'ADMIN',
    }),
    archive: t.boolean({ resolve: u => u.archivedAt !== null }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    affectations: t.relation('affectations', {
      authScopes: soiOuAdmin,
      args: { editionId: t.arg.id() },
      // Seules les affectations de l'organisation active sont visibles.
      query: (args, ctx) => ({
        where: {
          perimetre: { organisationId: ctx.organisation?.id ?? '' },
          ...(args.editionId ? { editionId: String(args.editionId) } : {}),
        },
        orderBy: { createdAt: 'asc' },
      }),
    }),
  }),
})

export const AffectationRef = builder.prismaObject('Affectation', {
  fields: t => ({
    id: t.exposeID('id'),
    personne: t.relation('user', { type: PersonneRef }),
    perimetre: t.relation('perimetre', { type: PerimetreRef }),
    edition: t.relation('edition', { type: EditionRef }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
  }),
})

builder.queryFields(t => ({
  moi: t.prismaField({
    type: PersonneRef,
    nullable: true,
    resolve: (query, _root, _args, ctx) =>
      ctx.personne === null
        ? null
        : prisma.user.findUnique({ ...query, where: { id: ctx.personne.id } }),
  }),

  personnes: t.prismaField({
    type: [PersonneRef],
    authScopes: { admin: true },
    args: { inclureArchives: t.arg.boolean({ defaultValue: false }) },
    resolve: (query, _root, { inclureArchives }, ctx) =>
      prisma.user.findMany({
        ...query,
        where: {
          appartenances: { some: { organisationId: ctx.organisation!.id } },
          ...(inclureArchives ? {} : { archivedAt: null }),
        },
        orderBy: { name: 'asc' },
      }),
  }),

  affectations: t.prismaField({
    type: [AffectationRef],
    authScopes: { admin: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, _root, { editionId }, ctx) =>
      prisma.affectation.findMany({
        ...query,
        where: { editionId: (await ctx.exigerEdition(editionId)).id },
        orderBy: [{ perimetre: { ordre: 'asc' } }, { createdAt: 'asc' }],
      }),
  }),
}))

builder.mutationFields(t => ({
  inviterPersonne: t.prismaField({
    type: PersonneRef,
    authScopes: { admin: true },
    args: {
      email: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      estAdmin: t.arg.boolean({ defaultValue: false }),
      // Édition et périmètres souhaités. Un souhait ne donne aucun accès.
      editionId: t.arg.id(),
      perimetresSouhaites: t.arg.idList(),
    },
    resolve: async (query, _root, args, ctx) => {
      const email = adresseValide(args.email)
      const name = texteRequis(args.nom, 'Le nom')
      // Les souhaits sont validés avant toute création de compte.
      let souhaits: { perimetreId: string; editionId: string }[] = []
      if ((args.perimetresSouhaites ?? []).length > 0) {
        if (!args.editionId) {
          throw erreurSaisie('Choisissez l’édition des périmètres souhaités.')
        }
        const edition = await exigerEditionOuverte(ctx, args.editionId)
        const perimetreIds = await perimetresSouhaitesValides(
          args.perimetresSouhaites ?? [],
          edition.activiteId
        )
        souhaits = perimetreIds.map(perimetreId => ({
          perimetreId,
          editionId: edition.id,
        }))
      }
      const organisationId = ctx.organisation!.id
      const role = args.estAdmin ? 'ADMIN' : 'MEMBRE'
      // Un compte est global (ADR 0008) : une adresse déjà connue d'une autre
      // organisation reçoit une appartenance à celle-ci, sans nouveau compte.
      const existant = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          archivedAt: true,
          appartenances: { where: { organisationId }, select: { id: true } },
        },
      })
      if (existant !== null && existant.appartenances.length > 0) {
        throw erreurSaisie('Un compte existe déjà pour cette adresse.')
      }
      if (existant !== null && existant.archivedAt !== null) {
        throw erreurSaisie('Cette adresse ne peut pas être invitée.')
      }
      const personne = await sansDoublon(
        existant === null
          ? prisma.user.create({
              ...query,
              data: {
                id: randomUUID(),
                email,
                name,
                appartenances: { create: { organisationId, role } },
                ...(souhaits.length > 0
                  ? { souhaits: { create: souhaits } }
                  : {}),
              },
            })
          : prisma.user.update({
              ...query,
              where: { id: existant.id },
              data: {
                appartenances: { create: { organisationId, role } },
                ...(souhaits.length > 0
                  ? { souhaits: { create: souhaits } }
                  : {}),
              },
            }),
        'Un compte existe déjà pour cette adresse.'
      )
      journal.info(
        {
          evenement: 'personne-invitee',
          userId: personne.id,
          compteExistant: existant !== null,
          souhaits: souhaits.length,
          par: ctx.personne?.id,
        },
        'Une personne a été invitée.'
      )
      await mettreEnFile(
        'invitation',
        { userId: personne.id },
        { organisationId }
      )
      return personne
    },
  }),

  renvoyerInvitation: t.boolean({
    authScopes: { admin: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      await exigerMembre(ctx, String(id))
      const personne = await prisma.user.findUnique({
        where: { id: String(id) },
        select: { id: true, archivedAt: true },
      })
      if (personne === null || personne.archivedAt !== null) {
        throw erreurSaisie('Ce compte est introuvable ou archivé.')
      }
      await mettreEnFile(
        'invitation',
        { userId: personne.id },
        { organisationId: ctx.organisation!.id }
      )
      return true
    },
  }),

  modifierPersonne: t.prismaField({
    type: PersonneRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      estAdmin: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const id = String(args.id)
      // Un admin ne retire pas ses propres droits : il ne pourrait plus les rétablir.
      if (id === ctx.personne?.id && !args.estAdmin) {
        throw erreurSaisie(
          'Vous ne pouvez pas retirer vos propres droits d’admin.'
        )
      }
      const membre = await exigerMembre(ctx, id)
      const nom = texteRequis(args.nom, 'Le nom')
      const actuel = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: { name: true },
      })
      // Le nom appartient au compte, commun à toutes ses organisations.
      if (nom !== actuel.name && membre.autresOrganisations > 0) {
        throw erreurSaisie(
          'Ce compte appartient aussi à une autre organisation : seule la personne peut changer son nom.'
        )
      }
      return prisma.user.update({
        ...query,
        where: { id },
        data: {
          name: nom,
          appartenances: {
            update: {
              where: {
                userId_organisationId: {
                  userId: id,
                  organisationId: ctx.organisation!.id,
                },
              },
              data: { role: args.estAdmin ? 'ADMIN' : 'MEMBRE' },
            },
          },
        },
      })
    },
  }),

  archiverPersonne: t.prismaField({
    type: PersonneRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      archive: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const id = String(args.id)
      if (id === ctx.personne?.id) {
        throw erreurSaisie('Vous ne pouvez pas archiver votre propre compte.')
      }
      // L'archivage porte sur le compte, commun à toutes ses organisations : un admin
      // n'archive pas le compte d'une personne qui appartient aussi à une autre.
      const membre = await exigerMembre(ctx, id)
      if (membre.autresOrganisations > 0) {
        throw erreurSaisie(
          'Ce compte appartient aussi à une autre organisation : il ne peut pas être archivé depuis la vôtre.'
        )
      }
      // L'archivage ferme aussitôt toutes les sessions ouvertes du compte.
      const [personne] = await prisma.$transaction([
        prisma.user.update({
          ...query,
          where: { id },
          data: { archivedAt: args.archive ? new Date() : null },
        }),
        ...(args.archive
          ? [prisma.session.deleteMany({ where: { userId: id } })]
          : []),
      ])
      journal.info(
        {
          evenement: args.archive ? 'personne-archivee' : 'personne-restauree',
          userId: id,
          par: ctx.personne?.id,
        },
        args.archive ? 'Un compte a été archivé.' : 'Un compte a été restauré.'
      )
      return personne
    },
  }),

  affecter: t.prismaField({
    type: AffectationRef,
    authScopes: { admin: true },
    args: {
      personneId: t.arg.id({ required: true }),
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const userId = String(args.personneId)
      const perimetreId = String(args.perimetreId)
      const editionId = String(args.editionId)
      await exigerMembre(ctx, userId)
      // Même contrôle qu'une écriture : périmètre et édition de la même activité de
      // l'organisation, édition non archivée.
      await exigerEcriture(ctx, perimetreId, editionId)
      return sansDoublon(
        prisma.affectation.create({
          ...query,
          data: {
            userId,
            perimetreId,
            editionId,
            creeParId: ctx.personne?.id ?? null,
          },
        }),
        'Cette personne est déjà affectée à ce périmètre pour cette édition.'
      )
    },
  }),

  retirerAffectation: t.boolean({
    authScopes: { admin: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const { count } = await prisma.affectation.deleteMany({
        where: {
          id: String(id),
          perimetre: { organisationId: ctx.organisation!.id },
        },
      })
      return count === 1
    },
  }),
}))
