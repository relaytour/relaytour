import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'yaml'
import { z } from 'zod'

import { SLUGS_RESERVES } from '../lib/activites.ts'
import { FormulaireSchema, textesDuFormulaire } from '../lib/formulaire.ts'
import {
  donneesPersonnelles,
  normaliserContenu,
  type AdressesDeRole,
} from '../lib/contenu.ts'
import {
  verifierIconeApplication,
  verifierMedia,
  type MediaValide,
} from '../lib/medias.ts'
import { ECHEANCE_RELATIVE, PhasesSchema } from '../lib/phases.ts'
import { TITRE_MAX } from '../lib/saisie.ts'
import {
  DeclarationOrganisationSchema,
  IdentiteActiviteSchema,
  manquementsIdentiteActivite,
  type DeclarationOrganisation,
  type Logo,
} from '../lib/organisation.ts'

// Lecture et validation d'un dossier de contenu (ADR 0003 et 0008).
//
// L'analyse est stricte : un champ inconnu, un slug mal formé ou une donnée
// personnelle font échouer la lecture du fichier concerné, avec un message qui nomme
// le fichier. Rien n'est écrit en base tant que tout le dossier n'est pas valide.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const Slug = z.string().regex(SLUG, 'minuscules, chiffres et tirets seulement')

const GroupeModele = z.strictObject({
  cle: Slug,
  libelle: z.string().trim().min(1).max(60),
  libellePluriel: z.string().trim().min(1).max(60),
})

