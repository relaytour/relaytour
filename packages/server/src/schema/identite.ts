import { estUneLangue } from '@relaytour/commun'
import { Prisma, prisma, type Activite } from '@relaytour/database'
import type { z } from 'zod'

import { adresseDeRole } from '../lib/contenu.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import { construireExport } from '../lib/export.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import {
  EXTENSIONS,
  verifierIconeApplication,
  verifierMedia,
  type TypeMedia,
} from '../lib/medias.ts'
import {
  configurationOrganisation,
  DeclarationOrganisationSchema,
  lireDeclaration,
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
import { PersonneRef } from './personnes.ts'

// Identité de l'organisation et de ses activités (ADR 0009) : les admins la
// modifient dans l'application, sans passer par l'hébergeur. Le slug, le statut
// et les limites restent à l'administration de l'installation (ADR 0008).

function messageValidation(
  issues: readonly { path: readonly PropertyKey[]; message: string }[]
): string {
  return issues
    .map(
      i =>
        `${i.path.map(String).join('.') || i18n._('identité')} : ${i.message}`
    )
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
  const r = lireDeclaration(ligne.configuration)
  if (r.etat !== 'valide') {
    throw erreurSaisie(
      i18n._(
        'La configuration de l’organisation est invalide : l’hébergeur doit la réimporter.'
      )
    )
  }
  return r.declaration
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
        ? i18n._('Choisissez une image PNG téléversée pour cette organisation.')
        : i18n._('Choisissez une image SVG téléversée pour cette organisation.')
    )
  }
  return empreinte
}

/** L'icône d'application : une image PNG de l'organisation, aux dimensions exigées (ADR 0023). */
async function exigerIconeApplication(
  organisationId: string,
  empreinte: string | null | undefined
): Promise<string | undefined> {
  const icone = await exigerMedia(organisationId, empreinte, 'png')
  if (icone === undefined) return undefined
  const media = await prisma.media.findUnique({
    where: { organisationId_empreinte: { organisationId, empreinte: icone } },
    select: { donnees: true },
  })
  try {
    verifierIconeApplication(Buffer.from(media!.donnees))
  } catch (e) {
    throw erreurSaisie((e as Error).message)
  }
  return icone
}

function texteFacultatif(
  valeur: string | null | undefined
): string | undefined {
  const texte = valeur?.trim()
  return texte === undefined || texte === '' ? undefined : texte
}

// ── Types ──────────────────────────────────────────────────────────────────

