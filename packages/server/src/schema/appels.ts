import {
  PorteeAppel,
  prisma,
  StatutCandidature,
  StatutChoix,
  type Prisma,
} from '@relaytour/database'

import type { AppContext } from '../context.ts'
import {
  accepterSurSequence,
  APPELS_OUVERTS_MAX,
  CHOIX_EN_ATTENTE,
  datesAppelValides,
  jetonAppel,
  etatAppel,
  gereLAppel,
  INTRODUCTION_MAX,
  joursDeLaPeriode,
  NOM_APPEL_MAX,
  perimetresEcrits,
  recalculerCandidature,
} from '../lib/appels.ts'
import { accesRefuse, conflitDeVersion, erreurSaisie } from '../lib/erreurs.ts'
import { annoncerPlace } from '../lib/espace-benevole.ts'
import { empreinte, jetonDe, nouveauSel } from '../lib/liens.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { heureLocale } from '../lib/heures.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import { configurationOrganisation } from '../lib/organisation.ts'
import { peutEcrireSequence } from '../lib/programme.ts'
import { texteFacultatif, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'
import { i18n } from '../lib/langue.ts'
import { exigerModule } from '../lib/modules.ts'

// Appels à bénévoles et candidatures (ADR 0041). Un admin de l'activité ouvre un
// appel de toute portée ; une personne qui écrit dans un périmètre ouvre un appel
// pour son périmètre ou pour une de ses séquences. Une candidature se lit par les
// personnes qui peuvent la traiter, avec ses coordonnées : une personne qui écrit
// dans un périmètre n'en voit que les choix de ses périmètres.

const PorteeAppelEnum = builder.enumType(PorteeAppel, { name: 'PorteeAppel' })
const StatutCandidatureEnum = builder.enumType(StatutCandidature, {
  name: 'StatutCandidature',
})
const StatutChoixEnum = builder.enumType(StatutChoix, { name: 'StatutChoix' })
const EtatAppelEnum = builder.enumType('EtatAppel', {
  values: ['A_VENIR', 'OUVERT', 'FERME'] as const,
})

// ── Appels ───────────────────────────────────────────────────────────────────

const APPEL_CHARGE = {
  perimetre: true,
  sequence: { select: { id: true, titre: true } },
  _count: { select: { candidatures: { where: { statut: 'EN_ATTENTE' } } } },
} satisfies Prisma.AppelBenevolesInclude

type AppelCharge = Prisma.AppelBenevolesGetPayload<{
  include: typeof APPEL_CHARGE
}>

interface AppelLu {
  appel: AppelCharge
  peutModifier: boolean
  maintenant: Date
}

export const AppelRef = builder.objectRef<AppelLu>('AppelBenevoles').implement({
  description:
    'Un appel à bénévoles : une adresse publique ouverte entre deux dates (ADR 0041).',
  fields: t => ({
    id: t.id({ resolve: l => l.appel.id }),
    editionId: t.id({ resolve: l => l.appel.editionId }),
    nom: t.string({ resolve: l => l.appel.nom }),
    portee: t.field({ type: PorteeAppelEnum, resolve: l => l.appel.portee }),
    perimetre: t.field({
      type: PerimetreRef,
      nullable: true,
      resolve: l => l.appel.perimetre,
    }),
    sequenceId: t.id({ nullable: true, resolve: l => l.appel.sequenceId }),
    sansAdresse: t.boolean({
      description:
        'Vrai pour un appel d’import (ADR 0042) : il n’a pas d’adresse publique et reste fermé.',
      resolve: l => l.appel.sansAdresse,
    }),
    sourceImport: t.string({
      nullable: true,
      description: 'La source d’un appel d’import.',
      resolve: l => l.appel.sourceImport,
    }),
    sequenceTitre: t.string({
      nullable: true,
      resolve: l => l.appel.sequence?.titre ?? null,
    }),
    introduction: t.string({
      nullable: true,
      resolve: l => l.appel.introduction,
    }),
    ouvertLe: t.field({ type: 'DateTime', resolve: l => l.appel.ouvertLe }),
    fermeLe: t.field({ type: 'DateTime', resolve: l => l.appel.fermeLe }),
    etat: t.field({
      type: EtatAppelEnum,
      resolve: l => etatAppel(l.appel, l.maintenant),
    }),
    finAdresse: t.string({
      description:
        'Les derniers caractères du jeton, pour reconnaître l’adresse d’un coup d’œil.',
      resolve: l => l.appel.fin,
    }),
    adresse: t.string({
      nullable: true,
      description:
        'L’adresse publique, recalculée à la demande pour les personnes qui gèrent l’appel ; null sinon.',
      resolve: async l => {
        if (!l.peutModifier || l.appel.sansAdresse) return null
        const { origineOrga } = await configurationOrganisation(
          l.appel.organisationId
        )
        return adresseAppel(origineOrga, await jetonAppel(prisma, l.appel.id))
      },
    }),
    candidaturesEnAttente: t.int({
      resolve: l => l.appel._count.candidatures,
    }),
    version: t.int({ resolve: l => l.appel.version }),
    peutModifier: t.boolean({ resolve: l => l.peutModifier }),
  }),
})

const AppelEtAdresseRef = builder
  .objectRef<{ appel: AppelLu; adresse: string }>('AppelEtAdresse')
  .implement({
    fields: t => ({
      appel: t.field({ type: AppelRef, resolve: r => r.appel }),
      adresse: t.exposeString('adresse', {
        description: 'L’adresse publique de l’appel.',
      }),
    }),
  })

/** L'adresse publique d'un appel. */
export function adresseAppel(origine: string, jeton: string): string {
  return `${origine.replace(/\/$/, '')}/benevoles/${jeton}`
}

/** L'édition, et les périmètres où la personne écrit. Refuse sans aucun. */
async function editionEcrite(ctx: AppContext, editionId: string | number) {
  const edition = await ctx.exigerEdition(editionId)
  await exigerModule(edition.activiteId, 'BENEVOLES')
  const ecrits = await perimetresEcrits(ctx, edition)
  if (ecrits !== 'TOUS' && ecrits.size === 0) throw accesRefuse()
  return { edition, ecrits }
}

/** L'appel, si la personne le gère. */
async function appelGere(ctx: AppContext, id: string): Promise<AppelCharge> {
  const appel = await prisma.appelBenevoles.findFirst({
    where: { id, organisationId: ctx.organisation!.id },
    include: APPEL_CHARGE,
  })
  if (appel === null) throw accesRefuse()
  const edition = await ctx.exigerEdition(appel.editionId)
  await exigerModule(edition.activiteId, 'BENEVOLES')
  if (!gereLAppel(await perimetresEcrits(ctx, edition), appel)) {
    throw accesRefuse()
  }
  return appel
}

const lireAppel = (appel: AppelCharge, peutModifier = true): AppelLu => ({
  appel,
  peutModifier,
  maintenant: new Date(),
})

/** Refuse un appel de plus quand la période en compte déjà trop d'ouverts. */
async function exigerPlacePourUnAppel(
  tx: Prisma.TransactionClient,
  editionId: string,
  maintenant: Date,
  sauf?: string
) {
  const ouverts = await tx.appelBenevoles.count({
    where: {
      editionId,
      fermeManuellementLe: null,
      fermeLe: { gt: maintenant },
      // Un appel de séquence dont la séquence a disparu est fermé.
      NOT: { portee: 'SEQUENCE', sequenceId: null },
      ...(sauf ? { id: { not: sauf } } : {}),
    },
  })
  if (ouverts >= APPELS_OUVERTS_MAX) {
    throw erreurSaisie(
      i18n._('Une période compte {max} appels ouverts au plus.', {
        max: APPELS_OUVERTS_MAX,
      })
    )
  }
}

const signalAppel = (a: {
  organisationId: string
  activiteId: string
  editionId: string
  id?: string
}) =>
  publierPourActivite('CANDIDATURE', a.organisationId, a.activiteId, {
    id: a.id,
    editionId: a.editionId,
  })

// ── Candidatures ─────────────────────────────────────────────────────────────

const CANDIDATURE_CHARGEE = {
  appel: {
    select: { id: true, nom: true, portee: true, perimetreId: true },
  },
  plages: { orderBy: { debut: 'asc' } },
  choix: {
    orderBy: { sequence: { debut: 'asc' } },
    include: {
      sequence: {
        include: {
          perimetre: true,
          lieu: { select: { nom: true } },
        },
      },
    },
  },
} satisfies Prisma.CandidatureInclude

type CandidatureChargee = Prisma.CandidatureGetPayload<{
  include: typeof CANDIDATURE_CHARGEE
}>

type ChoixCharge = CandidatureChargee['choix'][number]

interface ChoixLu {
  choix: ChoixCharge
  peutTraiter: boolean
  fuseau: string
}

interface CandidatureLue {
  candidature: CandidatureChargee
  choix: ChoixLu[]
  peutEcarter: boolean
  fuseau: string
}

export interface PlageLue {
  debut: Date
  fin: Date
  fuseau: string
}

export const PlageRef = builder
  .objectRef<PlageLue>('PlageDisponibilite')
  .implement({
    description:
      'Un intervalle où une personne peut aider, dans le fuseau de l’organisation.',
    fields: t => ({
      debut: t.field({ type: 'DateTime', resolve: p => p.debut }),
      fin: t.field({ type: 'DateTime', resolve: p => p.fin }),
      jour: t.string({ resolve: p => heureLocale(p.debut, p.fuseau).jour }),
      heureDebut: t.string({
        resolve: p => heureLocale(p.debut, p.fuseau).heure,
      }),
      jourFin: t.string({ resolve: p => heureLocale(p.fin, p.fuseau).jour }),
      heureFin: t.string({ resolve: p => heureLocale(p.fin, p.fuseau).heure }),
    }),
  })

const ChoixRef = builder.objectRef<ChoixLu>('ChoixCandidature').implement({
  description: 'Une séquence choisie dans une candidature.',
  fields: t => ({
    id: t.id({ resolve: c => c.choix.id }),
    statut: t.field({ type: StatutChoixEnum, resolve: c => c.choix.statut }),
    sequenceId: t.id({ resolve: c => c.choix.sequenceId }),
    titre: t.string({ resolve: c => c.choix.sequence.titre }),
    debut: t.field({ type: 'DateTime', resolve: c => c.choix.sequence.debut }),
    fin: t.field({ type: 'DateTime', resolve: c => c.choix.sequence.fin }),
    jour: t.string({
      resolve: c => heureLocale(c.choix.sequence.debut, c.fuseau).jour,
    }),
    heureDebut: t.string({
      resolve: c => heureLocale(c.choix.sequence.debut, c.fuseau).heure,
    }),
    jourFin: t.string({
      resolve: c => heureLocale(c.choix.sequence.fin, c.fuseau).jour,
    }),
    heureFin: t.string({
      resolve: c => heureLocale(c.choix.sequence.fin, c.fuseau).heure,
    }),
    lieu: t.string({
      nullable: true,
      resolve: c => c.choix.sequence.lieu?.nom ?? null,
    }),
    perimetre: t.field({
      type: PerimetreRef,
      nullable: true,
      resolve: c => c.choix.sequence.perimetre,
    }),
    traiteLe: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: c => c.choix.traiteLe,
    }),
    peutTraiter: t.boolean({ resolve: c => c.peutTraiter }),
  }),
})