// Groupes de la disposition plate, et des activités qui n'en déclarent pas.
export const GROUPES_PAR_DEFAUT = [
  { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
  { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
]

// activites/<slug>/activite.yaml (ADR 0008), avec l'identité propre de l'activité
// (ADR 0009) : contacts, logo, couleurs et fond.
export const ActiviteDeclaree = z.strictObject({
  ...IdentiteActiviteSchema.shape,
  // Les premiers segments d'adresse de l'espace organisateur sont réservés.
  slug: Slug.refine(s => !SLUGS_RESERVES.has(s), {
    message: 'identifiant réservé par l’espace organisateur',
  }),
  nom: z.string().trim().min(1).max(120),
  sigle: z.string().trim().min(1).max(20).optional(),
  nature: z.enum(['EVENEMENT', 'SAISON', 'MANDAT']).default('EVENEMENT'),
  groupes: z.array(GroupeModele).min(1).max(10).default(GROUPES_PAR_DEFAUT),
  // Phases de l'activité, dans l'ordre (ADR 0025). Absentes, l'activité garde les
  // phases par défaut.
  phases: PhasesSchema.optional(),
  ordre: z.number().int().min(0).max(999).default(0),
  // Tous les membres découvrent les périmètres et formulent leurs souhaits (ADR 0012).
  souhaitsOuverts: z.boolean().optional(),
  // Réglage du formulaire public (ADR 0015). Son ouverture ne se déclare pas ici :
  // elle vit en base seulement.
  formulaire: FormulaireSchema.optional(),
})

// Un périmètre déclare son groupe, ou son type (SPORT, POLE) pour les contenus
// antérieurs à l'ADR 0008. Le groupe se déduit du type et le type du groupe.
const PerimetreDeclare = z
  .strictObject({
    slug: Slug,
    nom: z.string().min(1).max(120),
    // Une ou deux phrases qui présentent le périmètre (ADR 0012).
    description: z.string().trim().min(1).max(400).optional(),
    groupe: Slug.optional(),
    type: z.enum(['SPORT', 'POLE']).optional(),
    couleur: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'couleur au format #RRGGBB')
      .optional(),
    ordre: z.number().int().min(0).max(999).default(0),
    // Nombre de référentes et de référents souhaité pour chaque période.
    // Un effectif de 0 signifie qu'aucune personne n'est recherchée.
    effectif: z.number().int('nombre entier attendu').min(0).max(50).optional(),
  })
  .refine(p => p.groupe !== undefined || p.type !== undefined, {
    message: 'groupe attendu (ou type pour un contenu antérieur)',
    path: ['groupe'],
  })
  // Un périmètre qui déclare les deux garde un type cohérent avec son groupe :
  // SPORT pour le groupe sport, POLE pour tout autre groupe.
  .refine(
    p =>
      p.groupe === undefined ||
      p.type === undefined ||
      p.type === (p.groupe === 'sport' ? 'SPORT' : 'POLE'),
    {
      message: 'type incohérent avec le groupe : retirez le type',
      path: ['type'],
    }
  )
  .transform(p => ({
    ...p,
    groupe: p.groupe ?? (p.type === 'SPORT' ? 'sport' : 'pole'),
    type: p.type ?? (p.groupe === 'sport' ? 'SPORT' : 'POLE'),
  }))

export const FichierPerimetres = z.strictObject({
  perimetres: z.array(PerimetreDeclare),
})

// `concerne` et `concerneGroupes` portent la liste « Concerne aussi » (ADR 0039).
const EnteteFiche = z.strictObject({
  slug: Slug,
  titre: z.string().min(1).max(TITRE_MAX),
  concerne: z.array(Slug).max(100).optional(),
  concerneGroupes: z.array(z.string().min(1).max(64)).max(100).optional(),
})

// J-120 : 120 jours avant le premier jour de la période. J+3 : 3 jours après.
const EcheanceRelative = z
  .string()
  .regex(ECHEANCE_RELATIVE, 'échéance relative de la forme J-120 ou J+3')

// Déclinaison d'une tâche partagée (ADR 0026) : la tâche type se décline dans les
// périmètres d'un groupe, ou dans une liste de périmètres. Un champ absent reprend
// celui de la tâche partagée.
const Declinaison = z
  .strictObject({
    groupe: Slug.optional(),
    perimetres: z.array(Slug).min(1).optional(),
    titre: z.string().min(1).max(TITRE_MAX).optional(),
    description: z.string().max(5000).optional(),
    echeance: EcheanceRelative.optional(),
    // Une fiche commune seulement : les périmètres cibles la lisent tous.
    fiche: Slug.optional(),
  })
  .refine(d => (d.groupe === undefined) !== (d.perimetres === undefined), {
    message: 'groupe ou perimetres attendu, l’un des deux',
    path: ['groupe'],
  })

const TacheModele = z.strictObject({
  modele: Slug,
  titre: z.string().min(1).max(TITRE_MAX),
  description: z.string().max(5000).optional(),
  echeance: EcheanceRelative.optional(),
  fiche: Slug.optional(),
  declinaison: Declinaison.optional(),
})

export const FichierTaches = z.strictObject({
  taches: z.array(TacheModele),
})

export type PerimetreModele = z.output<typeof PerimetreDeclare>

/**
 * Les tâches types d'un périmètre lues en base, ou null quand la colonne est vide
 * ou illisible. L'import les y écrit telles que le dossier les déclare.
 */
export function lireTachesTypes(valeur: unknown): TacheModele[] | null {
  if (valeur === null || valeur === undefined) return null
  const lues = FichierTaches.shape.taches.safeParse(valeur)
  return lues.success ? lues.data : null
}
export type TacheModele = z.infer<typeof TacheModele>
export type ActiviteDeclaree = z.output<typeof ActiviteDeclaree>

/**
 * Les périmètres cibles d'une tâche partagée, dans l'ordre de perimetres.yaml : ceux
 * du groupe déclaré, ou ceux de la liste. Le périmètre d'origine n'en fait jamais
 * partie.
 */
export function ciblesDeLaDeclinaison(
  tache: TacheModele,
  origine: string,
  perimetres: readonly Pick<PerimetreModele, 'slug' | 'groupe'>[]
): string[] {
  const declinaison = tache.declinaison
  if (declinaison === undefined) return []
  const voulus =
    declinaison.perimetres === undefined
      ? null
      : new Set(declinaison.perimetres)
  return perimetres
    .filter(
      p =>
        p.slug !== origine &&
        (voulus === null ? p.groupe === declinaison.groupe : voulus.has(p.slug))
    )
    .map(p => p.slug)
}

/** Les textes d'une déclinaison : ceux qu'elle déclare, sinon ceux de sa tâche partagée. */
export function textesDeLaDeclinaison(tache: TacheModele): {
  titre: string
  description: string | undefined
  echeance: string | undefined
} {
  return {
    titre: tache.declinaison?.titre ?? tache.titre,
    description: tache.declinaison?.description ?? tache.description,
    echeance: tache.declinaison?.echeance ?? tache.echeance,
  }
}

export interface FicheModele {
  slug: string
  titre: string
  contenu: string
  /** null pour une fiche commune à l'activité. */
  perimetre: string | null
  /** La liste « Concerne aussi » (ADR 0039) : des slugs de périmètres et des clés de groupes. */
  concerne: string[]
  concerneGroupes: string[]
  fichier: string
}

export interface ActiviteModele {
  declaration: ActiviteDeclaree
  /** Vrai pour la disposition plate : l'activité reprend le slug et le nom de l'organisation. */
  implicite: boolean
  /** Préfixe des fichiers de l'activité, relatif à la racine : '' ou 'activites/<slug>/'. */
  dossier: string
  perimetres: PerimetreModele[]
  fiches: FicheModele[]
  /** Tâches types par slug de périmètre. */
  taches: Map<string, TacheModele[]>
}

export interface Modeles {
  /**
   * Identité et thème de l'organisation (organisation.yaml). Ses images et celles
   * des activités sont des chemins relatifs à la racine du dossier.
   */
  organisation: DeclarationOrganisation
  /** Images du dossier, vérifiées, par chemin relatif à la racine. */
  medias: Map<string, MediaValide>
  /** Disposition du dossier : plate (une activité implicite) ou activites/. */
  disposition: 'plate' | 'activites'
  activites: ActiviteModele[]
}

export class ErreurModeles extends Error {
  constructor(readonly erreurs: string[]) {
    super(
      `${erreurs.length} erreur(s) dans les modèles :\n- ${erreurs.join('\n- ')}`
    )
  }
}

function formaterZod(fichier: string, erreur: z.ZodError): string[] {
  return erreur.issues.map(
    i => `${fichier} : ${i.path.join('.') || '(racine)'} ${i.message}`
  )
}

/** Sépare l'en-tête YAML (entre deux lignes « --- ») du corps Markdown. */
export function separerEntete(
  source: string
): { entete: unknown; corps: string } | null {
  const texte = source.replace(/\r\n?/g, '\n')
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texte)
  if (m === null) return null
  return { entete: parse(m[1] ?? ''), corps: m[2] ?? '' }
}

