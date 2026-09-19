import {
  fusionnerTheme,
  pile,
  POLICES_DISPONIBLES,
  themeParDefaut,
  verifierAccessibilite,
  type CouleursTheme,
  type Theme,
} from '@relaytour/tokens'
import { z } from 'zod'

import type { Env } from '../env.ts'

import { domainesAutorises } from './contenu.ts'

// Configuration de l'organisation (ADR 0006, lot commun). Un seul objet, lu par
// l'API, les mails et les scripts. Sources, dans l'ordre : la ligne `Organisation`
// en base quand elle existe, sinon les variables d'environnement d'amorçage
// (ORGANISATION_NOM, DOMAINES_COURRIEL_AUTORISES, CONTACT_RECRUTEMENT, PAGE_EQUIPE).
// L'expéditeur des mails et l'origine de l'espace organisateur viennent toujours
// de l'environnement : ils dépendent de l'hébergement, pas de l'organisation.
//
// Ce module n'importe pas env.ts : le schéma GraphQL le charge, et l'impression du
// schéma doit fonctionner sans .env (invariant 12). L'environnement se lit à l'appel.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DOMAINE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/
const COULEUR = /^#[0-9A-Fa-f]{6}$/
const ADRESSE = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/
const URL_PUBLIQUE = /^(https:\/\/|\/)/

const Couleur = z.string().regex(COULEUR, 'couleur au format #RRGGBB')
const Police = z.enum(POLICES_DISPONIBLES)

const CLES_COULEURS = [
  'encre',
  'primaire',
  'primaireClair',
  'accent',
  'accentClair',
  'succes',
  'succesClair',
  'alerte',
  'alerteClair',
  'erreur',
  'erreurClair',
  'sol1',
  'sol2',
  'sol3',
] as const satisfies readonly (keyof CouleursTheme)[]

/** Un thème tel qu'une organisation le déclare : polices nommées, valeurs partielles. */
export const ThemeDeclareSchema = z.strictObject({
  couleurs: z
    .strictObject(
      Object.fromEntries(CLES_COULEURS.map(cle => [cle, Couleur.optional()]))
    )
    .optional(),
  polices: z
    .strictObject({
      texte: Police.optional(),
      titre: Police.optional(),
      mono: Police.optional(),
    })
    .optional(),
  typographie: z
    .strictObject({
      graisseTitre: z.number().int().min(100).max(900).optional(),
      graisseCorps: z.number().int().min(100).max(900).optional(),
      espacementTitre: z
        .string()
        .regex(/^-?\d+(\.\d+)?em$/, 'espacement en em, par exemple -0.02em')
        .optional(),
      echelleTitre: z.number().min(0.5).max(2).optional(),
    })
    .optional(),
})

export type ThemeDeclare = z.infer<typeof ThemeDeclareSchema>

/** Le thème complet d'une déclaration partielle, polices converties en piles CSS. */
export function resoudreTheme(declare: ThemeDeclare | undefined): Theme {
  if (declare === undefined) return themeParDefaut
  const couleurs = Object.fromEntries(
    Object.entries(declare.couleurs ?? {}).filter(([, v]) => v !== undefined)
  ) as Partial<CouleursTheme>
  const polices = Object.fromEntries(
    Object.entries(declare.polices ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([cle, famille]) => [cle, pile(famille)])
  )
  const typographie = Object.fromEntries(
    Object.entries(declare.typographie ?? {}).filter(([, v]) => v !== undefined)
  )
  return fusionnerTheme({ couleurs, polices, typographie })
}

function fuseauValide(fuseau: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau })
    return true
  } catch {
    return false
  }
}

/**
 * Ce qu'une organisation déclare (organisation.yaml de son dépôt, puis ligne en base).
 * Aucun secret, aucune valeur d'hébergement.
 */
