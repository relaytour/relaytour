import { prisma, type Prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { jourISO } from '../lib/agenda.ts'
import {
  accepterSurSequence,
  adequation,
  CHOIX_EN_ATTENTE,
  couverture,
  joursDesPlages,
  joursDeLaPeriode,
  perimetresEcrits,
  plagesValides,
  voitLAppel,
  type Adequation,
  type Plage,
} from '../lib/appels.ts'
import { coordonneesLisibles } from '../lib/benevoles.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { peutEcrireSequence, PLACES_MAX } from '../lib/programme.ts'

import { PlageRef } from './appels.ts'
import { builder } from './builder.ts'
import {
  lireSequence,
  SequenceRef,
  sequenceVisible,
  signal,
} from './programme.ts'

// Répartition des bénévoles (ADR 0041). La vue « Répartition » de l'écran
// « Programme » montre les manques par tranche de 30 minutes, et les bénévoles à
// répartir : les candidatures en attente, et les fiches qui ont des plages de
// disponibilité. Ces personnes se lisent par celles qui écrivent dans l'activité,
// sans adresse ni téléphone ; une personne venue d'un appel de périmètre ne se lit
// que dans ce périmètre.

const AdequationEnum = builder.enumType('Adequation', {
  description:
    'TOTALE : une plage couvre toute la séquence. PARTIELLE : une plage en couvre une partie. AUCUNE : aucune plage ne la touche.',
  values: ['TOTALE', 'PARTIELLE', 'AUCUNE'] as const,
})

interface ChoixResume {
  sequenceId: string
  statut: string
}

interface PlaceTenue {
  sequenceId: string
  debut: Date
  fin: Date
}

interface ARepartir {
  cle: string
  candidatureId: string | null
  benevoleId: string | null
  nom: string
  plages: Plage[]
  precisions: string | null
  message: string | null
  origine: string | null
  ouAilleurs: boolean
  choix: ChoixResume[]
  places: PlaceTenue[]
  adequation: Adequation | null
  note: string | null
}

const ChoixResumeRef = builder
  .objectRef<ChoixResume>('ChoixARepartir')
  .implement({
    fields: t => ({
      sequenceId: t.exposeID('sequenceId'),
      statut: t.exposeString('statut'),
    }),
  })

const PlaceTenueRef = builder.objectRef<PlaceTenue>('PlaceTenue').implement({
  fields: t => ({
    sequenceId: t.exposeID('sequenceId'),
    debut: t.field({ type: 'DateTime', resolve: p => p.debut }),
    fin: t.field({ type: 'DateTime', resolve: p => p.fin }),
  }),
})

const ARepartirRef = builder
  .objectRef<ARepartir & { fuseau: string }>('BenevoleARepartir')
  .implement({
    description:
      'Une personne disponible : une candidature en attente, ou une fiche qui a des plages de disponibilité. Elle se lit sans adresse ni téléphone.',
    fields: t => ({
      cle: t.exposeString('cle'),
      candidatureId: t.exposeID('candidatureId', { nullable: true }),
      benevoleId: t.exposeID('benevoleId', { nullable: true }),
      nom: t.exposeString('nom'),
      plages: t.field({
        type: [PlageRef],
        resolve: r => r.plages.map(p => ({ ...p, fuseau: r.fuseau })),
      }),
      precisionsDisponibilite: t.exposeString('precisions', {
        nullable: true,
      }),
      message: t.exposeString('message', { nullable: true }),
      origine: t.exposeString('origine', {
        nullable: true,
        description: 'Le nom de l’appel, pour une candidature.',
      }),
      ouAilleurs: t.exposeBoolean('ouAilleurs'),
      choix: t.field({ type: [ChoixResumeRef], resolve: r => r.choix }),
      places: t.field({ type: [PlaceTenueRef], resolve: r => r.places }),
      adequation: t.field({
        type: AdequationEnum,
        nullable: true,
        description: 'Pour la séquence demandée, s’il y en a une.',
        resolve: r => r.adequation,
      }),
      note: t.exposeString('note', {
        nullable: true,
        description:
          'La note de la fiche, pour une personne qui lit ses coordonnées (ADR 0040).',
      }),
    }),
  })

interface TrancheLue {
  debut: Date
  fin: Date
  besoin: number
  confirmees: number
  aConfirmer: number
  disponibles: number
}

const TrancheRef = builder
  .objectRef<TrancheLue>('TrancheCouverture')
  .implement({
    description:
      'Une tranche de 30 minutes du programme : besoins, places en renfort et bénévoles à répartir.',
    fields: t => ({
      debut: t.field({ type: 'DateTime', resolve: r => r.debut }),
      fin: t.field({ type: 'DateTime', resolve: r => r.fin }),
      besoin: t.exposeInt('besoin'),
      confirmees: t.exposeInt('confirmees'),
      aConfirmer: t.exposeInt('aConfirmer'),
      disponibles: t.exposeInt('disponibles'),
    }),
  })

/** L'édition, si la personne écrit dans l'activité pour cette période. */
async function editionRepartie(ctx: AppContext, editionId: string | number) {
  const edition = await ctx.exigerEdition(editionId)
  const ecrits = await perimetresEcrits(ctx, edition)
  if (ecrits !== 'TOUS' && ecrits.size === 0) throw accesRefuse()
  return { edition, ecrits }
}

/**
 * Les bénévoles à répartir d'une période que la personne voit : les candidatures
 * en attente sans fiche, et les fiches qui ont des plages pour la période. Une
 * fiche reprend les choix, les précisions et le message de ses candidatures.
 */
async function benevolesARepartir(
  ctx: AppContext,
  edition: { id: string; activiteId: string },
  ecrits: 'TOUS' | Set<string>
): Promise<ARepartir[]> {
  const organisationId = ctx.organisation!.id
  const [candidatures, fiches] = await Promise.all([
    prisma.candidature.findMany({
      where: {
        organisationId,
        editionId: edition.id,
        OR: [{ statut: 'EN_ATTENTE' }, { benevoleId: { not: null } }],
      },
      include: {
        appel: { select: { nom: true, portee: true, perimetreId: true } },
        plages: true,
        choix: { select: { sequenceId: true, statut: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    }),
    prisma.benevole.findMany({
      where: {
        organisationId,
        activiteId: edition.activiteId,
        plages: { some: { editionId: edition.id } },
      },
      include: {
        plages: { where: { editionId: edition.id } },
        places: {
          where: { sequence: { editionId: edition.id } },
          include: {
            sequence: { select: { id: true, debut: true, fin: true } },
          },
        },
      },
      orderBy: [{ nom: 'asc' }, { id: 'asc' }],
      take: 5000,
    }),
  ])
  const visibles = candidatures.filter(c => voitLAppel(ecrits, c.appel))
  const parFiche = new Map<string, typeof visibles>()
  for (const c of visibles) {
    if (c.benevoleId === null) continue
    parFiche.set(c.benevoleId, [...(parFiche.get(c.benevoleId) ?? []), c])
  }
  const notes = await coordonneesLisibles(
    ctx,
    edition.activiteId,
    fiches.map(f => f.id)
  )
  const resultat: ARepartir[] = visibles
    .filter(c => c.benevoleId === null && c.statut === 'EN_ATTENTE')
    .map(c => ({
      cle: `candidature:${c.id}`,
      candidatureId: c.id,
      benevoleId: null,
      nom: c.nom,
      plages: c.plages,
      precisions: c.precisionsDisponibilite,
      message: c.message,
      origine: c.appel.nom,
      ouAilleurs: c.ouAilleurs,
      choix: c.choix,
      places: [],
      adequation: null,
      note: null,
    }))
  for (const fiche of fiches) {
    const siennes = parFiche.get(fiche.id) ?? []
    const enAttente = siennes.find(c => c.statut === 'EN_ATTENTE')
    resultat.push({
      cle: `benevole:${fiche.id}`,
      candidatureId: enAttente?.id ?? null,
      benevoleId: fiche.id,
      nom: fiche.nom,
      plages: fiche.plages,
      precisions:
        siennes.map(c => c.precisionsDisponibilite).find(Boolean) ?? null,
      message: siennes.map(c => c.message).find(Boolean) ?? null,
      origine: siennes[0]?.appel.nom ?? null,
      ouAilleurs: siennes.some(c => c.ouAilleurs),
      choix: siennes.flatMap(c =>
        c.choix.filter(x => CHOIX_EN_ATTENTE.includes(x.statut))
      ),
      places: fiche.places.map(p => ({
        sequenceId: p.sequence.id,
        debut: p.sequence.debut,
        fin: p.sequence.fin,
      })),
      adequation: null,
      note: notes.has(fiche.id) ? fiche.note : null,
    })
  }
  return resultat
}

const RANG: Record<Adequation, number> = { TOTALE: 0, PARTIELLE: 1, AUCUNE: 2 }

builder.queryFields(t => ({
  benevolesARepartir: t.field({
    type: [ARepartirRef],
    authScopes: { connecte: true },
    description:
      'Les bénévoles à répartir d’une période. Avec une séquence : les personnes qui n’y sont pas placées, classées par adéquation de leurs plages, puis par choix de la séquence.',
    args: {
      editionId: t.arg.id({ required: true }),
      sequenceId: t.arg.id(),
    },
    resolve: async (_root, args, ctx) => {
      const { edition, ecrits } = await editionRepartie(ctx, args.editionId)
      const fuseau = ctx.organisation!.fuseauHoraire
      const liste = await benevolesARepartir(ctx, edition, ecrits)
      if (!args.sequenceId) return liste.map(r => ({ ...r, fuseau }))
      const sequence = await prisma.sequence.findFirst({
        where: { id: String(args.sequenceId), editionId: edition.id },
        select: { id: true, debut: true, fin: true },
      })
      if (sequence === null) throw accesRefuse()
      return liste
        .filter(r => !r.places.some(p => p.sequenceId === sequence.id))
        .map(r => ({
          ...r,
          fuseau,
          adequation: adequation(r.plages, sequence),
          choisie: r.choix.some(c => c.sequenceId === sequence.id),
        }))
        .sort(
          (x, y) =>
            RANG[x.adequation] - RANG[y.adequation] ||
            Number(y.choisie) - Number(x.choisie) ||
            x.nom.localeCompare(y.nom, 'fr')
        )
    },
  }),

  couvertureProgramme: t.field({
    type: [TrancheRef],
    authScopes: { connecte: true },
    description:
      'La couverture du programme par tranches de 30 minutes. Les périmètres filtrent les séquences ; les bénévoles à répartir se comptent tous.',
    args: {
      editionId: t.arg.id({ required: true }),
      perimetreIds: t.arg.idList(),
    },
    resolve: async (_root, args, ctx) => {
      const { edition, ecrits } = await editionRepartie(ctx, args.editionId)
      const filtre = args.perimetreIds?.map(String)
      const [sequences, liste] = await Promise.all([
        prisma.sequence.findMany({
          where: {
            organisationId: ctx.organisation!.id,
            editionId: edition.id,
            besoinBenevoles: { gt: 0 },
            ...(filtre && filtre.length > 0
              ? { perimetreId: { in: filtre } }
              : {}),
          },
          include: {
            places: {
              where: { role: 'RENFORT' },
              select: { confirmeeLe: true },
            },
          },
        }),
        benevolesARepartir(ctx, edition, ecrits),
      ])
      return couverture(
        sequences.map(s => ({
          debut: s.debut,
          fin: s.fin,
          besoin: s.besoinBenevoles,
          confirmees: s.places.filter(p => p.confirmeeLe !== null).length,
          aConfirmer: s.places.filter(p => p.confirmeeLe === null).length,
        })),
        liste
      )
    },
  }),
}))

/** La séquence, si la personne l'écrit. */
async function sequenceEcrite(ctx: AppContext, id: string) {
  const sequence = await sequenceVisible(ctx, id)
  if (!(await peutEcrireSequence(ctx, sequence))) throw accesRefuse()
  return sequence
}

const incrementer = (tx: Prisma.TransactionClient, sequenceId: string) =>
  tx.sequence.update({
    where: { id: sequenceId },
    data: { version: { increment: 1 } },
  })

export const PlageInput = builder.inputType('PlageDisponibiliteInput', {
  fields: t => ({
    jour: t.field({ type: 'Date', required: true }),
    jourFin: t.field({
      type: 'Date',
      description: 'Pour une plage qui passe minuit. Sans valeur : le jour.',
    }),
    heureDebut: t.string({ required: true }),
    heureFin: t.string({ required: true }),
  }),
})

builder.mutationFields(t => ({
  placerBenevole: t.field({
    type: SequenceRef,
    authScopes: { connecte: true },
    description:
      'Place une personne à répartir dans une séquence, en renfort. Une candidature y est acceptée ; une fiche y reçoit une place, à confirmer si elle est née d’une candidature.',
    args: {
      sequenceId: t.arg.id({ required: true }),
      candidatureId: t.arg.id(),
      benevoleId: t.arg.id(),
    },
    resolve: async (_root, args, ctx) => {
      if (!args.candidatureId === !args.benevoleId) {
        throw erreurSaisie('Choisissez une candidature ou une fiche bénévole.')
      }
      const sequence = await sequenceEcrite(ctx, String(args.sequenceId))
      const edition = await ctx.exigerEdition(sequence.editionId)
      const ecrits = await perimetresEcrits(ctx, edition)
      const maintenant = new Date()
      if (args.candidatureId) {
        const candidature = await prisma.candidature.findFirst({
          where: {
            id: String(args.candidatureId),
            organisationId: ctx.organisation!.id,
            editionId: sequence.editionId,
            statut: { not: 'RETIREE' },
          },
          include: { appel: { select: { portee: true, perimetreId: true } } },
        })
        if (candidature === null || !voitLAppel(ecrits, candidature.appel)) {
          throw accesRefuse()
        }
        await prisma.$transaction(async tx => {
          await accepterSurSequence(tx, {
            candidatureId: candidature.id,
            sequenceId: sequence.id,
            acteurId: ctx.personne!.id,
            maintenant,
          })
          await incrementer(tx, sequence.id)
        })
        publierPourActivite(
          'CANDIDATURE',
          sequence.organisationId,
          sequence.activiteId,
          { id: candidature.id, editionId: sequence.editionId }
        )
      } else {
        const benevole = await prisma.benevole.findFirst({
          where: {
            id: String(args.benevoleId),
            organisationId: ctx.organisation!.id,
            activiteId: sequence.activiteId,
          },
          select: { id: true, origine: true },
        })
        if (benevole === null) throw accesRefuse()
        await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM Sequence WHERE id = ${sequence.id} FOR UPDATE`
          const deja = await tx.placeSequence.findUnique({
            where: {
              sequenceId_benevoleId: {
                sequenceId: sequence.id,
                benevoleId: benevole.id,
              },
            },
            select: { id: true },
          })
          if (deja !== null) {
            throw erreurSaisie('Cette personne est déjà placée ici.')
          }
          const nombre = await tx.placeSequence.count({
            where: { sequenceId: sequence.id },
          })
          if (nombre >= PLACES_MAX) {
            throw erreurSaisie(
              `Une séquence compte ${PLACES_MAX} places au plus.`
            )
          }
          await tx.placeSequence.create({
            data: {
              sequenceId: sequence.id,
              benevoleId: benevole.id,
              role: 'RENFORT',
              // Une fiche saisie à la main naît confirmée ; une fiche née d'une
              // candidature reçoit une place à confirmer (ADR 0041).
              confirmeeLe: benevole.origine === 'SAISIE' ? maintenant : null,
            },
          })
          await incrementer(tx, sequence.id)
        })
      }
      signal(sequence)
      return lireSequence(ctx, await sequenceVisible(ctx, sequence.id))
    },
  }),

  retirerPlaceSequence: t.field({
    type: SequenceRef,
    authScopes: { connecte: true },
    description:
      'Retire une place d’une séquence. Le choix accepté d’une candidature reste accepté.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const place = await prisma.placeSequence.findFirst({
        where: {
          id: String(args.id),
          sequence: { organisationId: ctx.organisation!.id },
        },
        select: { id: true, sequenceId: true },
      })
      if (place === null) throw accesRefuse()
      const sequence = await sequenceEcrite(ctx, place.sequenceId)
      await prisma.$transaction(async tx => {
        await tx.placeSequence.delete({ where: { id: place.id } })
        await incrementer(tx, sequence.id)
      })
      signal(sequence)
      return lireSequence(ctx, await sequenceVisible(ctx, sequence.id))
    },
  }),

  modifierPlagesBenevole: t.field({
    type: [PlageRef],
    authScopes: { connecte: true },
    description:
      'Remplace les plages de disponibilité d’une fiche pour une période. Réservé aux personnes qui modifient la fiche.',
    args: {
      benevoleId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
      plages: t.arg({ type: [PlageInput], required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const benevole = await prisma.benevole.findFirst({
        where: {
          id: String(args.benevoleId),
          organisationId: ctx.organisation!.id,
        },
        select: { id: true, activiteId: true, creeParId: true },
      })
      if (benevole === null) throw accesRefuse()
      const edition = await ctx.exigerEdition(args.editionId)
      if (edition.activiteId !== benevole.activiteId) throw accesRefuse()
      const admin = await ctx.estAdminDe(benevole.activiteId)
      if (!admin && benevole.creeParId !== ctx.personne!.id) throw accesRefuse()
      if (edition.statut === 'ARCHIVEE') {
        throw erreurSaisie('Cette période est archivée.')
      }
      const fuseau = ctx.organisation!.fuseauHoraire
      const sequences = await prisma.sequence.findMany({
        where: { editionId: edition.id },
        select: { debut: true, fin: true },
      })
      const jours = joursDesPlages(
        await joursDeLaPeriode(prisma, edition.id),
        sequences,
        fuseau
      )
      const plages = plagesValides(
        args.plages.map(p => ({
          jour: jourISO(p.jour),
          jourFin: p.jourFin ? jourISO(p.jourFin) : null,
          heureDebut: p.heureDebut,
          heureFin: p.heureFin,
        })),
        jours,
        fuseau
      )
      await prisma.$transaction(async tx => {
        await tx.plageDisponibilite.deleteMany({
          where: { benevoleId: benevole.id, editionId: edition.id },
        })
        await tx.plageDisponibilite.createMany({
          data: plages.map(p => ({
            editionId: edition.id,
            benevoleId: benevole.id,
            debut: p.debut,
            fin: p.fin,
          })),
        })
      })
      publierPourActivite(
        'CANDIDATURE',
        ctx.organisation!.id,
        benevole.activiteId,
        { editionId: edition.id }
      )
      return plages.map(p => ({ ...p, fuseau }))
    },
  }),
}))
