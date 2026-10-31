import {
  prisma,
  type Activite,
  type Edition,
  type Perimetre,
  type User,
} from '@relaytour/database'

import type { AppContext } from '../context.ts'
import {
  calculerCharges,
  type Charge,
  type ChargeEdition,
  type ChargeMaintenant,
  type ChargePlaces,
} from '../lib/charge.ts'
import { TACHES_ACTIVES } from '../lib/declinaisons.ts'
import { aujourdhui } from '../lib/droits.ts'
import { lirePhases } from '../lib/phases.ts'

import { ActiviteRef } from './activites.ts'
import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'
import { ORDRE_TACHES, TacheRef } from './taches.ts'

// Charge de l'équipe (ADR 0055). Toute personne qui voit les tâches de l'activité
// lit la charge de chacun : `exigerEdition` refuse l'édition d'une activité
// invisible, donc à une personne en découverte. Le nombre de tâches réalisées suit
// la règle de la clôture : la personne elle-même et les admins de l'activité.

const OUVERTES = ['A_FAIRE', 'EN_COURS'] as const

const TempsChargeEnum = builder.enumType('TempsCharge', {
  description:
    'MAINTENANT : les tâches ouvertes. EDITION : toutes les tâches assignées de l’édition.',
  values: ['MAINTENANT', 'EDITION'] as const,
})

const ChargeMaintenantRef = builder
  .objectRef<ChargeMaintenant>('ChargeMaintenant')
  .implement({
    description: 'Les tâches ouvertes d’une personne, selon leur échéance.',
    fields: t => ({
      total: t.exposeInt('total'),
      enRetard: t.exposeInt('enRetard'),
      proches: t.exposeInt('proches', {
        description: 'Échéance dans les 7 jours, aujourd’hui compris.',
      }),
      plusTard: t.exposeInt('plusTard'),
      sansEcheance: t.exposeInt('sansEcheance'),
      partagees: t.exposeInt('partagees', {
        description:
          'Tâches ouvertes qui ont aussi d’autres personnes assignées.',
      }),
    }),
  })

const ChargePhaseRef = builder
  .objectRef<{ cle: string | null; total: number }>('ChargePhase')
  .implement({
    fields: t => ({
      cle: t.exposeString('cle', {
        nullable: true,
        description: 'Clé de la phase ; null pour les tâches sans échéance.',
      }),
      total: t.exposeInt('total'),
    }),
  })

const ChargeEditionRef = builder
  .objectRef<ChargeEdition>('ChargeEdition')
  .implement({
    description: 'Toutes les tâches assignées à une personne dans l’édition.',
    fields: t => ({
      total: t.exposeInt('total'),
      aFaire: t.exposeInt('aFaire'),
      enCours: t.exposeInt('enCours'),
      faites: t.exposeInt('faites'),
      abandonnees: t.exposeInt('abandonnees'),
      parPhase: t.field({ type: [ChargePhaseRef], resolve: e => e.parPhase }),
    }),
  })

const ChargePlacesRef = builder
  .objectRef<ChargePlaces>('ChargePlaces')
  .implement({
    description: 'Les places d’une personne au programme de l’édition.',
    fields: t => ({
      total: t.exposeInt('total'),
      aVenir: t.exposeInt('aVenir'),
      prochaine: t.expose('prochaine', { type: 'DateTime', nullable: true }),
    }),
  })

const AffectationChargeRef = builder
  .objectRef<{ perimetre: Perimetre; contactPrincipal: boolean }>(
    'AffectationCharge'
  )
  .implement({
    fields: t => ({
      perimetre: t.field({ type: PerimetreRef, resolve: a => a.perimetre }),
      contactPrincipal: t.exposeBoolean('contactPrincipal'),
    }),
  })

interface ChargeLue extends Charge {
  personne: User
  perimetres: Map<string, Perimetre>
  realiseesLisibles: boolean
}

