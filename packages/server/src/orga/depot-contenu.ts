import path from 'node:path'

import type { PrismaClient } from '@relaytour/database'
import { parseDocument } from 'yaml'

import { i18n } from '../lib/langue.ts'
import {
  ErreurArchive,
  lireArchiveZip,
  sansDossierEnglobant,
  type LimitesArchive,
} from '../lib/zip.ts'

import { construireContenu } from './exporter.ts'
import {
  importerModeles,
  modificationNonSynchronisee,
  type RapportImport,
} from './importer.ts'
import {
  ErreurModeles,
  lireModeles,
  RACINE_EN_MEMOIRE,
  systemeEnMemoire,
  type SystemeContenu,
} from './modeles.ts'

// Dépôt d'un dossier de contenu depuis l'espace organisateur (ADR 0049). L'archive
// se lit en mémoire, se valide comme avec orga:valider, puis s'importe comme avec
// orga:importer sans --edition.
//
// - Un admin de l'organisation dépose le dossier entier. Le slug de l'organisation
//   reste celui de la base : celui d'organisation.yaml est ignoré.
// - Un admin d'activité dépose le dossier de son activité. Le serveur ne lit que ce
//   dossier ; organisation.yaml et les autres activités viennent de la base.

export const LIMITES_DEPOT: LimitesArchive = {
  taille: 20 * 1024 * 1024,
  decompressee: 50 * 1024 * 1024,
  fichiers: 2000,
}

/** Refus lisible par l'espace organisateur, avec le détail des erreurs. */
export class ErreurDepot extends Error {
  constructor(
    message: string,
    readonly erreurs: string[] = [],
    readonly code:
      'SAISIE_INVALIDE' | 'MODIFIE_DANS_APPLICATION' = 'SAISIE_INVALIDE'
  ) {
    super(message)
  }
}

export interface RapportDepot extends RapportImport {
  /** Le slug déclaré par organisation.yaml quand il diffère de celui de la base. */
  slugIgnore: string | null
  /** Fichiers de l'archive que l'import n'a pas lus. */
  fichiersIgnores: string[]
}

export interface DemandeDepot {
  organisationId: string
  organisationSlug: string
  /** L'activité dont seul le dossier s'importe, ou null pour le dossier entier. */
  activite: { id: string; slug: string } | null
  archive: Buffer
  simulation: boolean
  /** Écrase les modifications faites dans l'application (équivaut à --forcer). */
  forcer: boolean
}

/** Les fichiers de la disposition plate qui décrivent une activité. */
function fichierDActivitePlate(chemin: string): boolean {
  return (
    chemin === 'perimetres.yaml' ||
    chemin.startsWith('fiches/') ||
    chemin.startsWith('taches/')
  )
}

/**
 * Le dossier d'une activité, rangé sous `activites/<slug>/`, à partir d'une archive
 * dans l'une des trois formes admises : l'export de l'organisation (disposition
 * activites/), le dossier de l'activité seul (activite.yaml à la racine), ou la
 * disposition plate. La clé est le chemin dans le dossier composé, la valeur le
 * chemin d'origine dans l'archive.
 */
function dossierDeLActivite(
  fichiers: ReadonlyMap<string, Buffer>,
  slug: string
): Map<string, string> {
  const dossier = `activites/${slug}/`
  const correspondance = new Map<string, string>()
  const chemins = [...fichiers.keys()]
  if (chemins.some(c => c.startsWith('activites/'))) {
    for (const c of chemins) {
      if (c.startsWith(dossier)) correspondance.set(c, c)
    }
    if (correspondance.size === 0) {
      throw new ErreurDepot(
        i18n._('L’archive ne contient pas le dossier activites/{slug}/.', {
          slug,
        })
      )
    }
  } else if (fichiers.has('activite.yaml')) {
    for (const c of chemins) correspondance.set(`${dossier}${c}`, c)
  } else {
    for (const c of chemins.filter(fichierDActivitePlate)) {
      correspondance.set(`${dossier}${c}`, c)
    }
  }
  return correspondance
}

/** Remplace le slug d'organisation.yaml, en gardant le reste du fichier. */
function avecSlug(
  texte: Buffer,
  slug: string
): { fichier: Buffer; declare: string | null } {
  const document = parseDocument(texte.toString('utf8'))
  const declare = document.get('slug')
  if (declare === slug || document.errors.length > 0) {
    return { fichier: texte, declare: null }
  }
  document.set('slug', slug)
  return {
    fichier: Buffer.from(document.toString(), 'utf8'),
    declare: typeof declare === 'string' ? declare : null,
  }
}

