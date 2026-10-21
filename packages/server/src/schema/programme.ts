import { prisma, RolePlace, type Prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { jourISO } from '../lib/agenda.ts'
import { peutModifierPerimetre } from '../lib/droits.ts'
import { accesRefuse, conflitDeVersion, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import { heureLocale } from '../lib/heures.ts'
import {
  dureeValide,
  NOM_LIEU_MAX,
  placesDatees,
  placesValides,
  SEQUENCES_MAX,
} from '../lib/programme.ts'
import {
  DESCRIPTION_REUNION_MAX,
  exigerEcritureReunion,
  horaireValide,
  TITRE_REUNION_MAX,
} from '../lib/reunions.ts'
import { texteFacultatif, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'

// Programme du jour J (ADR 0040) : les lieux d'une activité, et les séquences
// d'une période où se placent des membres de l'équipe et des bénévoles. Toute
// personne qui voit l'activité lit le programme ; une fiche bénévole n'y montre
// que son nom.

const RolePlaceEnum = builder.enumType(RolePlace, { name: 'RolePlace' })

export const LieuRef = builder.prismaObject('Lieu', {
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('nom'),
    description: t.exposeString('description', { nullable: true }),
    ordre: t.exposeInt('ordre'),
    archive: t.boolean({ resolve: l => l.archivedAt !== null }),
  }),
})

const SEQUENCE_CHARGEE = {
  perimetre: true,
  lieu: true,
  places: {
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: { select: { id: true, name: true } },
      benevole: { select: { id: true, nom: true } },
    },
  },
} satisfies Prisma.SequenceInclude

type SequenceChargee = Prisma.SequenceGetPayload<{
  include: typeof SEQUENCE_CHARGEE
}>

interface SequenceLue {
  sequence: SequenceChargee
  peutModifier: boolean
  moi: string
  fuseau: string
}

interface PlaceLue {
  id: string
  role: RolePlace
  personneId: string | null
  benevoleId: string | null
  nom: string
  estMoi: boolean
}

const PlaceLueRef = builder.objectRef<PlaceLue>('PlaceSequence').implement({
  fields: t => ({
    id: t.exposeID('id'),
    role: t.expose('role', { type: RolePlaceEnum }),
    personneId: t.exposeID('personneId', { nullable: true }),
    benevoleId: t.exposeID('benevoleId', {
      nullable: true,
      description: 'La fiche bénévole ; ses coordonnées se lisent à part.',
    }),
    nom: t.exposeString('nom'),
    estMoi: t.exposeBoolean('estMoi'),
  }),
})

export const SequenceRef = builder
  .objectRef<SequenceLue>('Sequence')
  .implement({
    description: 'Une séquence du programme du jour J (ADR 0040).',
    fields: t => ({
      id: t.id({ resolve: l => l.sequence.id }),
      editionId: t.id({ resolve: l => l.sequence.editionId }),
      titre: t.string({ resolve: l => l.sequence.titre }),
      description: t.string({
        nullable: true,
        resolve: l => l.sequence.description,
      }),
      debut: t.field({ type: 'DateTime', resolve: l => l.sequence.debut }),
      fin: t.field({ type: 'DateTime', resolve: l => l.sequence.fin }),
      jour: t.string({
        resolve: l => heureLocale(l.sequence.debut, l.fuseau).jour,
      }),
      jourFin: t.string({
        resolve: l => heureLocale(l.sequence.fin, l.fuseau).jour,
      }),
      heureDebut: t.string({
        resolve: l => heureLocale(l.sequence.debut, l.fuseau).heure,
      }),
      heureFin: t.string({
        resolve: l => heureLocale(l.sequence.fin, l.fuseau).heure,
      }),
      version: t.int({ resolve: l => l.sequence.version }),
      perimetre: t.field({
        type: PerimetreRef,
        nullable: true,
        resolve: l => l.sequence.perimetre,
      }),
      lieu: t.field({
        type: LieuRef,
        nullable: true,
        resolve: l => l.sequence.lieu,
      }),
      peutModifier: t.boolean({ resolve: l => l.peutModifier }),
      places: t.field({
        type: [PlaceLueRef],
        resolve: l =>
          l.sequence.places.map(p => ({
            id: p.id,
            role: p.role,
            personneId: p.userId,
            benevoleId: p.benevoleId,
            nom: p.user?.name ?? p.benevole?.nom ?? '',
            estMoi: p.userId === l.moi,
          })),
      }),
    }),
  })