export const DeclarationOrganisationSchema = z
  .strictObject({
    slug: z.string().regex(SLUG, 'minuscules, chiffres et tirets seulement').max(60),
    nom: z.string().trim().min(1).max(120),
    sigle: z.string().trim().min(1).max(20).optional(),
    fuseauHoraire: z
      .string()
      .default('Europe/Paris')
      .refine(fuseauValide, 'fuseau horaire inconnu (forme Europe/Paris)'),
    domainesCourrielAutorises: z
      .array(z.string().trim().toLowerCase().regex(DOMAINE, 'domaine attendu'))
      .default([]),
    contactRecrutement: z.string().trim().toLowerCase().regex(ADRESSE, 'adresse mail attendue').optional(),
    pageEquipe: z.string().trim().url().optional(),
    logoUrl: z.string().trim().regex(URL_PUBLIQUE, 'adresse https ou chemin absolu').optional(),
    faviconUrl: z.string().trim().regex(URL_PUBLIQUE, 'adresse https ou chemin absolu').optional(),
    theme: ThemeDeclareSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.contactRecrutement !== undefined) {
      const domaine = ADRESSE.exec(v.contactRecrutement)?.[1] ?? ''
      if (!v.domainesCourrielAutorises.includes(domaine)) {
        ctx.addIssue({
          code: 'custom',
          path: ['contactRecrutement'],
          message: `le domaine ${domaine} n'est pas dans domainesCourrielAutorises`,
        })
      }
    }
    const manquements = verifierAccessibilite(resoudreTheme(v.theme))
    for (const m of manquements) {
      ctx.addIssue({
        code: 'custom',
        path: ['theme', 'couleurs', m.couleur],
        message: `contraste ${m.rapport.toFixed(2)} sur ${m.fond}, 4,5 attendu`,
      })
    }
  })

export type DeclarationOrganisation = z.infer<typeof DeclarationOrganisationSchema>

/** La configuration résolue, jamais partielle. */
export interface ConfigurationOrganisation {
  /** Identifiant de la ligne en base, null tant qu'elle n'existe pas. */
  id: string | null
  slug: string
  nom: string
  sigle: string | undefined
  /** Le sigle s'il existe, sinon le nom : en-tête, sujets de mail, appel aux référent·es. */
  nomCourt: string
  fuseauHoraire: string
  expediteur: string
  origineOrga: string
  domainesCourrielAutorises: string[]
  contactRecrutement: string | undefined
  pageEquipe: string | undefined
  logoUrl: string | undefined
  faviconUrl: string | undefined
  theme: Theme
}

type SourceEnv = Pick<
  Env,
  | 'ORGANISATION_NOM'
  | 'CONTACT_RECRUTEMENT'
  | 'PAGE_EQUIPE'
  | 'COURRIEL_EXPEDITEUR'
  | 'ORIGINE_ORGA'
>

/** La déclaration d'amorçage, lue dans l'environnement avant le premier import. */
export function declarationDepuisEnv(
  env: SourceEnv,
  source: NodeJS.ProcessEnv = process.env
): DeclarationOrganisation {
  const domaines = domainesAutorises(source)
  const contact = env.CONTACT_RECRUTEMENT?.toLowerCase()
  const domaineContact = contact ? (ADRESSE.exec(contact)?.[1] ?? '') : ''
  return {
    slug: 'defaut',
    nom: env.ORGANISATION_NOM,
    sigle: undefined,
    fuseauHoraire: 'Europe/Paris',
    domainesCourrielAutorises: domaines,
    // Un contact hors des domaines autorisés ne vaut rien : la validation le refuserait.
    contactRecrutement:
      contact && domaines.includes(domaineContact) ? contact : undefined,
    pageEquipe: env.PAGE_EQUIPE,
    logoUrl: undefined,
    faviconUrl: undefined,
    theme: undefined,
  }
}

/** Assemble la configuration : la déclaration de l'organisation et les valeurs d'hébergement. */
export function resoudreConfiguration(
  env: SourceEnv,
  declaration: DeclarationOrganisation,
  id: string | null = null
): ConfigurationOrganisation {
  const nomCourt = declaration.sigle ?? declaration.nom
  return {
    id,
    slug: declaration.slug,
    nom: declaration.nom,
    sigle: declaration.sigle,
    nomCourt,
    fuseauHoraire: declaration.fuseauHoraire,
    expediteur: env.COURRIEL_EXPEDITEUR ?? `${nomCourt} <relaytour@localhost>`,
    origineOrga: env.ORIGINE_ORGA,
    domainesCourrielAutorises: declaration.domainesCourrielAutorises,
    contactRecrutement: declaration.contactRecrutement,
    pageEquipe: declaration.pageEquipe,
    logoUrl: declaration.logoUrl,
    faviconUrl: declaration.faviconUrl,
    theme: resoudreTheme(declaration.theme),
  }
}

