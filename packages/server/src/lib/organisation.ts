import {
  fusionnerTheme,
  INTENSITE_HALO_MAX,
  pile,
  POLICES_DISPONIBLES,
  themeParDefaut,
  verifierAccessibilite,
  type CouleursTheme,
  type Theme,
} from '@relaytour/tokens'
import { z } from 'zod'

import type { Env } from '../env.ts'

import { GROUPES_PAR_DEFAUT, SLUGS_RESERVES } from './activites.ts'
import {
  adresseDeRole,
  domainesAutorises,
  messagerieGrandPublic,
} from './contenu.ts'

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

const Halo = z.strictObject({
  couleur: Couleur.optional(),
  intensite: z
    .number()
    .min(0)
    .max(INTENSITE_HALO_MAX, `intensité entre 0 et ${INTENSITE_HALO_MAX}`)
    .optional(),
})

/** Un thème tel qu'une organisation le déclare : polices nommées, valeurs partielles. */
export const ThemeDeclareSchema = z.strictObject({
  couleurs: z
    .strictObject(
      Object.fromEntries(CLES_COULEURS.map(cle => [cle, Couleur.optional()]))
    )
    .optional(),
  fond: z
    .strictObject({
      transition: Couleur.optional(),
      halo1: Halo.optional(),
      halo2: Halo.optional(),
    })
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

/**
 * Ce qu'une activité peut surcharger dans le thème de son organisation : les
 * couleurs et le fond. Les polices et la typographie restent celles de
 * l'organisation, pour une identité cohérente entre ses activités (ADR 0009).
 */
export const ThemeActiviteSchema = ThemeDeclareSchema.pick({
  couleurs: true,
  fond: true,
})

export type ThemeActivite = z.infer<typeof ThemeActiviteSchema>

/** Fusionne deux déclarations de thème : la seconde l'emporte, champ par champ. */
export function fusionnerThemesDeclares(
  base: ThemeDeclare | undefined,
  surcharge: ThemeActivite | undefined
): ThemeDeclare | undefined {
  if (surcharge === undefined) return base
  if (base === undefined) return surcharge
  const fond =
    base.fond === undefined && surcharge.fond === undefined
      ? undefined
      : {
          ...base.fond,
          ...surcharge.fond,
          halo1: fusionnerObjets(base.fond?.halo1, surcharge.fond?.halo1),
          halo2: fusionnerObjets(base.fond?.halo2, surcharge.fond?.halo2),
        }
  return {
    ...base,
    couleurs:
      base.couleurs === undefined && surcharge.couleurs === undefined
        ? undefined
        : { ...base.couleurs, ...surcharge.couleurs },
    fond,
  }
}

function fusionnerObjets<T extends object>(
  a: T | undefined,
  b: T | undefined
): T | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return { ...a, ...b }
}

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
  return fusionnerTheme({ couleurs, fond: declare.fond, polices, typographie })
}

/** Les manquements de contraste d'un thème déclaré, chacun avec son chemin. */
function manquementsContraste(theme: ThemeDeclare | undefined) {
  return verifierAccessibilite(resoudreTheme(theme)).map(m => ({
    path: ['theme', 'couleurs', m.couleur],
    message: `contraste ${m.rapport.toFixed(2)} sur ${m.fond}, 4,5 attendu`,
  }))
}

const Adresse = z
  .string()
  .trim()
  .toLowerCase()
  .regex(ADRESSE, 'adresse mail attendue')

/**
 * Une image de l'organisation ou d'une activité. Dans le dossier de contenu, un
 * chemin relatif au fichier qui la déclare ; en base, l'empreinte du média.
 */
const ReferenceImage = z.string().trim().min(1).max(200)

/** Un logo : le PNG sert partout, y compris dans les mails ; le SVG, à l'écran. */
export const LogoSchema = z.strictObject({
  png: ReferenceImage,
  svg: ReferenceImage.optional(),
})

export type Logo = z.infer<typeof LogoSchema>

const EMPREINTE = /^[0-9a-f]{64}$/

