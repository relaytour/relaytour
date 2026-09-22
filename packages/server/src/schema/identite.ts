import { Prisma, prisma, type Activite } from '@relaytour/database'
import type { z } from 'zod'

import { erreurSaisie } from '../lib/erreurs.ts'
import { EXTENSIONS, verifierMedia, type TypeMedia } from '../lib/medias.ts'
import {
  configurationOrganisation,
  DeclarationOrganisationSchema,
  IdentiteActiviteSchema,
  invaliderConfigurationOrganisation,
  lireIdentiteActivite,
  manquementsIdentiteActivite,
  surchargerParActivite,
  urlMedia,
  type ConfigurationActivite,
  type DeclarationOrganisation,
  type IdentiteActivite,
} from '../lib/organisation.ts'
import { texteRequis } from '../lib/saisie.ts'
import { marquerContenuModifie } from '../lib/synchronisation.ts'
import { archiveZip } from '../lib/zip.ts'
import { construireContenu } from '../orga/exporter.ts'

import { ActiviteRef } from './activites.ts'
import { builder } from './builder.ts'
import { ThemeRef } from './organisation.ts'

// Identité de l'organisation et de ses activités (ADR 0009) : les admins la
// modifient dans l'application, sans passer par l'hébergeur. Le slug, le statut
// et les limites restent à l'administration de l'installation (ADR 0008).

function messageValidation(
  issues: readonly { path: readonly PropertyKey[]; message: string }[]
): string {
  return issues
    .map(i => `${i.path.map(String).join('.') || 'identité'} : ${i.message}`)
    .join(' ; ')
}

function valider<T>(schema: z.ZodType<T>, valeur: unknown): T {
  const r = schema.safeParse(valeur)
  if (!r.success) throw erreurSaisie(messageValidation(r.error.issues))
  return r.data
}

/** La déclaration de l'organisation en base, validée. */
async function declarationEnBase(
  organisationId: string
): Promise<DeclarationOrganisation> {
  const ligne = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { configuration: true },
  })
  const r = DeclarationOrganisationSchema.safeParse(ligne.configuration)
  if (!r.success) {
    throw erreurSaisie(
      'La configuration de l’organisation est invalide : l’hébergeur doit la réimporter.'
    )
  }
  return r.data
}

/** Vérifie qu'une image appartient à l'organisation et a le format attendu. */
async function exigerMedia(
  organisationId: string,
  empreinte: string | null | undefined,
  format: 'png' | 'svg'
): Promise<string | undefined> {
  if (empreinte === null || empreinte === undefined || empreinte === '')
    return undefined
  const media = await prisma.media.findUnique({
    where: { organisationId_empreinte: { organisationId, empreinte } },
    select: { type: true },
  })
  if (media === null || EXTENSIONS[media.type as TypeMedia] !== format) {
    throw erreurSaisie(
      format === 'png'
        ? 'Choisissez une image PNG téléversée pour cette organisation.'
        : 'Choisissez une image SVG téléversée pour cette organisation.'
    )
  }
  return empreinte
}

function texteFacultatif(
  valeur: string | null | undefined
): string | undefined {
  const texte = valeur?.trim()
  return texte === undefined || texte === '' ? undefined : texte
}

// ── Types ──────────────────────────────────────────────────────────────────

const MediaTeleverseRef = builder
  .objectRef<{ empreinte: string; url: string }>('MediaTeleverse')
  .implement({
    description:
      'Image enregistrée pour l’organisation, désignée par son empreinte.',
    fields: t => ({
      empreinte: t.exposeString('empreinte'),
      url: t.exposeString('url'),
    }),
  })

const FormatMediaEnum = builder.enumType('FormatMedia', {
  values: { PNG: { value: 'png' }, SVG: { value: 'svg' } } as const,
})

interface IdentiteOrganisation {
  declaration: DeclarationOrganisation
  contenuModifieLe: Date | null
  contenuSynchroniseLe: Date | null
}