/**
 * Ce que la lecture d'un dossier de contenu demande au système de fichiers. Le
 * disque sert à la commande ; une archive déposée dans l'espace organisateur se lit
 * en mémoire (ADR 0049), avec la même validation.
 */
export interface SystemeContenu {
  existe(chemin: string): boolean
  lireTexte(chemin: string): string
  lireOctets(chemin: string): Buffer
  /** Les entrées directes d'un dossier, avec leur nature. */
  entrees(dossier: string): { nom: string; fichier: boolean }[]
}

export const DISQUE: SystemeContenu = {
  existe: chemin => existsSync(chemin),
  lireTexte: chemin => readFileSync(chemin, 'utf8'),
  lireOctets: chemin => readFileSync(chemin),
  entrees: dossier =>
    readdirSync(dossier, { withFileTypes: true }).map(e => ({
      nom: e.name,
      fichier: e.isFile(),
    })),
}

/** La racine fictive d'un dossier lu en mémoire. */
export const RACINE_EN_MEMOIRE = '/contenu'

/**
 * Un dossier de contenu en mémoire, à partir de ses fichiers rangés par chemin
 * relatif (« activites/club/perimetres.yaml »). Il se lit avec RACINE_EN_MEMOIRE.
 */
export function systemeEnMemoire(
  fichiers: ReadonlyMap<string, Buffer>
): SystemeContenu {
  const relatif = (chemin: string) =>
    path.posix.relative(RACINE_EN_MEMOIRE, chemin)
  const dossierContient = (dossier: string) => {
    const prefixe = dossier === '' ? '' : `${dossier}/`
    return [...fichiers.keys()].filter(c => c.startsWith(prefixe))
  }
  const lire = (chemin: string) => {
    const donnees = fichiers.get(relatif(chemin))
    if (donnees === undefined) throw new Error(`${relatif(chemin)} est absent`)
    return donnees
  }
  return {
    existe: chemin => {
      const r = relatif(chemin)
      return fichiers.has(r) || dossierContient(r).length > 0
    },
    lireTexte: chemin => lire(chemin).toString('utf8'),
    lireOctets: lire,
    entrees: dossier => {
      const r = relatif(dossier)
      const prefixe = r === '' ? '' : `${r}/`
      const vues = new Map<string, boolean>()
      for (const chemin of dossierContient(r)) {
        const [nom, ...reste] = chemin.slice(prefixe.length).split('/')
        if (nom) vues.set(nom, (vues.get(nom) ?? true) && reste.length === 0)
      }
      return [...vues].map(([nom, fichier]) => ({ nom, fichier }))
    },
  }
}