/** L'adresse publique d'un média, ou undefined si la référence n'est pas une empreinte. */
export function urlMedia(
  empreinte: string | undefined,
  extension: 'png' | 'svg',
  origine = ''
): string | undefined {
  if (empreinte === undefined || !EMPREINTE.test(empreinte)) return undefined
  return `${origine}/medias/${empreinte}.${extension}`
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
    // L'activité implicite d'une organisation prend son slug : il ne peut pas être
    // un segment réservé de l'espace organisateur (ADR 0008).
    slug: z
      .string()
      .regex(SLUG, 'minuscules, chiffres et tirets seulement')
      .max(60)
      .refine(s => !SLUGS_RESERVES.has(s), {
        message: 'identifiant réservé par l’espace organisateur',
      }),
    nom: z.string().trim().min(1).max(120),
    sigle: z.string().trim().min(1).max(20).optional(),
    fuseauHoraire: z
      .string()
      .default('Europe/Paris')
      .refine(fuseauValide, 'fuseau horaire inconnu (forme Europe/Paris)'),
    // Domaines des adresses de rôle : une adresse de ces domaines passe pour
    // institutionnelle. Aucune messagerie grand public (ADR 0009).
    domainesCourrielAutorises: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(DOMAINE, 'domaine attendu')
          .refine(d => !messagerieGrandPublic(d), {
            message:
              'messagerie grand public refusée : déclarez plutôt l’adresse complète dans adressesRoleAutorisees',
          })
      )
      .max(20)
      .default([]),
    // Exceptions : boîtes partagées hébergées chez une messagerie grand public.
    adressesRoleAutorisees: z.array(Adresse).max(20).default([]),
    contactRecrutement: Adresse.optional(),
    pageEquipe: z.string().trim().url().optional(),
    logo: LogoSchema.optional(),
    favicon: ReferenceImage.optional(),
    logoUrl: z
      .string()
      .trim()
      .regex(URL_PUBLIQUE, 'adresse https ou chemin absolu')
      .optional(),
    faviconUrl: z
      .string()
      .trim()
      .regex(URL_PUBLIQUE, 'adresse https ou chemin absolu')
      .optional(),
    theme: ThemeDeclareSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const role = {
      domaines: v.domainesCourrielAutorises,
      adresses: v.adressesRoleAutorisees,
    }
    if (
      v.contactRecrutement !== undefined &&
      !adresseDeRole(v.contactRecrutement, role)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactRecrutement'],
        message: `le domaine ${v.contactRecrutement.split('@')[1] ?? ''} n'est pas dans domainesCourrielAutorises, et l'adresse n'est pas dans adressesRoleAutorisees`,
      })
    }
    for (const m of manquementsContraste(v.theme)) {
      ctx.addIssue({ code: 'custom', ...m })
    }
  })

export type DeclarationOrganisation = z.infer<
  typeof DeclarationOrganisationSchema
>

/**
 * L'identité propre d'une activité (ADR 0009). Chaque champ absent reprend la
 * valeur de l'organisation. Le thème ne surcharge que les couleurs et le fond.
 */
export const IdentiteActiviteSchema = z.strictObject({
  contactRecrutement: Adresse.optional(),
  pageEquipe: z.string().trim().url().optional(),
  logo: LogoSchema.optional(),
  theme: ThemeActiviteSchema.optional(),
})

export type IdentiteActivite = z.infer<typeof IdentiteActiviteSchema>

/**
 * Ce que l'identité d'une activité enfreint dans le cadre de son organisation :
 * un contact hors des adresses de rôle, un contraste insuffisant une fois les deux
 * thèmes fusionnés.
 */
export function manquementsIdentiteActivite(
  identite: IdentiteActivite,
  organisation: Pick<
    DeclarationOrganisation,
    'domainesCourrielAutorises' | 'adressesRoleAutorisees' | 'theme'
  >
): { path: (string | number)[]; message: string }[] {
  const manquements: { path: (string | number)[]; message: string }[] = []
  if (
    identite.contactRecrutement !== undefined &&
    !adresseDeRole(identite.contactRecrutement, {
      domaines: organisation.domainesCourrielAutorises,
      adresses: organisation.adressesRoleAutorisees,
    })
  ) {
    manquements.push({
      path: ['contactRecrutement'],
      message: `le domaine ${identite.contactRecrutement.split('@')[1] ?? ''} n'est pas dans les domainesCourrielAutorises de l'organisation, et l'adresse n'est pas dans ses adressesRoleAutorisees`,
    })
  }
  manquements.push(
    ...manquementsContraste(
      fusionnerThemesDeclares(organisation.theme, identite.theme)
    )
  )
  return manquements
}