/** Vrai si la personne écrit dans l'agenda de la séquence. */
async function peutEcrire(
  ctx: AppContext,
  s: { editionId: string; activiteId: string; perimetreId: string | null }
): Promise<boolean> {
  if (s.perimetreId !== null) {
    return peutModifierPerimetre(ctx, s.perimetreId, s.editionId)
  }
  const edition = await ctx.exigerEdition(s.editionId)
  return edition.statut !== 'ARCHIVEE' && (await ctx.estAdminDe(s.activiteId))
}

async function lireSequence(
  ctx: AppContext,
  sequence: SequenceChargee
): Promise<SequenceLue> {
  return {
    sequence,
    peutModifier: await peutEcrire(ctx, sequence),
    moi: ctx.personne!.id,
    fuseau: ctx.organisation!.fuseauHoraire,
  }
}

/** La séquence si la personne voit son activité, sinon un refus. */
async function sequenceVisible(
  ctx: AppContext,
  id: string
): Promise<SequenceChargee> {
  const sequence = await prisma.sequence.findFirst({
    where: { id, organisationId: ctx.organisation!.id },
    include: SEQUENCE_CHARGEE,
  })
  if (sequence === null) throw accesRefuse()
  await ctx.exigerEdition(sequence.editionId)
  return sequence
}

/**
 * Le lieu d'une séquence : un lieu non archivé de la même activité. Une séquence
 * qui garde son lieu actuel le garde même archivé ; un autre lieu archivé ne se
 * choisit pas.
 */
async function lieuValide(
  lieuId: string | number | null | undefined,
  activiteId: string,
  lieuActuel: string | null = null
): Promise<string | null> {
  if (!lieuId) return null
  const id = String(lieuId)
  const lieu = await prisma.lieu.findFirst({
    where: {
      id,
      activiteId,
      ...(id === lieuActuel ? {} : { archivedAt: null }),
    },
    select: { id: true },
  })
  if (lieu === null) throw accesRefuse()
  return lieu.id
}

const PlaceInput = builder.inputType('PlaceSequenceInput', {
  fields: t => ({
    personneId: t.id({ description: 'Une personne de l’équipe.' }),
    benevoleId: t.id({ description: 'Ou une fiche bénévole de l’activité.' }),
    role: t.field({ type: RolePlaceEnum, required: true }),
  }),
})

const signal = (s: {
  id: string
  organisationId: string
  activiteId: string
  perimetreId: string | null
  editionId: string
}) =>
  publierPourActivite('PROGRAMME', s.organisationId, s.activiteId, {
    id: s.id,
    perimetreId: s.perimetreId,
    editionId: s.editionId,
  })

