import { prisma, RolePlace, type Prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { jourISO } from '../lib/agenda.ts'
import {
  besoinValide,
  CONSIGNES_MAX,
  etatPlace,
  type EtatPlace,
} from '../lib/appels.ts'
import { accesRefuse, conflitDeVersion, erreurSaisie } from '../lib/erreurs.ts'
import {
  annoncerPlace,
  fichesJoignables,
  signalerPlacesModifiees,
} from '../lib/espace-benevole.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import { heureLocale } from '../lib/heures.ts'
import {
  dureeValide,
  NOM_LIEU_MAX,
  peutEcrireSequence,
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

const EtatPlaceEnum = builder.enumType('EtatPlace', {
  description:
    'CONFIRMEE : la place est tenue. A_CONFIRMER : la personne n’a pas encore confirmé. NON_CONFIRMEE : toujours à confirmer sept jours après sa création, ou la veille de la séquence (ADR 0041).',
  values: ['CONFIRMEE', 'A_CONFIRMER', 'NON_CONFIRMEE'] as const,
})

export const LieuRef = builder.prismaObject('Lieu', {
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('nom'),
    description: t.exposeString('description', { nullable: true }),
    ordre: t.exposeInt('ordre'),
    archive: t.boolean({ resolve: l => l.archivedAt !== null }),
  }),
})

export const SEQUENCE_CHARGEE = {
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

export type SequenceChargee = Prisma.SequenceGetPayload<{
  include: typeof SEQUENCE_CHARGEE
}>

interface SequenceLue {
  sequence: SequenceChargee
  peutModifier: boolean
  moi: string
  fuseau: string
  maintenant: Date
}

interface PlaceLue {
  id: string
  role: RolePlace
  personneId: string | null
  benevoleId: string | null
  nom: string
  estMoi: boolean
  etat: EtatPlace
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
    etat: t.field({ type: EtatPlaceEnum, resolve: p => p.etat }),
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
      besoinBenevoles: t.int({
        nullable: true,
        description:
          'Le nombre de renforts recherchés ; null si la séquence ne cherche personne (ADR 0041).',
        resolve: l => l.sequence.besoinBenevoles,
      }),
      consignesBenevoles: t.string({
        nullable: true,
        description: 'Le texte public pour les bénévoles.',
        resolve: l => l.sequence.consignesBenevoles,
      }),
      renforts: t.int({
        description:
          'Les places en renfort, confirmées ou non : elles comptent dans le besoin.',
        resolve: l =>
          l.sequence.places.filter(p => p.role === 'RENFORT').length,
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
            etat: etatPlace(p, l.sequence.debut, l.maintenant, l.fuseau),
          })),
      }),
    }),
  })

export async function lireSequence(
  ctx: AppContext,
  sequence: SequenceChargee
): Promise<SequenceLue> {
  return {
    sequence,
    peutModifier: await peutEcrireSequence(ctx, sequence),
    moi: ctx.personne!.id,
    fuseau: ctx.organisation!.fuseauHoraire,
    maintenant: new Date(),
  }
}

/** La séquence si la personne voit son activité, sinon un refus. */
export async function sequenceVisible(
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

/** Les fiches bénévoles d'une liste de places. */
const fichesDe = (places: readonly { benevoleId: string | null }[]) =>
  places.flatMap(p => (p.benevoleId ? [p.benevoleId] : []))

/** Annonce à chaque fiche sa place nouvelle dans une séquence (ADR 0041). */
async function annoncerPlaces(
  benevoleIds: readonly string[],
  sequence: { organisationId: string; activiteId: string }
) {
  for (const benevoleId of benevoleIds) {
    await annoncerPlace(prisma, {
      benevoleId,
      organisationId: sequence.organisationId,
      activiteId: sequence.activiteId,
    })
  }
}

export const signal = (s: {
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
    besoinBenevoles: t.arg.int({
      description: 'Le nombre de renforts recherchés ; 0 ou rien : aucun.',
    }),
    consignesBenevoles: t.arg.string(),
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
      besoinBenevoles?: number | null
      consignesBenevoles?: string | null
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
        // Un champ absent garde sa valeur : un client antérieur à l'ADR 0041
        // ne l'efface pas.
        ...(args.besoinBenevoles === undefined
          ? {}
          : { besoinBenevoles: besoinValide(args.besoinBenevoles) }),
        ...(args.consignesBenevoles === undefined
          ? {}
          : {
              consignesBenevoles: texteFacultatif(
                args.consignesBenevoles,
                'Les consignes',
                CONSIGNES_MAX
              ),
            }),
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
        const joignables = await fichesJoignables(
          prisma,
          fichesDe(valides.places)
        )
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
                  create: placesDatees(
                    valides.places,
                    [],
                    new Date(),
                    joignables
                  ),
                },
              },
              include: SEQUENCE_CHARGEE,
            })
          }
        )
        await annoncerPlaces(fichesDe(valides.places), creee)
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
        const joignables = await fichesJoignables(
          prisma,
          fichesDe(valides.places)
        )
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
            data: placesDatees(
              valides.places,
              actuelles,
              new Date(),
              joignables
            ).map(p => ({ sequenceId: actuelle.id, ...p })),
          })
        })
        // Une fiche ajoutée reçoit son lien, ou le mail de ses places. Une fiche
        // retirée reçoit le mail de ses places, comme toutes les fiches gardées
        // quand l'horaire ou le lieu change (ADR 0041).
        const avant = fichesDe(actuelle.places)
        const apres = fichesDe(valides.places)
        const deplacee =
          actuelle.debut.getTime() !== valides.champs.debut.getTime() ||
          actuelle.fin.getTime() !== valides.champs.fin.getTime() ||
          actuelle.lieuId !== valides.champs.lieuId
        await annoncerPlaces(
          apres.filter(id => !avant.includes(id)),
          actuelle
        )
        await signalerPlacesModifiees(
          prisma,
          [
            ...avant.filter(id => !apres.includes(id)),
            ...(deplacee ? apres.filter(id => avant.includes(id)) : []),
          ],
          actuelle
        )
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
        await signalerPlacesModifiees(
          prisma,
          fichesDe(sequence.places),
          sequence
        )
        signal(sequence)
        return true
      },
    }),
  }
})