const CandidatureRef = builder
  .objectRef<CandidatureLue>('Candidature')
  .implement({
    description:
      'Le dépôt d’une personne sur un appel à bénévoles (ADR 0041). Il se lit par les personnes qui peuvent le traiter.',
    fields: t => ({
      id: t.id({ resolve: l => l.candidature.id }),
      statut: t.field({
        type: StatutCandidatureEnum,
        resolve: l => l.candidature.statut,
      }),
      nom: t.string({ resolve: l => l.candidature.nom }),
      courriel: t.string({
        nullable: true,
        resolve: l => l.candidature.courriel,
      }),
      telephone: t.string({
        nullable: true,
        resolve: l => l.candidature.telephone,
      }),
      message: t.string({
        nullable: true,
        resolve: l => l.candidature.message,
      }),
      precisionsDisponibilite: t.string({
        nullable: true,
        resolve: l => l.candidature.precisionsDisponibilite,
      }),
      origine: t.string({
        description:
          'PUBLIC : déposée sur la page d’un appel. IMPORT : venue d’un import de liste (ADR 0042).',
        resolve: l => l.candidature.origine,
      }),
      sourceImport: t.string({
        nullable: true,
        resolve: l => l.candidature.sourceImport,
      }),
      ouAilleurs: t.boolean({
        description:
          'Vrai : la personne aide là où il manque du monde, sans choisir de séquence.',
        resolve: l => l.candidature.ouAilleurs,
      }),
      accordLe: t.field({
        type: 'DateTime',
        resolve: l => l.candidature.accordLe,
      }),
      deposeeLe: t.field({
        type: 'DateTime',
        resolve: l => l.candidature.createdAt,
      }),
      appelId: t.id({ resolve: l => l.candidature.appel.id }),
      appelNom: t.string({ resolve: l => l.candidature.appel.nom }),
      benevoleId: t.id({
        nullable: true,
        resolve: l => l.candidature.benevoleId,
      }),
      // Une candidature choisit 30 séquences et porte 20 plages au plus ; la file
      // en compte quelques-unes en moyenne. Le multiplicateur borne le coût d'une
      // requête sans refuser la file de revue.
      choix: t.field({
        type: [ChoixRef],
        complexity: { field: 1, multiplier: 3 },
        resolve: l => l.choix,
      }),
      plages: t.field({
        type: [PlageRef],
        complexity: { field: 1, multiplier: 2 },
        resolve: l =>
          l.candidature.plages.map(p => ({
            debut: p.debut,
            fin: p.fin,
            fuseau: l.fuseau,
          })),
      }),
      peutEcarter: t.boolean({
        description:
          'Vrai si la personne gère l’appel : elle refuse alors toute la candidature.',
        resolve: l => l.peutEcarter,
      }),
    }),
  })

