import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'yaml'
import { z } from 'zod'

import {
  domainesAutorises,
  donneesPersonnelles,
  normaliserContenu,
} from '../lib/contenu.ts'

// Lecture et validation du dossier content/orga (ADR 0003).
//
// L'analyse est stricte : un champ inconnu, un slug mal formé ou une donnée
// personnelle font échouer la lecture du fichier concerné, avec un message qui nomme
// le fichier. Rien n'est écrit en base tant que tout le dossier n'est pas valide.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const Slug = z.string().regex(SLUG, 'minuscules, chiffres et tirets seulement')

const PerimetreModele = z.strictObject({
  slug: Slug,
  nom: z.string().min(1).max(120),
  type: z.enum(['SPORT', 'POLE']),
  couleur: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'couleur au format #RRGGBB')
    .optional(),
  ordre: z.number().int().min(0).max(999).default(0),
  // Nombre de référentes et de référents souhaité pour chaque édition.
  // Un effectif de 0 signifie qu'aucune personne n'est recherchée.
  effectif: z.number().int('nombre entier attendu').min(0).max(50).optional(),
})

const FichierPerimetres = z.strictObject({
  perimetres: z.array(PerimetreModele),
})

const EnteteFiche = z.strictObject({
  slug: Slug,
  titre: z.string().min(1).max(200),
})

// J-120 : 120 jours avant le premier jour de l'édition. J+3 : 3 jours après.
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

export type PerimetreModele = z.infer<typeof PerimetreModele>
export type TacheModele = z.infer<typeof TacheModele>

export interface FicheModele {
  slug: string
  titre: string
  contenu: string
  /** null pour une fiche commune. */
  perimetre: string | null
  fichier: string
}

export interface Modeles {
  perimetres: PerimetreModele[]
  fiches: FicheModele[]
  /** Tâches types par slug de périmètre. */
  taches: Map<string, TacheModele[]>
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

export function lireModeles(racine: string): Modeles {
  const erreurs: string[] = []
  const domaines = domainesAutorises()
  const relatif = (f: string) => path.relative(racine, f)

  // Périmètres
  let perimetres: PerimetreModele[] = []
  const fichierPerimetres = path.join(racine, 'perimetres.yaml')
  if (!existsSync(fichierPerimetres)) {
    erreurs.push('perimetres.yaml est absent')
  } else {
    const r = FichierPerimetres.safeParse(
      parse(readFileSync(fichierPerimetres, 'utf8'))
    )
    if (r.success) perimetres = r.data.perimetres
    else erreurs.push(...formaterZod('perimetres.yaml', r.error))
  }
  const slugsPerimetres = new Set(perimetres.map(p => p.slug))
  if (slugsPerimetres.size !== perimetres.length) {
    erreurs.push('perimetres.yaml : deux périmètres ont le même slug')
  }

  // Fiches : fiches/communes/*.md et fiches/<perimetre>/*.md
  const fiches: FicheModele[] = []
  const dossierFiches = path.join(racine, 'fiches')
  const sousDossiers = existsSync(dossierFiches)
    ? readdirSync(dossierFiches, { withFileTypes: true }).filter(e =>
        e.isDirectory()
      )
    : []
  for (const sousDossier of sousDossiers) {
    const perimetre = sousDossier.name === 'communes' ? null : sousDossier.name
    if (perimetre !== null && !slugsPerimetres.has(perimetre)) {
      erreurs.push(
        `fiches/${perimetre} : ce périmètre n'existe pas dans perimetres.yaml`
      )
      continue
    }
    for (const fichier of fichiers(
      path.join(dossierFiches, sousDossier.name),
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
  const slugsFiches = new Map<string, FicheModele>()
  for (const fiche of fiches) {
    const autre = slugsFiches.get(fiche.slug)
    if (autre)
      erreurs.push(
        `${fiche.fichier} : le slug ${fiche.slug} est déjà utilisé par ${autre.fichier}`
      )
    slugsFiches.set(fiche.slug, fiche)
  }

  // Tâches types : taches/<perimetre>.yaml
  const taches = new Map<string, TacheModele[]>()
  for (const fichier of fichiers(path.join(racine, 'taches'), '.yaml')) {
    const nom = relatif(fichier)
    const perimetre = path.basename(fichier, '.yaml')
    if (!slugsPerimetres.has(perimetre)) {
      erreurs.push(`${nom} : ce périmètre n'existe pas dans perimetres.yaml`)
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
          `${nom} : ${tache.modele} cite la fiche ${tache.fiche}, qui n'existe pas`
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

  if (erreurs.length > 0) throw new ErreurModeles(erreurs)
  return { perimetres, fiches, taches }
}

/** Calcule la date d'une échéance relative (J-120) à partir du premier jour de l'édition. */
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
