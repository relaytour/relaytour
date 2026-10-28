import {
  ChoixSondage,
  prisma,
  StatutSondage,
  type Prisma,
} from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { jourISO } from '../lib/agenda.ts'
import { accesAuPerimetre, peutModifierPerimetre } from '../lib/droits.ts'
import { accesRefuse, conflitDeVersion, erreurSaisie } from '../lib/erreurs.ts'
import { publierNotification, publierPourActivite } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'
import { pousser } from '../lib/push-file.ts'
import {
  DESCRIPTION_REUNION_MAX,
  exigerEcritureReunion,
  personnesConvoquees,
  TITRE_REUNION_MAX,
} from '../lib/reunions.ts'
import { texteFacultatif, texteRequis } from '../lib/saisie.ts'
import { creneauxValides, type CreneauSaisi } from '../lib/sondages.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'
import { CibleConvocationEnum } from './reunions.ts'
import { i18n } from '../lib/langue.ts'
import { exigerModule } from '../lib/modules.ts'

// Sondages de dates (ADR 0037). Un sondage propose des créneaux pour une réunion à
// venir, dans l'agenda global d'une activité ou dans l'agenda d'un périmètre. Les
// personnes visées répondent à chaque créneau : oui, si besoin, non. Une personne
// qui écrit dans l'agenda clôt le sondage sur un créneau, puis crée la réunion.

const StatutSondageEnum = builder.enumType(StatutSondage, {
  name: 'StatutSondage',
})
const ChoixSondageEnum = builder.enumType(ChoixSondage, {
  name: 'ChoixSondage',
})

const SONDAGE_CHARGE = {
  perimetre: true,
  creneaux: {
    orderBy: { ordre: 'asc' },
    include: {
      reponses: { select: { userId: true, choix: true } },
    },
  },
  participants: {
    select: { userId: true, user: { select: { name: true } } },
  },
} satisfies Prisma.SondageInclude

type SondageCharge = Prisma.SondageGetPayload<{
  include: typeof SONDAGE_CHARGE
}>

interface SondageLu {
  sondage: SondageCharge
  peutModifier: boolean
  moi: string
}

interface ReponseLue {
  personneId: string
  nom: string
  choix: ChoixSondage
}

interface CreneauLu {
  id: string
  jour: string
  heureDebut: string | null
  heureFin: string | null
  retenu: boolean
  oui: number
  siBesoin: number
  non: number
  monChoix: ChoixSondage | null
  reponses: ReponseLue[]
}

const ReponseLueRef = builder
  .objectRef<ReponseLue>('ReponseSondage')
  .implement({
    fields: t => ({
      personneId: t.exposeID('personneId'),
      nom: t.exposeString('nom'),
      choix: t.expose('choix', { type: ChoixSondageEnum }),
    }),
  })

const CreneauLuRef = builder.objectRef<CreneauLu>('CreneauSondage').implement({
  fields: t => ({
    id: t.exposeID('id'),
    jour: t.exposeString('jour', { description: 'AAAA-MM-JJ.' }),
    heureDebut: t.exposeString('heureDebut', {
      nullable: true,
      description: 'HH:MM, dans le fuseau de l’organisation.',
    }),
    heureFin: t.exposeString('heureFin', { nullable: true }),
    retenu: t.exposeBoolean('retenu'),
    oui: t.exposeInt('oui'),
    siBesoin: t.exposeInt('siBesoin'),
    non: t.exposeInt('non'),
    monChoix: t.expose('monChoix', {
      type: ChoixSondageEnum,
      nullable: true,
    }),
    reponses: t.field({
      type: [ReponseLueRef],
      description:
        'Les réponses nominatives, lues par les personnes visées et par celles qui écrivent dans l’agenda.',
      resolve: c => c.reponses,
    }),
  }),
})