/** Images gardées par organisation : logos, favicons et icônes, actuels et récents. */
const MEDIAS_MAX = 50

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
      contactSupport: t.string({
        nullable: true,
        description:
          'Adresse de rôle que le bouton « Support » ouvre dans la messagerie de la personne.',
        resolve: i => i.declaration.contactSupport,
      }),
      pageEquipe: t.string({
        nullable: true,
        resolve: i => i.declaration.pageEquipe,
      }),
      langue: t.string({
        nullable: true,
        description:
          'Langue par défaut des membres qui n’en ont pas choisi (ADR 0047).',
        resolve: i => i.declaration.langue,
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
      expediteurRecoitReponses: t.boolean({
        description:
          'La boîte de l’expéditeur des mails reçoit les réponses. Faux quand l’installation déclare COURRIEL_EXPEDITEUR_SANS_REPONSE (ADR 0053).',
        resolve: async () =>
          (await configurationOrganisation()).expediteurRecoitReponses,
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
      iconeApplication: t.string({
        nullable: true,
        description:
          'Empreinte de l’icône de l’application installée : un PNG carré de 512 pixels (ADR 0023).',
        resolve: i => i.declaration.iconeApplication,
      }),
      iconeApplicationUrl: t.string({
        nullable: true,
        resolve: i => urlMedia(i.declaration.iconeApplication, 'png'),
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
export async function configurationDe(
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
  reponsesRecues: t.boolean({
    description:
      'Une boîte reçoit les réponses aux mails de l’activité : son contact, celui de l’organisation, ou l’expéditeur de l’installation (ADR 0053).',
    resolve: async a => {
      const configuration = await configurationDe(a, a.organisationId)
      return (
        configuration.contactRecrutement !== undefined ||
        configuration.expediteurRecoitReponses
      )
    },
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

const ExportOrganisationRef = builder
  .objectRef<{ nomFichier: string; donnees: string }>('ExportOrganisation')
  .implement({
    description:
      'Export complet de l’organisation au format JSON (ADR 0008) : activités, fiches, tâches, membres et affectations. Il contient des noms et des adresses.',
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
        const fichiers = contenu.refusees
          .map(r => `${r.fichier} (${r.raison})`)
          .join(' ; ')
        throw erreurSaisie(
          i18n._(
            'L’export est incomplet : {fichiers}. Corrigez ces fichiers, puis relancez l’export.',
            { fichiers }
          )
        )
      }
      const date = new Date().toISOString().slice(0, 10)
      return {
        nomFichier: `contenu-${ctx.organisation!.slug}-${date}.zip`,
        donnees: archiveZip(contenu.fichiers).toString('base64'),
      }
    },
  }),

  // Un admin de l'organisation télécharge l'export complet, même en lecture seule :
  // une limite ou la fin d'un essai ne bloque jamais l'export (ADR 0057).
  exportOrganisation: t.field({
    type: ExportOrganisationRef,
    authScopes: { admin: true },
    resolve: async (_root, _args, ctx) => {
      const organisation = ctx.organisation!
      const donnees = JSON.stringify(
        await construireExport(organisation.id),
        null,
        2
      )
      journal.info(
        {
          evenement: 'export-telecharge',
          organisation: organisation.slug,
          octets: Buffer.byteLength(donnees),
        },
        'Un admin a téléchargé l’export de son organisation.'
      )
      const date = new Date().toISOString().slice(0, 10)
      return {
        nomFichier: `export-${organisation.slug}-${date}.json`,
        donnees: donnees + '\n',
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
      // Au plus MEDIAS_MAX images par organisation ; la purge nocturne retire celles
      // qu'aucune identité ne cite plus (lib/purge.ts). Le comptage et l'écriture se
      // font sous le verrou de l'organisation : deux envois simultanés ne dépassent
      // pas la limite ensemble.
      await sousVerrouOrganisation(organisationId, async tx => {
        const existante = await tx.media.count({
          where: { organisationId, empreinte: media.empreinte },
        })
        if (existante === 0) {
          const total = await tx.media.count({ where: { organisationId } })
          if (total >= MEDIAS_MAX) {
            throw erreurSaisie(
              i18n._(
                'L’organisation a déjà {max} images : les images que l’identité ne cite plus sont retirées chaque nuit.',
                { max: MEDIAS_MAX }
              )
            )
          }
        }
        await tx.media.upsert({
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
      contactSupport: t.arg.string(),
      pageEquipe: t.arg.string(),
      // Absente, la langue ne change pas : un client antérieur ne l'envoie pas.
      // Nulle, elle s'efface et le français s'applique (ADR 0047).
      langue: t.arg.string(),
      domainesCourrielAutorises: t.arg.stringList({ required: true }),
      adressesRoleAutorisees: t.arg.stringList({ required: true }),
      logoPng: t.arg.string(),
      logoSvg: t.arg.string(),
      favicon: t.arg.string(),
      iconeApplication: t.arg.string(),
      theme: t.arg({ type: 'JSONObject' }),
    },
    resolve: async (_root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      if (
        args.langue !== undefined &&
        args.langue !== null &&
        !estUneLangue(args.langue)
      ) {
        throw erreurSaisie(i18n._('Cette langue n’est pas proposée.'))
      }
      const actuelle = await declarationEnBase(organisationId)
      const logoPng = await exigerMedia(organisationId, args.logoPng, 'png')
      const logoSvg = await exigerMedia(organisationId, args.logoSvg, 'svg')
      if (logoSvg !== undefined && logoPng === undefined) {
        throw erreurSaisie(
          i18n._(
            'Un logo SVG s’accompagne d’un logo PNG : les mails n’affichent pas le SVG.'
          )
        )
      }
      const favicon = await exigerMedia(organisationId, args.favicon, 'png')
      const iconeApplication = await exigerIconeApplication(
        organisationId,
        args.iconeApplication
      )
      const declaration = valider(DeclarationOrganisationSchema, {
        ...actuelle,
        nom: texteRequis(args.nom, i18n._('Le nom')),
        sigle: texteFacultatif(args.sigle),
        contactRecrutement: texteFacultatif(args.contactRecrutement),
        contactSupport: texteFacultatif(args.contactSupport),
        pageEquipe: texteFacultatif(args.pageEquipe),
        langue:
          args.langue === undefined
            ? actuelle.langue
            : (args.langue ?? undefined),
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
        iconeApplication,
        theme: args.theme ?? undefined,
      })
      // Les activités gardent une identité valide : un contact qui cesserait
      // d'être une adresse de rôle, ou un contraste qui deviendrait insuffisant,
      // bloque la modification.
      const activites = await prisma.activite.findMany({
        where: { organisationId, archivedAt: null },
        select: { nom: true, identite: true, formulaireOuvert: true },
      })
      for (const activite of activites) {
        const identite = lireIdentiteActivite(activite.identite)
        const manquements = manquementsIdentiteActivite(identite, declaration)
        if (manquements.length > 0) {
          throw erreurSaisie(
            i18n._('L’activité « {nom} » ne serait plus valide : {details}.', {
              nom: activite.nom,
              details: messageValidation(manquements),
            })
          )
        }
        // Un formulaire public ouvert cite un contact (ADR 0015).
        if (
          activite.formulaireOuvert &&
          declaration.contactRecrutement === undefined &&
          identite.contactRecrutement === undefined
        ) {
          throw erreurSaisie(
            i18n._(
              'Le formulaire public de l’activité « {nom} » cite ce contact : fermez d’abord le formulaire, ou gardez un contact.',
              { nom: activite.nom }
            )
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
          i18n._(
            'Un logo SVG s’accompagne d’un logo PNG : les mails n’affichent pas le SVG.'
          )
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
      const declaration = await declarationEnBase(organisationId)
      const manquements = manquementsIdentiteActivite(identite, declaration)
      if (manquements.length > 0) {
        throw erreurSaisie(messageValidation(manquements))
      }
      // Un formulaire public ouvert cite un contact (ADR 0015) : le dernier contact
      // ne se retire pas tant que le formulaire est ouvert.
      if (
        identite.contactRecrutement === undefined &&
        declaration.contactRecrutement === undefined &&
        (await prisma.activite.count({
          where: { id, formulaireOuvert: true },
        })) > 0
      ) {
        throw erreurSaisie(
          i18n._(
            'Le formulaire public de l’activité cite ce contact : fermez d’abord le formulaire, ou gardez un contact.'
          )
        )
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

// Une personne reprend sa propre adresse comme contact seulement si elle passe
// déjà pour une adresse de rôle de l'organisation (ADR 0053). Elle seule le lit :
// toute autre personne lit null.
builder.prismaObjectFields(PersonneRef, t => ({
  adresseDeRole: t.boolean({
    nullable: true,
    description:
      'L’adresse de la personne est une adresse de rôle de son organisation active. Lue par la personne seule.',
    select: { email: true },
    resolve: async (u, _args, ctx) => {
      if (ctx.personne?.id !== u.id || ctx.organisation === null) return null
      const configuration = await configurationOrganisation(ctx.organisation.id)
      return adresseDeRole(u.email, {
        domaines: configuration.domainesCourrielAutorises,
        adresses: configuration.adressesRoleAutorisees,
      })
    },
  }),
}))
