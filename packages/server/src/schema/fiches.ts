import { prisma, SourceFiche } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { perimetresLisibles, peutLirePerimetre } from '../lib/droits.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import {
  donneesPersonnelles,
  empreinte,
  normaliserContenu,
  peutLireFiche,
  peutRedigerFiche,
} from '../lib/fiches.ts'
import { exigerMembre } from '../lib/appartenances.ts'
import { configurationOrganisation } from '../lib/organisation.ts'
import { sansDoublon, slugValide, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'
import { TacheRef } from './taches.ts'

export const SourceFicheEnum = builder.enumType(SourceFiche, {
  name: 'SourceFiche',
})

const TAILLE_MAX_CONTENU = 200_000

// ── Types ────────────────────────────────────────────────────────────────────

export const FicheVersionRef = builder.prismaObject('FicheVersion', {
  fields: t => ({
    id: t.exposeID('id'),
    titre: t.exposeString('titre'),
    contenu: t.exposeString('contenu'),
    source: t.expose('source', { type: SourceFicheEnum }),
    resume: t.exposeString('resume', { nullable: true }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    auteur: t.relation('auteur', { type: PersonneRef, nullable: true }),
  }),
})

export const FicheRef = builder.prismaObject('Fiche', {
  fields: t => ({
    id: t.exposeID('id'),
    slug: t.exposeString('slug'),
    archive: t.boolean({ resolve: f => f.archivedAt !== null }),
    perimetre: t.relation('perimetre', { type: PerimetreRef, nullable: true }),
    titre: t.string({
      select: { versionCourante: { select: { titre: true } } },
      resolve: f => f.versionCourante?.titre ?? f.slug,
    }),
    contenu: t.string({
      select: { versionCourante: { select: { contenu: true } } },
      resolve: f => f.versionCourante?.contenu ?? '',
    }),
    source: t.field({
      type: SourceFicheEnum,
      nullable: true,
      select: { versionCourante: { select: { source: true } } },
      resolve: f => f.versionCourante?.source ?? null,
    }),
    modifieeLe: t.field({
      type: 'DateTime',
      select: { versionCourante: { select: { createdAt: true } } },
      resolve: f => f.versionCourante?.createdAt ?? f.updatedAt,
    }),
    modifieePar: t.string({
      nullable: true,
      select: {
        versionCourante: { select: { auteur: { select: { name: true } } } },
      },
      resolve: f => f.versionCourante?.auteur?.name ?? null,
    }),
    // Adresses et numéros relevés dans le contenu. Une fiche qui en contient ne peut
    // pas être reversée dans Git (yarn orga:exporter la refuse).
    donneesPersonnelles: t.stringList({
      select: { versionCourante: { select: { contenu: true } } },
      resolve: async f => {
        const configuration = await configurationOrganisation(f.organisationId)
        return donneesPersonnelles(f.versionCourante?.contenu ?? '', {
          domaines: configuration.domainesCourrielAutorises,
          adresses: configuration.adressesRoleAutorisees,
        })
      },
    }),
    peutModifier: t.boolean({
      resolve: (f, _args, ctx) => peutRedigerFiche(ctx, f.perimetreId),
    }),
    // L'historique complet est réservé aux admins.
    versions: t.relation('versions', {
      authScopes: { admin: true },
      query: { orderBy: { createdAt: 'desc' } },
    }),
    versionCouranteId: t.exposeID('versionCouranteId', { nullable: true }),
  }),
})

const DroitRedactionRef = builder.prismaObject('DroitRedaction', {
  fields: t => ({
    id: t.exposeID('id'),
    personne: t.relation('user', { type: PersonneRef }),
    perimetre: t.relation('perimetre', { type: PerimetreRef, nullable: true }),
    accordeLe: t.expose('createdAt', { type: 'DateTime' }),
  }),
})

async function exigerLectureFiche(
  ctx: AppContext,
  fiche: { perimetreId: string | null; organisationId: string }
) {
  if (!(await peutLireFiche(ctx, fiche))) throw accesRefuse()
}

async function exigerRedaction(ctx: AppContext, perimetreId: string | null) {
  if (ctx.personne === null || !(await peutRedigerFiche(ctx, perimetreId))) {
    throw accesRefuse()
  }
  return ctx.personne
}

function contenuValide(contenu: string): string {
  const normalise = normaliserContenu(contenu)
  if (normalise.trim().length === 0)
    throw erreurSaisie('Le contenu est obligatoire.')
  if (normalise.length > TAILLE_MAX_CONTENU) {
    throw erreurSaisie('Le contenu dépasse la taille autorisée.')
  }
  return normalise
}

// ── Champs ajoutés au périmètre et à la tâche ────────────────────────────────

builder.prismaObjectFields(PerimetreRef, t => ({
  fiches: t.prismaField({
    type: [FicheRef],
    resolve: async (query, perimetre, _args, ctx) => {
      if (!(await peutLirePerimetre(ctx, perimetre.id))) throw accesRefuse()
      return prisma.fiche.findMany({
        ...query,
        where: { perimetreId: perimetre.id, archivedAt: null },
        orderBy: { slug: 'asc' },
      })
    },
  }),
  peutRedigerFiches: t.boolean({
    resolve: (perimetre, _args, ctx) => peutRedigerFiche(ctx, perimetre.id),
  }),
}))

builder.prismaObjectFields('Tache', t => ({
  // La fiche liée, si la personne peut la lire.
  fiche: t.prismaField({
    type: FicheRef,
    nullable: true,
    resolve: async (query, tache, _args, ctx) => {
      if (tache.ficheId === null) return null
      const fiche = await prisma.fiche.findUnique({
        ...query,
        where: { id: tache.ficheId },
      })
      return fiche !== null && (await peutLireFiche(ctx, fiche)) ? fiche : null
    },
  }),
}))

// ── Champs ajoutés à la fiche ────────────────────────────────────────────────

builder.prismaObjectFields(FicheRef, t => ({
  // Les tâches d'une édition liées à la fiche, dans les périmètres lisibles.
  taches: t.prismaField({
    type: [TacheRef],
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, fiche, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      const lisibles = await perimetresLisibles(ctx)
      return prisma.tache.findMany({
        ...query,
        where: {
          ficheId: fiche.id,
          editionId: edition.id,
          perimetre: { archivedAt: null },
          perimetreId: { in: lisibles },
        },
        orderBy: [{ echeance: { sort: 'asc', nulls: 'last' } }],
      })
    },
  }),
  // Le nombre de versions suit la règle de l'historique : les autres lisent null.
  nombreVersions: t.int({
    nullable: true,
    resolve: (fiche, _args, ctx) =>
      ctx.personne?.estAdmin
        ? prisma.ficheVersion.count({ where: { ficheId: fiche.id } })
        : null,
  }),
}))

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  // Les fiches lisibles d'une activité : ses fiches communes, puis celles des
  // périmètres accessibles. Sans `activiteId`, la première activité de l'organisation.
  fiches: t.prismaField({
    type: [FicheRef],
    authScopes: { connecte: true },
    args: {
      activiteId: t.arg.id(),
      inclureArchives: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _root, { activiteId, inclureArchives }, ctx) => {
      const activite = await ctx.exigerActivite(activiteId)
      const perimetres = await perimetresLisibles(ctx)
      return prisma.fiche.findMany({
        ...query,
        where: {
          activiteId: activite,
          ...(inclureArchives && ctx.personne?.estAdmin
            ? {}
            : { archivedAt: null }),
          OR: [{ perimetreId: null }, { perimetreId: { in: perimetres } }],
        },
        orderBy: [{ perimetreId: 'asc' }, { slug: 'asc' }],
      })
    },
  }),

  fiche: t.prismaField({
    type: FicheRef,
    nullable: true,
    authScopes: { connecte: true },
    args: { slug: t.arg.string({ required: true }) },
    resolve: async (query, _root, { slug }, ctx) => {
      const fiche = await prisma.fiche.findUnique({
        ...query,
        where: {
          organisationId_slug: { organisationId: ctx.organisation!.id, slug },
        },
      })
      if (fiche === null) {
        if (ctx.personne?.estAdmin) return null
        throw accesRefuse()
      }
      await exigerLectureFiche(ctx, fiche)
      return fiche
    },
  }),

  peutRedigerFichesCommunes: t.boolean({
    authScopes: { connecte: true },
    resolve: (_root, _args, ctx) => peutRedigerFiche(ctx, null),
  }),

  droitsRedaction: t.prismaField({
    type: [DroitRedactionRef],
    authScopes: { admin: true },
    resolve: (query, _root, _args, ctx) =>
      prisma.droitRedaction.findMany({
        ...query,
        where: { organisationId: ctx.organisation!.id },
        orderBy: { createdAt: 'asc' },
      }),
  }),
}))