builder.queryFields(t => ({
  lieux: t.prismaField({
    type: [LieuRef],
    authScopes: { connecte: true },
    description: 'Les lieux d’une activité, dans leur ordre d’affichage.',
    args: {
      activiteId: t.arg.id({ required: true }),
      inclureArchives: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      const activiteId = await ctx.exigerActivite(args.activiteId)
      return prisma.lieu.findMany({
        ...query,
        where: {
          organisationId: ctx.organisation!.id,
          activiteId,
          ...(args.inclureArchives ? {} : { archivedAt: null }),
        },
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      })
    },
  }),

  programme: t.field({
    type: [SequenceRef],
    authScopes: { connecte: true },
    description:
      'Les séquences d’une période, par début. Les filtres gardent un périmètre, ou les séquences où la personne connectée est placée.',
    args: {
      editionId: t.arg.id({ required: true }),
      perimetreId: t.arg.id(),
      mesSequences: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (_root, args, ctx) => {
      const edition = await ctx.exigerEdition(args.editionId)
      const sequences = await prisma.sequence.findMany({
        where: {
          organisationId: ctx.organisation!.id,
          editionId: edition.id,
          ...(args.perimetreId
            ? { perimetreId: String(args.perimetreId) }
            : {}),
          ...(args.mesSequences
            ? { places: { some: { userId: ctx.personne!.id } } }
            : {}),
        },
        include: SEQUENCE_CHARGEE,
        orderBy: [{ debut: 'asc' }, { id: 'asc' }],
        take: SEQUENCES_MAX,
      })
      return Promise.all(sequences.map(s => lireSequence(ctx, s)))
    },
  }),
}))

builder.mutationFields(t => {
  const champsSequence = {
    titre: t.arg.string({ required: true }),
    jour: t.arg({ type: 'Date', required: true }),
    jourFin: t.arg({
      type: 'Date',
      description: 'Pour une séquence qui passe minuit. Sans valeur : le jour.',
    }),
    heureDebut: t.arg.string({ required: true }),
    heureFin: t.arg.string({ required: true }),
    lieuId: t.arg.id(),
    description: t.arg.string(),
    places: t.arg({ type: [PlaceInput] }),
  }

  /** Les champs écrits en base, et les places vérifiées. */
  const champsValides = async (
    ctx: AppContext,
    args: {
      titre: string
      jour: Date
      jourFin?: Date | null
      heureDebut: string
      heureFin: string
      lieuId?: string | number | null
      description?: string | null
      places?:
        | readonly {
            personneId?: string | number | null
            benevoleId?: string | number | null
            role: RolePlace
          }[]
        | null
    },
    lieu: { editionId: string; activiteId: string; lieuActuel?: string | null }
  ) => {
    const edition = await prisma.edition.findUniqueOrThrow({
      where: { id: lieu.editionId },
      select: { debut: true, fin: true },
    })
    const horaire = horaireValide(
      {
        jour: jourISO(args.jour),
        jourFin: args.jourFin ? jourISO(args.jourFin) : null,
        heureDebut: args.heureDebut,
        heureFin: args.heureFin,
      },
      { debut: jourISO(edition.debut), fin: jourISO(edition.fin) },
      ctx.organisation!.fuseauHoraire
    )
    dureeValide(horaire.debut, horaire.fin)
    return {
      champs: {
        titre: texteRequis(args.titre, 'Le titre', TITRE_REUNION_MAX),
        description: texteFacultatif(
          args.description,
          'La description',
          DESCRIPTION_REUNION_MAX
        ),
        debut: horaire.debut,
        fin: horaire.fin,
        lieuId: await lieuValide(
          args.lieuId,
          lieu.activiteId,
          lieu.lieuActuel ?? null
        ),
      },
      places: await placesValides(
        ctx.organisation!.id,
        lieu.activiteId,
        args.places
      ),
    }
  }

  return {
    creerLieu: t.prismaField({
      type: LieuRef,
      authScopes: { gestion: true },
      args: {
        activiteId: t.arg.id({ required: true }),
        nom: t.arg.string({ required: true }),
        description: t.arg.string(),
        ordre: t.arg.int({ defaultValue: 0 }),
      },
      resolve: async (query, _root, args, ctx) => {
        const activiteId = await ctx.exigerActivite(args.activiteId)
        await ctx.exigerAdminDe(activiteId)
        // Le comptage et la création se font sous le verrou de l'organisation.
        const cree = await sousVerrouOrganisation(
          ctx.organisation!.id,
          async tx => {
            const nombre = await tx.lieu.count({ where: { activiteId } })
            if (nombre >= 200) {
              throw erreurSaisie('Une activité compte 200 lieux au plus.')
            }
            return tx.lieu.create({
              ...query,
              data: {
                organisationId: ctx.organisation!.id,
                activiteId,
                nom: texteRequis(args.nom, 'Le nom', NOM_LIEU_MAX),
                description: texteFacultatif(
                  args.description,
                  'La description',
                  2000
                ),
                ordre: args.ordre ?? 0,
              },
            })
          }
        )
        publierPourActivite('PROGRAMME', ctx.organisation!.id, activiteId)
        return cree
      },
    }),

    modifierLieu: t.prismaField({
      type: LieuRef,
      authScopes: { gestion: true },
      args: {
        id: t.arg.id({ required: true }),
        nom: t.arg.string({ required: true }),
        description: t.arg.string(),
        ordre: t.arg.int({ required: true }),
        archive: t.arg.boolean({ required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const lieu = await prisma.lieu.findFirst({
          where: { id: String(args.id), organisationId: ctx.organisation!.id },
        })
        if (lieu === null) throw accesRefuse()
        await ctx.exigerActivite(lieu.activiteId)
        await ctx.exigerAdminDe(lieu.activiteId)
        const modifie = await prisma.lieu.update({
          ...query,
          where: { id: lieu.id },
          data: {
            nom: texteRequis(args.nom, 'Le nom', NOM_LIEU_MAX),
            description: texteFacultatif(
              args.description,
              'La description',
              2000
            ),
            ordre: args.ordre,
            archivedAt: args.archive ? (lieu.archivedAt ?? new Date()) : null,
          },
        })
        publierPourActivite('PROGRAMME', ctx.organisation!.id, lieu.activiteId)
        return modifie
      },
    }),

    creerSequence: t.field({
      type: SequenceRef,
      authScopes: { connecte: true },
      args: {
        editionId: t.arg.id({ required: true }),
        perimetreId: t.arg.id({
          description: 'Le périmètre ; sans valeur, toute l’activité.',
        }),
        ...champsSequence,
      },
      resolve: async (_root, args, ctx) => {
        const lieu = {
          editionId: String(args.editionId),
          perimetreId: args.perimetreId ? String(args.perimetreId) : null,
        }
        const { activiteId } = await exigerEcritureReunion(ctx, lieu)
        const valides = await champsValides(ctx, args, {
          editionId: lieu.editionId,
          activiteId,
        })
        // Le comptage et la création se font sous le verrou de l'organisation :
        // deux créations simultanées ne dépassent pas le plafond.
        const creee = await sousVerrouOrganisation(
          ctx.organisation!.id,
          async tx => {
            const nombre = await tx.sequence.count({
              where: { editionId: lieu.editionId },
            })
            if (nombre >= SEQUENCES_MAX) {
              throw erreurSaisie(
                `Une période compte ${SEQUENCES_MAX} séquences au plus.`
              )
            }
            return tx.sequence.create({
              data: {
                organisationId: ctx.organisation!.id,
                activiteId,
                ...lieu,
                ...valides.champs,
                creeParId: ctx.personne!.id,
                places: {
                  create: placesDatees(valides.places, [], new Date()),
                },
              },
              include: SEQUENCE_CHARGEE,
            })
          }
        )
        signal(creee)
        return lireSequence(ctx, creee)
      },
    }),

    modifierSequence: t.field({
      type: SequenceRef,
      authScopes: { connecte: true },
      description:
        'Change une séquence et ses places. Les places reçues remplacent les places actuelles.',
      args: {
        id: t.arg.id({ required: true }),
        ...champsSequence,
        versionAttendue: t.arg.int({
          required: true,
          description:
            'La version lue : le serveur refuse d’écraser une modification faite depuis.',
        }),
      },
      resolve: async (_root, args, ctx) => {
        const actuelle = await sequenceVisible(ctx, String(args.id))
        const { activiteId } = await exigerEcritureReunion(ctx, actuelle)
        const valides = await champsValides(ctx, args, {
          editionId: actuelle.editionId,
          activiteId,
          lieuActuel: actuelle.lieuId,
        })
        await prisma.$transaction(async tx => {
          const { count } = await tx.sequence.updateMany({
            where: { id: actuelle.id, version: args.versionAttendue },
            data: { ...valides.champs, version: { increment: 1 } },
          })
          if (count === 0) {
            // La version relue après l'échec : celle qu'une autre écriture a
            // validée, et non celle lue avant la transaction.
            const { version, updatedAt } = await tx.sequence.findUniqueOrThrow({
              where: { id: actuelle.id },
              select: { version: true, updatedAt: true },
            })
            throw conflitDeVersion(
              'Cette séquence a été modifiée depuis votre lecture.',
              { versionCourante: version, modifieeLe: updatedAt.toISOString() }
            )
          }
          // Une place gardée garde sa date de confirmation : une place à
          // confirmer le reste (ADR 0041).
          const actuelles = await tx.placeSequence.findMany({
            where: { sequenceId: actuelle.id },
            select: { userId: true, benevoleId: true, confirmeeLe: true },
          })
          await tx.placeSequence.deleteMany({
            where: { sequenceId: actuelle.id },
          })
          await tx.placeSequence.createMany({
            data: placesDatees(valides.places, actuelles, new Date()).map(
              p => ({ sequenceId: actuelle.id, ...p })
            ),
          })
        })
        signal(actuelle)
        return lireSequence(ctx, await sequenceVisible(ctx, actuelle.id))
      },
    }),

    supprimerSequence: t.boolean({
      authScopes: { connecte: true },
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_root, args, ctx) => {
        const sequence = await sequenceVisible(ctx, String(args.id))
        await exigerEcritureReunion(ctx, sequence)
        await prisma.sequence.delete({ where: { id: sequence.id } })
        signal(sequence)
        return true
      },
    }),
  }
})