/** L'identité d'une activité lue en base, vide si elle est absente ou invalide. */
export function lireIdentiteActivite(valeur: unknown): IdentiteActivite {
  const r = IdentiteActiviteSchema.safeParse(valeur ?? {})
  return r.success ? r.data : {}
}

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
  adressesRoleAutorisees: string[]
  contactRecrutement: string | undefined
  pageEquipe: string | undefined
  /** Le logo à l'écran : SVG, sinon PNG, sinon l'adresse déclarée. */
  logoUrl: string | undefined
  /** Le logo PNG en adresse absolue, pour les mails. */
  logoMailUrl: string | undefined
  faviconUrl: string | undefined
  /** La déclaration du thème, avant résolution : base de la fusion d'une activité. */
  themeDeclare: ThemeDeclare | undefined
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
    adressesRoleAutorisees: [],
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
    adressesRoleAutorisees: declaration.adressesRoleAutorisees,
    contactRecrutement: declaration.contactRecrutement,
    pageEquipe: declaration.pageEquipe,
    logoUrl:
      urlMedia(declaration.logo?.svg, 'svg') ??
      urlMedia(declaration.logo?.png, 'png') ??
      declaration.logoUrl,
    logoMailUrl: urlMedia(declaration.logo?.png, 'png', env.ORIGINE_ORGA),
    faviconUrl: urlMedia(declaration.favicon, 'png') ?? declaration.faviconUrl,
    themeDeclare: declaration.theme,
    theme: resoudreTheme(declaration.theme),
  }
}

/** La configuration d'une activité : celle de son organisation, surchargée par son identité. */
export interface ConfigurationActivite extends ConfigurationOrganisation {
  activite: { id: string; slug: string; nom: string; nomCourt: string }
}

/** Applique l'identité d'une activité à la configuration de son organisation. */
export function surchargerParActivite(
  organisation: ConfigurationOrganisation,
  activite: { id: string; slug: string; nom: string; sigle: string | null },
  identite: IdentiteActivite
): ConfigurationActivite {
  const themeDeclare = fusionnerThemesDeclares(
    organisation.themeDeclare,
    identite.theme
  )
  return {
    ...organisation,
    activite: {
      id: activite.id,
      slug: activite.slug,
      nom: activite.nom,
      nomCourt: activite.sigle ?? activite.nom,
    },
    contactRecrutement:
      identite.contactRecrutement ?? organisation.contactRecrutement,
    pageEquipe: identite.pageEquipe ?? organisation.pageEquipe,
    logoUrl:
      urlMedia(identite.logo?.svg, 'svg') ??
      urlMedia(identite.logo?.png, 'png') ??
      organisation.logoUrl,
    logoMailUrl:
      urlMedia(identite.logo?.png, 'png', organisation.origineOrga) ??
      organisation.logoMailUrl,
    themeDeclare,
    theme:
      identite.theme === undefined
        ? organisation.theme
        : resoudreTheme(themeDeclare),
  }
}

/** La configuration d'une activité, lue en base ; celle de son organisation l'encadre. */
export async function configurationActivite(
  activiteId: string
): Promise<ConfigurationActivite> {
  const { prisma } = await import('@relaytour/database')
  const activite = await prisma.activite.findUniqueOrThrow({
    where: { id: activiteId },
    select: {
      id: true,
      slug: true,
      nom: true,
      sigle: true,
      identite: true,
      organisationId: true,
    },
  })
  const organisation = await configurationOrganisation(activite.organisationId)
  return surchargerParActivite(
    organisation,
    activite,
    lireIdentiteActivite(activite.identite)
  )
}

/** Les variables qu'un mail reçoit de l'organisation : nom court, logo et couleurs. */
export function variablesOrganisation(
  configuration: ConfigurationOrganisation
) {
  const c = configuration.theme.couleurs
  return {
    organisation: configuration.nomCourt,
    logoUrl: configuration.logoMailUrl ?? '',
    couleurEncre: c.encre,
    couleurPrimaire: c.primaire,
    couleurAccent: c.accent,
    couleurSol: c.sol2,
  }
}

const DUREE_CACHE_MS = 60_000
// Une entrée par organisation ; la clé vide désigne la première organisation.
const cache = new Map<
  string,
  { valeur: ConfigurationOrganisation; expire: number }
>()
let idParDefaut: string | null = null