function fichiers(
  sys: SystemeContenu,
  dossier: string,
  extension: string
): string[] {
  if (!sys.existe(dossier)) return []
  return sys
    .entrees(dossier)
    .filter(e => e.fichier && e.nom.endsWith(extension))
    .map(e => path.join(dossier, e.nom))
    .sort()
}

function sousDossiers(sys: SystemeContenu, dossier: string): string[] {
  if (!sys.existe(dossier)) return []
  return sys
    .entrees(dossier)
    .filter(e => !e.fichier)
    .map(e => e.nom)
    .sort()
}

/**
 * Lit une image déclarée par un fichier YAML. Le chemin est relatif au dossier du
 * fichier et ne sort pas du dossier de contenu. Renvoie le chemin relatif à la
 * racine, ou undefined en cas d'erreur (consignée).
 */
function lireImage(
  sys: SystemeContenu,
  racine: string,
  dossier: string,
  reference: string,
  attendu: 'png' | 'svg',
  fichierDeclarant: string,
  medias: Map<string, MediaValide>,
  erreurs: string[]
): string | undefined {
  const cible = path.resolve(racine, dossier, reference)
  const relatif = path.relative(path.resolve(racine), cible)
  if (
    path.isAbsolute(reference) ||
    relatif.startsWith('..') ||
    path.isAbsolute(relatif)
  ) {
    erreurs.push(
      `${fichierDeclarant} : l'image ${reference} doit se trouver dans le dossier de contenu`
    )
    return undefined
  }
  const chemin = relatif.split(path.sep).join('/')
  if (!sys.existe(cible)) {
    erreurs.push(`${fichierDeclarant} : l'image ${chemin} est absente`)
    return undefined
  }
  try {
    medias.set(chemin, verifierMedia(sys.lireOctets(cible), attendu))
    return chemin
  } catch (e) {
    erreurs.push(`${chemin} : ${(e as Error).message}`)
    return undefined
  }
}

/** Lit le PNG et le SVG d'un logo ; les chemins deviennent relatifs à la racine. */
function lireLogo(
  sys: SystemeContenu,
  racine: string,
  dossier: string,
  logo: Logo | undefined,
  fichierDeclarant: string,
  medias: Map<string, MediaValide>,
  erreurs: string[]
): Logo | undefined {
  if (logo === undefined) return undefined
  const png = lireImage(
    sys,
    racine,
    dossier,
    logo.png,
    'png',
    fichierDeclarant,
    medias,
    erreurs
  )
  const svg =
    logo.svg === undefined
      ? undefined
      : lireImage(
          sys,
          racine,
          dossier,
          logo.svg,
          'svg',
          fichierDeclarant,
          medias,
          erreurs
        )
  return png === undefined
    ? undefined
    : { png, ...(svg === undefined ? {} : { svg }) }
}

/** Fichiers propres à une activité, qui signalent la disposition plate à la racine. */
const FICHIERS_D_ACTIVITE = ['perimetres.yaml', 'fiches', 'taches']

/**
 * Lit les périmètres, fiches et tâches types d'une activité, dans le dossier
 * `racine/dossier`. Les messages nomment les fichiers depuis la racine.
 */
