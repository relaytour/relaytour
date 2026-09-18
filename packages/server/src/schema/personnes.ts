import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'
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
    estAdmin: t.exposeBoolean('isAdmin'),
    archive: t.boolean({ resolve: u => u.archivedAt !== null }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    affectations: t.relation('affectations', {
      authScopes: soiOuAdmin,
      args: { editionId: t.arg.id() },
      query: args => ({
        where: args.editionId ? { editionId: String(args.editionId) } : {},
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
    resolve: (query, _root, { inclureArchives }) =>
      prisma.user.findMany({
        ...query,
        where: inclureArchives ? {} : { archivedAt: null },
        orderBy: { name: 'asc' },
      }),
  }),

  affectations: t.prismaField({
    type: [AffectationRef],
    authScopes: { admin: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: (query, _root, { editionId }) =>
      prisma.affectation.findMany({
        ...query,
        where: { editionId: String(editionId) },
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
        const editionId = String(args.editionId)
        await exigerEditionOuverte(editionId)
        const perimetreIds = await perimetresSouhaitesValides(
          args.perimetresSouhaites ?? []
        )
        souhaits = perimetreIds.map(perimetreId => ({ perimetreId, editionId }))
      }
      const personne = await sansDoublon(
        prisma.user.create({
          ...query,
          data: {
            id: randomUUID(),
            email,
            name,
            isAdmin: args.estAdmin ?? false,
            ...(souhaits.length > 0 ? { souhaits: { create: souhaits } } : {}),
          },
        }),
        'Un compte existe déjà pour cette adresse.'
      )
      journal.info(
        {
          evenement: 'personne-invitee',
          userId: personne.id,
          souhaits: souhaits.length,
          par: ctx.personne?.id,
        },
        'Une personne a été invitée.'
      )
      await mettreEnFile('invitation', { userId: personne.id })
      return personne
    },
  }),

  renvoyerInvitation: t.boolean({
    authScopes: { admin: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      const personne = await prisma.user.findUnique({
        where: { id: String(id) },
        select: { id: true, archivedAt: true },
      })
      if (personne === null || personne.archivedAt !== null) {
        throw erreurSaisie('Ce compte est introuvable ou archivé.')
      }
      await mettreEnFile('invitation', { userId: personne.id })
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
    resolve: (query, _root, args, ctx) => {
      // Un admin ne retire pas ses propres droits : il ne pourrait plus les rétablir.
      if (String(args.id) === ctx.personne?.id && !args.estAdmin) {
        throw erreurSaisie(
          'Vous ne pouvez pas retirer vos propres droits d’admin.'
        )
      }
      return prisma.user.update({
        ...query,
        where: { id: String(args.id) },
        data: { name: texteRequis(args.nom, 'Le nom'), isAdmin: args.estAdmin },
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
    resolve: (query, _root, args, ctx) =>
      sansDoublon(
        prisma.affectation.create({
          ...query,
          data: {
            userId: String(args.personneId),
            perimetreId: String(args.perimetreId),
            editionId: String(args.editionId),
            creeParId: ctx.personne?.id ?? null,
          },
        }),
        'Cette personne est déjà affectée à ce périmètre pour cette édition.'
      ),
  }),

  retirerAffectation: t.boolean({
    authScopes: { admin: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      const { count } = await prisma.affectation.deleteMany({
        where: { id: String(id) },
      })
      return count === 1
    },
  }),
}))