/**
 * Les candidatures d'une période que la personne lit : toutes pour un admin de
 * l'activité ; sinon celles qui choisissent une séquence de ses périmètres, et
 * celles « là où il manque du monde » des appels qu'elle voit.
 */
function candidaturesLisibles(
  ecrits: 'TOUS' | Set<string>
): Prisma.CandidatureWhereInput {
  if (ecrits === 'TOUS') return {}
  const perimetres = [...ecrits]
  return {
    OR: [
      { choix: { some: { sequence: { perimetreId: { in: perimetres } } } } },
      { ouAilleurs: true, appel: { portee: 'PERIODE' } },
      { ouAilleurs: true, appel: { perimetreId: { in: perimetres } } },
    ],
  }
}

function lireCandidature(
  ctx: AppContext,
  ecrits: 'TOUS' | Set<string>,
  candidature: CandidatureChargee
): CandidatureLue {
  const fuseau = ctx.organisation!.fuseauHoraire
  const ecrit = (perimetreId: string | null) =>
    ecrits === 'TOUS' || (perimetreId !== null && ecrits.has(perimetreId))
  return {
    candidature,
    // Une personne qui écrit dans un périmètre ne voit que ses choix.
    choix: candidature.choix
      .filter(c => ecrit(c.sequence.perimetreId))
      .map(choix => ({
        choix,
        peutTraiter: ecrit(choix.sequence.perimetreId),
        fuseau,
      })),
    peutEcarter: gereLAppel(ecrits, candidature.appel),
    fuseau,
  }
}