const ChargePersonneRef = builder
  .objectRef<ChargeLue>('ChargePersonne')
  .implement({
    fields: t => ({
      personne: t.field({ type: PersonneRef, resolve: c => c.personne }),
      affectations: t.field({
        type: [AffectationChargeRef],
        resolve: c =>
          c.affectations.flatMap(a => {
            const perimetre = c.perimetres.get(a.perimetreId)
            return perimetre
              ? [{ perimetre, contactPrincipal: a.contactPrincipal }]
              : []
          }),
      }),
      maintenant: t.field({
        type: ChargeMaintenantRef,
        resolve: c => c.maintenant,
      }),
      edition: t.field({ type: ChargeEditionRef, resolve: c => c.edition }),
      places: t.field({ type: ChargePlacesRef, resolve: c => c.places }),
      realisees: t.int({
        nullable: true,
        description:
          'Tâches faites où la personne est créditée. Lisible par elle-même et par les admins de l’activité ; null pour les autres.',
        resolve: c => (c.realiseesLisibles ? c.realisees : null),
      }),
    }),
  })

interface ChargeCumulee {
  activite: Activite
  edition: Edition
  ouvertes: number
  enRetard: number
  placesAVenir: number
  perimetres: number
}

const ChargeCumuleeRef = builder
  .objectRef<ChargeCumulee>('ChargeCumulee')
  .implement({
    description:
      'La charge d’une personne dans une activité, pour son édition en cours ou à venir.',
    fields: t => ({
      activite: t.field({ type: ActiviteRef, resolve: c => c.activite }),
      edition: t.field({ type: EditionRef, resolve: c => c.edition }),
      ouvertes: t.exposeInt('ouvertes'),
      enRetard: t.exposeInt('enRetard'),
      placesAVenir: t.exposeInt('placesAVenir'),
      perimetres: t.exposeInt('perimetres'),
    }),
  })

/** Qui lit le nombre de tâches réalisées d'une personne : elle-même et les admins. */
async function lisibilitesDesRealisations(
  ctx: AppContext,
  activiteId: string
): Promise<(userId: string) => boolean> {
  const admin = await ctx.estAdminDe(activiteId)
  return userId => admin || ctx.personne?.id === userId
}

