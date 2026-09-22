import { prisma, StatutEdition, TypePerimetre } from '@relaytour/database'

import type {
  CouleursTheme,
  FondTheme,
  HaloTheme,
  PolicesTheme,
  Theme,
  TypographieTheme,
} from '@relaytour/tokens'

import { groupeDepuisType } from '../lib/activites.ts'
import { validerDates, validerEdition } from '../lib/editions.ts'
import { accesRefuse } from '../lib/erreurs.ts'
import {
  couleurValide,
  sansDoublon,
  slugValide,
  texteRequis,
} from '../lib/saisie.ts'

import { exigerPlacePeriode } from '../lib/limites.ts'
import {
  configurationOrganisation,
  type ConfigurationOrganisation,
} from '../lib/organisation.ts'

import { builder } from './builder.ts'

export const StatutEditionEnum = builder.enumType(StatutEdition, {
  name: 'StatutEdition',
})
export const TypePerimetreEnum = builder.enumType(TypePerimetre, {
  name: 'TypePerimetre',
})

export const EditionRef = builder.prismaObject('Edition', {
  fields: t => ({
    id: t.exposeID('id'),
    annee: t.exposeInt('annee'),
    nom: t.exposeString('nom'),
    debut: t.expose('debut', { type: 'Date' }),
    fin: t.expose('fin', { type: 'Date' }),
    statut: t.expose('statut', { type: StatutEditionEnum }),
  }),
})

export const PerimetreRef = builder.prismaObject('Perimetre', {
  fields: t => ({
    id: t.exposeID('id'),
    slug: t.exposeString('slug'),
    nom: t.exposeString('nom'),
    type: t.expose('type', { type: TypePerimetreEnum }),
    couleur: t.exposeString('couleur', { nullable: true }),
    ordre: t.exposeInt('ordre'),
    archive: t.boolean({ resolve: p => p.archivedAt !== null }),
  }),
})

// ── Lecture ──────────────────────────────────────────────────────────────────

// Sans `activiteId`, les requêtes portent sur la première activité non archivée de
// l'organisation active (ADR 0008).

