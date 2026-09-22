import { NatureActivite, prisma, type Prisma } from '@relaytour/database'

import {
  GROUPES_PAR_DEFAUT,
  groupesValides,
  lireGroupes,
  slugActiviteValide,
  type GroupePerimetres,
} from '../lib/activites.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { exigerPlaceActivite, sousVerrouOrganisation } from '../lib/limites.ts'
import { sansDoublon, texteRequis } from '../lib/saisie.ts'
import { marquerContenuModifie } from '../lib/synchronisation.ts'

import { builder } from './builder.ts'

// Activités d'une organisation (ADR 0008) : un événement, une section, une instance.
// Une personne ne lit que les activités qu'elle voit (ADR 0010) : celles qu'elle
// administre et celles où elle a été affectée. Un admin de l'organisation crée et
// archive les activités ; l'admin d'une activité la modifie.

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
    // Vrai quand la personne connectée administre l'activité (ADR 0010).
    estAdministree: t.boolean({
      resolve: (a, _args, ctx) => ctx.estAdminDe(a.id),
    }),
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
    resolve: async (query, _root, { inclureArchives }, ctx) =>
      prisma.activite.findMany({
        ...query,
        where: {
          organisationId: ctx.organisation!.id,
          id: { in: [...(await ctx.activitesVisibles())] },
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
      return sousVerrouOrganisation(organisationId, async tx => {
        await exigerPlaceActivite(organisationId, tx)
        const activite = await sansDoublon(
          tx.activite.create({ ...query, data: donnees }),
          'Une activité utilise déjà cet identifiant.'
        )
        await marquerContenuModifie(organisationId, tx)
        return activite
      })
    },
  }),

  modifierActivite: t.prismaField({
    type: ActiviteRef,
    authScopes: { gestion: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      sigle: t.arg.string(),
      nature: t.arg({ type: NatureActiviteEnum, required: true }),
      groupes: t.arg({ type: [GroupePerimetresInput], required: true }),
      ordre: t.arg.int({ required: true }),
      // Archiver ou rouvrir dans la même transaction : une limite atteinte ou la
      // dernière activité ouverte annulent toute la modification.
      archive: t.arg.boolean(),
    },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const id = await ctx.exigerActivite(args.id)
      await ctx.exigerAdminDe(id)
      // Archiver ou rouvrir une activité touche aux limites de l'organisation :
      // seul un admin de l'organisation le fait.
      if (
        args.archive !== null &&
        args.archive !== undefined &&
        !ctx.personne!.estAdmin
      ) {
        throw accesRefuse()
      }
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
      const donnees = {
        nom: texteRequis(args.nom, 'Le nom'),
        sigle: args.sigle?.trim()
          ? texteRequis(args.sigle, 'Le sigle', 20)
          : null,
        nature: args.nature,
        groupes,
        ordre: args.ordre,
      }
      return sousVerrouOrganisation(organisationId, async tx => {
        const archivedAt =
          args.archive === null || args.archive === undefined
            ? undefined
            : await archivage(tx, organisationId, id, args.archive)
        const activite = await tx.activite.update({
          ...query,
          where: { id },
          data: {
            ...donnees,
            ...(archivedAt === undefined ? {} : { archivedAt }),
          },
        })
        await marquerContenuModifie(organisationId, tx)
        return activite
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
      const organisationId = ctx.organisation!.id
      const id = await ctx.exigerActivite(args.id)
      return sousVerrouOrganisation(organisationId, async tx => {
        const archivedAt = await archivage(tx, organisationId, id, args.archive)
        const activite = await tx.activite.update({
          ...query,
          where: { id },
          data: { archivedAt },
        })
        await marquerContenuModifie(organisationId, tx)
        return activite
      })
    },
  }),
}))

/**
 * La date d'archivage d'une activité après la demande, contrôles faits sous le
 * verrou de l'organisation : rouvrir respecte la limite d'activités, archiver
 * garde au moins une activité ouverte. La date d'archivage d'origine est conservée.
 */
async function archivage(
  tx: Prisma.TransactionClient,
  organisationId: string,
  id: string,
  archive: boolean
): Promise<Date | null> {
  const actuelle = await tx.activite.findUniqueOrThrow({
    where: { id },
    select: { archivedAt: true },
  })
  if (!archive && actuelle.archivedAt !== null) {
    await exigerPlaceActivite(organisationId, tx)
  }
  if (archive && actuelle.archivedAt === null) {
    const restantes = await tx.activite.count({
      where: { organisationId, archivedAt: null, id: { not: id } },
    })
    if (restantes === 0) throw erreurDerniereActivite()
  }
  return archive ? (actuelle.archivedAt ?? new Date()) : null
}

function erreurGroupeUtilise(cle: string) {
  return erreurSaisie(
    `Des périmètres appartiennent encore au groupe « ${cle} » : changez-les de groupe avant de le retirer.`
  )
}

function erreurDerniereActivite() {
  return erreurSaisie('Une organisation garde au moins une activité ouverte.')
}
