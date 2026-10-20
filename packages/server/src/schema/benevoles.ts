import { prisma, type Benevole } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import {
  BENEVOLES_MAX,
  coordonneesLisibles,
  courrielValide,
  ecritDansLActivite,
  NOM_BENEVOLE_MAX,
  NOTE_BENEVOLE_MAX,
  telephoneValide,
} from '../lib/benevoles.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { texteFacultatif, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'

// Fiches bénévoles (ADR 0040). Les admins de l'activité et les personnes qui
// écrivent dans un de ses périmètres lisent la liste des fiches et en créent. Les
// coordonnées d'une fiche ne se lisent que par les admins de l'activité, par la
// personne qui l'a créée, et par les personnes qui écrivent dans un périmètre où
// la fiche est placée. Aucune fiche n'existe sans l'accord de la personne.

interface BenevoleLu {
  benevole: Benevole & { _count: { places: number } }
  coordonnees: boolean
  peutModifier: boolean
}

const BenevoleRef = builder.objectRef<BenevoleLu>('Benevole').implement({
  description: 'Une fiche bénévole : une personne qui aide sans compte.',
  fields: t => ({
    id: t.id({ resolve: l => l.benevole.id }),
    nom: t.string({ resolve: l => l.benevole.nom }),
    coordonneesVisibles: t.boolean({
      description:
        'Vrai si la personne connectée lit l’adresse, le téléphone et la note.',
      resolve: l => l.coordonnees,
    }),
    courriel: t.string({
      nullable: true,
      resolve: l => (l.coordonnees ? l.benevole.courriel : null),
    }),
    telephone: t.string({
      nullable: true,
      resolve: l => (l.coordonnees ? l.benevole.telephone : null),
    }),
    note: t.string({
      nullable: true,
      resolve: l => (l.coordonnees ? l.benevole.note : null),
    }),
    accordLe: t.field({ type: 'DateTime', resolve: l => l.benevole.accordLe }),
    places: t.int({
      description: 'Le nombre de séquences où la fiche est placée.',
      resolve: l => l.benevole._count.places,
    }),
    peutModifier: t.boolean({ resolve: l => l.peutModifier }),
  }),
})

const AVEC_PLACES = { _count: { select: { places: true } } } as const

async function lireBenevoles(
  ctx: AppContext,
  activiteId: string,
  benevoles: (Benevole & { _count: { places: number } })[]
): Promise<BenevoleLu[]> {
  const admin = await ctx.estAdminDe(activiteId)
  const lisibles = await coordonneesLisibles(
    ctx,
    activiteId,
    benevoles.map(b => b.id)
  )
  return benevoles.map(benevole => ({
    benevole,
    coordonnees: lisibles.has(benevole.id),
    peutModifier: admin || benevole.creeParId === ctx.personne!.id,
  }))
}

/** L'activité, si la personne y écrit : admin, ou affectée à un périmètre. */
async function activiteEcrite(ctx: AppContext, id: string | number) {
  const activiteId = await ctx.exigerActivite(id)
  if (!(await ecritDansLActivite(ctx, activiteId))) throw accesRefuse()
  return activiteId
}

/** La fiche, si la personne peut la modifier : admin de l'activité ou autrice. */
async function ficheModifiable(ctx: AppContext, id: string) {
  const benevole = await prisma.benevole.findFirst({
    where: { id, organisationId: ctx.organisation!.id },
  })
  if (benevole === null) throw accesRefuse()
  await ctx.exigerActivite(benevole.activiteId)
  if (
    !(await ctx.estAdminDe(benevole.activiteId)) &&
    benevole.creeParId !== ctx.personne!.id
  ) {
    throw accesRefuse()
  }
  return benevole
}

builder.queryFields(t => ({
  benevoles: t.field({
    type: [BenevoleRef],
    authScopes: { connecte: true },
    description:
      'Les fiches bénévoles d’une activité, par nom, pour les personnes qui y écrivent.',
    args: { activiteId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const activiteId = await activiteEcrite(ctx, args.activiteId)
      const benevoles = await prisma.benevole.findMany({
        where: { organisationId: ctx.organisation!.id, activiteId },
        include: AVEC_PLACES,
        orderBy: [{ nom: 'asc' }, { id: 'asc' }],
        take: BENEVOLES_MAX,
      })
      return lireBenevoles(ctx, activiteId, benevoles)
    },
  }),
}))

builder.mutationFields(t => ({
  creerBenevole: t.field({
    type: BenevoleRef,
    authScopes: { connecte: true },
    description:
      'Crée une fiche bénévole. La personne qui la crée déclare l’accord de la ou du bénévole.',
    args: {
      activiteId: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      courriel: t.arg.string(),
      telephone: t.arg.string(),
      note: t.arg.string(),
      accord: t.arg.boolean({
        required: true,
        description:
          'Vrai : la personne accepte que ses coordonnées soient enregistrées.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const activiteId = await activiteEcrite(ctx, args.activiteId)
      if (!args.accord) {
        throw erreurSaisie(
          'Une fiche ne s’enregistre qu’avec l’accord de la personne.'
        )
      }
      const nombre = await prisma.benevole.count({ where: { activiteId } })
      if (nombre >= BENEVOLES_MAX) {
        throw erreurSaisie(
          `Une activité compte ${BENEVOLES_MAX} fiches bénévoles au plus.`
        )
      }
      const creee = await prisma.benevole.create({
        data: {
          organisationId: ctx.organisation!.id,
          activiteId,
          nom: texteRequis(args.nom, 'Le nom', NOM_BENEVOLE_MAX),
          courriel: courrielValide(args.courriel),
          telephone: telephoneValide(args.telephone),
          note: texteFacultatif(args.note, 'La note', NOTE_BENEVOLE_MAX),
          accordLe: new Date(),
          creeParId: ctx.personne!.id,
        },
        include: AVEC_PLACES,
      })
      publierPourActivite('PROGRAMME', ctx.organisation!.id, activiteId)
      const [lue] = await lireBenevoles(ctx, activiteId, [creee])
      return lue!
    },
  }),

  modifierBenevole: t.field({
    type: BenevoleRef,
    authScopes: { connecte: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      courriel: t.arg.string(),
      telephone: t.arg.string(),
      note: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const actuelle = await ficheModifiable(ctx, String(args.id))
      const modifiee = await prisma.benevole.update({
        where: { id: actuelle.id },
        data: {
          nom: texteRequis(args.nom, 'Le nom', NOM_BENEVOLE_MAX),
          courriel: courrielValide(args.courriel),
          telephone: telephoneValide(args.telephone),
          note: texteFacultatif(args.note, 'La note', NOTE_BENEVOLE_MAX),
        },
        include: AVEC_PLACES,
      })
      publierPourActivite(
        'PROGRAMME',
        ctx.organisation!.id,
        actuelle.activiteId
      )
      const [lue] = await lireBenevoles(ctx, actuelle.activiteId, [modifiee])
      return lue!
    },
  }),

  supprimerBenevole: t.boolean({
    authScopes: { connecte: true },
    description:
      'Supprime une fiche et la retire de toutes les séquences. Réservé aux admins de l’activité.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const benevole = await prisma.benevole.findFirst({
        where: { id: String(args.id), organisationId: ctx.organisation!.id },
      })
      if (benevole === null) throw accesRefuse()
      await ctx.exigerActivite(benevole.activiteId)
      await ctx.exigerAdminDe(benevole.activiteId)
      await prisma.benevole.delete({ where: { id: benevole.id } })
      publierPourActivite(
        'PROGRAMME',
        ctx.organisation!.id,
        benevole.activiteId
      )
      return true
    },
  }),
}))