builder.queryFields(t => ({
  editions: t.prismaField({
    type: [EditionRef],
    authScopes: { connecte: true },
    args: { activiteId: t.arg.id() },
    resolve: async (query, _root, { activiteId }, ctx) =>
      prisma.edition.findMany({
        ...query,
        where: { activiteId: await ctx.exigerActivite(activiteId) },
        orderBy: { annee: 'desc' },
      }),
  }),

  // L'édition en cours de préparation ou de déroulement la plus récente.
  editionCourante: t.prismaField({
    type: EditionRef,
    nullable: true,
    authScopes: { connecte: true },
    args: { activiteId: t.arg.id() },
    resolve: async (query, _root, { activiteId }, ctx) =>
      prisma.edition.findFirst({
        ...query,
        where: {
          activiteId: await ctx.exigerActivite(activiteId),
          statut: { not: 'ARCHIVEE' },
        },
        orderBy: { annee: 'desc' },
      }),
  }),

  perimetres: t.prismaField({
    type: [PerimetreRef],
    authScopes: { connecte: true },
    args: {
      activiteId: t.arg.id(),
      inclureArchives: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _root, { activiteId, inclureArchives }, ctx) =>
      prisma.perimetre.findMany({
        ...query,
        where: {
          activiteId: await ctx.exigerActivite(activiteId),
          ...(inclureArchives ? {} : { archivedAt: null }),
        },
        orderBy: [{ type: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
      }),
  }),
}))

// ── Administration ───────────────────────────────────────────────────────────

builder.mutationFields(t => ({
  creerEdition: t.prismaField({
    type: EditionRef,
    authScopes: { admin: true },
    args: {
      activiteId: t.arg.id(),
      annee: t.arg.int({ required: true }),
      nom: t.arg.string({ required: true }),
      debut: t.arg({ type: 'Date', required: true }),
      fin: t.arg({ type: 'Date', required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const edition = validerEdition(args)
      const activiteId = await ctx.exigerActivite(args.activiteId)
      const organisationId = ctx.organisation!.id
      await exigerPlacePeriode(organisationId)
      return sansDoublon(
        prisma.edition.create({
          ...query,
          data: { ...edition, organisationId, activiteId },
        }),
        `Une édition existe déjà pour ${args.annee}.`
      )
    },
  }),

  modifierEdition: t.prismaField({
    type: EditionRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      debut: t.arg({ type: 'Date', required: true }),
      fin: t.arg({ type: 'Date', required: true }),
      statut: t.arg({ type: StatutEditionEnum, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      validerDates(args.debut, args.fin)
      const actuelle = await ctx.exigerEdition(args.id)
      // Rouvrir une période archivée compte dans la limite des périodes ouvertes.
      if (actuelle.statut === 'ARCHIVEE' && args.statut !== 'ARCHIVEE') {
        await exigerPlacePeriode(ctx.organisation!.id)
      }
      return prisma.edition.update({
        ...query,
        where: { id: String(args.id) },
        data: {
          nom: texteRequis(args.nom, 'Le nom'),
          debut: args.debut,
          fin: args.fin,
          statut: args.statut,
        },
      })
    },
  }),

  creerPerimetre: t.prismaField({
    type: PerimetreRef,
    authScopes: { admin: true },
    args: {
      activiteId: t.arg.id(),
      slug: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      type: t.arg({ type: TypePerimetreEnum, required: true }),
      couleur: t.arg.string(),
      ordre: t.arg.int({ defaultValue: 0 }),
    },
    resolve: async (query, _root, args, ctx) =>
      sansDoublon(
        prisma.perimetre.create({
          ...query,
          data: {
            organisationId: ctx.organisation!.id,
            activiteId: await ctx.exigerActivite(args.activiteId),
            slug: slugValide(args.slug),
            nom: texteRequis(args.nom, 'Le nom'),
            type: args.type,
            groupe: groupeDepuisType(args.type),
            couleur: couleurValide(args.couleur),
            ordre: args.ordre ?? 0,
          },
        }),
        'Un périmètre utilise déjà cet identifiant.'
      ),
  }),

  modifierPerimetre: t.prismaField({
    type: PerimetreRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      type: t.arg({ type: TypePerimetreEnum, required: true }),
      couleur: t.arg.string(),
      ordre: t.arg.int({ required: true }),
      archive: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const actuel = await prisma.perimetre.findFirst({
        where: { id: String(args.id), organisationId: ctx.organisation!.id },
        select: { archivedAt: true },
      })
      if (actuel === null) throw accesRefuse()
      return prisma.perimetre.update({
        ...query,
        where: { id: String(args.id) },
        data: {
          nom: texteRequis(args.nom, 'Le nom'),
          type: args.type,
          groupe: groupeDepuisType(args.type),
          couleur: couleurValide(args.couleur),
          ordre: args.ordre,
          // La date d'archivage d'origine est conservée.
          archivedAt: args.archive ? (actuel.archivedAt ?? new Date()) : null,
        },
      })
    },
  }),
}))

// ── Configuration publique de l'organisation (ADR 0006) ─────────────────────
//
// Servie sans session : l'écran de connexion a besoin du nom et du thème.
// Le type n'expose que des champs publics (invariant 14) : ni expéditeur, ni
// domaines de mail, ni contact de recrutement.

const CouleursThemeRef = builder
  .objectRef<CouleursTheme>('CouleursTheme')
  .implement({
    fields: t => ({
      encre: t.exposeString('encre'),
      primaire: t.exposeString('primaire'),
      primaireClair: t.exposeString('primaireClair'),
      accent: t.exposeString('accent'),
      accentClair: t.exposeString('accentClair'),
      succes: t.exposeString('succes'),
      succesClair: t.exposeString('succesClair'),
      alerte: t.exposeString('alerte'),
      alerteClair: t.exposeString('alerteClair'),
      erreur: t.exposeString('erreur'),
      erreurClair: t.exposeString('erreurClair'),
      sol1: t.exposeString('sol1'),
      sol2: t.exposeString('sol2'),
      sol3: t.exposeString('sol3'),
    }),
  })

const HaloThemeRef = builder.objectRef<HaloTheme>('HaloTheme').implement({
  description: 'Une tache de couleur floue derrière le verre.',
  fields: t => ({
    couleur: t.exposeString('couleur'),
    intensite: t.exposeFloat('intensite', {
      description: 'Opacité, de 0 à 0,35.',
    }),
  }),
})

const FondThemeRef = builder.objectRef<FondTheme>('FondTheme').implement({
  description: 'Le fond du thème, en plus des trois arrêts du sol.',
  fields: t => ({
    transition: t.exposeString('transition', {
      description: 'L’arrêt à 18 % du dégradé du sol, entre sol1 et sol2.',
    }),
    halo1: t.field({ type: HaloThemeRef, resolve: f => f.halo1 }),
    halo2: t.field({ type: HaloThemeRef, resolve: f => f.halo2 }),
  }),
})

const PolicesThemeRef = builder
  .objectRef<PolicesTheme>('PolicesTheme')
  .implement({
    description: 'Piles CSS complètes, prêtes pour font-family.',
    fields: t => ({
      texte: t.exposeString('texte'),
      titre: t.exposeString('titre'),
      mono: t.exposeString('mono'),
    }),
  })

const TypographieThemeRef = builder
  .objectRef<TypographieTheme>('TypographieTheme')
  .implement({
    fields: t => ({
      graisseTitre: t.exposeInt('graisseTitre'),
      graisseCorps: t.exposeInt('graisseCorps'),
      espacementTitre: t.exposeString('espacementTitre'),
      echelleTitre: t.exposeFloat('echelleTitre'),
    }),
  })

const ThemeRef = builder.objectRef<Theme>('Theme').implement({
  description:
    'Le thème complet de l’organisation, fusionné avec le thème par défaut de Relaytour.',
  fields: t => ({
    couleurs: t.field({ type: CouleursThemeRef, resolve: th => th.couleurs }),
    fond: t.field({ type: FondThemeRef, resolve: th => th.fond }),
    polices: t.field({ type: PolicesThemeRef, resolve: th => th.polices }),
    typographie: t.field({
      type: TypographieThemeRef,
      resolve: th => th.typographie,
    }),
  }),
})

const OrganisationRef = builder
  .objectRef<ConfigurationOrganisation>('Organisation')
  .implement({
    description:
      'Identité publique de l’organisation qui utilise cette installation.',
    fields: t => ({
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
      sigle: t.exposeString('sigle', { nullable: true }),
      logoUrl: t.exposeString('logoUrl', { nullable: true }),
      faviconUrl: t.exposeString('faviconUrl', { nullable: true }),
      pageEquipe: t.exposeString('pageEquipe', { nullable: true }),
      theme: t.field({ type: ThemeRef, resolve: o => o.theme }),
    }),
  })

builder.queryField('organisation', t =>
  t.field({
    type: OrganisationRef,
    description:
      'Nom, sigle et thème de l’organisation active, ou de la première organisation de l’installation sans session. Lisible sans session.',
    resolve: (_root, _args, ctx) =>
      configurationOrganisation(ctx.organisation?.id),
  })
)
