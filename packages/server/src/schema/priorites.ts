import { AjustementPriorite, prisma } from '@relaytour/database'

import { aujourdhui, exigerEcriture } from '../lib/droits.ts'
import { publierPourPerimetre } from '../lib/flux.ts'
import { heureLocale } from '../lib/heures.ts'
import { moduleActif } from '../lib/modules.ts'
import {
  ajustementLu,
  lirePrioritesDeLaPeriode,
  type AjustementLu,
  type PrioriteLue,
  type PrioritesDuPerimetreLues,
} from '../lib/priorites-periode.ts'
import { filtreProchainPoint } from '../lib/reunions.ts'
import { horizon, type CodeRaison, type Raison } from '../lib/priorites.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'
import { lireReunion, REUNION_CHARGEE, ReunionRef } from './reunions.ts'
import { chargerTache, exigerDeclinaisonAcceptee, TacheRef } from './taches.ts'

// Priorités d'une période (ADR 0059). Toute personne qui voit l'activité lit les
// priorités de tous ses périmètres, comme la consultation (ADR 0014) : `exigerEdition`
// refuse l'édition d'une activité invisible, donc à une personne en découverte. Le
// score est le même pour tout le monde. Ajuster une tâche demande d'écrire dans son
// périmètre.

const AjustementPrioriteEnum = builder.enumType(AjustementPriorite, {
  name: 'AjustementPriorite',
  description:
    'Niveau d’un ajustement des priorités. BASSE : 20 points en moins. HAUTE : 20 points en plus, et la tâche entre dans les priorités. EPINGLEE : la tâche entre dans les priorités et passe en tête de son périmètre.',
})

const CODES_RAISON = [
  'RETARD',
  'RETARD_A_REVOIR',
  'ECHEANCE_PROCHE',
  'AVANT_LE_POINT',
  'REUNION_A_VENIR',
  'DECLINAISONS',
  'ACCORD_ATTENDU',
  'A_PRENDRE',
  'EN_COURS',
  'AJUSTEMENT',
  'JALON',
  'MENE_A_UN_JALON',
] as const satisfies readonly CodeRaison[]

const CodeRaisonEnum = builder.enumType('CodeRaisonPriorite', {
  description:
    'Ce qui donne des points à une tâche. L’espace organisateur traduit chaque code.',
  values: CODES_RAISON,
})

const RaisonRef = builder.objectRef<Raison>('RaisonPriorite').implement({
  fields: t => ({
    code: t.field({ type: CodeRaisonEnum, resolve: r => r.code }),
    points: t.exposeInt('points'),
    jours: t.int({
      nullable: true,
      description:
        'Jours de retard (RETARD, RETARD_A_REVOIR) ou jours avant l’échéance (ECHEANCE_PROCHE).',
      resolve: r => r.jours ?? null,
    }),
    nombre: t.int({
      nullable: true,
      description:
        'Déclinaisons actives (DECLINAISONS) ou tâches liées ouvertes (JALON).',
      resolve: r => r.nombre ?? null,
    }),
    titre: t.string({
      nullable: true,
      description: 'Le titre du jalon le plus proche (MENE_A_UN_JALON).',
      resolve: r => r.titre ?? null,
    }),
    niveau: t.field({
      type: AjustementPrioriteEnum,
      nullable: true,
      resolve: r => r.niveau ?? null,
    }),
  }),
})

const AjustementRef = builder
  .objectRef<AjustementLu>('AjustementTache')
  .implement({
    description: 'L’ajustement en cours d’une tâche dans les priorités.',
    fields: t => ({
      niveau: t.field({ type: AjustementPrioriteEnum, resolve: a => a.niveau }),
      par: t.field({
        type: PersonneRef,
        nullable: true,
        resolve: a =>
          a.parId === null
            ? null
            : prisma.user.findUnique({ where: { id: a.parId } }),
      }),
      le: t.field({ type: 'DateTime', resolve: a => a.le }),
      jusquAu: t.field({
        type: 'Date',
        description: 'Dernier jour où l’ajustement compte.',
        resolve: a => a.jusquAu,
      }),
    }),
  })

builder.prismaObjectFields(TacheRef, t => ({
  ajustement: t.field({
    type: AjustementRef,
    nullable: true,
    description:
      'L’ajustement de la tâche dans les priorités, tant qu’il compte (ADR 0059).',
    resolve: (tache, _args, ctx) =>
      ajustementLu(
        tache,
        aujourdhui(new Date(), ctx.organisation?.fuseauHoraire)
      ),
  }),
}))

const PrioriteRef = builder.objectRef<PrioriteLue>('Priorite').implement({
  fields: t => ({
    tache: t.field({ type: TacheRef, resolve: p => p.tache }),
    score: t.exposeInt('score'),
    // Une tâche cumule rarement plus de huit raisons : l'échéance, le point, la
    // réunion, les déclinaisons, l'accord, les jalons, la prise, le statut et
    // l'ajustement ne se rencontrent presque jamais tous ensemble. Ce nombre
    // estime le coût d'une requête ; aucune raison n'en dépend.
    raisons: t.field({
      type: [RaisonRef],
      complexity: { field: 1, multiplier: 8 },
      resolve: p => p.raisons,
    }),
  }),
})