const IdentiteOrganisationRef = builder
  .objectRef<IdentiteOrganisation>('IdentiteOrganisation')
  .implement({
    description:
      'Identité de l’organisation telle que ses admins la déclarent. Réservée aux admins.',
    fields: t => ({
      slug: t.string({ resolve: i => i.declaration.slug }),
      nom: t.string({ resolve: i => i.declaration.nom }),
      sigle: t.string({ nullable: true, resolve: i => i.declaration.sigle }),
      contactRecrutement: t.string({
        nullable: true,
        resolve: i => i.declaration.contactRecrutement,
      }),
      pageEquipe: t.string({
        nullable: true,
        resolve: i => i.declaration.pageEquipe,
      }),
      domainesCourrielAutorises: t.stringList({
        description:
          'Domaines des adresses de rôle. Une adresse de ces domaines passe pour institutionnelle. Ils ne limitent pas les invitations.',
        resolve: i => i.declaration.domainesCourrielAutorises,
      }),
      adressesRoleAutorisees: t.stringList({
        description:
          'Adresses de rôle hébergées chez une messagerie grand public, autorisées une par une.',
        resolve: i => i.declaration.adressesRoleAutorisees,
      }),
      logoPng: t.string({
        nullable: true,
        resolve: i => i.declaration.logo?.png,
      }),
      logoSvg: t.string({
        nullable: true,
        resolve: i => i.declaration.logo?.svg,
      }),
      favicon: t.string({
        nullable: true,
        resolve: i => i.declaration.favicon,
      }),
      logoUrl: t.string({
        nullable: true,
        resolve: i =>
          urlMedia(i.declaration.logo?.svg, 'svg') ??
          urlMedia(i.declaration.logo?.png, 'png') ??
          i.declaration.logoUrl,
      }),
      faviconUrl: t.string({
        nullable: true,
        resolve: i =>
          urlMedia(i.declaration.favicon, 'png') ?? i.declaration.faviconUrl,
      }),
      theme: t.field({
        type: 'JSONObject',
        nullable: true,
        description:
          'Thème déclaré, partiel : le thème par défaut complète les valeurs absentes.',
        resolve: i => i.declaration.theme ?? null,
      }),
      contenuModifieLe: t.field({
        type: 'DateTime',
        nullable: true,
        resolve: i => i.contenuModifieLe,
      }),
      contenuSynchroniseLe: t.field({
        type: 'DateTime',
        nullable: true,
        resolve: i => i.contenuSynchroniseLe,
      }),
    }),
  })

const IdentiteActiviteRef = builder
  .objectRef<IdentiteActivite>('IdentiteActivite')
  .implement({
    description:
      'Identité propre d’une activité. Chaque champ absent reprend la valeur de l’organisation.',
    fields: t => ({
      contactRecrutement: t.string({
        nullable: true,
        resolve: i => i.contactRecrutement,
      }),
      pageEquipe: t.string({ nullable: true, resolve: i => i.pageEquipe }),
      logoPng: t.string({ nullable: true, resolve: i => i.logo?.png }),
      logoSvg: t.string({ nullable: true, resolve: i => i.logo?.svg }),
      logoUrl: t.string({
        nullable: true,
        resolve: i =>
          urlMedia(i.logo?.svg, 'svg') ?? urlMedia(i.logo?.png, 'png'),
      }),
      theme: t.field({
        type: 'JSONObject',
        nullable: true,
        description:
          'Couleurs et fond qui surchargent le thème de l’organisation.',
        resolve: i => i.theme ?? null,
      }),
    }),
  })

// Chaque activité expose son identité résolue : celle de l'organisation,
// surchargée par la sienne. L'espace organisateur l'applique quand l'activité
// s'affiche.
async function configurationDe(
  activite: Activite,
  organisationId: string
): Promise<ConfigurationActivite> {
  return surchargerParActivite(
    await configurationOrganisation(organisationId),
    activite,
    lireIdentiteActivite(activite.identite)
  )
}

