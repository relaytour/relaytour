import { prisma, type Edition, type Perimetre } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { exigerMembre } from '../lib/appartenances.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
import {
  exigerEditionOuverte,
  perimetresSouhaitesValides,
  SOUHAITS_MAX,
} from '../lib/souhaits.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'

// Souhaits des personnes pour les périmètres d'une édition (règle dans lib/souhaits.ts).
// Les admins voient et gèrent tous les souhaits de leurs activités. Une personne ne
// voit et ne gère que les siens, dans « Tous les périmètres » (ADR 0012). Les souhaits ne
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
  // Les souhaits d'une personne, dans les activités que la personne qui lit
  // administre (ADR 0010).
  souhaits: t.prismaField({
    type: [SouhaitRef],
    authScopes: { gestion: true },
    args: { editionId: t.arg.id() },
    resolve: async (query, personne, args, ctx) =>
      prisma.souhait.findMany({
        ...query,
        where: {
          userId: personne.id,
          perimetre: {
            organisationId: ctx.organisation?.id ?? '',
            activiteId: { in: [...(await ctx.activitesAdministrees())] },
          },
          ...(args.editionId ? { editionId: String(args.editionId) } : {}),
        },
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
    authScopes: { gestion: true },
    args: {
      personneId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
      perimetreIds: t.arg.idList({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const userId = String(args.personneId)
      await exigerMembre(ctx, userId)
      const personne = await prisma.user.findUnique({
        where: { id: userId },
        select: { archivedAt: true },
      })
      if (personne === null || personne.archivedAt !== null) {
        throw erreurSaisie('Ce compte est introuvable ou archivé.')
      }
      const edition = await exigerEditionOuverte(ctx, args.editionId)
      await ctx.exigerAdminDe(edition.activiteId)
      const editionId = edition.id
      const perimetreIds = await perimetresSouhaitesValides(
        args.perimetreIds,
        edition.activiteId
      )

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
    authScopes: { gestion: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const souhait = await prisma.souhait.findFirst({
        where: {
          id: String(id),
          perimetre: { organisationId: ctx.organisation!.id },
        },
        select: {
          id: true,
          userId: true,
          editionId: true,
          perimetre: { select: { activiteId: true } },
        },
      })
      if (
        souhait === null ||
        !(await ctx.estAdminDe(souhait.perimetre.activiteId))
      ) {
        return false
      }
      await exigerEditionOuverte(ctx, souhait.editionId)
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

// ── Tous les périmètres (ADR 0012) ────────────────────────────────────────────
//
// Une personne découvre les périmètres d'une activité, voit ses affectations et ses
// souhaits pour la période en cours, et formule ou retire ses propres souhaits. La
// page ne renvoie aucune donnée d'une autre personne. Les champs de périmètre qui
// lisent des tâches, des fiches ou des personnes gardent leurs propres contrôles.

interface PerimetreDecouvert {
  perimetre: Perimetre
  affecte: boolean
  souhaite: boolean
}

interface Decouverte {
  edition: Edition | null
  perimetres: PerimetreDecouvert[]
}

const PerimetreDecouvertRef = builder
  .objectRef<PerimetreDecouvert>('PerimetreDecouvert')
  .implement({
    fields: t => ({
      perimetre: t.field({ type: PerimetreRef, resolve: p => p.perimetre }),
      affecte: t.exposeBoolean('affecte', {
        description:
          'Vrai si la personne est affectée à ce périmètre pour la période.',
      }),
      souhaite: t.exposeBoolean('souhaite', {
        description:
          'Vrai si la personne a un souhait pour ce périmètre et la période.',
      }),
    }),
  })

const DecouverteRef = builder
  .objectRef<Decouverte>('TousLesPerimetres')
  .implement({
    fields: t => ({
      edition: t.field({
        type: EditionRef,
        nullable: true,
        description:
          'La période en préparation ou en cours la plus récente. Sans elle, aucun souhait ne se formule.',
        resolve: d => d.edition,
      }),
      perimetres: t.field({
        type: [PerimetreDecouvertRef],
        resolve: d => d.perimetres,
      }),
    }),
  })

builder.queryFields(t => ({
  tousLesPerimetres: t.field({
    type: DecouverteRef,
    authScopes: { connecte: true },
    args: { activiteId: t.arg.id() },
    resolve: async (_root, { activiteId }, ctx) => {
      const id = await ctx.exigerActiviteDecouverte(activiteId)
      const userId = ctx.personne!.id
      const [edition, perimetres] = await Promise.all([
        prisma.edition.findFirst({
          where: { activiteId: id, statut: { not: 'ARCHIVEE' } },
          orderBy: { annee: 'desc' },
        }),
        prisma.perimetre.findMany({
          where: { activiteId: id, archivedAt: null },
          orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
        }),
      ])
      const [affectations, souhaits] =
        edition === null
          ? [[], []]
          : await Promise.all([
              prisma.affectation.findMany({
                where: { userId, editionId: edition.id },
                select: { perimetreId: true },
              }),
              prisma.souhait.findMany({
                where: { userId, editionId: edition.id },
                select: { perimetreId: true },
              }),
            ])
      const affectes = new Set(affectations.map(a => a.perimetreId))
      const souhaites = new Set(souhaits.map(s => s.perimetreId))
      return {
        edition,
        perimetres: perimetres.map(perimetre => ({
          perimetre,
          affecte: affectes.has(perimetre.id),
          souhaite: souhaites.has(perimetre.id),
        })),
      }
    },
  }),
}))

/**
 * Le périmètre et la période d'un souhait formulé par la personne elle-même : un
 * périmètre non archivé d'une activité qu'elle découvre, et une période de la même
 * activité. Un identifiant d'ailleurs donne le même refus qu'un identifiant inconnu.
 */
async function cibleDuSouhait(
  ctx: AppContext,
  perimetreId: string,
  editionId: string
) {
  const organisationId = ctx.organisation!.id
  const perimetre = await prisma.perimetre.findFirst({
    where: { id: perimetreId, organisationId, archivedAt: null },
    select: { id: true, activiteId: true },
  })
  if (
    perimetre === null ||
    !(await ctx.activitesDecouvertes()).has(perimetre.activiteId)
  ) {
    throw accesRefuse()
  }
  const edition = await prisma.edition.findFirst({
    where: { id: editionId, organisationId, activiteId: perimetre.activiteId },
    select: { id: true, statut: true },
  })
  if (edition === null) throw accesRefuse()
  if (edition.statut === 'ARCHIVEE') {
    throw erreurSaisie('Cette période est archivée : ses souhaits sont figés.')
  }
  return { perimetreId: perimetre.id, editionId: edition.id }
}

builder.mutationFields(t => ({
  formulerSouhait: t.boolean({
    description:
      'La personne connectée note son intérêt pour un périmètre (ADR 0012). Aucun mail ne part.',
    authScopes: { connecte: true },
    args: {
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = ctx.personne!.id
      const cible = await cibleDuSouhait(
        ctx,
        String(args.perimetreId),
        String(args.editionId)
      )
      // Un souhait déjà présent répond oui, même à la limite : l'opération se
      // rejoue sans erreur.
      const present = await prisma.souhait.findUnique({
        where: { userId_perimetreId_editionId: { userId, ...cible } },
        select: { id: true },
      })
      if (present !== null) return true
      // Le verrou sur la ligne de la personne sérialise ses souhaits : deux requêtes
      // simultanées ne dépassent pas la limite.
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`
        const deja = await tx.souhait.count({
          where: { userId, editionId: cible.editionId },
        })
        if (deja >= SOUHAITS_MAX) {
          throw erreurSaisie(
            `Vous avez déjà ${SOUHAITS_MAX} souhaits pour cette période.`
          )
        }
        await tx.souhait.createMany({
          data: [{ userId, ...cible }],
          skipDuplicates: true,
        })
      })
      journal.info(
        { evenement: 'souhait-formule', userId, ...cible },
        'Une personne a formulé un souhait.'
      )
      return true
    },
  }),

  retirerMonSouhait: t.boolean({
    description:
      'La personne connectée retire son propre souhait. Hors de ses activités, rien ne change.',
    authScopes: { connecte: true },
    args: {
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = ctx.personne!.id
      const souhait = await prisma.souhait.findFirst({
        where: {
          userId,
          perimetreId: String(args.perimetreId),
          editionId: String(args.editionId),
          perimetre: { organisationId: ctx.organisation!.id },
        },
        select: { id: true, edition: { select: { statut: true } } },
      })
      if (souhait === null) return false
      if (souhait.edition.statut === 'ARCHIVEE') {
        throw erreurSaisie(
          'Cette période est archivée : ses souhaits sont figés.'
        )
      }
      const { count } = await prisma.souhait.deleteMany({
        where: { id: souhait.id },
      })
      journal.info(
        {
          evenement: 'souhait-retire',
          souhaitId: souhait.id,
          userId,
          par: userId,
        },
        'Un souhait a été retiré.'
      )
      return count === 1
    },
  }),
}))
