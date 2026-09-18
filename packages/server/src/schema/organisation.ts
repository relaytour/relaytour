import { prisma, StatutEdition, TypePerimetre } from '@relaytour/database'

import { erreurSaisie } from '../lib/erreurs.ts'
import {
  couleurValide,
  sansDoublon,
  slugValide,
  texteRequis,
} from '../lib/saisie.ts'

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

builder.queryFields(t => ({
  editions: t.prismaField({
    type: [EditionRef],
    authScopes: { connecte: true },
    resolve: query =>
      prisma.edition.findMany({ ...query, orderBy: { annee: 'desc' } }),
  }),

  // L'édition en cours de préparation ou de déroulement la plus récente.
  editionCourante: t.prismaField({
    type: EditionRef,
    nullable: true,
    authScopes: { connecte: true },
    resolve: query =>
      prisma.edition.findFirst({
        ...query,
        where: { statut: { not: 'ARCHIVEE' } },
        orderBy: { annee: 'desc' },
      }),
  }),

  perimetres: t.prismaField({
    type: [PerimetreRef],
    authScopes: { connecte: true },
    args: { inclureArchives: t.arg.boolean({ defaultValue: false }) },
    resolve: (query, _root, { inclureArchives }) =>
      prisma.perimetre.findMany({
        ...query,
        where: inclureArchives ? {} : { archivedAt: null },
        orderBy: [{ type: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
      }),
  }),
}))

// ── Administration ───────────────────────────────────────────────────────────

function datesValides(debut: Date, fin: Date) {
  if (debut > fin) {
    throw erreurSaisie('La date de fin doit suivre la date de début.')
  }
}

builder.mutationFields(t => ({
  creerEdition: t.prismaField({
    type: EditionRef,
    authScopes: { admin: true },
    args: {
      annee: t.arg.int({ required: true }),
      nom: t.arg.string({ required: true }),
      debut: t.arg({ type: 'Date', required: true }),
      fin: t.arg({ type: 'Date', required: true }),
    },
    resolve: (query, _root, args) => {
      if (args.annee < 2020 || args.annee > 2100) {
        throw erreurSaisie('L’année doit être comprise entre 2020 et 2100.')
      }
      datesValides(args.debut, args.fin)
      return sansDoublon(
        prisma.edition.create({
          ...query,
          data: {
            annee: args.annee,
            nom: texteRequis(args.nom, 'Le nom'),
            debut: args.debut,
            fin: args.fin,
          },
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
    resolve: (query, _root, args) => {
      datesValides(args.debut, args.fin)
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
      slug: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      type: t.arg({ type: TypePerimetreEnum, required: true }),
      couleur: t.arg.string(),
      ordre: t.arg.int({ defaultValue: 0 }),
    },
    resolve: (query, _root, args) =>
      sansDoublon(
        prisma.perimetre.create({
          ...query,
          data: {
            slug: slugValide(args.slug),
            nom: texteRequis(args.nom, 'Le nom'),
            type: args.type,
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
    resolve: async (query, _root, args) => {
      const actuel = await prisma.perimetre.findUniqueOrThrow({
        where: { id: String(args.id) },
        select: { archivedAt: true },
      })
      return prisma.perimetre.update({
        ...query,
        where: { id: String(args.id) },
        data: {
          nom: texteRequis(args.nom, 'Le nom'),
          type: args.type,
          couleur: couleurValide(args.couleur),
          ordre: args.ordre,
          // La date d'archivage d'origine est conservée.
          archivedAt: args.archive ? (actuel.archivedAt ?? new Date()) : null,
        },
      })
    },
  }),
}))