function lireActivite(
  sys: SystemeContenu,
  racine: string,
  dossier: string,
  declaration: ActiviteDeclaree,
  implicite: boolean,
  role: AdressesDeRole,
  erreurs: string[]
): ActiviteModele {
  const base = path.join(racine, dossier)
  const relatif = (f: string) => path.relative(racine, f)
  const groupes = new Set(declaration.groupes.map(g => g.cle))

  // Le formulaire public s'affiche sans session : aucune coordonnée personnelle
  // (invariant 16).
  if (
    textesDuFormulaire(declaration.formulaire ?? {}).some(
      texte => donneesPersonnelles(texte, role).length > 0
    )
  ) {
    erreurs.push(
      `${relatif(path.join(base, 'activite.yaml'))} : le formulaire contient des données personnelles interdites dans Git`
    )
  }

  // Périmètres
  let perimetres: PerimetreModele[] = []
  const fichierPerimetres = path.join(base, 'perimetres.yaml')
  const nomPerimetres = relatif(fichierPerimetres)
  if (!sys.existe(fichierPerimetres)) {
    erreurs.push(`${nomPerimetres} est absent`)
  } else {
    const r = FichierPerimetres.safeParse(
      parse(sys.lireTexte(fichierPerimetres))
    )
    if (r.success) perimetres = r.data.perimetres
    else erreurs.push(...formaterZod(nomPerimetres, r.error))
  }
  const slugsPerimetres = new Set(perimetres.map(p => p.slug))
  if (slugsPerimetres.size !== perimetres.length) {
    erreurs.push(`${nomPerimetres} : deux périmètres ont le même slug`)
  }
  for (const perimetre of perimetres) {
    if (!groupes.has(perimetre.groupe)) {
      erreurs.push(
        `${nomPerimetres} : ${perimetre.slug} appartient au groupe ${perimetre.groupe}, que l'activité ne déclare pas (${[...groupes].join(', ')})`
      )
    }
    // Une description est un texte de contenu : aucune coordonnée personnelle
    // (invariant 16).
    if (
      perimetre.description !== undefined &&
      donneesPersonnelles(perimetre.description, role).length > 0
    ) {
      erreurs.push(
        `${nomPerimetres} : la description de ${perimetre.slug} contient des données personnelles interdites dans Git`
      )
    }
  }

  // Fiches : fiches/communes/*.md et fiches/<perimetre>/*.md
  const fiches: FicheModele[] = []
  const dossierFiches = path.join(base, 'fiches')
  for (const nomDossier of sousDossiers(sys, dossierFiches)) {
    const perimetre = nomDossier === 'communes' ? null : nomDossier
    if (perimetre !== null && !slugsPerimetres.has(perimetre)) {
      erreurs.push(
        `${relatif(path.join(dossierFiches, nomDossier))} : ce périmètre n'existe pas dans ${nomPerimetres}`
      )
      continue
    }
    for (const fichier of fichiers(
      sys,
      path.join(dossierFiches, nomDossier),
      '.md'
    )) {
      const nom = relatif(fichier)
      const separe = separerEntete(sys.lireTexte(fichier))
      if (separe === null) {
        erreurs.push(`${nom} : l'en-tête entre deux lignes « --- » est absent`)
        continue
      }
      const entete = EnteteFiche.safeParse(separe.entete)
      if (!entete.success) {
        erreurs.push(...formaterZod(nom, entete.error))
        continue
      }
      if (path.basename(fichier, '.md') !== entete.data.slug) {
        erreurs.push(
          `${nom} : le nom du fichier doit être ${entete.data.slug}.md`
        )
      }
      const contenu = normaliserContenu(separe.corps)
      if (contenu.trim().length === 0)
        erreurs.push(`${nom} : le contenu est vide`)
      const personnelles = donneesPersonnelles(
        `${entete.data.titre}\n${contenu}`,
        role
      )
      if (personnelles.length > 0) {
        erreurs.push(
          `${nom} : données personnelles interdites dans Git (${personnelles.join(', ')}). Écrire un rôle à la place.`
        )
      }
      const concerne = [...new Set(entete.data.concerne ?? [])]
      const concerneGroupes = [...new Set(entete.data.concerneGroupes ?? [])]
      if (perimetre === null && concerne.length + concerneGroupes.length > 0) {
        erreurs.push(
          `${nom} : une fiche commune concerne déjà tous les périmètres, sans « concerne » ni « concerneGroupes »`
        )
      }
      for (const cible of concerne) {
        if (cible === perimetre) {
          erreurs.push(
            `${nom} : la fiche appartient déjà au périmètre ${cible}`
          )
        } else if (!slugsPerimetres.has(cible)) {
          erreurs.push(
            `${nom} : « concerne » cite ${cible}, qui n'existe pas dans ${nomPerimetres}`
          )
        }
      }
      for (const groupe of concerneGroupes) {
        if (!groupes.has(groupe)) {
          erreurs.push(
            `${nom} : « concerneGroupes » cite le groupe ${groupe}, que l'activité ne déclare pas`
          )
        }
      }
      fiches.push({
        slug: entete.data.slug,
        titre: entete.data.titre,
        contenu,
        perimetre,
        concerne,
        concerneGroupes,
        fichier: nom,
      })
    }
  }
  const slugsFiches = new Map(fiches.map(f => [f.slug, f]))

  // Tâches types : taches/<perimetre>.yaml
  const taches = new Map<string, TacheModele[]>()
  for (const fichier of fichiers(sys, path.join(base, 'taches'), '.yaml')) {
    const nom = relatif(fichier)
    const perimetre = path.basename(fichier, '.yaml')
    if (!slugsPerimetres.has(perimetre)) {
      erreurs.push(`${nom} : ce périmètre n'existe pas dans ${nomPerimetres}`)
      continue
    }
    const r = FichierTaches.safeParse(parse(sys.lireTexte(fichier)))
    if (!r.success) {
      erreurs.push(...formaterZod(nom, r.error))
      continue
    }
    const modeles = new Set<string>()
    for (const tache of r.data.taches) {
      if (modeles.has(tache.modele))
        erreurs.push(`${nom} : le modèle ${tache.modele} est en double`)
      modeles.add(tache.modele)
      const fiche =
        tache.fiche === undefined ? undefined : slugsFiches.get(tache.fiche)
      if (tache.fiche !== undefined && fiche === undefined) {
        erreurs.push(
          `${nom} : ${tache.modele} cite la fiche ${tache.fiche}, qui n'existe pas dans cette activité`
        )
      }
      if (
        fiche !== undefined &&
        fiche.perimetre !== null &&
        fiche.perimetre !== perimetre
      ) {
        erreurs.push(
          `${nom} : ${tache.modele} cite une fiche d'un autre périmètre`
        )
      }
      const personnelles = donneesPersonnelles(
        [
          tache.titre,
          tache.description ?? '',
          tache.declinaison?.titre ?? '',
          tache.declinaison?.description ?? '',
        ].join('\n'),
        role
      )
      if (personnelles.length > 0) {
        erreurs.push(
          `${nom} : ${tache.modele} contient des données personnelles interdites dans Git`
        )
      }
    }
    taches.set(perimetre, r.data.taches)
  }

  // Tâches partagées (ADR 0026). Les cibles se vérifient après la lecture de tous
  // les fichiers : une tâche partagée peut viser un périmètre lu après le sien.
  const fichierTaches = (perimetre: string) =>
    relatif(path.join(base, 'taches', `${perimetre}.yaml`))
  // Pour chaque périmètre cible, le fichier d'origine de chaque modèle décliné.
  const declinees = new Map<string, Map<string, string>>()
  for (const [origine, liste] of taches) {
    const nom = fichierTaches(origine)
    for (const tache of liste) {
      const declinaison = tache.declinaison
      if (declinaison === undefined) continue
      if (
        declinaison.groupe !== undefined &&
        !groupes.has(declinaison.groupe)
      ) {
        erreurs.push(
          `${nom} : ${tache.modele} se décline dans le groupe ${declinaison.groupe}, que l'activité ne déclare pas (${[...groupes].join(', ')})`
        )
        continue
      }
      for (const slug of declinaison.perimetres ?? []) {
        if (slug === origine) {
          erreurs.push(
            `${nom} : ${tache.modele} ne se décline pas dans son propre périmètre`
          )
        } else if (!slugsPerimetres.has(slug)) {
          erreurs.push(
            `${nom} : ${tache.modele} se décline dans le périmètre ${slug}, qui n'existe pas dans ${nomPerimetres}`
          )
        }
      }
      if (
        declinaison.perimetres !== undefined &&
        new Set(declinaison.perimetres).size !== declinaison.perimetres.length
      ) {
        erreurs.push(
          `${nom} : ${tache.modele} cite deux fois le même périmètre cible`
        )
      }
      const cibles = ciblesDeLaDeclinaison(tache, origine, perimetres)
      if (cibles.length === 0 && declinaison.groupe !== undefined) {
        erreurs.push(
          `${nom} : ${tache.modele} se décline dans le groupe ${declinaison.groupe}, qui ne contient aucun autre périmètre`
        )
      }
      const fiche =
        declinaison.fiche === undefined
          ? undefined
          : slugsFiches.get(declinaison.fiche)
      if (declinaison.fiche !== undefined && fiche === undefined) {
        erreurs.push(
          `${nom} : la déclinaison de ${tache.modele} cite la fiche ${declinaison.fiche}, qui n'existe pas dans cette activité`
        )
      }
      // Une déclinaison cite une fiche commune, ou une fiche du périmètre de la
      // tâche partagée, qui devient connexe pour chaque cible (ADR 0039).
      if (
        fiche !== undefined &&
        fiche.perimetre !== null &&
        fiche.perimetre !== origine
      ) {
        erreurs.push(
          `${nom} : la déclinaison de ${tache.modele} cite une fiche d'un autre périmètre que celui de la tâche partagée`
        )
      }
      // Une tâche se retrouve par son périmètre et son modèle : un périmètre cible
      // ne porte donc pas deux fois le même modèle.
      for (const cible of cibles) {
        if ((taches.get(cible) ?? []).some(t => t.modele === tache.modele)) {
          erreurs.push(
            `${fichierTaches(cible)} : le modèle ${tache.modele} est déjà décliné depuis ${nom}`
          )
        }
        const recus = declinees.get(cible) ?? new Map<string, string>()
        const autre = recus.get(tache.modele)
        if (autre !== undefined) {
          erreurs.push(
            `${nom} : le modèle ${tache.modele} est déjà décliné dans ${cible} depuis ${autre}`
          )
        }
        recus.set(tache.modele, nom)
        declinees.set(cible, recus)
      }
    }
  }

  return { declaration, implicite, dossier, perimetres, fiches, taches }
}