/** La candidature, si la personne la lit. */
async function candidatureLisible(
  ctx: AppContext,
  id: string
): Promise<{ candidature: CandidatureChargee; ecrits: 'TOUS' | Set<string> }> {
  const brute = await prisma.candidature.findFirst({
    where: { id, organisationId: ctx.organisation!.id },
    select: { editionId: true },
  })
  if (brute === null) throw accesRefuse()
  const { ecrits } = await editionEcrite(ctx, brute.editionId)
  const candidature = await prisma.candidature.findFirst({
    where: { id, ...candidaturesLisibles(ecrits) },
    include: CANDIDATURE_CHARGEE,
  })
  if (candidature === null) throw accesRefuse()
  return { candidature, ecrits }
}

const signalCandidature = (c: {
  organisationId: string
  activiteId: string
  editionId: string
  id: string
}) => signalAppel(c)

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  appelsBenevoles: t.field({
    type: [AppelRef],
    authScopes: { connecte: true },
    description:
      'Les appels à bénévoles d’une période que la personne voit : tous pour un admin de l’activité ; ceux de la période et de ses périmètres sinon.',
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { edition, ecrits } = await editionEcrite(ctx, args.editionId)
      const appels = await prisma.appelBenevoles.findMany({
        where: {
          organisationId: ctx.organisation!.id,
          editionId: edition.id,
          ...(ecrits === 'TOUS'
            ? {}
            : {
                OR: [
                  { portee: 'PERIODE' },
                  { perimetreId: { in: [...ecrits] } },
                ],
              }),
        },
        include: APPEL_CHARGE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      })
      return appels.map(a => lireAppel(a, gereLAppel(ecrits, a)))
    },
  }),

  candidatures: t.field({
    type: [CandidatureRef],
    authScopes: { connecte: true },
    description:
      'Les candidatures d’une période que la personne peut traiter, des plus anciennes aux plus récentes.',
    args: {
      editionId: t.arg.id({ required: true }),
      appelId: t.arg.id(),
      statut: t.arg({
        type: StatutCandidatureEnum,
        defaultValue: 'EN_ATTENTE',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const { edition, ecrits } = await editionEcrite(ctx, args.editionId)
      const candidatures = await prisma.candidature.findMany({
        where: {
          organisationId: ctx.organisation!.id,
          editionId: edition.id,
          statut: args.statut ?? 'EN_ATTENTE',
          ...(args.appelId ? { appelId: String(args.appelId) } : {}),
          ...candidaturesLisibles(ecrits),
        },
        include: CANDIDATURE_CHARGEE,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 2000,
      })
      return candidatures.map(c => lireCandidature(ctx, ecrits, c))
    },
  }),
}))