builder.queryFields(t => ({
  chargeEquipe: t.field({
    type: [ChargePersonneRef],
    authScopes: { connecte: true },
    description:
      'La charge de chaque personne de l’édition : affectée, assignée à une tâche ou placée au programme (ADR 0055). Triée par charge actuelle décroissante.',
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      const [lue, affectations, taches, places, perimetres] = await Promise.all(
        [
          prisma.edition.findUniqueOrThrow({
            where: { id: edition.id },
            select: { debut: true, activite: { select: { phases: true } } },
          }),
          prisma.affectation.findMany({
            where: { editionId: edition.id, perimetre: { archivedAt: null } },
            select: { userId: true, perimetreId: true, contactPrincipal: true },
          }),
          // Une déclinaison qui n'est pas acceptée ne compte pas (ADR 0026).
          prisma.tache.findMany({
            where: {
              editionId: edition.id,
              perimetre: { archivedAt: null },
              AND: [TACHES_ACTIVES],
            },
            select: {
              statut: true,
              echeance: true,
              clotureeParId: true,
              assignations: { select: { userId: true } },
              realisations: { select: { userId: true } },
            },
          }),
          prisma.placeSequence.findMany({
            where: {
              userId: { not: null },
              sequence: { editionId: edition.id },
            },
            select: {
              userId: true,
              sequence: { select: { debut: true, fin: true } },
            },
          }),
          prisma.perimetre.findMany({
            where: { activiteId: edition.activiteId, archivedAt: null },
          }),
        ]
      )
      const charges = calculerCharges({
        taches: taches.map(t => ({
          statut: t.statut,
          echeance: t.echeance,
          assignes: t.assignations.map(a => a.userId),
          credites:
            t.realisations.length > 0
              ? t.realisations.map(r => r.userId)
              : t.clotureeParId
                ? [t.clotureeParId]
                : [],
        })),
        places: places.map(p => ({
          userId: p.userId!,
          debut: p.sequence.debut,
          fin: p.sequence.fin,
        })),
        affectations,
        aujourdhui: aujourdhui(new Date(), ctx.organisation?.fuseauHoraire),
        maintenant: new Date(),
        debutEdition: lue.debut,
        phases: lirePhases(lue.activite.phases),
      })
      // Les personnes se chargent en une seule requête, pas une par ligne.
      const personnes = new Map(
        (
          await prisma.user.findMany({
            where: { id: { in: charges.map(c => c.userId) } },
          })
        ).map(p => [p.id, p])
      )
      const parId = new Map(perimetres.map(p => [p.id, p]))
      const lisible = await lisibilitesDesRealisations(ctx, edition.activiteId)
      return charges.flatMap(charge => {
        const personne = personnes.get(charge.userId)
        return personne
          ? [
              {
                ...charge,
                personne,
                perimetres: parId,
                realiseesLisibles: lisible(charge.userId),
              },
            ]
          : []
      })
    },
  }),

  tachesDe: t.prismaField({
    type: [TacheRef],
    authScopes: { connecte: true },
    description:
      'Les tâches assignées à une personne dans l’édition : ouvertes (MAINTENANT) ou toutes (EDITION), dans les périmètres non archivés (ADR 0055).',
    args: {
      personneId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
      temps: t.arg({ type: TempsChargeEnum, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const edition = await ctx.exigerEdition(args.editionId)
      return prisma.tache.findMany({
        ...query,
        where: {
          editionId: edition.id,
          perimetre: { archivedAt: null },
          assignations: { some: { userId: String(args.personneId) } },
          ...(args.temps === 'MAINTENANT'
            ? { statut: { in: [...OUVERTES] } }
            : {}),
          AND: [TACHES_ACTIVES],
        },
        orderBy: ORDRE_TACHES,
      })
    },
  }),

  chargeCumulee: t.field({
    type: [ChargeCumuleeRef],
    authScopes: { connecte: true },
    description:
      'La charge d’une personne dans chaque activité que la personne connectée voit, pour l’édition en cours ou à venir de chacune (ADR 0055).',
    args: { personneId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const personneId = String(args.personneId)
      const visibles = [...(await ctx.activitesVisibles())]
      if (visibles.length === 0) return []
      const jour = aujourdhui(new Date(), ctx.organisation?.fuseauHoraire)
      // L'édition retenue par activité : la première qui n'est pas terminée, sinon
      // la plus récente. Une édition archivée ne compte pas.
      const editions = await prisma.edition.findMany({
        where: {
          organisationId: ctx.organisation!.id,
          activiteId: { in: visibles },
          statut: { not: 'ARCHIVEE' },
        },
        include: { activite: true },
        orderBy: { debut: 'asc' },
      })
      const retenues = new Map<string, (typeof editions)[number]>()
      for (const activiteId of visibles) {
        const siennes = editions.filter(e => e.activiteId === activiteId)
        const retenue =
          siennes.find(e => e.fin.toISOString().slice(0, 10) >= jour) ??
          siennes.at(-1)
        if (retenue) retenues.set(activiteId, retenue)
      }
      const ids = [...retenues.values()].map(e => e.id)
      if (ids.length === 0) return []
      const [taches, places, affectations] = await Promise.all([
        prisma.tache.findMany({
          where: {
            editionId: { in: ids },
            perimetre: { archivedAt: null },
            statut: { in: [...OUVERTES] },
            assignations: { some: { userId: personneId } },
            AND: [TACHES_ACTIVES],
          },
          select: { editionId: true, echeance: true },
        }),
        prisma.placeSequence.findMany({
          where: {
            userId: personneId,
            sequence: { editionId: { in: ids }, fin: { gte: new Date() } },
          },
          select: { sequence: { select: { editionId: true } } },
        }),
        prisma.affectation.findMany({
          where: {
            userId: personneId,
            editionId: { in: ids },
            perimetre: { archivedAt: null },
          },
          select: { editionId: true },
        }),
      ])
      return [...retenues.values()]
        .map(edition => ({
          activite: edition.activite,
          edition,
          ouvertes: taches.filter(t => t.editionId === edition.id).length,
          enRetard: taches.filter(
            t =>
              t.editionId === edition.id &&
              t.echeance !== null &&
              t.echeance.toISOString().slice(0, 10) < jour
          ).length,
          placesAVenir: places.filter(p => p.sequence.editionId === edition.id)
            .length,
          perimetres: affectations.filter(a => a.editionId === edition.id)
            .length,
        }))
        .filter(c => c.ouvertes + c.placesAVenir + c.perimetres > 0)
        .sort((a, b) => a.activite.nom.localeCompare(b.activite.nom))
    },
  }),
}))