builder.prismaObjectFields('Activite', t => ({
  identite: t.field({
    type: IdentiteActiviteRef,
    resolve: a => lireIdentiteActivite(a.identite),
  }),
  logoUrl: t.string({
    nullable: true,
    description: 'Le logo de l’activité, sinon celui de l’organisation.',
    resolve: async a => (await configurationDe(a, a.organisationId)).logoUrl,
  }),
  contactRecrutement: t.string({
    nullable: true,
    resolve: async a =>
      (await configurationDe(a, a.organisationId)).contactRecrutement,
  }),
  pageEquipe: t.string({
    nullable: true,
    resolve: async a => (await configurationDe(a, a.organisationId)).pageEquipe,
  }),
  theme: t.field({
    type: ThemeRef,
    description:
      'Le thème de l’organisation, dont l’activité surcharge les couleurs et le fond.',
    resolve: async a => (await configurationDe(a, a.organisationId)).theme,
  }),
}))

const ArchiveContenuRef = builder
  .objectRef<{ nomFichier: string; donnees: string }>('ArchiveContenu')
  .implement({
    description:
      'Dossier de contenu de l’organisation, en archive zip encodée en base64. Il ne contient aucune donnée personnelle.',
    fields: t => ({
      nomFichier: t.exposeString('nomFichier'),
      donnees: t.exposeString('donnees'),
    }),
  })

// ── Requêtes ───────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  identiteOrganisation: t.field({
    type: IdentiteOrganisationRef,
    authScopes: { admin: true },
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const ligne = await prisma.organisation.findUniqueOrThrow({
        where: { id: organisationId },
        select: { contenuModifieLe: true, contenuSynchroniseLe: true },
      })
      return {
        declaration: await declarationEnBase(organisationId),
        ...ligne,
      }
    },
  }),

  // L'export reste ouvert à une organisation en lecture seule : une limite ne
  // bloque jamais la lecture ni l'export (ADR 0008).
  exportContenu: t.field({
    type: ArchiveContenuRef,
    authScopes: { admin: true },
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const contenu = await construireContenu(prisma, organisationId)
      if (contenu.refusees.length > 0) {
        throw erreurSaisie(
          `L’export est incomplet : ${contenu.refusees
            .map(r => `${r.fichier} (${r.raison})`)
            .join(' ; ')}. Corrigez ces fichiers, puis relancez l’export.`
        )
      }
      const date = new Date().toISOString().slice(0, 10)
      return {
        nomFichier: `contenu-${ctx.organisation!.slug}-${date}.zip`,
        donnees: archiveZip(contenu.fichiers).toString('base64'),
      }
    },
  }),
}))

// ── Mutations ──────────────────────────────────────────────────────────────

