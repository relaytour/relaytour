import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
import {
  exigerEditionOuverte,
  perimetresSouhaitesValides,
} from '../lib/souhaits.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'

// Souhaits des personnes pour les périmètres d'une édition (règle dans lib/souhaits.ts).
// Tous les champs et toutes les mutations sont réservés aux admins. Les souhaits ne
// créent ni activité ni notification.

/** Clé d'une affectation pour une édition : la personne et le périmètre. */
const cle = (userId: string, perimetreId: string) => `${userId}|${perimetreId}`

// Affectations de chaque édition, lues une fois par requête GraphQL : une liste de
// souhaits ne déclenche pas une lecture par souhait.
const affectationsParRequete = new WeakMap<
  AppContext,
  Map<string, Promise<Set<string>>>
>()

function affectationsDeLEdition(
  ctx: AppContext,
  editionId: string
): Promise<Set<string>> {
  let parEdition = affectationsParRequete.get(ctx)
  if (parEdition === undefined) {
    parEdition = new Map()
    affectationsParRequete.set(ctx, parEdition)
  }
  let affectations = parEdition.get(editionId)
  if (affectations === undefined) {
    affectations = prisma.affectation
      .findMany({
        where: { editionId },
        select: { userId: true, perimetreId: true },
      })
      .then(lignes => new Set(lignes.map(l => cle(l.userId, l.perimetreId))))
    parEdition.set(editionId, affectations)
  }
  return affectations
}

export const SouhaitRef = builder.prismaObject('Souhait', {
  fields: t => ({
    id: t.exposeID('id'),
    personne: t.relation('user', { type: PersonneRef }),
    perimetre: t.relation('perimetre', { type: PerimetreRef }),
    edition: t.relation('edition', { type: EditionRef }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    satisfait: t.boolean({
      description:
        'Vaut vrai quand la personne est affectée à ce périmètre pour cette édition.',
      resolve: async (souhait, _args, ctx) =>
        (await affectationsDeLEdition(ctx, souhait.editionId)).has(
          cle(souhait.userId, souhait.perimetreId)
        ),
    }),
  }),
})

builder.prismaObjectFields(PersonneRef, t => ({
  souhaits: t.relation('souhaits', {
    authScopes: { admin: true },
    args: { editionId: t.arg.id() },
    query: args => ({
      where: args.editionId ? { editionId: String(args.editionId) } : {},
      orderBy: [
        { perimetre: { type: 'asc' } },
        { perimetre: { ordre: 'asc' } },
        { perimetre: { nom: 'asc' } },
      ],
    }),
  }),
}))

builder.mutationFields(t => ({
  definirSouhaits: t.prismaField({
    type: [SouhaitRef],
    description:
      'Remplace l’ensemble des souhaits d’une personne pour une édition.',
    authScopes: { admin: true },
    args: {
      personneId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
      perimetreIds: t.arg.idList({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const userId = String(args.personneId)
      const editionId = String(args.editionId)
      const personne = await prisma.user.findUnique({
        where: { id: userId },
        select: { archivedAt: true },
      })
      if (personne === null || personne.archivedAt !== null) {
        throw erreurSaisie('Ce compte est introuvable ou archivé.')
      }
      await exigerEditionOuverte(editionId)
      const perimetreIds = await perimetresSouhaitesValides(args.perimetreIds)

      await prisma.$transaction([
        prisma.souhait.deleteMany({
          where: { userId, editionId, perimetreId: { notIn: perimetreIds } },
        }),
        prisma.souhait.createMany({
          data: perimetreIds.map(perimetreId => ({
            userId,
            perimetreId,
            editionId,
          })),
          skipDuplicates: true,
        }),
      ])
      journal.info(
        {
          evenement: 'souhaits-definis',
          userId,
          editionId,
          perimetreIds,
          par: ctx.personne?.id,
        },
        'Les souhaits d’une personne ont été définis.'
      )
      return prisma.souhait.findMany({
        ...query,
        where: { userId, editionId },
        orderBy: [
          { perimetre: { type: 'asc' } },
          { perimetre: { ordre: 'asc' } },
          { perimetre: { nom: 'asc' } },
        ],
      })
    },
  }),

  retirerSouhait: t.boolean({
    authScopes: { admin: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const souhait = await prisma.souhait.findUnique({
        where: { id: String(id) },
        select: { id: true, userId: true, editionId: true },
      })
      if (souhait === null) return false
      await exigerEditionOuverte(souhait.editionId)
      const { count } = await prisma.souhait.deleteMany({
        where: { id: souhait.id },
      })
      journal.info(
        {
          evenement: 'souhait-retire',
          souhaitId: souhait.id,
          userId: souhait.userId,
          editionId: souhait.editionId,
          par: ctx.personne?.id,
        },
        'Un souhait a été retiré.'
      )
      return count === 1
    },
  }),
}))