/**
 * Lit un dossier de contenu. Deux dispositions existent (ADR 0008) :
 *
 * - plate : perimetres.yaml, fiches/ et taches/ à la racine décrivent une seule
 *   activité, un événement au slug et au nom de l'organisation ;
 * - activites/ : un sous-dossier par activité, chacun avec son activite.yaml.
 *
 * Les deux ne se mélangent pas. Le slug d'une fiche est unique dans l'organisation.
 */
export function lireModeles(
  racine: string,
  sys: SystemeContenu = DISQUE
): Modeles {
  const erreurs: string[] = []

  // Organisation : nom, domaines de mail autorisés, contact, thème.
  // Les domaines autorisés dans les fiches viennent d'ici, pas de l'environnement :
  // la validation en CI du dépôt d'organisation n'a besoin d'aucune variable.
  let organisation: DeclarationOrganisation | null = null
  const fichierOrganisation = path.join(racine, 'organisation.yaml')
  if (!sys.existe(fichierOrganisation)) {
    erreurs.push(
      'organisation.yaml est absent (slug, nom, domainesCourrielAutorises au minimum)'
    )
  } else {
    const r = DeclarationOrganisationSchema.safeParse(
      parse(sys.lireTexte(fichierOrganisation))
    )
    if (r.success) organisation = r.data
    else erreurs.push(...formaterZod('organisation.yaml', r.error))
  }
  const role: AdressesDeRole = {
    domaines: organisation?.domainesCourrielAutorises ?? [],
    adresses: organisation?.adressesRoleAutorisees ?? [],
  }
  const medias = new Map<string, MediaValide>()
  if (organisation !== null) {
    const logo = lireLogo(
      sys,
      racine,
      '',
      organisation.logo,
      'organisation.yaml',
      medias,
      erreurs
    )
    const favicon =
      organisation.favicon === undefined
        ? undefined
        : lireImage(
            sys,
            racine,
            '',
            organisation.favicon,
            'png',
            'organisation.yaml',
            medias,
            erreurs
          )
    let iconeApplication =
      organisation.iconeApplication === undefined
        ? undefined
        : lireImage(
            sys,
            racine,
            '',
            organisation.iconeApplication,
            'png',
            'organisation.yaml',
            medias,
            erreurs
          )
    if (iconeApplication !== undefined) {
      try {
        verifierIconeApplication(medias.get(iconeApplication)!.donnees)
      } catch (e) {
        erreurs.push(`${iconeApplication} : ${(e as Error).message}`)
        iconeApplication = undefined
      }
    }
    organisation = {
      ...organisation,
      logo,
      favicon,
      iconeApplication,
    }
    if (logo === undefined) delete organisation.logo
    if (favicon === undefined) delete organisation.favicon
    if (iconeApplication === undefined) delete organisation.iconeApplication
  }

  const plate = FICHIERS_D_ACTIVITE.some(f => sys.existe(path.join(racine, f)))
  const dossierActivites = path.join(racine, 'activites')
  const enActivites = sys.existe(dossierActivites)
  const activites: ActiviteModele[] = []

  if (plate && enActivites) {
    erreurs.push(
      "le dossier mélange deux dispositions : perimetres.yaml, fiches/ ou taches/ à la racine, et activites/. Choisissez l'une des deux."
    )
  } else if (enActivites) {
    const slugs = sousDossiers(sys, dossierActivites)
    if (slugs.length === 0) {
      erreurs.push('activites/ ne contient aucune activité')
    }
    for (const slug of slugs) {
      const dossier = path.join('activites', slug)
      const fichierActivite = path.join(racine, dossier, 'activite.yaml')
      const nom = path.join(dossier, 'activite.yaml')
      if (!sys.existe(fichierActivite)) {
        erreurs.push(`${nom} est absent (slug, nom, nature au minimum)`)
        continue
      }
      const r = ActiviteDeclaree.safeParse(
        parse(sys.lireTexte(fichierActivite))
      )
      if (!r.success) {
        erreurs.push(...formaterZod(nom, r.error))
        continue
      }
      if (r.data.slug !== slug) {
        erreurs.push(`${nom} : le slug doit être ${slug}, le nom du dossier`)
      }
      const cles = r.data.groupes.map(g => g.cle)
      if (new Set(cles).size !== cles.length) {
        erreurs.push(`${nom} : deux groupes ont la même clé`)
      }
      const declaration = { ...r.data }
      if (organisation !== null) {
        for (const m of manquementsIdentiteActivite(
          declaration,
          organisation
        )) {
          erreurs.push(`${nom} : ${m.path.join('.')} ${m.message}`)
        }
      }
      const logo = lireLogo(
        sys,
        racine,
        dossier,
        declaration.logo,
        nom,
        medias,
        erreurs
      )
      if (logo === undefined) delete declaration.logo
      else declaration.logo = logo
      activites.push(
        lireActivite(sys, racine, dossier, declaration, false, role, erreurs)
      )
    }
  } else {
    // Disposition plate. Sans organisation valide, l'activité implicite garde un
    // slug provisoire : la lecture échoue de toute façon sur organisation.yaml.
    const declaration: ActiviteDeclaree = {
      slug: organisation?.slug ?? 'organisation',
      nom: organisation?.nom ?? 'Organisation',
      sigle: organisation?.sigle,
      nature: 'EVENEMENT',
      groupes: GROUPES_PAR_DEFAUT,
      ordre: 0,
    }
    activites.push(
      lireActivite(sys, racine, '', declaration, true, role, erreurs)
    )
  }

  // Le slug d'une fiche est unique dans l'organisation, toutes activités confondues.
  const fichesParSlug = new Map<string, FicheModele>()
  for (const fiche of activites.flatMap(a => a.fiches)) {
    const autre = fichesParSlug.get(fiche.slug)
    if (autre)
      erreurs.push(
        `${fiche.fichier} : le slug ${fiche.slug} est déjà utilisé par ${autre.fichier}`
      )
    fichesParSlug.set(fiche.slug, fiche)
  }

  if (erreurs.length > 0 || organisation === null)
    throw new ErreurModeles(erreurs)
  activites.sort(
    (a, b) =>
      a.declaration.ordre - b.declaration.ordre ||
      a.declaration.slug.localeCompare(b.declaration.slug)
  )
  return {
    organisation,
    medias,
    disposition: enActivites ? 'activites' : 'plate',
    activites,
  }
}

/** Calcule la date d'une échéance relative (J-120) à partir du premier jour de la période. */
export function dateEcheance(
  relative: string | undefined,
  debut: Date
): Date | null {
  if (relative === undefined) return null
  const m = /^J([-+])(\d{1,3})$/.exec(relative)
  if (m === null) return null
  const jours = Number(m[2]) * (m[1] === '-' ? -1 : 1)
  const date = new Date(
    Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), debut.getUTCDate())
  )
  date.setUTCDate(date.getUTCDate() + jours)
  return date
}