/** Un système de fichiers en mémoire qui retient les fichiers lus. */
function systemeSuivi(fichiers: ReadonlyMap<string, Buffer>): {
  sys: SystemeContenu
  lus: Set<string>
} {
  const base = systemeEnMemoire(fichiers)
  const lus = new Set<string>()
  const relatif = (c: string) => path.posix.relative(RACINE_EN_MEMOIRE, c)
  return {
    lus,
    sys: {
      ...base,
      lireTexte: c => {
        lus.add(relatif(c))
        return base.lireTexte(c)
      },
      lireOctets: c => {
        lus.add(relatif(c))
        return base.lireOctets(c)
      },
    },
  }
}

/**
 * Simule ou importe une archive déposée. Les refus de lecture, de validation et de
 * synchronisation lèvent une ErreurDepot ; l'appelant a déjà vérifié les droits.
 */
export async function deposerContenu(
  prisma: PrismaClient,
  demande: DemandeDepot
): Promise<RapportDepot> {
  let archive: Map<string, Buffer>
  try {
    archive = sansDossierEnglobant(
      lireArchiveZip(demande.archive, LIMITES_DEPOT)
    )
  } catch (erreur) {
    if (erreur instanceof ErreurArchive) throw new ErreurDepot(erreur.message)
    throw erreur
  }

  // Le dossier composé, et l'origine de chacun de ses fichiers dans l'archive.
  const dossier = new Map<string, Buffer>()
  const origine = new Map<string, string>()
  let slugIgnore: string | null = null
  if (demande.activite === null) {
    for (const [chemin, donnees] of archive) {
      dossier.set(chemin, donnees)
      origine.set(chemin, chemin)
    }
    const declaration = archive.get('organisation.yaml')
    if (declaration !== undefined) {
      const { fichier, declare } = avecSlug(
        declaration,
        demande.organisationSlug
      )
      dossier.set('organisation.yaml', fichier)
      slugIgnore = declare
    }
  } else {
    const { slug } = demande.activite
    const correspondance = dossierDeLActivite(archive, slug)
    // L'identité de l'organisation et ses images viennent de la base, avec la
    // déclaration de l'activité si l'archive n'en apporte pas.
    const enBase = await construireContenu(prisma, demande.organisationId, {
      disposition: 'activites',
    })
    const dossierActivite = `activites/${slug}/`
    const apporteDeclaration = correspondance.has(
      `${dossierActivite}activite.yaml`
    )
    for (const [chemin, donnees] of enBase.fichiers) {
      if (
        chemin === 'organisation.yaml' ||
        chemin.startsWith('medias/') ||
        (!apporteDeclaration &&
          (chemin === `${dossierActivite}activite.yaml` ||
            chemin.startsWith(`${dossierActivite}medias/`)))
      ) {
        dossier.set(chemin, donnees)
      }
    }
    for (const [chemin, source] of correspondance) {
      dossier.set(chemin, archive.get(source)!)
      origine.set(chemin, source)
    }
  }

  const { sys, lus } = systemeSuivi(dossier)
  let modeles: ReturnType<typeof lireModeles>
  try {
    modeles = lireModeles(RACINE_EN_MEMOIRE, sys)
  } catch (erreur) {
    if (erreur instanceof ErreurModeles) {
      throw new ErreurDepot(
        i18n._('Le dossier de contenu contient des erreurs.'),
        erreur.erreurs
      )
    }
    throw erreur
  }

  if (!demande.simulation && !demande.forcer) {
    const modifie = await modificationNonSynchronisee(
      prisma,
      demande.organisationId
    )
    if (modifie !== null) {
      throw new ErreurDepot(
        i18n._(
          'Des admins ont modifié le contenu dans l’application après la dernière synchronisation. Confirmez l’écrasement de ces modifications pour importer l’archive.'
        ),
        [],
        'MODIFIE_DANS_APPLICATION'
      )
    }
  }

  let rapport: RapportImport
  try {
    rapport = await importerModeles(prisma, modeles, {
      simulation: demande.simulation,
      organisation: demande.organisationSlug,
      activite: demande.activite?.slug,
      ignorerOrganisation: demande.activite !== null,
      forcer: demande.forcer,
    })
  } catch (erreur) {
    // Les refus de l'import (limite d'activités, activité absente) sont rédigés
    // pour la commande : l'espace organisateur les affiche tels quels.
    if (erreur instanceof Error && erreur.constructor === Error) {
      throw new ErreurDepot(i18n._('L’import a été refusé.'), [erreur.message])
    }
    throw erreur
  }

  const lusDansLArchive = new Set(
    [...lus].flatMap(c => {
      const source = origine.get(c)
      return source === undefined ? [] : [source]
    })
  )
  return {
    ...rapport,
    slugIgnore,
    fichiersIgnores: [...archive.keys()]
      .filter(c => !lusDansLArchive.has(c))
      .sort(),
  }
}