// ── Écriture ─────────────────────────────────────────────────────────────────

builder.mutationFields(t => ({
  creerFiche: t.prismaField({
    type: FicheRef,
    authScopes: { connecte: true },
    args: {
      slug: t.arg.string({ required: true }),
      titre: t.arg.string({ required: true }),
      contenu: t.arg.string({ required: true }),
      perimetreId: t.arg.id(),
      // Pour une fiche commune ; une fiche de périmètre suit l'activité du périmètre.
      activiteId: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      const perimetreId = args.perimetreId ? String(args.perimetreId) : null
      const auteur = await exigerRedaction(ctx, perimetreId)
      const activiteId =
        perimetreId === null
          ? await ctx.exigerActivite(args.activiteId)
          : (
              await prisma.perimetre.findUniqueOrThrow({
                where: { id: perimetreId },
                select: { activiteId: true },
              })
            ).activiteId
      const titre = texteRequis(args.titre, 'Le titre', 200)
      const contenu = contenuValide(args.contenu)
      const slug = slugValide(args.slug)
      return sansDoublon(
        prisma.$transaction(async tx => {
          const fiche = await tx.fiche.create({
            data: {
              slug,
              perimetreId,
              organisationId: ctx.organisation!.id,
              activiteId,
            },
          })
          const version = await tx.ficheVersion.create({
            data: {
              ficheId: fiche.id,
              titre,
              contenu,
              empreinte: empreinte(titre, contenu),
              source: 'APP',
              auteurId: auteur.id,
            },
          })
          await tx.journal.create({
            data: {
              type: 'FICHE_CREEE',
              acteurId: auteur.id,
              perimetreId,
              ficheId: fiche.id,
            },
          })
          return tx.fiche.update({
            ...query,
            where: { id: fiche.id },
            data: { versionCouranteId: version.id },
          })
        }),
        'Une fiche utilise déjà cet identifiant.'
      )
    },
  }),

  modifierFiche: t.prismaField({
    type: FicheRef,
    authScopes: { connecte: true },
    args: {
      id: t.arg.id({ required: true }),
      titre: t.arg.string({ required: true }),
      contenu: t.arg.string({ required: true }),
      resume: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const fiche = await prisma.fiche.findFirst({
        where: { id: String(args.id), organisationId: ctx.organisation!.id },
        include: { versionCourante: { select: { empreinte: true } } },
      })
      if (fiche === null) throw accesRefuse()
      const auteur = await exigerRedaction(ctx, fiche.perimetreId)
      const titre = texteRequis(args.titre, 'Le titre', 200)
      const contenu = contenuValide(args.contenu)
      const nouvelleEmpreinte = empreinte(titre, contenu)

      // Rien n'a changé : aucune version n'est créée.
      if (fiche.versionCourante?.empreinte === nouvelleEmpreinte) {
        return prisma.fiche.findUniqueOrThrow({
          ...query,
          where: { id: fiche.id },
        })
      }
      return prisma.$transaction(async tx => {
        const version = await tx.ficheVersion.create({
          data: {
            ficheId: fiche.id,
            titre,
            contenu,
            empreinte: nouvelleEmpreinte,
            source: 'APP',
            resume: args.resume?.trim() || null,
            auteurId: auteur.id,
          },
        })
        await tx.journal.create({
          data: {
            type: 'FICHE_MODIFIEE',
            acteurId: auteur.id,
            perimetreId: fiche.perimetreId,
            ficheId: fiche.id,
          },
        })
        return tx.fiche.update({
          ...query,
          where: { id: fiche.id },
          data: { versionCouranteId: version.id },
        })
      })
    },
  }),

  // Restaurer une version en crée une nouvelle : l'historique ne se réécrit jamais.
  restaurerVersionFiche: t.prismaField({
    type: FicheRef,
    authScopes: { admin: true },
    args: { versionId: t.arg.id({ required: true }) },
    resolve: async (query, _root, { versionId }, ctx) => {
      const ancienne = await prisma.ficheVersion.findFirst({
        where: {
          id: String(versionId),
          fiche: { organisationId: ctx.organisation!.id },
        },
      })
      if (ancienne === null)
        throw erreurSaisie('Cette version est introuvable.')
      const date = ancienne.createdAt.toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris',
      })
      return prisma.$transaction(async tx => {
        const version = await tx.ficheVersion.create({
          data: {
            ficheId: ancienne.ficheId,
            titre: ancienne.titre,
            contenu: ancienne.contenu,
            empreinte: ancienne.empreinte,
            source: 'APP',
            resume: `Restauration de la version du ${date}`,
            auteurId: ctx.personne!.id,
          },
        })
        return tx.fiche.update({
          ...query,
          where: { id: ancienne.ficheId },
          data: { versionCouranteId: version.id },
        })
      })
    },
  }),

  archiverFiche: t.prismaField({
    type: FicheRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      archive: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, { id, archive }, ctx) => {
      const fiche = await prisma.fiche.findFirst({
        where: { id: String(id), organisationId: ctx.organisation!.id },
        select: { id: true },
      })
      if (fiche === null) throw accesRefuse()
      return prisma.fiche.update({
        ...query,
        where: { id: fiche.id },
        data: { archivedAt: archive ? new Date() : null },
      })
    },
  }),

  accorderDroitRedaction: t.prismaField({
    type: DroitRedactionRef,
    authScopes: { admin: true },
    args: { personneId: t.arg.id({ required: true }), perimetreId: t.arg.id() },
    resolve: async (query, _root, args, ctx) => {
      const userId = String(args.personneId)
      const perimetreId = args.perimetreId ? String(args.perimetreId) : null
      const organisationId = ctx.organisation!.id
      await exigerMembre(ctx, userId)
      if (perimetreId !== null) {
        const perimetre = await prisma.perimetre.findFirst({
          where: { id: perimetreId, organisationId },
          select: { id: true },
        })
        if (perimetre === null) throw accesRefuse()
      }
      // MariaDB ne rend pas un index unique efficace sur une colonne nulle :
      // le doublon se vérifie ici.
      const existant = await prisma.droitRedaction.findFirst({
        where: { userId, perimetreId, organisationId },
      })
      if (existant !== null) {
        throw erreurSaisie('Cette personne a déjà ce droit de rédaction.')
      }
      return prisma.droitRedaction.create({
        ...query,
        data: {
          organisationId,
          userId,
          perimetreId,
          accordeParId: ctx.personne!.id,
        },
      })
    },
  }),

  retirerDroitRedaction: t.boolean({
    authScopes: { admin: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const { count } = await prisma.droitRedaction.deleteMany({
        where: { id: String(id), organisationId: ctx.organisation!.id },
      })
      return count === 1
    },
  }),
}))