export const SondageRef = builder.objectRef<SondageLu>('Sondage').implement({
  description:
    'Un sondage de dates de l’agenda global d’une activité, ou de l’agenda d’un périmètre.',
  fields: t => ({
    id: t.id({ resolve: l => l.sondage.id }),
    editionId: t.id({ resolve: l => l.sondage.editionId }),
    titre: t.string({ resolve: l => l.sondage.titre }),
    description: t.string({
      nullable: true,
      resolve: l => l.sondage.description,
    }),
    statut: t.field({
      type: StatutSondageEnum,
      resolve: l => l.sondage.statut,
    }),
    cible: t.field({
      type: CibleConvocationEnum,
      resolve: l => l.sondage.cible,
    }),
    version: t.int({ resolve: l => l.sondage.version }),
    perimetre: t.field({
      type: PerimetreRef,
      nullable: true,
      resolve: l => l.sondage.perimetre,
    }),
    reunionId: t.id({
      nullable: true,
      description: 'La réunion créée depuis le sondage clos.',
      resolve: l => l.sondage.reunionId,
    }),
    peutModifier: t.boolean({ resolve: l => l.peutModifier }),
    estParticipant: t.boolean({
      resolve: l => l.sondage.participants.some(p => p.userId === l.moi),
    }),
    aRepondu: t.boolean({
      description: 'Vrai si la personne connectée a répondu à chaque créneau.',
      resolve: l =>
        l.sondage.creneaux.every(c => c.reponses.some(r => r.userId === l.moi)),
    }),
    participantIds: t.idList({
      nullable: true,
      description:
        'Les personnes visées, pour les personnes qui écrivent dans l’agenda : la réunion créée depuis le sondage les convoque. Nul sinon.',
      resolve: l =>
        l.peutModifier ? l.sondage.participants.map(p => p.userId) : null,
    }),
    participants: t.int({
      description: 'Le nombre de personnes visées.',
      resolve: l => l.sondage.participants.length,
    }),
    repondants: t.int({
      description:
        'Le nombre de personnes qui ont répondu à au moins un créneau.',
      resolve: l =>
        new Set(l.sondage.creneaux.flatMap(c => c.reponses.map(r => r.userId)))
          .size,
    }),
    creneaux: t.field({
      type: [CreneauLuRef],
      resolve: l => {
        const noms = new Map(
          l.sondage.participants.map(p => [p.userId, p.user.name])
        )
        return l.sondage.creneaux.map(c => {
          const compte = (choix: ChoixSondage) =>
            c.reponses.filter(r => r.choix === choix).length
          return {
            id: c.id,
            jour: jourISO(c.jour),
            heureDebut: c.heureDebut,
            heureFin: c.heureFin,
            retenu: l.sondage.creneauRetenuId === c.id,
            oui: compte('OUI'),
            siBesoin: compte('SI_BESOIN'),
            non: compte('NON'),
            monChoix: c.reponses.find(r => r.userId === l.moi)?.choix ?? null,
            // Les réponses nominatives se lisent par les personnes visées et
            // par les personnes qui écrivent dans l'agenda ; les autres lecteurs
            // ne voient que les décomptes.
            reponses: !(
              l.peutModifier ||
              l.sondage.participants.some(p => p.userId === l.moi)
            )
              ? []
              : c.reponses
                  .filter(r => noms.has(r.userId))
                  .map(r => ({
                    personneId: r.userId,
                    nom: noms.get(r.userId)!,
                    choix: r.choix,
                  }))
                  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
          }
        })
      },
    }),
  }),
})

/** Vrai si la personne écrit dans l'agenda du sondage. */
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

/**
 * Vrai si la personne lit le sondage : un sondage global s'ouvre à toute personne
 * qui voit l'activité ; un sondage de périmètre, aux personnes qui lisent ce
 * périmètre et aux personnes visées. La consultation ne l'ouvre pas.
 */
async function sondageLisible(
  ctx: AppContext,
  s: SondageCharge
): Promise<boolean> {
  if (s.perimetreId === null) return true
  if (s.participants.some(p => p.userId === ctx.personne!.id)) return true
  return (
    (await accesAuPerimetre(ctx, {
      id: s.perimetreId,
      organisationId: s.organisationId,
      activiteId: s.activiteId,
    })) === 'COMPLET'
  )
}

async function lireSondage(
  ctx: AppContext,
  sondage: SondageCharge
): Promise<SondageLu> {
  return {
    sondage,
    peutModifier: await peutEcrire(ctx, sondage),
    moi: ctx.personne!.id,
  }
}

/** Le sondage si la personne le lit, sinon un refus identique à un inconnu. */
async function sondageVisible(
  ctx: AppContext,
  id: string
): Promise<SondageCharge> {
  const sondage = await prisma.sondage.findFirst({
    where: { id, organisationId: ctx.organisation!.id },
    include: SONDAGE_CHARGE,
  })
  if (sondage === null) throw accesRefuse()
  const edition = await ctx.exigerEdition(sondage.editionId)
  await exigerModule(edition.activiteId, 'AGENDA')
  if (!(await sondageLisible(ctx, sondage))) throw accesRefuse()
  return sondage
}

