import { prisma, StatutTache, type Prisma } from '@relaytour/database'
import { GraphQLError } from 'graphql'

import type { AppContext } from '../context.ts'
import {
  aujourdhuiParis,
  estEnRetard,
  exigerEcriture,
  exigerLecture,
  perimetresLisibles,
  peutModifierPerimetre,
} from '../lib/droits.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { notifier, referentsSauf } from '../lib/notifications.ts'
import { texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'

export const StatutTacheEnum = builder.enumType(StatutTache, {
  name: 'StatutTache',
})

// ── Types ────────────────────────────────────────────────────────────────────

export const TacheRef = builder.prismaObject('Tache', {
  fields: t => ({
    id: t.exposeID('id'),
    titre: t.exposeString('titre'),
    description: t.exposeString('description', { nullable: true }),
    echeance: t.expose('echeance', { type: 'Date', nullable: true }),
    statut: t.expose('statut', { type: StatutTacheEnum }),
    enRetard: t.boolean({ resolve: tache => estEnRetard(tache) }),
    termineeLe: t.expose('termineeLe', { type: 'DateTime', nullable: true }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    modifieeLe: t.expose('updatedAt', { type: 'DateTime' }),
    perimetre: t.relation('perimetre', { type: PerimetreRef }),
    edition: t.relation('edition', { type: EditionRef }),
    // Les personnes assignées sont chargées avec la tâche, sans requête par tâche.
    assignes: t.field({
      type: [PersonneRef],
      select: (_args, _ctx, selection) => ({
        assignations: {
          select: { user: selection(true) },
          orderBy: { user: { name: 'asc' } },
        },
      }),
      resolve: tache => tache.assignations.map(a => a.user),
    }),
    // Qui a coché la tâche et qui l'a réalisée : ces informations ne sont lisibles que
    // par la personne qui a coché et par les admins. Les autres lisent null.
    clotureePar: t.field({
      type: PersonneRef,
      nullable: true,
      resolve: (tache, _args, ctx) =>
        tache.clotureeParId !== null && voitLaCloture(ctx, tache)
          ? prisma.user.findUnique({ where: { id: tache.clotureeParId } })
          : null,
    }),
    realiseePar: t.field({
      type: PersonneRef,
      nullable: true,
      resolve: (tache, _args, ctx) =>
        tache.realiseeParId !== null && voitLaCloture(ctx, tache)
          ? prisma.user.findUnique({ where: { id: tache.realiseeParId } })
          : null,
    }),
  }),
})

function voitLaCloture(
  ctx: AppContext,
  tache: { clotureeParId: string | null }
) {
  return (
    ctx.personne?.estAdmin === true || ctx.personne?.id === tache.clotureeParId
  )
}

const AvancementRef = builder
  .objectRef<{
    total: number
    aFaire: number
    enCours: number
    faites: number
    abandonnees: number
    enRetard: number
    sansPersonne: number
  }>('Avancement')
  .implement({
    fields: t => ({
      total: t.exposeInt('total'),
      aFaire: t.exposeInt('aFaire'),
      enCours: t.exposeInt('enCours'),
      faites: t.exposeInt('faites'),
      abandonnees: t.exposeInt('abandonnees'),
      enRetard: t.exposeInt('enRetard'),
      sansPersonne: t.exposeInt('sansPersonne'),
    }),
  })

async function calculerAvancement(where: Prisma.TacheWhereInput) {
  const taches = await prisma.tache.findMany({
    where,
    select: {
      statut: true,
      echeance: true,
      perimetreId: true,
      _count: { select: { assignations: true } },
    },
  })
  const aujourdhui = aujourdhuiParis()
  const parPerimetre = new Map<string, ReturnType<typeof avancementVide>>()
  for (const tache of taches) {
    const a = parPerimetre.get(tache.perimetreId) ?? avancementVide()
    a.total += 1
    if (tache.statut === 'A_FAIRE') a.aFaire += 1
    if (tache.statut === 'EN_COURS') a.enCours += 1
    if (tache.statut === 'FAITE') a.faites += 1
    if (tache.statut === 'ABANDONNEE') a.abandonnees += 1
    if (estEnRetard(tache, aujourdhui)) a.enRetard += 1
    const ouverte = tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS'
    if (ouverte && tache._count.assignations === 0) a.sansPersonne += 1
    parPerimetre.set(tache.perimetreId, a)
  }
  return parPerimetre
}

function avancementVide() {
  return {
    total: 0,
    aFaire: 0,
    enCours: 0,
    faites: 0,
    abandonnees: 0,
    enRetard: 0,
    sansPersonne: 0,
  }
}

const AvancementPerimetreRef = builder
  .objectRef<{
    perimetreId: string
    avancement: ReturnType<typeof avancementVide>
  }>('AvancementPerimetre')
  .implement({
    fields: t => ({
      perimetre: t.prismaField({
        type: PerimetreRef,
        resolve: (query, parent) =>
          prisma.perimetre.findUniqueOrThrow({
            ...query,
            where: { id: parent.perimetreId },
          }),
      }),
      avancement: t.field({
        type: AvancementRef,
        resolve: parent => parent.avancement,
      }),
    }),
  })

const ORDRE_TACHES: Prisma.TacheOrderByWithRelationInput[] = [
  { echeance: { sort: 'asc', nulls: 'last' } },
  { createdAt: 'asc' },
]

// ── Champs ajoutés au périmètre ──────────────────────────────────────────────

builder.prismaObjectFields(PerimetreRef, t => ({
  taches: t.prismaField({
    type: [TacheRef],
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, perimetre, { editionId }, ctx) => {
      await exigerLecture(ctx, perimetre.id)
      return prisma.tache.findMany({
        ...query,
        where: { perimetreId: perimetre.id, editionId: String(editionId) },
        orderBy: ORDRE_TACHES,
      })
    },
  }),

  // Les personnes affectées au périmètre pour l'édition : les co-référent·es.
  referents: t.prismaField({
    type: [PersonneRef],
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, perimetre, { editionId }, ctx) => {
      await exigerLecture(ctx, perimetre.id)
      return prisma.user.findMany({
        ...query,
        where: {
          affectations: {
            some: { perimetreId: perimetre.id, editionId: String(editionId) },
          },
        },
        orderBy: { name: 'asc' },
      })
    },
  }),

  avancement: t.field({
    type: AvancementRef,
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (perimetre, { editionId }, ctx) => {
      await exigerLecture(ctx, perimetre.id)
      const resultat = await calculerAvancement({
        perimetreId: perimetre.id,
        editionId: String(editionId),
      })
      return resultat.get(perimetre.id) ?? avancementVide()
    },
  }),

  peutModifier: t.boolean({
    args: { editionId: t.arg.id({ required: true }) },
    resolve: (perimetre, { editionId }, ctx) =>
      peutModifierPerimetre(ctx, perimetre.id, String(editionId)),
  }),
}))

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  perimetre: t.prismaField({
    type: PerimetreRef,
    nullable: true,
    authScopes: { connecte: true },
    args: { slug: t.arg.string({ required: true }) },
    resolve: async (query, _root, { slug }, ctx) => {
      const perimetre = await prisma.perimetre.findUnique({
        ...query,
        where: { slug },
      })
      // Un périmètre inconnu et un périmètre interdit donnent la même réponse.
      if (perimetre === null) {
        if (ctx.personne?.estAdmin) return null
        throw accesRefuse()
      }
      await exigerLecture(ctx, perimetre.id)
      return perimetre
    },
  }),

  // Les périmètres accessibles en lecture : tous pour un admin, sinon ceux où la
  // personne a été affectée au moins une fois.
  mesPerimetres: t.prismaField({
    type: [PerimetreRef],
    authScopes: { connecte: true },
    resolve: async (query, _root, _args, ctx) => {
      const lisibles = await perimetresLisibles(ctx)
      return prisma.perimetre.findMany({
        ...query,
        where:
          lisibles === null ? { archivedAt: null } : { id: { in: lisibles } },
        orderBy: [{ type: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
      })
    },
  }),

  mesTaches: t.prismaField({
    type: [TacheRef],
    authScopes: { connecte: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: (query, _root, { editionId }, ctx) =>
      prisma.tache.findMany({
        ...query,
        where: {
          editionId: String(editionId),
          statut: { in: ['A_FAIRE', 'EN_COURS'] },
          assignations: { some: { userId: ctx.personne!.id } },
        },
        orderBy: ORDRE_TACHES,
      }),
  }),

  // Toutes les tâches d'une édition dans les périmètres que la personne peut lire,
  // triées par échéance. Seule la règle de lecture compte : une assignation dans un
  // autre périmètre n'ajoute aucune tâche.
  retroplanning: t.prismaField({
    type: [TacheRef],
    authScopes: { connecte: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, _root, { editionId }, ctx) => {
      const lisibles = await perimetresLisibles(ctx)
      return prisma.tache.findMany({
        ...query,
        where: {
          editionId: String(editionId),
          perimetre: { archivedAt: null },
          ...(lisibles === null ? {} : { perimetreId: { in: lisibles } }),
        },
        orderBy: ORDRE_TACHES,
      })
    },
  }),

  // Les tâches ouvertes sans personne dans les périmètres de la personne.
  tachesAPrendre: t.prismaField({
    type: [TacheRef],
    authScopes: { connecte: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, _root, { editionId }, ctx) => {
      const perimetres = [...(await ctx.perimetresAffectes(String(editionId)))]
      return prisma.tache.findMany({
        ...query,
        where: {
          editionId: String(editionId),
          perimetreId: { in: perimetres },
          statut: { in: ['A_FAIRE', 'EN_COURS'] },
          assignations: { none: {} },
        },
        orderBy: ORDRE_TACHES,
      })
    },
  }),

  avancementGlobal: t.field({
    type: [AvancementPerimetreRef],
    authScopes: { admin: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }) => {
      const [perimetres, parPerimetre] = await Promise.all([
        prisma.perimetre.findMany({
          where: { archivedAt: null },
          select: { id: true },
          orderBy: [{ type: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
        }),
        calculerAvancement({ editionId: String(editionId) }),
      ])
      return perimetres.map(p => ({
        perimetreId: p.id,
        avancement: parPerimetre.get(p.id) ?? avancementVide(),
      }))
    },
  }),
}))

// ── Écriture ─────────────────────────────────────────────────────────────────

type TacheChargee = Prisma.TacheGetPayload<{
  include: {
    assignations: { select: { userId: true } }
    perimetre: { select: { nom: true } }
  }
}>

async function chargerTache(id: string): Promise<TacheChargee> {
  const tache = await prisma.tache.findUnique({
    where: { id },
    include: {
      assignations: { select: { userId: true } },
      perimetre: { select: { nom: true } },
    },
  })
  if (tache === null) throw accesRefuse()
  return tache
}

/**
 * Règle de collaboration n° 2 : modifier une tâche assignée à d'autres personnes
 * demande une confirmation explicite. Sans elle, l'API refuse et renvoie les noms
 * des personnes concernées.
 */
async function exigerConfirmation(
  tache: TacheChargee,
  acteurId: string,
  confirmer: boolean
): Promise<string[]> {
  const autres = tache.assignations
    .map(a => a.userId)
    .filter(id => id !== acteurId)
  if (autres.length > 0 && !confirmer) {
    const personnes = await prisma.user.findMany({
      where: { id: { in: autres } },
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    throw new GraphQLError('Cette tâche est assignée à d’autres personnes.', {
      extensions: {
        code: 'CONFIRMATION_REQUISE',
        personnes: personnes.map(p => p.name),
      },
    })
  }
  return autres
}

function echeanceValide(echeance: Date | null | undefined): Date | null {
  return echeance ?? null
}

async function exigerAffectee(
  personneId: string,
  tache: { perimetreId: string; editionId: string }
) {
  const affectation = await prisma.affectation.findFirst({
    where: {
      userId: personneId,
      perimetreId: tache.perimetreId,
      editionId: tache.editionId,
    },
    select: { id: true },
  })
  if (affectation === null) {
    throw erreurSaisie(
      'Cette personne n’est pas affectée à ce périmètre pour cette édition.'
    )
  }
}

/** Une tâche se lie à une fiche commune ou à une fiche de son propre périmètre. */
async function ficheValide(
  ficheId: string | number | null | undefined,
  perimetreId: string
): Promise<string | null> {
  if (ficheId === null || ficheId === undefined || ficheId === '') return null
  const fiche = await prisma.fiche.findUnique({
    where: { id: String(ficheId) },
    select: { id: true, perimetreId: true },
  })
  if (
    fiche === null ||
    (fiche.perimetreId !== null && fiche.perimetreId !== perimetreId)
  ) {
    throw erreurSaisie('Cette fiche ne peut pas être liée à cette tâche.')
  }
  return fiche.id
}

builder.mutationFields(t => ({
  creerTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    args: {
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
      titre: t.arg.string({ required: true }),
      description: t.arg.string(),
      echeance: t.arg({ type: 'Date' }),
      ficheId: t.arg.id(),
      mAssigner: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      const perimetreId = String(args.perimetreId)
      const editionId = String(args.editionId)
      const acteur = await exigerEcriture(ctx, perimetreId, editionId)
      const ficheId = await ficheValide(args.ficheId, perimetreId)
      const creee = await prisma.$transaction(async tx => {
        const tache = await tx.tache.create({
          data: {
            perimetreId,
            editionId,
            titre: texteRequis(args.titre, 'Le titre', 200),
            description: args.description?.trim() || null,
            echeance: echeanceValide(args.echeance),
            ficheId,
            creeParId: acteur.id,
            ...(args.mAssigner
              ? { assignations: { create: { userId: acteur.id } } }
              : {}),
          },
        })
        await tx.activite.create({
          data: {
            type: 'TACHE_CREEE',
            acteurId: acteur.id,
            editionId,
            perimetreId,
            tacheId: tache.id,
          },
        })
        return tx.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      })
      // Règle n° 3 : les autres référent·es du périmètre le voient dans leur résumé.
      await notifier(prisma, {
        type: 'TACHE_CREEE',
        destinataires: await referentsSauf(
          prisma,
          perimetreId,
          editionId,
          acteur.id
        ),
        acteurId: acteur.id,
        tacheId: creee.id,
        perimetreId,
      })
      return creee
    },
  }),

  modifierTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    args: {
      id: t.arg.id({ required: true }),
      titre: t.arg.string({ required: true }),
      description: t.arg.string(),
      echeance: t.arg({ type: 'Date' }),
      ficheId: t.arg.id(),
      confirmer: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      const ficheId = await ficheValide(args.ficheId, tache.perimetreId)
      const autres = await exigerConfirmation(
        tache,
        acteur.id,
        args.confirmer ?? false
      )
      const resultat = await prisma.$transaction(async tx => {
        await tx.tache.update({
          where: { id: tache.id },
          data: {
            titre: texteRequis(args.titre, 'Le titre', 200),
            description: args.description?.trim() || null,
            echeance: echeanceValide(args.echeance),
            ficheId,
          },
        })
        await tx.activite.create({
          data: {
            type: 'TACHE_MODIFIEE',
            acteurId: acteur.id,
            editionId: tache.editionId,
            perimetreId: tache.perimetreId,
            tacheId: tache.id,
          },
        })
        return tx.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      })
      // Règle n° 2 : les personnes assignées sont prévenues tout de suite, par mail.
      await notifier(
        prisma,
        {
          type: 'TACHE_MODIFIEE',
          destinataires: autres,
          acteurId: acteur.id,
          tacheId: tache.id,
          perimetreId: tache.perimetreId,
          changement: 'contenu',
        },
        { mailImmediat: true }
      )
      return resultat
    },
  }),

  changerStatutTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    args: {
      id: t.arg.id({ required: true }),
      statut: t.arg({ type: StatutTacheEnum, required: true }),
      realiseeParId: t.arg.id(),
      confirmer: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      const autres = await exigerConfirmation(
        tache,
        acteur.id,
        args.confirmer ?? false
      )
      const faite = args.statut === 'FAITE'
      const realiseeParId =
        faite && args.realiseeParId ? String(args.realiseeParId) : null
      if (realiseeParId !== null) await exigerAffectee(realiseeParId, tache)

      const resultat = await prisma.$transaction(async tx => {
        await tx.tache.update({
          where: { id: tache.id },
          data: {
            statut: args.statut,
            // Rouvrir une tâche efface qui l'avait cochée et réalisée.
            termineeLe: faite ? new Date() : null,
            clotureeParId: faite ? acteur.id : null,
            realiseeParId,
          },
        })
        await tx.activite.create({
          data: {
            type: 'TACHE_STATUT',
            acteurId: acteur.id,
            editionId: tache.editionId,
            perimetreId: tache.perimetreId,
            tacheId: tache.id,
            statut: args.statut,
            realiseeParId,
          },
        })
        return tx.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      })
      await notifier(
        prisma,
        {
          type: 'TACHE_MODIFIEE',
          destinataires: autres,
          acteurId: acteur.id,
          tacheId: tache.id,
          perimetreId: tache.perimetreId,
          changement: 'statut',
        },
        { mailImmediat: true }
      )
      return resultat
    },
  }),

  // Une personne s'assigne ou se retire elle-même. Les admins peuvent assigner une
  // autre personne affectée au périmètre.
  assignerTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    args: {
      id: t.arg.id({ required: true }),
      assigne: t.arg.boolean({ required: true }),
      personneId: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      const personneId = args.personneId ? String(args.personneId) : acteur.id
      if (personneId !== acteur.id && !acteur.estAdmin) throw accesRefuse()
      if (args.assigne) await exigerAffectee(personneId, tache)

      const dejaAssignee = tache.assignations.some(a => a.userId === personneId)
      if (dejaAssignee !== args.assigne) {
        await prisma.$transaction([
          args.assigne
            ? prisma.tacheAssignation.create({
                data: { tacheId: tache.id, userId: personneId },
              })
            : prisma.tacheAssignation.deleteMany({
                where: { tacheId: tache.id, userId: personneId },
              }),
          prisma.activite.create({
            data: {
              type: args.assigne ? 'TACHE_ASSIGNEE' : 'TACHE_DESASSIGNEE',
              acteurId: acteur.id,
              editionId: tache.editionId,
              perimetreId: tache.perimetreId,
              tacheId: tache.id,
              personneId,
            },
          }),
        ])
        // Règle n° 3 : les autres référent·es voient qui fait quoi dans leur résumé.
        // La personne assignée par un admin l'apprend aussi.
        await notifier(prisma, {
          type: args.assigne ? 'TACHE_ASSIGNEE' : 'TACHE_DESASSIGNEE',
          destinataires: [
            ...(await referentsSauf(
              prisma,
              tache.perimetreId,
              tache.editionId,
              acteur.id
            )),
            personneId,
          ],
          acteurId: acteur.id,
          tacheId: tache.id,
          perimetreId: tache.perimetreId,
          personneId,
        })
      }
      return prisma.tache.findUniqueOrThrow({
        ...query,
        where: { id: tache.id },
      })
    },
  }),
}))