const PrioritesDuPerimetreRef = builder
  .objectRef<PrioritesDuPerimetreLues>('PrioritesDuPerimetre')
  .implement({
    fields: t => ({
      perimetre: t.field({ type: PerimetreRef, resolve: p => p.perimetre }),
      // Le plafond fixe le nombre de priorités d'un périmètre.
      priorites: t.field({
        type: [PrioriteRef],
        complexity: { field: 1, multiplier: 5 },
        resolve: p => p.priorites,
      }),
      autres: t.exposeInt('autres', {
        description: 'Priorités au-delà du plafond de cinq.',
      }),
      ensuite: t.field({
        type: TacheRef,
        nullable: true,
        description:
          'La prochaine tâche ouverte, quand le périmètre n’a aucune priorité. Ce n’est pas une priorité.',
        resolve: p => p.ensuite,
      }),
    }),
  })

interface PrioritesLues {
  fin: string
  prochainPoint: Awaited<ReturnType<typeof lireReunion>> | null
  perimetres: PrioritesDuPerimetreLues[]
  jalons: Tache[]
}

const PrioritesRef = builder.objectRef<PrioritesLues>('Priorites').implement({
  fields: t => ({
    fin: t.string({
      description:
        'Dernier jour de l’horizon (AAAA-MM-JJ), dans le fuseau de l’organisation.',
      resolve: p => p.fin,
    }),
    prochainPoint: t.field({
      type: ReunionRef,
      nullable: true,
      description:
        'Le prochain point d’équipe : une réunion de l’agenda global marquée comme point d’équipe, non annulée. Null sans point d’équipe prévu ou sans module Agenda.',
      resolve: p => p.prochainPoint,
    }),
    perimetres: t.field({
      type: [PrioritesDuPerimetreRef],
      description:
        'Les périmètres non archivés de l’activité, dans leur ordre.',
      complexity: { field: 1, multiplier: 4 },
      resolve: p => p.perimetres,
    }),
    jalons: t.field({
      type: [TacheRef],
      description:
        'Les jalons ouverts dont l’échéance tombe dans l’horizon, échéance dépassée comprise, tous périmètres confondus, par échéance (ADR 0062).',
      // Un horizon de deux à quatre semaines porte peu de jalons. Ce nombre estime
      // le coût de la requête ; la liste n'est pas tronquée.
      complexity: { field: 1, multiplier: 2 },
      resolve: p => p.jalons,
    }),
  }),
})

builder.queryFields(t => ({
  priorites: t.field({
    type: PrioritesRef,
    authScopes: { connecte: true },
    description:
      'Les priorités d’une période (ADR 0059) : pour chaque périmètre de l’activité, les tâches à traiter avant le prochain point, classées par score.',
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      const lues = await lirePrioritesDeLaPeriode(
        edition,
        ctx.organisation!.fuseauHoraire,
        new Date()
      )
      const point =
        lues.pointId === null
          ? null
          : await prisma.reunion.findUnique({
              where: { id: lues.pointId },
              include: REUNION_CHARGEE,
            })
      return {
        fin: lues.fin,
        prochainPoint: point === null ? null : await lireReunion(ctx, point),
        perimetres: lues.perimetres,
        jalons: lues.jalons,
      }
    },
  }),
}))

builder.mutationFields(t => ({
  ajusterPriorite: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description:
      'Pose ou retire l’ajustement d’une tâche dans les priorités (ADR 0059). Un niveau absent retire l’ajustement. L’ajustement compte jusqu’à la fin de l’horizon du jour. Il ne change pas la version de la tâche.',
    args: {
      id: t.arg.id({ required: true }),
      niveau: t.arg({ type: AjustementPrioriteEnum }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      exigerDeclinaisonAcceptee(tache)
      const niveau = args.niveau ?? null
      const fuseau = ctx.organisation!.fuseauHoraire
      const maintenant = new Date()
      const jour = aujourdhui(maintenant, fuseau)
      let jusquAu: Date | null = null
      if (niveau !== null) {
        const edition = await prisma.edition.findUniqueOrThrow({
          where: { id: tache.editionId },
          select: { activiteId: true },
        })
        const point = (await moduleActif(edition.activiteId, 'AGENDA'))
          ? await prisma.reunion.findFirst({
              where: filtreProchainPoint(tache.editionId, maintenant),
              select: { debut: true },
              orderBy: { debut: 'asc' },
            })
          : null
        const fin = horizon(
          jour,
          point === null ? null : heureLocale(point.debut, fuseau).jour
        ).fin
        jusquAu = new Date(`${fin}T00:00:00.000Z`)
      }
      await prisma.$transaction([
        prisma.tache.update({
          where: { id: tache.id },
          data: {
            ajustementPriorite: niveau,
            ajustementParId: niveau === null ? null : acteur.id,
            ajustementLe: niveau === null ? null : maintenant,
            ajustementJusquAu: jusquAu,
          },
        }),
        prisma.journal.create({
          data: {
            type: 'TACHE_PRIORITE',
            acteurId: acteur.id,
            editionId: tache.editionId,
            perimetreId: tache.perimetreId,
            tacheId: tache.id,
            ajustement: niveau,
          },
        }),
      ])
      publierPourPerimetre('TACHE', tache.perimetreId, {
        id: tache.id,
        editionId: tache.editionId,
      })
      return prisma.tache.findUniqueOrThrow({
        ...query,
        where: { id: tache.id },
      })
    },
  }),
}))
