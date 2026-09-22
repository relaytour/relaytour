import { NatureActivite, prisma } from '@relaytour/database'

import {
  GROUPES_PAR_DEFAUT,
  groupesValides,
  lireGroupes,
  slugActiviteValide,
  type GroupePerimetres,
} from '../lib/activites.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import { exigerPlaceActivite } from '../lib/limites.ts'
import { sansDoublon, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'

// Activités d'une organisation (ADR 0008) : un événement, une section, une instance.
// Toutes les personnes connectées lisent les activités de leur organisation ; seuls
// les admins les créent, les modifient et les archivent.

export const NatureActiviteEnum = builder.enumType(NatureActivite, {
  name: 'NatureActivite',
  description:
    'Fixe le libellé de la période : édition pour un événement, saison pour une section, mandat pour une instance.',
})

const GroupePerimetresRef = builder
  .objectRef<GroupePerimetres>('GroupePerimetres')
  .implement({
    description: 'Catégorie de périmètres déclarée par une activité.',
    fields: t => ({
      cle: t.exposeString('cle'),
      libelle: t.exposeString('libelle'),
      libellePluriel: t.exposeString('libellePluriel'),
    }),
  })

const GroupePerimetresInput = builder.inputType('GroupePerimetresInput', {
  fields: t => ({
    cle: t.string({ required: true }),
    libelle: t.string({ required: true }),
    libellePluriel: t.string({ required: true }),
  }),
})

export const ActiviteRef = builder.prismaObject('Activite', {
  fields: t => ({
    id: t.exposeID('id'),
    slug: t.exposeString('slug'),
    nom: t.exposeString('nom'),
    sigle: t.exposeString('sigle', { nullable: true }),
    nature: t.expose('nature', { type: NatureActiviteEnum }),
    groupes: t.field({
      type: [GroupePerimetresRef],
      resolve: a => lireGroupes(a.groupes),
    }),
    ordre: t.exposeInt('ordre'),
    archive: t.boolean({ resolve: a => a.archivedAt !== null }),
  }),
})

// La période et le périmètre disent à quelle activité ils appartiennent.
builder.prismaObjectFields('Edition', t => ({
  activite: t.relation('activite', { type: ActiviteRef }),
}))
builder.prismaObjectFields('Perimetre', t => ({
  activite: t.relation('activite', { type: ActiviteRef }),
  groupe: t.exposeString('groupe'),
}))
builder.prismaObjectFields('Fiche', t => ({
  activite: t.relation('activite', { type: ActiviteRef }),
}))

builder.queryFields(t => ({
  activites: t.prismaField({
    type: [ActiviteRef],
    authScopes: { connecte: true },
    args: { inclureArchives: t.arg.boolean({ defaultValue: false }) },
    resolve: (query, _root, { inclureArchives }, ctx) =>
      prisma.activite.findMany({
        ...query,
        where: {
          organisationId: ctx.organisation!.id,
          ...(inclureArchives ? {} : { archivedAt: null }),
        },
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      }),
  }),
}))

builder.mutationFields(t => ({
  creerActivite: t.prismaField({
    type: ActiviteRef,
    authScopes: { admin: true },
    args: {
      slug: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      sigle: t.arg.string(),
      nature: t.arg({ type: NatureActiviteEnum, required: true }),
      groupes: t.arg({ type: [GroupePerimetresInput] }),
      ordre: t.arg.int({ defaultValue: 0 }),
    },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const donnees = {
        organisationId,
        slug: slugActiviteValide(args.slug),
        nom: texteRequis(args.nom, 'Le nom'),
        sigle: args.sigle?.trim()
          ? texteRequis(args.sigle, 'Le sigle', 20)
          : null,
        nature: args.nature,
        groupes: groupesValides(args.groupes ?? GROUPES_PAR_DEFAUT),
        ordre: args.ordre ?? 0,
      }
      await exigerPlaceActivite(organisationId)
      return sansDoublon(
        prisma.activite.create({ ...query, data: donnees }),
        'Une activité utilise déjà cet identifiant.'
      )
    },
  }),

  modifierActivite: t.prismaField({
    type: ActiviteRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      sigle: t.arg.string(),
      nature: t.arg({ type: NatureActiviteEnum, required: true }),
      groupes: t.arg({ type: [GroupePerimetresInput], required: true }),
      ordre: t.arg.int({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const id = await ctx.exigerActivite(args.id)
      const groupes = groupesValides(args.groupes)
      // Un groupe encore porté par un périmètre ne disparaît pas.
      const utilises = await prisma.perimetre.findMany({
        where: { activiteId: id },
        select: { groupe: true },
        distinct: ['groupe'],
      })
      const cles = new Set(groupes.map(g => g.cle))
      const manquant = utilises.find(p => !cles.has(p.groupe))
      if (manquant !== undefined) {
        throw erreurGroupeUtilise(manquant.groupe)
      }
      return prisma.activite.update({
        ...query,
        where: { id },
        data: {
          nom: texteRequis(args.nom, 'Le nom'),
          sigle: args.sigle?.trim()
            ? texteRequis(args.sigle, 'Le sigle', 20)
            : null,
          nature: args.nature,
          groupes,
          ordre: args.ordre,
        },
      })
    },
  }),

  // Archiver une activité la retire des listes et libère sa place dans les limites.
  // Ses périodes, périmètres et fiches restent consultables.
  archiverActivite: t.prismaField({
    type: ActiviteRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      archive: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const id = await ctx.exigerActivite(args.id)
      const actuelle = await prisma.activite.findUniqueOrThrow({
        where: { id },
        select: { archivedAt: true },
      })
      if (!args.archive && actuelle.archivedAt !== null) {
        await exigerPlaceActivite(ctx.organisation!.id)
      }
      if (args.archive && actuelle.archivedAt === null) {
        const restantes = await prisma.activite.count({
          where: {
            organisationId: ctx.organisation!.id,
            archivedAt: null,
            id: { not: id },
          },
        })
        if (restantes === 0) throw erreurDerniereActivite()
      }
      return prisma.activite.update({
        ...query,
        where: { id },
        data: {
          // La date d'archivage d'origine est conservée.
          archivedAt: args.archive ? (actuelle.archivedAt ?? new Date()) : null,
        },
      })
    },
  }),
}))

function erreurGroupeUtilise(cle: string) {
  return erreurSaisie(
    `Des périmètres appartiennent encore au groupe « ${cle} » : changez-les de groupe avant de le retirer.`
  )
}

function erreurDerniereActivite() {
  return erreurSaisie('Une organisation garde au moins une activité ouverte.')
}