builder.mutationFields(t => ({
  // Un admin d'activité téléverse le logo de son activité.
  televerserMedia: t.field({
    type: MediaTeleverseRef,
    authScopes: { gestion: true },
    description:
      'Enregistre une image de l’organisation : PNG de 512 Ko au plus, ou SVG de 128 Ko au plus, sans script.',
    args: {
      format: t.arg({ type: FormatMediaEnum, required: true }),
      // Le fichier encodé en base64.
      donnees: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      let media: ReturnType<typeof verifierMedia>
      try {
        media = verifierMedia(Buffer.from(args.donnees, 'base64'), args.format)
      } catch (e) {
        throw erreurSaisie((e as Error).message)
      }
      await prisma.media.upsert({
        where: {
          organisationId_empreinte: {
            organisationId,
            empreinte: media.empreinte,
          },
        },
        update: {},
        create: {
          organisationId,
          empreinte: media.empreinte,
          type: media.type,
          octets: media.octets,
          donnees: new Uint8Array(media.donnees),
        },
      })
      return {
        empreinte: media.empreinte,
        url: urlMedia(media.empreinte, args.format)!,
      }
    },
  }),

  modifierIdentiteOrganisation: t.field({
    type: IdentiteOrganisationRef,
    authScopes: { admin: true },
    description:
      'Remplace l’identité de l’organisation. Le slug, le fuseau horaire, le statut et les limites ne changent pas ici.',
    args: {
      nom: t.arg.string({ required: true }),
      sigle: t.arg.string(),
      contactRecrutement: t.arg.string(),
      pageEquipe: t.arg.string(),
      domainesCourrielAutorises: t.arg.stringList({ required: true }),
      adressesRoleAutorisees: t.arg.stringList({ required: true }),
      logoPng: t.arg.string(),
      logoSvg: t.arg.string(),
      favicon: t.arg.string(),
      theme: t.arg({ type: 'JSONObject' }),
    },
    resolve: async (_root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const actuelle = await declarationEnBase(organisationId)
      const logoPng = await exigerMedia(organisationId, args.logoPng, 'png')
      const logoSvg = await exigerMedia(organisationId, args.logoSvg, 'svg')
      if (logoSvg !== undefined && logoPng === undefined) {
        throw erreurSaisie(
          'Un logo SVG s’accompagne d’un logo PNG : les mails n’affichent pas le SVG.'
        )
      }
      const favicon = await exigerMedia(organisationId, args.favicon, 'png')
      const declaration = valider(DeclarationOrganisationSchema, {
        ...actuelle,
        nom: texteRequis(args.nom, 'Le nom'),
        sigle: texteFacultatif(args.sigle),
        contactRecrutement: texteFacultatif(args.contactRecrutement),
        pageEquipe: texteFacultatif(args.pageEquipe),
        domainesCourrielAutorises: args.domainesCourrielAutorises,
        adressesRoleAutorisees: args.adressesRoleAutorisees,
        logo:
          logoPng === undefined
            ? undefined
            : {
                png: logoPng,
                ...(logoSvg === undefined ? {} : { svg: logoSvg }),
              },
        favicon,
        theme: args.theme ?? undefined,
      })
      // Les activités gardent une identité valide : un contact qui cesserait
      // d'être une adresse de rôle, ou un contraste qui deviendrait insuffisant,
      // bloque la modification.
      const activites = await prisma.activite.findMany({
        where: { organisationId, archivedAt: null },
        select: { nom: true, identite: true },
      })
      for (const activite of activites) {
        const manquements = manquementsIdentiteActivite(
          lireIdentiteActivite(activite.identite),
          declaration
        )
        if (manquements.length > 0) {
          throw erreurSaisie(
            `L’activité « ${activite.nom} » ne serait plus valide : ${messageValidation(manquements)}.`
          )
        }
      }
      const ligne = await prisma.organisation.update({
        where: { id: organisationId },
        data: {
          nom: declaration.nom,
          sigle: declaration.sigle ?? null,
          configuration: declaration,
          contenuModifieLe: new Date(),
        },
        select: { contenuModifieLe: true, contenuSynchroniseLe: true },
      })
      invaliderConfigurationOrganisation()
      return { declaration, ...ligne }
    },
  }),

  modifierIdentiteActivite: t.prismaField({
    type: ActiviteRef,
    authScopes: { gestion: true },
    description:
      'Remplace l’identité propre d’une activité. Un champ vide reprend la valeur de l’organisation.',
    args: {
      id: t.arg.id({ required: true }),
      contactRecrutement: t.arg.string(),
      pageEquipe: t.arg.string(),
      logoPng: t.arg.string(),
      logoSvg: t.arg.string(),
      theme: t.arg({ type: 'JSONObject' }),
    },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const id = await ctx.exigerActivite(args.id)
      await ctx.exigerAdminDe(id)
      const logoPng = await exigerMedia(organisationId, args.logoPng, 'png')
      const logoSvg = await exigerMedia(organisationId, args.logoSvg, 'svg')
      if (logoSvg !== undefined && logoPng === undefined) {
        throw erreurSaisie(
          'Un logo SVG s’accompagne d’un logo PNG : les mails n’affichent pas le SVG.'
        )
      }
      const identite = valider(IdentiteActiviteSchema, {
        contactRecrutement: texteFacultatif(args.contactRecrutement),
        pageEquipe: texteFacultatif(args.pageEquipe),
        logo:
          logoPng === undefined
            ? undefined
            : {
                png: logoPng,
                ...(logoSvg === undefined ? {} : { svg: logoSvg }),
              },
        theme: args.theme ?? undefined,
      })
      const manquements = manquementsIdentiteActivite(
        identite,
        await declarationEnBase(organisationId)
      )
      if (manquements.length > 0) {
        throw erreurSaisie(messageValidation(manquements))
      }
      const vide = Object.values(identite).every(v => v === undefined)
      const activite = await prisma.activite.update({
        ...query,
        where: { id },
        data: { identite: vide ? Prisma.DbNull : identite },
      })
      await marquerContenuModifie(organisationId)
      return activite
    },
  }),
}))