/** Le sondage, si la personne écrit dans son agenda et qu'il est encore ouvert. */
async function sondageModifiable(ctx: AppContext, id: string) {
  const sondage = await sondageVisible(ctx, id)
  await exigerEcritureReunion(ctx, sondage)
  if (sondage.statut !== 'OUVERT') {
    throw erreurSaisie(i18n._('Ce sondage est clos : il ne change plus.'))
  }
  return sondage
}

async function periodeDe(editionId: string) {
  const edition = await prisma.edition.findUniqueOrThrow({
    where: { id: editionId },
    select: { debut: true, fin: true },
  })
  return { debut: jourISO(edition.debut), fin: jourISO(edition.fin) }
}

const lireCreneaux = (
  creneaux: readonly {
    id?: string | number | null
    jour: Date
    heureDebut?: string | null
    heureFin?: string | null
  }[]
): CreneauSaisi[] =>
  creneaux.map(c => ({
    id: c.id === null || c.id === undefined ? null : String(c.id),
    jour: jourISO(c.jour),
    heureDebut: c.heureDebut,
    heureFin: c.heureFin,
  }))

const CreneauInput = builder.inputType('CreneauSondageInput', {
  fields: t => ({
    id: t.id({ description: 'Un créneau existant, pour une modification.' }),
    jour: t.field({ type: 'Date', required: true }),
    heureDebut: t.string({ description: 'HH:MM, ou rien.' }),
    heureFin: t.string({ description: 'HH:MM, ou rien.' }),
  }),
})

const ReponseInput = builder.inputType('ReponseSondageInput', {
  fields: t => ({
    creneauId: t.id({ required: true }),
    choix: t.field({ type: ChoixSondageEnum, required: true }),
  }),
})

/** Prévient les personnes visées par un nouveau sondage, sauf son auteur. */
async function notifierSondage(
  sondage: {
    id: string
    organisationId: string
    activiteId: string
    perimetreId: string | null
    editionId: string
  },
  destinataires: string[],
  acteurId: string
): Promise<void> {
  try {
    for (const userId of destinataires.filter(id => id !== acteurId)) {
      const creee = await prisma.notification.create({
        data: {
          organisationId: sondage.organisationId,
          userId,
          type: 'SONDAGE_OUVERT',
          acteurId,
          sondageId: sondage.id,
          activiteId: sondage.activiteId,
          perimetreId: sondage.perimetreId,
          editionId: sondage.editionId,
        },
        select: { id: true },
      })
      publierNotification(sondage.organisationId, userId)
      await pousser(creee.id)
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type: 'SONDAGE_OUVERT',
        message: (erreur as Error).message,
      },
      'Une notification de sondage n’a pas pu être créée.'
    )
  }
}

const signal = (s: {
  id: string
  organisationId: string
  activiteId: string
  perimetreId: string | null
  editionId: string
}) =>
  publierPourActivite('AGENDA', s.organisationId, s.activiteId, {
    id: s.id,
    perimetreId: s.perimetreId,
    editionId: s.editionId,
  })

builder.queryFields(t => ({
  sondages: t.field({
    type: [SondageRef],
    authScopes: { connecte: true },
    description:
      'Les sondages de dates d’une période que la personne lit, les plus récents d’abord.',
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const edition = await ctx.exigerEdition(args.editionId)
      await exigerModule(edition.activiteId, 'AGENDA')
      const sondages = await prisma.sondage.findMany({
        where: { organisationId: ctx.organisation!.id, editionId: edition.id },
        include: SONDAGE_CHARGE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 200,
      })
      const lus: SondageLu[] = []
      for (const s of sondages) {
        if (await sondageLisible(ctx, s)) lus.push(await lireSondage(ctx, s))
      }
      return lus
    },
  }),
  sondage: t.field({
    type: SondageRef,
    authScopes: { connecte: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) =>
      lireSondage(ctx, await sondageVisible(ctx, String(args.id))),
  }),
}))