/** Les variables qu'un mail reçoit de l'organisation : nom court et couleurs. */
export function variablesOrganisation(configuration: ConfigurationOrganisation) {
  const c = configuration.theme.couleurs
  return {
    organisation: configuration.nomCourt,
    couleurEncre: c.encre,
    couleurPrimaire: c.primaire,
    couleurAccent: c.accent,
    couleurSol: c.sol2,
  }
}

const DUREE_CACHE_MS = 60_000
let cache: { valeur: ConfigurationOrganisation; expire: number } | null = null
let idParDefaut: string | null = null

/** Oublie la configuration en cache : à appeler après un import ou une modification. */
export function invaliderConfigurationOrganisation(): void {
  cache = null
  idParDefaut = null
}

interface LigneOrganisation {
  id: string
  slug: string
  configuration: unknown
}

/** La déclaration portée par une ligne, ou null si sa configuration est vide ou invalide. */
function declarationDeLaLigne(ligne: LigneOrganisation): DeclarationOrganisation | null {
  const r = DeclarationOrganisationSchema.safeParse(ligne.configuration)
  return r.success ? r.data : null
}

/**
 * La configuration courante, en cache une minute : la ligne Organisation en base
 * si elle porte une déclaration valide, sinon l'amorçage de l'environnement.
 * Lot commun : une seule organisation par installation.
 */
export async function configurationOrganisation(): Promise<ConfigurationOrganisation> {
  const maintenant = Date.now()
  if (cache !== null && cache.expire > maintenant) return cache.valeur
  // Imports paresseux : ce module est chargé par la validation de contenu, sans base ni .env.
  const [{ env }, { prisma }] = await Promise.all([
    import('../env.ts'),
    import('@relaytour/database'),
  ])
  const ligne = await prisma.organisation.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, slug: true, configuration: true },
  })
  const declaration =
    (ligne === null ? null : declarationDeLaLigne(ligne)) ??
    declarationDepuisEnv(env)
  const valeur = resoudreConfiguration(env, declaration, ligne?.id ?? null)
  cache = { valeur, expire: maintenant + DUREE_CACHE_MS }
  return valeur
}

/**
 * Garantit la ligne Organisation de l'installation et y rattache les données
 * qui n'ont pas encore de clé d'organisation. Appelée au démarrage de l'API et
 * du worker, et par les scripts qui écrivent en base.
 *
 * Sans ligne, elle en crée une depuis l'environnement (slug « defaut »). Une
 * ligne à la configuration vide (posée par une migration) est complétée de même.
 * L'import d'organisation.yaml remplace ensuite ces valeurs d'amorçage.
 */
export async function assurerOrganisationParDefaut(): Promise<string> {
  const [{ env }, { prisma }] = await Promise.all([
    import('../env.ts'),
    import('@relaytour/database'),
  ])
  let ligne = await prisma.organisation.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, slug: true, configuration: true },
  })
  if (ligne === null) {
    const declaration = declarationDepuisEnv(env)
    ligne = await prisma.organisation.create({
      data: {
        slug: declaration.slug,
        nom: declaration.nom,
        sigle: declaration.sigle ?? null,
        fuseauHoraire: declaration.fuseauHoraire,
        configuration: declaration,
      },
      select: { id: true, slug: true, configuration: true },
    })
  } else if (declarationDeLaLigne(ligne) === null) {
    const declaration = declarationDepuisEnv(env)
    await prisma.organisation.update({
      where: { id: ligne.id },
      data: {
        nom: declaration.nom,
        sigle: declaration.sigle ?? null,
        fuseauHoraire: declaration.fuseauHoraire,
        configuration: declaration,
      },
    })
  }
  const organisationId = ligne.id
  const ou = { where: { organisationId: null }, data: { organisationId } }
  await prisma.$transaction([
    prisma.edition.updateMany(ou),
    prisma.perimetre.updateMany(ou),
    prisma.fiche.updateMany(ou),
    prisma.notification.updateMany(ou),
    prisma.preferenceNotification.updateMany(ou),
  ])
  invaliderConfigurationOrganisation()
  idParDefaut = organisationId
  return organisationId
}

/**
 * L'identifiant de l'organisation de l'installation, pour les écritures.
 * Lot commun : une seule organisation. Le lot multi remplacera chaque appel par
 * l'organisation du contexte de la requête ; `grep organisationParDefaut` liste
 * alors le travail restant.
 */
export async function organisationParDefaut(): Promise<string> {
  if (idParDefaut !== null) return idParDefaut
  return assurerOrganisationParDefaut()
}