/** Oublie la configuration en cache : à appeler après un import ou une modification. */
export function invaliderConfigurationOrganisation(): void {
  cache.clear()
  idParDefaut = null
}

interface LigneOrganisation {
  id: string
  slug: string
  configuration: unknown
}

/** La déclaration portée par une ligne, ou null si sa configuration est vide ou invalide. */
function declarationDeLaLigne(
  ligne: LigneOrganisation
): DeclarationOrganisation | null {
  const r = DeclarationOrganisationSchema.safeParse(ligne.configuration)
  return r.success ? r.data : null
}

/**
 * La configuration d'une organisation, en cache une minute : la ligne Organisation
 * en base si elle porte une déclaration valide, sinon l'amorçage de l'environnement.
 * Sans identifiant, la première organisation de l'installation (worker et scripts,
 * jusqu'à leur passage par organisation).
 */
export async function configurationOrganisation(
  organisationId?: string
): Promise<ConfigurationOrganisation> {
  const maintenant = Date.now()
  const cle = organisationId ?? ''
  const enCache = cache.get(cle)
  if (enCache !== undefined && enCache.expire > maintenant)
    return enCache.valeur
  // Imports paresseux : ce module est chargé par la validation de contenu, sans base ni .env.
  const [{ env }, { prisma }] = await Promise.all([
    import('../env.ts'),
    import('@relaytour/database'),
  ])
  const selection = { id: true, slug: true, configuration: true } as const
  const ligne =
    organisationId === undefined
      ? await prisma.organisation.findFirst({
          orderBy: { createdAt: 'asc' },
          select: selection,
        })
      : await prisma.organisation.findUnique({
          where: { id: organisationId },
          select: selection,
        })
  const declaration =
    (ligne === null ? null : declarationDeLaLigne(ligne)) ??
    declarationDepuisEnv(env)
  const valeur = resoudreConfiguration(env, declaration, ligne?.id ?? null)
  cache.set(cle, { valeur, expire: maintenant + DUREE_CACHE_MS })
  return valeur
}

/**
 * La configuration publique servie sans session (écran de connexion) : celle de
 * l'organisation active, sinon de l'organisation désignée par son slug, sinon de
 * l'unique organisation de l'installation. Une installation à plusieurs
 * organisations, sans slug connu, sert l'identité d'amorçage de l'environnement :
 * elle n'affiche la marque d'aucune organisation.
 */
export async function configurationPublique(
  organisationId: string | undefined,
  slug: string | undefined
): Promise<ConfigurationOrganisation> {
  if (organisationId !== undefined)
    return configurationOrganisation(organisationId)
  const [{ env }, { prisma }] = await Promise.all([
    import('../env.ts'),
    import('@relaytour/database'),
  ])
  if (slug !== undefined) {
    const designee = await prisma.organisation.findFirst({
      where: { slug, statut: { not: 'ARCHIVEE' } },
      select: { id: true },
    })
    if (designee !== null) return configurationOrganisation(designee.id)
  }
  const nombre = await prisma.organisation.count()
  if (nombre <= 1) return configurationOrganisation()
  return resoudreConfiguration(env, declarationDepuisEnv(env))
}

/**
 * Garantit la ligne Organisation de l'installation. Appelée au démarrage de
 * l'API et du worker, et par les scripts qui écrivent en base.
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
  // Une installation neuve reçoit aussi sa première activité : un événement au slug
  // de l'organisation, que le premier import en disposition activites/ retire s'il
  // reste vide. Sans elle, edition:creer n'aurait aucune activité où créer la période.
  const activites = await prisma.activite.count({
    where: { organisationId: ligne.id },
  })
  if (activites === 0) {
    const organisation = await prisma.organisation.findUniqueOrThrow({
      where: { id: ligne.id },
      select: { slug: true, nom: true, sigle: true },
    })
    await prisma.activite.create({
      data: {
        organisationId: ligne.id,
        slug: organisation.slug,
        nom: organisation.nom,
        sigle: organisation.sigle,
        nature: 'EVENEMENT',
        groupes: GROUPES_PAR_DEFAUT,
      },
    })
  }
  // Le rattachement des lignes sans clé a eu lieu dans la migration
  // `organisation_obligatoire` : la clé est obligatoire depuis.
  invaliderConfigurationOrganisation()
  idParDefaut = ligne.id
  return ligne.id
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
