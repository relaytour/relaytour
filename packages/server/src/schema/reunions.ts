import {
  CibleConvocation,
  prisma,
  ReponseConvocation,
  StatutReunion,
  type Prisma,
} from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { jourISO } from '../lib/agenda.ts'
import {
  envoyerAnnulations,
  envoyerConvocations,
  notifierReunion,
} from '../lib/convocations.ts'
import { peutModifierPerimetre } from '../lib/droits.ts'
import { accesRefuse, conflitDeVersion, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { heureLocale } from '../lib/heures.ts'
import {
  DESCRIPTION_REUNION_MAX,
  detailOuvert,
  exigerEcritureReunion,
  horaireValide,
  LIEU_MAX,
  lienVisioValide,
  personnesConvoquees,
  tachesLieesValides,
  TITRE_REUNION_MAX,
} from '../lib/reunions.ts'
import { texteFacultatif, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'

// Réunions de l'agenda (ADR 0037). Une réunion appartient à l'agenda global d'une
// activité ou à l'agenda d'un périmètre, pour une période. Elle ne se supprime
// pas : elle s'annule. En consultation, une réunion de périmètre ne montre que son
// titre et son horaire.

const StatutReunionEnum = builder.enumType(StatutReunion, {
  name: 'StatutReunion',
})
export const CibleConvocationEnum = builder.enumType(CibleConvocation, {
  name: 'CibleConvocation',
  description:
    'Les personnes convoquées : tout le périmètre, toute l’équipe de l’activité, ou des personnes choisies dans l’équipe.',
})
export const ReponseConvocationEnum = builder.enumType(ReponseConvocation, {
  name: 'ReponseConvocation',
})

/** Ce qu'une lecture charge d'une réunion. */
export const REUNION_CHARGEE = {
  perimetre: true,
  taches: {
    select: {
      tache: { select: { id: true, titre: true, perimetreId: true } },
    },
    orderBy: { id: 'asc' },
  },
  convocations: {
    select: {
      userId: true,
      reponse: true,
      envoyeeLe: true,
      user: { select: { name: true } },
    },
  },
} satisfies Prisma.ReunionInclude

export type ReunionChargee = Prisma.ReunionGetPayload<{
  include: typeof REUNION_CHARGEE
}>

interface ReunionLue {
  reunion: ReunionChargee
  detail: boolean
  peutModifier: boolean
  moi: string
  fuseau: string
}

interface ConvocationLue {
  personneId: string
  nom: string
  reponse: ReponseConvocation | null
  envoyee: boolean
}

interface Reponses {
  presentes: number
  absentes: number
  peutEtre: number
  sansReponse: number
}

const ConvocationLueRef = builder
  .objectRef<ConvocationLue>('ConvocationLue')
  .implement({
    fields: t => ({
      personneId: t.exposeID('personneId'),
      nom: t.exposeString('nom'),
      reponse: t.expose('reponse', {
        type: ReponseConvocationEnum,
        nullable: true,
      }),
      envoyee: t.exposeBoolean('envoyee', {
        description: 'Vrai quand le mail de convocation est parti.',
      }),
    }),
  })

const ReponsesRef = builder.objectRef<Reponses>('ReponsesReunion').implement({
  fields: t => ({
    presentes: t.exposeInt('presentes'),
    absentes: t.exposeInt('absentes'),
    peutEtre: t.exposeInt('peutEtre'),
    sansReponse: t.exposeInt('sansReponse'),
  }),
})

const TacheLieeRef = builder
  .objectRef<{ id: string; titre: string; perimetreId: string }>(
    'TacheLieeReunion'
  )
  .implement({
    fields: t => ({
      id: t.exposeID('id'),
      titre: t.exposeString('titre'),
      perimetreId: t.exposeID('perimetreId'),
    }),
  })

export const ReunionRef = builder.objectRef<ReunionLue>('Reunion').implement({
  description:
    'Une réunion de l’agenda global d’une activité, ou de l’agenda d’un périmètre.',
  fields: t => ({
    id: t.id({ resolve: l => l.reunion.id }),
    editionId: t.id({ resolve: l => l.reunion.editionId }),
    titre: t.string({ resolve: l => l.reunion.titre }),
    debut: t.field({ type: 'DateTime', resolve: l => l.reunion.debut }),
    fin: t.field({ type: 'DateTime', resolve: l => l.reunion.fin }),
    jour: t.string({
      description: 'Le jour de la réunion, dans le fuseau de l’organisation.',
      resolve: l => heureLocale(l.reunion.debut, l.fuseau).jour,
    }),
    heureDebut: t.string({
      description: 'HH:MM, dans le fuseau de l’organisation.',
      resolve: l => heureLocale(l.reunion.debut, l.fuseau).heure,
    }),
    heureFin: t.string({
      description: 'HH:MM, dans le fuseau de l’organisation.',
      resolve: l => heureLocale(l.reunion.fin, l.fuseau).heure,
    }),
    statut: t.field({
      type: StatutReunionEnum,
      resolve: l => l.reunion.statut,
    }),
    cible: t.field({
      type: CibleConvocationEnum,
      nullable: true,
      resolve: l => l.reunion.cible,
    }),
    version: t.int({ resolve: l => l.reunion.version }),
    perimetre: t.field({
      type: PerimetreRef,
      nullable: true,
      description: 'Le périmètre de la réunion ; nul pour l’agenda global.',
      resolve: l => l.reunion.perimetre,
    }),
    detailMasque: t.boolean({
      description:
        'Vrai en consultation : le lieu, le lien de visio, la description et les tâches restent masqués.',
      resolve: l => !l.detail,
    }),
    lieu: t.string({
      nullable: true,
      resolve: l => (l.detail ? l.reunion.lieu : null),
    }),
    lienVisio: t.string({
      nullable: true,
      resolve: l => (l.detail ? l.reunion.lienVisio : null),
    }),
    description: t.string({
      nullable: true,
      resolve: l => (l.detail ? l.reunion.description : null),
    }),
    taches: t.field({
      type: [TacheLieeRef],
      resolve: l => (l.detail ? l.reunion.taches.map(t => t.tache) : []),
    }),
    peutModifier: t.boolean({ resolve: l => l.peutModifier }),
    estConvoquee: t.boolean({
      description: 'Vrai si la personne connectée est convoquée.',
      resolve: l => l.reunion.convocations.some(c => c.userId === l.moi),
    }),
    maReponse: t.field({
      type: ReponseConvocationEnum,
      nullable: true,
      resolve: l =>
        l.reunion.convocations.find(c => c.userId === l.moi)?.reponse ?? null,
    }),
    reponses: t.field({
      type: ReponsesRef,
      nullable: true,
      description: 'Les réponses des personnes convoquées, en nombre.',
      resolve: l => {
        if (!l.detail) return null
        const compte = (r: ReponseConvocation | null) =>
          l.reunion.convocations.filter(c => c.reponse === r).length
        return {
          presentes: compte('PRESENT'),
          absentes: compte('ABSENT'),
          peutEtre: compte('PEUT_ETRE'),
          sansReponse: compte(null),
        }
      },
    }),
    convocations: t.field({
      type: [ConvocationLueRef],
      nullable: true,
      description:
        'Les personnes convoquées et leur réponse, pour les personnes qui écrivent dans cet agenda. Nul sinon.',
      resolve: l =>
        l.peutModifier
          ? l.reunion.convocations
              .map(c => ({
                personneId: c.userId,
                nom: c.user.name,
                reponse: c.reponse,
                envoyee: c.envoyeeLe !== null,
              }))
              .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
          : null,
    }),
  }),
})

/** Vrai si la personne écrit dans l'agenda de cette réunion. */
async function peutEcrire(
  ctx: AppContext,
  reunion: { editionId: string; activiteId: string; perimetreId: string | null }
): Promise<boolean> {
  if (reunion.perimetreId !== null) {
    return peutModifierPerimetre(ctx, reunion.perimetreId, reunion.editionId)
  }
  const edition = await ctx.exigerEdition(reunion.editionId)
  return (
    edition.statut !== 'ARCHIVEE' && (await ctx.estAdminDe(reunion.activiteId))
  )
}

/** La lecture d'une réunion par la personne du contexte. */
export async function lireReunion(
  ctx: AppContext,
  reunion: ReunionChargee
): Promise<ReunionLue> {
  const moi = ctx.personne!.id
  const convoquee = reunion.convocations.some(c => c.userId === moi)
  const ecrit = reunion.statut === 'PREVUE' && (await peutEcrire(ctx, reunion))
  return {
    reunion,
    detail: ecrit || (await detailOuvert(ctx, reunion, convoquee)),
    peutModifier: ecrit,
    moi,
    fuseau: ctx.organisation!.fuseauHoraire,
  }
}

/** La réunion si la personne voit son activité, sinon un refus. */
async function reunionVisible(
  ctx: AppContext,
  id: string
): Promise<ReunionChargee> {
  const reunion = await prisma.reunion.findFirst({
    where: { id, organisationId: ctx.organisation!.id },
    include: REUNION_CHARGEE,
  })
  if (reunion === null) throw accesRefuse()
  await ctx.exigerEdition(reunion.editionId)
  return reunion
}

/** Une période compte 500 réunions au plus dans une lecture. */
const REUNIONS_LUES_MAX = 500

builder.queryFields(t => ({
  reunions: t.field({
    type: [ReunionRef],
    authScopes: { connecte: true },
    description:
      'Les réunions d’une période, globales et de périmètre, de la plus proche à la plus lointaine.',
    args: {
      editionId: t.arg.id({ required: true }),
      perimetreId: t.arg.id({
        description: 'Un périmètre seulement. Sans valeur : toutes.',
      }),
      globales: t.arg.boolean({
        description: 'Les réunions de l’agenda global seulement.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const edition = await ctx.exigerEdition(args.editionId)
      const reunions = await prisma.reunion.findMany({
        where: {
          organisationId: ctx.organisation!.id,
          editionId: edition.id,
          ...(args.globales
            ? { perimetreId: null }
            : args.perimetreId
              ? { perimetreId: String(args.perimetreId) }
              : {}),
        },
        include: REUNION_CHARGEE,
        orderBy: [{ debut: 'asc' }, { id: 'asc' }],
        take: REUNIONS_LUES_MAX,
      })
      return Promise.all(reunions.map(r => lireReunion(ctx, r)))
    },
  }),
  reunion: t.field({
    type: ReunionRef,
    authScopes: { connecte: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) =>
      lireReunion(ctx, await reunionVisible(ctx, String(args.id))),
  }),
}))

/** Les champs saisis d'une réunion, communs à la création et à la modification. */
interface Saisie {
  titre: string
  jour: Date
  heureDebut: string
  heureFin: string
  lieu?: string | null
  lienVisio?: string | null
  description?: string | null
  tacheIds?: readonly (string | number)[] | null
  cible?: CibleConvocation | null
  personneIds?: readonly (string | number)[] | null
}

/** Les champs écrits en base, et les personnes à convoquer. */
async function champsValides(
  ctx: AppContext,
  saisie: Saisie,
  lieu: { editionId: string; perimetreId: string | null; activiteId: string }
) {
  const edition = await prisma.edition.findUniqueOrThrow({
    where: { id: lieu.editionId },
    select: { debut: true, fin: true },
  })
  const horaire = horaireValide(
    {
      jour: jourISO(saisie.jour),
      heureDebut: saisie.heureDebut,
      heureFin: saisie.heureFin,
    },
    { debut: jourISO(edition.debut), fin: jourISO(edition.fin) },
    ctx.organisation!.fuseauHoraire
  )
  const cible = saisie.cible ?? null
  return {
    champs: {
      titre: texteRequis(saisie.titre, 'Le titre', TITRE_REUNION_MAX),
      debut: horaire.debut,
      fin: horaire.fin,
      lieu: texteFacultatif(saisie.lieu, 'Le lieu', LIEU_MAX),
      lienVisio: lienVisioValide(saisie.lienVisio),
      description: texteFacultatif(
        saisie.description,
        'La description',
        DESCRIPTION_REUNION_MAX
      ),
      cible,
    },
    tacheIds: await tachesLieesValides(saisie.tacheIds, lieu),
    convoquees: await personnesConvoquees(ctx.organisation!.id, {
      cible,
      personneIds: saisie.personneIds,
      ...lieu,
    }),
  }
}

/** Les champs d'une réunion qui changent sa version iCalendar. */
const CHAMPS_MAJEURS = ['titre', 'debut', 'fin', 'lieu', 'lienVisio'] as const

builder.mutationFields(t => {
  const champsSaisis = {
    titre: t.arg.string({ required: true }),
    jour: t.arg({ type: 'Date', required: true }),
    heureDebut: t.arg.string({
      required: true,
      description: 'HH:MM, dans le fuseau de l’organisation.',
    }),
    heureFin: t.arg.string({
      required: true,
      description: 'HH:MM, dans le fuseau de l’organisation.',
    }),
    lieu: t.arg.string(),
    lienVisio: t.arg.string(),
    description: t.arg.string(),
    tacheIds: t.arg.idList(),
    cible: t.arg({ type: CibleConvocationEnum }),
    personneIds: t.arg.idList({
      description: 'Les personnes convoquées, pour la cible CHOIX.',
    }),
  }
  return {
    creerReunion: t.field({
      type: ReunionRef,
      authScopes: { connecte: true },
      args: {
        editionId: t.arg.id({ required: true }),
        perimetreId: t.arg.id({
          description: 'Le périmètre ; sans valeur, l’agenda global.',
        }),
        ...champsSaisis,
      },
      resolve: async (_root, args, ctx) => {
        const lieu = {
          editionId: String(args.editionId),
          perimetreId: args.perimetreId ? String(args.perimetreId) : null,
        }
        const { activiteId } = await exigerEcritureReunion(ctx, lieu)
        const valides = await champsValides(ctx, args, { ...lieu, activiteId })
        const creee = await prisma.reunion.create({
          data: {
            organisationId: ctx.organisation!.id,
            activiteId,
            ...lieu,
            ...valides.champs,
            creeParId: ctx.personne!.id,
            taches: {
              create: valides.tacheIds.map(tacheId => ({ tacheId })),
            },
            convocations: {
              create: valides.convoquees.map(userId => ({ userId })),
            },
          },
          include: REUNION_CHARGEE,
        })
        publierPourActivite('AGENDA', ctx.organisation!.id, activiteId, {
          id: creee.id,
          perimetreId: creee.perimetreId,
          editionId: creee.editionId,
        })
        envoyerConvocations(creee, valides.convoquees)
        await notifierReunion(
          'REUNION_CONVOQUEE',
          creee,
          valides.convoquees,
          ctx.personne!.id
        )
        return lireReunion(ctx, creee)
      },
    }),

    modifierReunion: t.field({
      type: ReunionRef,
      authScopes: { connecte: true },
      args: {
        id: t.arg.id({ required: true }),
        ...champsSaisis,
        versionAttendue: t.arg.int(),
      },
      resolve: async (_root, args, ctx) => {
        const actuelle = await reunionVisible(ctx, String(args.id))
        if (actuelle.statut === 'ANNULEE') {
          throw erreurSaisie('Cette réunion est annulée : elle ne change plus.')
        }
        const lieu = {
          editionId: actuelle.editionId,
          perimetreId: actuelle.perimetreId,
        }
        const { activiteId } = await exigerEcritureReunion(ctx, lieu)
        const valides = await champsValides(ctx, args, { ...lieu, activiteId })
        const majeur = CHAMPS_MAJEURS.some(champ => {
          const avant = actuelle[champ]
          const apres = valides.champs[champ]
          return avant instanceof Date && apres instanceof Date
            ? avant.getTime() !== apres.getTime()
            : avant !== apres
        })
        const avant = new Set(actuelle.convocations.map(c => c.userId))
        const apres = new Set(valides.convoquees)
        const versionAttendue = args.versionAttendue ?? null
        await prisma.$transaction(async tx => {
          const { count } = await tx.reunion.updateMany({
            where: {
              id: actuelle.id,
              statut: 'PREVUE',
              ...(versionAttendue === null ? {} : { version: versionAttendue }),
            },
            data: {
              ...valides.champs,
              version: { increment: 1 },
              ...(majeur ? { sequence: { increment: 1 } } : {}),
            },
          })
          if (count === 0) {
            const { version, updatedAt } = await tx.reunion.findUniqueOrThrow({
              where: { id: actuelle.id },
              select: { version: true, updatedAt: true },
            })
            throw conflitDeVersion(
              'Cette réunion a été modifiée depuis votre lecture.',
              { versionCourante: version, modifieeLe: updatedAt.toISOString() }
            )
          }
          await tx.reunionTache.deleteMany({
            where: {
              reunionId: actuelle.id,
              tacheId: { notIn: valides.tacheIds },
            },
          })
          await tx.reunionTache.createMany({
            data: valides.tacheIds.map(tacheId => ({
              reunionId: actuelle.id,
              tacheId,
            })),
            skipDuplicates: true,
          })
          await tx.convocationReunion.deleteMany({
            where: {
              reunionId: actuelle.id,
              userId: { in: [...avant].filter(id => !apres.has(id)) },
            },
          })
          await tx.convocationReunion.createMany({
            data: [...apres]
              .filter(id => !avant.has(id))
              .map(userId => ({ reunionId: actuelle.id, userId })),
            skipDuplicates: true,
          })
        })
        publierPourActivite('AGENDA', ctx.organisation!.id, activiteId, {
          id: actuelle.id,
          perimetreId: actuelle.perimetreId,
          editionId: actuelle.editionId,
        })
        const modifiee = await reunionVisible(ctx, actuelle.id)
        const ajoutees = [...apres].filter(id => !avant.has(id))
        const maintenues = [...apres].filter(id => avant.has(id))
        // Une personne retirée reçoit l'annulation si elle avait reçu la convocation.
        const retirees = actuelle.convocations
          .filter(c => !apres.has(c.userId) && c.envoyeeLe !== null)
          .map(c => c.userId)
        envoyerConvocations(modifiee, majeur ? [...apres] : ajoutees)
        envoyerAnnulations(modifiee, retirees)
        await notifierReunion(
          'REUNION_CONVOQUEE',
          modifiee,
          ajoutees,
          ctx.personne!.id
        )
        if (majeur) {
          await notifierReunion(
            'REUNION_MODIFIEE',
            modifiee,
            maintenues,
            ctx.personne!.id
          )
        }
        return lireReunion(ctx, modifiee)
      },
    }),

    annulerReunion: t.field({
      type: ReunionRef,
      authScopes: { connecte: true },
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_root, args, ctx) => {
        const actuelle = await reunionVisible(ctx, String(args.id))
        const { activiteId } = await exigerEcritureReunion(ctx, {
          editionId: actuelle.editionId,
          perimetreId: actuelle.perimetreId,
        })
        if (actuelle.statut === 'ANNULEE') return lireReunion(ctx, actuelle)
        await prisma.reunion.updateMany({
          where: { id: actuelle.id, statut: 'PREVUE' },
          data: {
            statut: 'ANNULEE',
            annuleeLe: new Date(),
            version: { increment: 1 },
            sequence: { increment: 1 },
          },
        })
        publierPourActivite('AGENDA', ctx.organisation!.id, activiteId, {
          id: actuelle.id,
          perimetreId: actuelle.perimetreId,
          editionId: actuelle.editionId,
        })
        const annulee = await reunionVisible(ctx, actuelle.id)
        envoyerAnnulations(
          annulee,
          actuelle.convocations
            .filter(c => c.envoyeeLe !== null)
            .map(c => c.userId)
        )
        await notifierReunion(
          'REUNION_ANNULEE',
          annulee,
          actuelle.convocations.map(c => c.userId),
          ctx.personne!.id
        )
        return lireReunion(ctx, annulee)
      },
    }),

    repondreConvocation: t.field({
      type: ReunionRef,
      authScopes: { connecte: true },
      description:
        'La réponse de la personne connectée à sa convocation : présente, absente ou peut-être.',
      args: {
        reunionId: t.arg.id({ required: true }),
        reponse: t.arg({ type: ReponseConvocationEnum, required: true }),
      },
      resolve: async (_root, args, ctx) => {
        const reunion = await reunionVisible(ctx, String(args.reunionId))
        // Une personne qui n'est pas convoquée ne répond pas : refus identique.
        if (!reunion.convocations.some(c => c.userId === ctx.personne!.id)) {
          throw accesRefuse()
        }
        if (reunion.statut === 'ANNULEE') {
          throw erreurSaisie('Cette réunion est annulée.')
        }
        await prisma.convocationReunion.updateMany({
          where: { reunionId: reunion.id, userId: ctx.personne!.id },
          data: { reponse: args.reponse, reponduLe: new Date() },
        })
        publierPourActivite(
          'AGENDA',
          ctx.organisation!.id,
          reunion.activiteId,
          {
            id: reunion.id,
            perimetreId: reunion.perimetreId,
            editionId: reunion.editionId,
          }
        )
        return lireReunion(ctx, await reunionVisible(ctx, reunion.id))
      },
    }),
  }
})
