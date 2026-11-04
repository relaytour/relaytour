import {
  AjustementPriorite,
  prisma,
  type Perimetre,
  type Tache,
} from '@relaytour/database'

import { jourISO } from '../lib/agenda.ts'
import { aujourdhui, exigerEcriture } from '../lib/droits.ts'
import { TACHES_ACTIVES } from '../lib/declinaisons.ts'
import { publierPourPerimetre } from '../lib/flux.ts'
import { heureLocale } from '../lib/heures.ts'
import { moduleActif } from '../lib/modules.ts'
import {
  ajustementActif,
  classerPriorites,
  horizon,
  type CodeRaison,
  type Raison,
  type TacheAClasser,
} from '../lib/priorites.ts'

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

const OUVERTES = ['A_FAIRE', 'EN_COURS'] as const

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
      description: 'Déclinaisons actives (DECLINAISONS).',
      resolve: r => r.nombre ?? null,
    }),
    niveau: t.field({
      type: AjustementPrioriteEnum,
      nullable: true,
      resolve: r => r.niveau ?? null,
    }),
  }),
})

interface AjustementLu {
  niveau: AjustementPriorite
  parId: string | null
  le: Date
  jusquAu: Date
}

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

/** L'ajustement d'une tâche, s'il compte encore aujourd'hui. */
function ajustementLu(
  tache: Pick<
    Tache,
    | 'ajustementPriorite'
    | 'ajustementParId'
    | 'ajustementLe'
    | 'ajustementJusquAu'
  >,
  jour: string
): AjustementLu | null {
  if (
    tache.ajustementPriorite === null ||
    tache.ajustementLe === null ||
    tache.ajustementJusquAu === null
  ) {
    return null
  }
  const actif = ajustementActif(
    {
      niveau: tache.ajustementPriorite,
      jusquAu: jourISO(tache.ajustementJusquAu),
    },
    jour
  )
  return actif === null
    ? null
    : {
        niveau: tache.ajustementPriorite,
        parId: tache.ajustementParId,
        le: tache.ajustementLe,
        jusquAu: tache.ajustementJusquAu,
      }
}

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

interface PrioriteLue {
  tache: Tache
  score: number
  raisons: Raison[]
}

const PrioriteRef = builder.objectRef<PrioriteLue>('Priorite').implement({
  fields: t => ({
    tache: t.field({ type: TacheRef, resolve: p => p.tache }),
    score: t.exposeInt('score'),
    // Une tâche porte six raisons au plus.
    raisons: t.field({
      type: [RaisonRef],
      complexity: { field: 1, multiplier: 3 },
      resolve: p => p.raisons,
    }),
  }),
})

interface PrioritesDuPerimetreLues {
  perimetre: Perimetre
  priorites: PrioriteLue[]
  autres: number
  ensuite: Tache | null
}

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
        'La prochaine réunion de l’agenda global, non annulée. Null sans réunion prévue ou sans module Agenda.',
      resolve: p => p.prochainPoint,
    }),
    perimetres: t.field({
      type: [PrioritesDuPerimetreRef],
      description:
        'Les périmètres non archivés de l’activité, dans leur ordre.',
      complexity: { field: 1, multiplier: 4 },
      resolve: p => p.perimetres,
    }),
  }),
})

type TacheLue = TacheAClasser & { ligne: Tache }

builder.queryFields(t => ({
  priorites: t.field({
    type: PrioritesRef,
    authScopes: { connecte: true },
    description:
      'Les priorités d’une période (ADR 0059) : pour chaque périmètre de l’activité, les tâches à traiter avant le prochain point, classées par score.',
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      const fuseau = ctx.organisation!.fuseauHoraire
      const maintenant = new Date()
      const jour = aujourdhui(maintenant, fuseau)
      const agenda = await moduleActif(edition.activiteId, 'AGENDA')
      const [perimetres, taches, point, liens] = await Promise.all([
        prisma.perimetre.findMany({
          where: { activiteId: edition.activiteId, archivedAt: null },
          orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
        }),
        // Une déclinaison qui n'est pas acceptée n'entre pas (ADR 0026).
        prisma.tache.findMany({
          where: {
            editionId: edition.id,
            perimetre: { archivedAt: null },
            statut: { in: [...OUVERTES] },
            AND: [TACHES_ACTIVES],
          },
          include: {
            _count: { select: { assignations: true } },
            declinaisons: {
              select: { statut: true, accord: true, echeance: true },
            },
          },
        }),
        agenda
          ? prisma.reunion.findFirst({
              where: {
                editionId: edition.id,
                perimetreId: null,
                statut: 'PREVUE',
                debut: { gt: maintenant },
              },
              include: REUNION_CHARGEE,
              orderBy: { debut: 'asc' },
            })
          : null,
        agenda
          ? prisma.reunionTache.findMany({
              where: {
                tache: { editionId: edition.id },
                reunion: { statut: 'PREVUE', debut: { gt: maintenant } },
              },
              select: { tacheId: true },
            })
          : [],
      ])
      const reunions = new Map<string, number>()
      for (const l of liens) {
        reunions.set(l.tacheId, (reunions.get(l.tacheId) ?? 0) + 1)
      }
      const h = horizon(
        jour,
        point === null ? null : heureLocale(point.debut, fuseau).jour
      )
      const aClasser: TacheLue[] = taches.map(tache => {
        const ouvertes = tache.declinaisons.filter(
          d => d.statut === 'A_FAIRE' || d.statut === 'EN_COURS'
        )
        const actives = ouvertes.filter(d => d.accord === 'ACCEPTE')
        const ajustement = ajustementLu(tache, jour)
        return {
          id: tache.id,
          perimetreId: tache.perimetreId,
          statut: tache.statut as TacheAClasser['statut'],
          echeance: tache.echeance ? jourISO(tache.echeance) : null,
          assignes: tache._count.assignations,
          declinaisonsActives: actives.length,
          declinaisonsEnAttente: tache.declinaisons.filter(
            d => d.accord === 'EN_ATTENTE'
          ).length,
          echeancesDeclinaisons: actives.flatMap(d =>
            d.echeance ? [jourISO(d.echeance)] : []
          ),
          reunionsAVenir: reunions.get(tache.id) ?? 0,
          ajustement:
            ajustement === null
              ? null
              : {
                  niveau: ajustement.niveau,
                  jusquAu: jourISO(ajustement.jusquAu),
                },
          ligne: tache,
        }
      })
      const parId = new Map(perimetres.map(p => [p.id, p]))
      const classes = classerPriorites(
        aClasser,
        perimetres.map(p => p.id),
        h
      )
      return {
        fin: h.fin,
        prochainPoint: point === null ? null : await lireReunion(ctx, point),
        perimetres: classes.map(c => ({
          perimetre: parId.get(c.perimetreId)!,
          priorites: c.priorites.map(n => ({
            tache: n.tache.ligne,
            score: n.score,
            raisons: n.raisons,
          })),
          autres: c.autres,
          ensuite: c.ensuite?.ligne ?? null,
        })),
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
              where: {
                editionId: tache.editionId,
                perimetreId: null,
                statut: 'PREVUE',
                debut: { gt: maintenant },
              },
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