builder.mutationFields(t => ({
  creerSondage: t.field({
    type: SondageRef,
    authScopes: { connecte: true },
    args: {
      editionId: t.arg.id({ required: true }),
      perimetreId: t.arg.id({
        description: 'Le périmètre ; sans valeur, l’agenda global.',
      }),
      titre: t.arg.string({ required: true }),
      description: t.arg.string(),
      creneaux: t.arg({ type: [CreneauInput], required: true }),
      cible: t.arg({ type: CibleConvocationEnum, required: true }),
      personneIds: t.arg.idList(),
    },
    resolve: async (_root, args, ctx) => {
      const lieu = {
        editionId: String(args.editionId),
        perimetreId: args.perimetreId ? String(args.perimetreId) : null,
      }
      const { activiteId } = await exigerEcritureReunion(ctx, lieu)
      const creneaux = creneauxValides(
        lireCreneaux(args.creneaux),
        await periodeDe(lieu.editionId)
      )
      const participants = await personnesConvoquees(ctx.organisation!.id, {
        cible: args.cible,
        personneIds: args.personneIds,
        ...lieu,
        activiteId,
      })
      const cree = await prisma.sondage.create({
        data: {
          organisationId: ctx.organisation!.id,
          activiteId,
          ...lieu,
          titre: texteRequis(args.titre, i18n._('Le titre'), TITRE_REUNION_MAX),
          description: texteFacultatif(
            args.description,
            i18n._('La description'),
            DESCRIPTION_REUNION_MAX
          ),
          cible: args.cible,
          creeParId: ctx.personne!.id,
          creneaux: {
            create: creneaux.map(c => ({
              jour: new Date(`${c.jour}T00:00:00.000Z`),
              heureDebut: c.heureDebut,
              heureFin: c.heureFin,
              ordre: c.ordre,
            })),
          },
          participants: {
            create: participants.map(userId => ({ userId })),
          },
        },
        include: SONDAGE_CHARGE,
      })
      signal(cree)
      await notifierSondage(cree, participants, ctx.personne!.id)
      return lireSondage(ctx, cree)
    },
  }),

  modifierSondage: t.field({
    type: SondageRef,
    authScopes: { connecte: true },
    description:
      'Change le titre, la description et les créneaux d’un sondage ouvert. Un créneau retiré perd ses réponses.',
    args: {
      id: t.arg.id({ required: true }),
      titre: t.arg.string({ required: true }),
      description: t.arg.string(),
      creneaux: t.arg({ type: [CreneauInput], required: true }),
      versionAttendue: t.arg.int({
        required: true,
        description:
          'La version lue : le serveur refuse d’écraser une modification faite depuis.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const actuel = await sondageModifiable(ctx, String(args.id))
      const creneaux = creneauxValides(
        lireCreneaux(args.creneaux),
        await periodeDe(actuel.editionId)
      )
      const existants = new Set(actuel.creneaux.map(c => c.id))
      if (creneaux.some(c => c.id !== null && !existants.has(c.id))) {
        throw accesRefuse()
      }
      const gardes = new Set(creneaux.map(c => c.id).filter(Boolean))
      const anciens = new Map(actuel.creneaux.map(c => [c.id, c]))
      await prisma.$transaction(async tx => {
        // Le verrou du sondage ordonne la modification, les réponses et la
        // clôture : aucune ne s'appuie sur un état dépassé.
        await tx.$queryRaw`SELECT id FROM Sondage WHERE id = ${actuel.id} FOR UPDATE`
        const { count } = await tx.sondage.updateMany({
          where: {
            id: actuel.id,
            statut: 'OUVERT',
            version: args.versionAttendue,
          },
          data: {
            version: { increment: 1 },
            titre: texteRequis(
              args.titre,
              i18n._('Le titre'),
              TITRE_REUNION_MAX
            ),
            description: texteFacultatif(
              args.description,
              i18n._('La description'),
              DESCRIPTION_REUNION_MAX
            ),
          },
        })
        if (count === 0) {
          const { version } = await tx.sondage.findUniqueOrThrow({
            where: { id: actuel.id },
            select: { version: true },
          })
          throw conflitDeVersion(
            i18n._('Ce sondage a été modifié depuis votre lecture.'),
            { versionCourante: version }
          )
        }
        await tx.creneauSondage.deleteMany({
          where: {
            sondageId: actuel.id,
            id: { notIn: [...gardes] as string[] },
          },
        })
        for (const c of creneaux) {
          const donnees = {
            jour: new Date(`${c.jour}T00:00:00.000Z`),
            heureDebut: c.heureDebut,
            heureFin: c.heureFin,
            ordre: c.ordre,
          }
          if (c.id === null) {
            await tx.creneauSondage.create({
              data: { sondageId: actuel.id, ...donnees },
            })
            continue
          }
          // Un créneau qui change de jour ou d'heure est une nouvelle
          // proposition : ses réponses ne valent plus. Un créneau seulement
          // déplacé dans la liste les garde.
          const ancien = anciens.get(c.id)!
          if (
            jourISO(ancien.jour) !== c.jour ||
            ancien.heureDebut !== c.heureDebut ||
            ancien.heureFin !== c.heureFin
          ) {
            await tx.reponseSondage.deleteMany({ where: { creneauId: c.id } })
          }
          await tx.creneauSondage.update({
            where: { id: c.id },
            data: donnees,
          })
        }
      })
      signal(actuel)
      return lireSondage(ctx, await sondageVisible(ctx, actuel.id))
    },
  }),

  repondreSondage: t.field({
    type: SondageRef,
    authScopes: { connecte: true },
    description:
      'Les réponses de la personne connectée, créneau par créneau. Un créneau absent garde sa réponse.',
    args: {
      id: t.arg.id({ required: true }),
      reponses: t.arg({ type: [ReponseInput], required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const sondage = await sondageVisible(ctx, String(args.id))
      const moi = ctx.personne!.id
      if (!sondage.participants.some(p => p.userId === moi)) throw accesRefuse()
      const edition = await ctx.exigerEdition(sondage.editionId)
      if (edition.statut === 'ARCHIVEE') {
        throw erreurSaisie(
          i18n._(
            'Cette période est archivée : son agenda est en lecture seule.'
          )
        )
      }
      await prisma.$transaction(async tx => {
        // Sous le verrou du sondage, le statut et les créneaux relus sont ceux
        // qu'une clôture ou une modification simultanée a validés.
        await tx.$queryRaw`SELECT id FROM Sondage WHERE id = ${sondage.id} FOR UPDATE`
        const actuel = await tx.sondage.findUniqueOrThrow({
          where: { id: sondage.id },
          select: { statut: true, creneaux: { select: { id: true } } },
        })
        if (actuel.statut !== 'OUVERT') {
          throw erreurSaisie(i18n._('Ce sondage est clos.'))
        }
        const creneaux = new Set(actuel.creneaux.map(c => c.id))
        if (args.reponses.some(r => !creneaux.has(String(r.creneauId)))) {
          throw accesRefuse()
        }
        for (const r of args.reponses) {
          await tx.reponseSondage.upsert({
            where: {
              creneauId_userId: { creneauId: String(r.creneauId), userId: moi },
            },
            update: { choix: r.choix },
            create: {
              creneauId: String(r.creneauId),
              userId: moi,
              choix: r.choix,
            },
          })
        }
      })
      signal(sondage)
      return lireSondage(ctx, await sondageVisible(ctx, sondage.id))
    },
  }),

  cloreSondage: t.field({
    type: SondageRef,
    authScopes: { connecte: true },
    description:
      'Clôt un sondage sur le créneau retenu. La réunion se crée ensuite depuis ce créneau.',
    args: {
      id: t.arg.id({ required: true }),
      creneauId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const sondage = await sondageModifiable(ctx, String(args.id))
      const creneauId = String(args.creneauId)
      if (!sondage.creneaux.some(c => c.id === creneauId)) throw accesRefuse()
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM Sondage WHERE id = ${sondage.id} FOR UPDATE`
        // La clôture vaut pour la version lue, encore ouverte, et pour un
        // créneau qui existe encore : une clôture ou une modification
        // simultanée l'emporte, et celle-ci reçoit un conflit.
        const existe = await tx.creneauSondage.count({
          where: { id: creneauId, sondageId: sondage.id },
        })
        const { count } =
          existe === 0
            ? { count: 0 }
            : await tx.sondage.updateMany({
                where: {
                  id: sondage.id,
                  statut: 'OUVERT',
                  version: sondage.version,
                },
                data: {
                  statut: 'CLOS',
                  creneauRetenuId: creneauId,
                  closLe: new Date(),
                  version: { increment: 1 },
                },
              })
        if (count === 0) {
          const { version } = await tx.sondage.findUniqueOrThrow({
            where: { id: sondage.id },
            select: { version: true },
          })
          throw conflitDeVersion(
            i18n._('Ce sondage a été modifié ou clos depuis votre lecture.'),
            { versionCourante: version }
          )
        }
      })
      signal(sondage)
      return lireSondage(ctx, await sondageVisible(ctx, sondage.id))
    },
  }),

  supprimerSondage: t.boolean({
    authScopes: { connecte: true },
    description:
      'Supprime un sondage et ses réponses. Une réunion déjà créée reste dans l’agenda.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const sondage = await sondageVisible(ctx, String(args.id))
      await exigerEcritureReunion(ctx, sondage)
      await prisma.sondage.delete({ where: { id: sondage.id } })
      signal(sondage)
      return true
    },
  }),
}))
