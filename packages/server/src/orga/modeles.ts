import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'yaml'
import { z } from 'zod'

import { donneesPersonnelles, normaliserContenu } from '../lib/contenu.ts'
import {
  DeclarationOrganisationSchema,
  type DeclarationOrganisation,
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
const GROUPES_PAR_DEFAUT = [
  { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
  { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
]

// activites/<slug>/activite.yaml (ADR 0008).
const ActiviteDeclaree = z.strictObject({
  slug: Slug,
  nom: z.string().trim().min(1).max(120),
  sigle: z.string().trim().min(1).max(20).optional(),
  nature: z.enum(['EVENEMENT', 'SAISON', 'MANDAT']).default('EVENEMENT'),
  groupes: z.array(GroupeModele).min(1).max(10).default(GROUPES_PAR_DEFAUT),
  ordre: z.number().int().min(0).max(999).default(0),
})

// Un périmètre déclare son groupe, ou son type (SPORT, POLE) pour les contenus
// antérieurs à l'ADR 0008. Le groupe se déduit du type et le type du groupe.
const PerimetreDeclare = z
  .strictObject({
    slug: Slug,
    nom: z.string().min(1).max(120),
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
  .transform(p => ({
    ...p,
    groupe: p.groupe ?? (p.type === 'SPORT' ? 'sport' : 'pole'),
    type: p.type ?? (p.groupe === 'sport' ? 'SPORT' : 'POLE'),
  }))

const FichierPerimetres = z.strictObject({
  perimetres: z.array(PerimetreDeclare),
})

const EnteteFiche = z.strictObject({
  slug: Slug,
  titre: z.string().min(1).max(200),
})

// J-120 : 120 jours avant le premier jour de la période. J+3 : 3 jours après.
const EcheanceRelative = z
  .string()
  .regex(/^J[-+]\d{1,3}$/, 'échéance relative de la forme J-120 ou J+3')

const TacheModele = z.strictObject({
  modele: Slug,
  titre: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  echeance: EcheanceRelative.optional(),
  fiche: Slug.optional(),
})

const FichierTaches = z.strictObject({
  taches: z.array(TacheModele),
})

export type PerimetreModele = z.output<typeof PerimetreDeclare>
export type TacheModele = z.infer<typeof TacheModele>
export type ActiviteDeclaree = z.output<typeof ActiviteDeclaree>

export interface FicheModele {
  slug: string
  titre: string
  contenu: string
  /** null pour une fiche commune à l'activité. */
  perimetre: string | null
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
  /** Identité et thème de l'organisation (organisation.yaml). */
  organisation: DeclarationOrganisation
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

function fichiers(dossier: string, extension: string): string[] {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith(extension))
    .map(e => path.join(dossier, e.name))
    .sort()
}

function sousDossiers(dossier: string): string[] {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
}

/** Fichiers propres à une activité, qui signalent la disposition plate à la racine. */
const FICHIERS_D_ACTIVITE = ['perimetres.yaml', 'fiches', 'taches']

/**
 * Lit les périmètres, fiches et tâches types d'une activité, dans le dossier
 * `racine/dossier`. Les messages nomment les fichiers depuis la racine.
 */
function lireActivite(
  racine: string,
  dossier: string,
  declaration: ActiviteDeclaree,
  implicite: boolean,
  domaines: string[],
  erreurs: string[]
): ActiviteModele {
  const base = path.join(racine, dossier)
  const relatif = (f: string) => path.relative(racine, f)
  const groupes = new Set(declaration.groupes.map(g => g.cle))

  // Périmètres
  let perimetres: PerimetreModele[] = []
  const fichierPerimetres = path.join(base, 'perimetres.yaml')
  const nomPerimetres = relatif(fichierPerimetres)
  if (!existsSync(fichierPerimetres)) {
    erreurs.push(`${nomPerimetres} est absent`)
  } else {
    const r = FichierPerimetres.safeParse(
      parse(readFileSync(fichierPerimetres, 'utf8'))
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
  }

  // Fiches : fiches/communes/*.md et fiches/<perimetre>/*.md
  const fiches: FicheModele[] = []
  const dossierFiches = path.join(base, 'fiches')
  for (const nomDossier of sousDossiers(dossierFiches)) {
    const perimetre = nomDossier === 'communes' ? null : nomDossier
    if (perimetre !== null && !slugsPerimetres.has(perimetre)) {
      erreurs.push(
        `${relatif(path.join(dossierFiches, nomDossier))} : ce périmètre n'existe pas dans ${nomPerimetres}`
      )
      continue
    }
    for (const fichier of fichiers(
      path.join(dossierFiches, nomDossier),
      '.md'
    )) {
      const nom = relatif(fichier)
      const separe = separerEntete(readFileSync(fichier, 'utf8'))
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
        domaines
      )
      if (personnelles.length > 0) {
        erreurs.push(
          `${nom} : données personnelles interdites dans Git (${personnelles.join(', ')}). Écrire un rôle à la place.`
        )
      }
      fiches.push({ ...entete.data, contenu, perimetre, fichier: nom })
    }
  }
  const slugsFiches = new Map(fiches.map(f => [f.slug, f]))

  // Tâches types : taches/<perimetre>.yaml
  const taches = new Map<string, TacheModele[]>()
  for (const fichier of fichiers(path.join(base, 'taches'), '.yaml')) {
    const nom = relatif(fichier)
    const perimetre = path.basename(fichier, '.yaml')
    if (!slugsPerimetres.has(perimetre)) {
      erreurs.push(`${nom} : ce périmètre n'existe pas dans ${nomPerimetres}`)
      continue
    }
    const r = FichierTaches.safeParse(parse(readFileSync(fichier, 'utf8')))
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
        `${tache.titre}\n${tache.description ?? ''}`,
        domaines
      )
      if (personnelles.length > 0) {
        erreurs.push(
          `${nom} : ${tache.modele} contient des données personnelles interdites dans Git`
        )
      }
    }
    taches.set(perimetre, r.data.taches)
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
export function lireModeles(racine: string): Modeles {
  const erreurs: string[] = []

  // Organisation : nom, domaines de mail autorisés, contact, thème.
  // Les domaines autorisés dans les fiches viennent d'ici, pas de l'environnement :
  // la validation en CI du dépôt d'organisation n'a besoin d'aucune variable.
  let organisation: DeclarationOrganisation | null = null
  const fichierOrganisation = path.join(racine, 'organisation.yaml')
  if (!existsSync(fichierOrganisation)) {
    erreurs.push(
      'organisation.yaml est absent (slug, nom, domainesCourrielAutorises au minimum)'
    )
  } else {
    const r = DeclarationOrganisationSchema.safeParse(
      parse(readFileSync(fichierOrganisation, 'utf8'))
    )
    if (r.success) organisation = r.data
    else erreurs.push(...formaterZod('organisation.yaml', r.error))
  }
  const domaines = organisation?.domainesCourrielAutorises ?? []

  const plate = FICHIERS_D_ACTIVITE.some(f => existsSync(path.join(racine, f)))
  const dossierActivites = path.join(racine, 'activites')
  const enActivites = existsSync(dossierActivites)
  const activites: ActiviteModele[] = []

  if (plate && enActivites) {
    erreurs.push(
      "le dossier mélange deux dispositions : perimetres.yaml, fiches/ ou taches/ à la racine, et activites/. Choisissez l'une des deux."
    )
  } else if (enActivites) {
    const slugs = sousDossiers(dossierActivites)
    if (slugs.length === 0) {
      erreurs.push('activites/ ne contient aucune activité')
    }
    for (const slug of slugs) {
      const dossier = path.join('activites', slug)
      const fichierActivite = path.join(racine, dossier, 'activite.yaml')
      const nom = path.join(dossier, 'activite.yaml')
      if (!existsSync(fichierActivite)) {
        erreurs.push(`${nom} est absent (slug, nom, nature au minimum)`)
        continue
      }
      const r = ActiviteDeclaree.safeParse(
        parse(readFileSync(fichierActivite, 'utf8'))
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
      activites.push(
        lireActivite(racine, dossier, r.data, false, domaines, erreurs)
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
      lireActivite(racine, '', declaration, true, domaines, erreurs)
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