// ── Écriture ─────────────────────────────────────────────────────────────────

builder.mutationFields(t => ({
  creerAppelBenevoles: t.field({
    type: AppelEtAdresseRef,
    authScopes: { connecte: true },
    description: 'Ouvre un appel à bénévoles, et rend son adresse publique.',
    args: {
      editionId: t.arg.id({ required: true }),
      portee: t.arg({ type: PorteeAppelEnum, required: true }),
      perimetreId: t.arg.id({ description: 'Pour la portée PERIMETRE.' }),
      sequenceId: t.arg.id({ description: 'Pour la portée SEQUENCE.' }),
      nom: t.arg.string({ required: true }),
      introduction: t.arg.string(),
      ouvertLe: t.arg({ type: 'DateTime', required: true }),
      fermeLe: t.arg({ type: 'DateTime', required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { edition, ecrits } = await editionEcrite(ctx, args.editionId)
      const organisationId = ctx.organisation!.id
      let perimetreId: string | null = null
      let sequenceId: string | null = null
      if (args.portee === 'PERIMETRE') {
        if (!args.perimetreId)
          throw erreurSaisie(i18n._('Choisissez un périmètre.'))
        const perimetre = await prisma.perimetre.findFirst({
          where: {
            id: String(args.perimetreId),
            activiteId: edition.activiteId,
            archivedAt: null,
          },
          select: { id: true },
        })
        if (perimetre === null) throw accesRefuse()
        perimetreId = perimetre.id
      } else if (args.portee === 'SEQUENCE') {
        if (!args.sequenceId)
          throw erreurSaisie(i18n._('Choisissez une séquence.'))
        const sequence = await prisma.sequence.findFirst({
          where: { id: String(args.sequenceId), editionId: edition.id },
          select: { id: true, perimetreId: true },
        })
        if (sequence === null) throw accesRefuse()
        sequenceId = sequence.id
        perimetreId = sequence.perimetreId
      }
      if (!gereLAppel(ecrits, { portee: args.portee, perimetreId })) {
        throw accesRefuse()
      }
      datesAppelValides(
        args.ouvertLe,
        args.fermeLe,
        (await joursDeLaPeriode(prisma, edition.id)).fin,
        ctx.organisation!.fuseauHoraire
      )
      const sel = nouveauSel()
      const jeton = await jetonDe('appel', sel)
      const maintenant = new Date()
      const appel = await sousVerrouOrganisation(organisationId, async tx => {
        await exigerPlacePourUnAppel(tx, edition.id, maintenant)
        return tx.appelBenevoles.create({
          data: {
            organisationId,
            activiteId: edition.activiteId,
            editionId: edition.id,
            portee: args.portee,
            perimetreId,
            sequenceId,
            nom: texteRequis(args.nom, i18n._('Le nom'), NOM_APPEL_MAX),
            introduction: texteFacultatif(
              args.introduction,
              i18n._('L’introduction'),
              INTRODUCTION_MAX
            ),
            ouvertLe: args.ouvertLe,
            fermeLe: args.fermeLe,
            sel,
            empreinte: empreinte(jeton),
            fin: jeton.slice(-6),
            creeParId: ctx.personne!.id,
          },
          include: APPEL_CHARGE,
        })
      })
      signalAppel(appel)
      const { origineOrga } = await configurationOrganisation(organisationId)
      return {
        appel: lireAppel(appel),
        adresse: adresseAppel(origineOrga, jeton),
      }
    },
  }),

  modifierAppelBenevoles: t.field({
    type: AppelRef,
    authScopes: { connecte: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      introduction: t.arg.string(),
      ouvertLe: t.arg({ type: 'DateTime', required: true }),
      fermeLe: t.arg({ type: 'DateTime', required: true }),
      versionAttendue: t.arg.int({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const appel = await appelGere(ctx, String(args.id))
      if (appel.sansAdresse) {
        throw erreurSaisie(
          i18n._('Un appel d’import n’a pas d’adresse publique.')
        )
      }
      const edition = await ctx.exigerEdition(appel.editionId)
      datesAppelValides(
        args.ouvertLe,
        args.fermeLe,
        (await joursDeLaPeriode(prisma, edition.id)).fin,
        ctx.organisation!.fuseauHoraire
      )
      const donnees = {
        nom: texteRequis(args.nom, i18n._('Le nom'), NOM_APPEL_MAX),
        introduction: texteFacultatif(
          args.introduction,
          i18n._('L’introduction'),
          INTRODUCTION_MAX
        ),
        ouvertLe: args.ouvertLe,
        fermeLe: args.fermeLe,
      }
      const maintenant = new Date()
      await sousVerrouOrganisation(ctx.organisation!.id, async tx => {
        // L'état se relit sous le verrou : un appel qui reste ou devient ouvert
        // compte parmi les appels ouverts, hors de lui-même.
        const courant = await tx.appelBenevoles.findUniqueOrThrow({
          where: { id: appel.id },
        })
        if (etatAppel({ ...courant, ...donnees }, maintenant) !== 'FERME') {
          await exigerPlacePourUnAppel(
            tx,
            appel.editionId,
            maintenant,
            appel.id
          )
        }
        const { count } = await tx.appelBenevoles.updateMany({
          where: { id: appel.id, version: args.versionAttendue },
          data: { ...donnees, version: { increment: 1 } },
        })
        if (count === 0) {
          const { version, updatedAt } =
            await tx.appelBenevoles.findUniqueOrThrow({
              where: { id: appel.id },
              select: { version: true, updatedAt: true },
            })
          throw conflitDeVersion(
            i18n._('Cet appel a été modifié depuis votre lecture.'),
            {
              versionCourante: version,
              modifieeLe: updatedAt.toISOString(),
            }
          )
        }
      })
      signalAppel(appel)
      return lireAppel(await appelGere(ctx, appel.id))
    },
  }),

  fermerAppelBenevoles: t.field({
    type: AppelRef,
    authScopes: { connecte: true },
    description: 'Ferme un appel avant sa date de fermeture.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const appel = await appelGere(ctx, String(args.id))
      await prisma.appelBenevoles.update({
        where: { id: appel.id },
        data: { fermeManuellementLe: appel.fermeManuellementLe ?? new Date() },
      })
      signalAppel(appel)
      return lireAppel(await appelGere(ctx, appel.id))
    },
  }),

  rouvrirAppelBenevoles: t.field({
    type: AppelRef,
    authScopes: { connecte: true },
    description: 'Rouvre un appel fermé à la main, avant sa date de fermeture.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const appel = await appelGere(ctx, String(args.id))
      if (appel.sansAdresse) {
        throw erreurSaisie(
          i18n._('Un appel d’import n’a pas d’adresse publique.')
        )
      }
      const maintenant = new Date()
      if (appel.fermeLe.getTime() <= maintenant.getTime()) {
        throw erreurSaisie(
          i18n._(
            'Cet appel a passé sa date de fermeture : changez d’abord ses dates.'
          )
        )
      }
      await sousVerrouOrganisation(ctx.organisation!.id, async tx => {
        // La capacité se vérifie toujours sous le verrou, hors de l'appel rouvert.
        {
          await exigerPlacePourUnAppel(
            tx,
            appel.editionId,
            maintenant,
            appel.id
          )
        }
        await tx.appelBenevoles.update({
          where: { id: appel.id },
          data: { fermeManuellementLe: null },
        })
      })
      signalAppel(appel)
      return lireAppel(await appelGere(ctx, appel.id))
    },
  }),

  renouvelerAdresseAppelBenevoles: t.field({
    type: AppelEtAdresseRef,
    authScopes: { connecte: true },
    description:
      'Remplace l’adresse publique d’un appel : l’ancienne cesse de répondre.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const appel = await appelGere(ctx, String(args.id))
      if (appel.sansAdresse) {
        throw erreurSaisie(
          i18n._('Un appel d’import n’a pas d’adresse publique.')
        )
      }
      const sel = nouveauSel()
      const jeton = await jetonDe('appel', sel)
      await prisma.appelBenevoles.update({
        where: { id: appel.id },
        data: { sel, empreinte: empreinte(jeton), fin: jeton.slice(-6) },
      })
      signalAppel(appel)
      const { origineOrga } = await configurationOrganisation(
        ctx.organisation!.id
      )
      return {
        appel: lireAppel(await appelGere(ctx, appel.id)),
        adresse: adresseAppel(origineOrga, jeton),
      }
    },
  }),

  accepterChoixCandidature: t.field({
    type: CandidatureRef,
    authScopes: { connecte: true },
    description:
      'Accepte une séquence choisie : la fiche bénévole naît ou se rattache par l’adresse, avec une place à confirmer en renfort.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const choix = await choixTraitable(ctx, String(args.id))
      if (choix.statut === 'ACCEPTE') return relire(ctx, choix.candidatureId)
      // Le verrou de l'organisation protège la recherche et la création de la
      // fiche, comme creerBenevole.
      const { benevoleId } = await sousVerrouOrganisation(
        choix.candidature.organisationId,
        async tx => {
          const acceptee = await accepterSurSequence(tx, {
            candidatureId: choix.candidatureId,
            sequenceId: choix.sequenceId,
            acteurId: ctx.personne!.id,
            maintenant: new Date(),
          })
          await tx.sequence.update({
            where: { id: choix.sequenceId },
            data: { version: { increment: 1 } },
          })
          return acceptee
        }
      )
      // Le mail suit la validation de la transaction : la file relit la fiche.
      await annoncerPlace(prisma, {
        benevoleId,
        organisationId: choix.candidature.organisationId,
        activiteId: choix.sequence.activiteId,
      })
      signaux(choix)
      return relire(ctx, choix.candidatureId)
    },
  }),

  refuserChoixCandidature: t.field({
    type: CandidatureRef,
    authScopes: { connecte: true },
    description:
      'Refuse une séquence choisie, en attente ou en liste d’attente. Aucun mail ne part.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const choix = await choixTraitable(ctx, String(args.id))
      if (!CHOIX_EN_ATTENTE.includes(choix.statut)) {
        throw erreurSaisie(
          i18n._(
            'Ce choix est déjà traité : retirez la place depuis le programme.'
          )
        )
      }
      await prisma.$transaction(async tx => {
        // La candidature d'abord, comme tout traitement : deux refus
        // simultanés des derniers choix clôturent bien la candidature.
        await tx.$queryRaw`SELECT id FROM Candidature WHERE id = ${choix.candidatureId} FOR UPDATE`
        // Le statut se vérifie dans l'écriture : une acceptation validée
        // entre-temps n'est pas remplacée par un refus.
        const { count } = await tx.choixCandidature.updateMany({
          where: { id: choix.id, statut: { in: CHOIX_EN_ATTENTE } },
          data: {
            statut: 'REFUSE',
            traiteParId: ctx.personne!.id,
            traiteLe: new Date(),
          },
        })
        if (count === 0) {
          throw erreurSaisie(
            i18n._(
              'Ce choix est déjà traité : retirez la place depuis le programme.'
            )
          )
        }
        await recalculerCandidature(tx, choix.candidatureId)
      })
      signalCandidature({ ...choix.candidature, id: choix.candidatureId })
      return relire(ctx, choix.candidatureId)
    },
  }),

  refuserCandidature: t.field({
    type: CandidatureRef,
    authScopes: { connecte: true },
    description:
      'Refuse tous les choix en attente d’une candidature et la clôt. Réservé aux personnes qui gèrent l’appel. Aucun mail ne part.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { candidature, ecrits } = await candidatureLisible(
        ctx,
        String(args.id)
      )
      if (!gereLAppel(ecrits, candidature.appel)) throw accesRefuse()
      if (candidature.statut !== 'EN_ATTENTE') {
        throw erreurSaisie(i18n._('Cette candidature est déjà traitée.'))
      }
      const maintenant = new Date()
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM Candidature WHERE id = ${candidature.id} FOR UPDATE`
        const { count } = await tx.candidature.updateMany({
          where: { id: candidature.id, statut: 'EN_ATTENTE' },
          data: { statut: 'TRAITEE', courrielEnAttente: null },
        })
        if (count === 0) {
          throw erreurSaisie(i18n._('Cette candidature est déjà traitée.'))
        }
        await tx.choixCandidature.updateMany({
          where: {
            candidatureId: candidature.id,
            statut: { in: CHOIX_EN_ATTENTE },
          },
          data: {
            statut: 'REFUSE',
            traiteParId: ctx.personne!.id,
            traiteLe: maintenant,
          },
        })
      })
      signalCandidature(candidature)
      return relire(ctx, candidature.id)
    },
  }),
}))

/**
 * Le choix, si la personne le traite : elle écrit sa séquence, et la candidature
 * n'est pas retirée.
 */
async function choixTraitable(ctx: AppContext, id: string) {
  const choix = await prisma.choixCandidature.findFirst({
    where: {
      id,
      candidature: { organisationId: ctx.organisation!.id },
    },
    include: {
      sequence: {
        select: {
          id: true,
          editionId: true,
          activiteId: true,
          perimetreId: true,
        },
      },
      candidature: {
        select: {
          statut: true,
          organisationId: true,
          activiteId: true,
          editionId: true,
        },
      },
    },
  })
  if (choix === null) throw accesRefuse()
  const edition = await ctx.exigerEdition(choix.sequence.editionId)
  await exigerModule(edition.activiteId, 'BENEVOLES')
  if (!(await peutEcrireSequence(ctx, choix.sequence))) throw accesRefuse()
  if (choix.candidature.statut === 'RETIREE') {
    throw erreurSaisie(i18n._('La personne a retiré cette candidature.'))
  }
  return choix
}

async function relire(ctx: AppContext, candidatureId: string) {
  const { candidature, ecrits } = await candidatureLisible(ctx, candidatureId)
  return lireCandidature(ctx, ecrits, candidature)
}

function signaux(choix: {
  candidatureId: string
  sequence: {
    id: string
    editionId: string
    activiteId: string
    perimetreId: string | null
  }
  candidature: { organisationId: string }
}) {
  const { organisationId } = choix.candidature
  signalCandidature({
    organisationId,
    activiteId: choix.sequence.activiteId,
    editionId: choix.sequence.editionId,
    id: choix.candidatureId,
  })
  publierPourActivite('PROGRAMME', organisationId, choix.sequence.activiteId, {
    id: choix.sequence.id,
    perimetreId: choix.sequence.perimetreId,
    editionId: choix.sequence.editionId,
  })
}
