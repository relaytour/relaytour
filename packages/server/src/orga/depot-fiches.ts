import { prisma } from '@relaytour/database'

import { formatImport, lireFiche } from '../espace-fichiers/conversion.ts'
import {
  accepterFiche,
  ecrireFiches,
  TAILLE_MAX,
  texteDuFichier,
  type RapportImportEspace,
} from '../espace-fichiers/import.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import { configurationOrganisation } from '../lib/organisation.ts'

// Dépôt direct de fiches depuis l'écran « Ressources » (ADR 0049). Les fichiers
// suivent les règles de l'import depuis l'espace de fichiers (ADR 0038) : même
// conversion, mêmes limites, même traitement des conflits. Leurs versions portent
// la source DEPOT.

export const LIMITES_DEPOT_FICHES = {
  /** Fichiers lus par dépôt. */
  fichiers: 50,
  /** Taille d'un fichier, en octets. */
  taille: TAILLE_MAX,
  /** Taille totale des fichiers d'un dépôt, en octets. */
  total: 20 * 1024 * 1024,
}

export interface FichierDepose {
  nom: string
  octets: Buffer
}

/**
 * Convertit les fichiers déposés en fiches d'un périmètre, ou en fiches communes
 * avec un périmètre nul, puis les importe. Sans `ecrire`, rien ne change en base.
 * L'appelant a vérifié les droits sur l'activité et le périmètre.
 */
export async function deposerFiches(
  organisationId: string,
  activiteId: string,
  perimetreId: string | null,
  fichiers: readonly FichierDepose[],
  options: { ecrire: boolean; auteurId: string }
): Promise<RapportImportEspace> {
  const rapport: RapportImportEspace = {
    creees: [],
    nouvellesVersions: [],
    inchangees: [],
    conflits: [],
    nonImportes: [],
    refusees: [],
    converties: [],
    incomplet: false,
  }
  const configuration = await configurationOrganisation(organisationId)
  const role = {
    domaines: configuration.domainesCourrielAutorises,
    adresses: configuration.adressesRoleAutorisees,
  }
  const fiches: Parameters<typeof ecrireFiches>[2][number][] = []
  const provenance = new Map<string, string>()
  let lus = 0
  const tries = [...fichiers].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  for (const fichier of tries) {
    // Le nom vient du navigateur : seul le dernier segment compte.
    const nom = fichier.nom.split(/[\\/]/).pop()!.trim()
    const ecarter = (raison: string) =>
      rapport.nonImportes.push({ fichier: nom, raison })
    const format = formatImport(nom)
    if (format === null) {
      ecarter(i18n._('format que Relaytour n’importe pas'))
      continue
    }
    if (lus >= LIMITES_DEPOT_FICHES.fichiers) {
      ecarter(
        i18n._('au-delà de {max} fichiers par import', {
          max: LIMITES_DEPOT_FICHES.fichiers,
        })
      )
      continue
    }
    if (fichier.octets.length > LIMITES_DEPOT_FICHES.taille) {
      ecarter(i18n._('plus de 2 Mo'))
      continue
    }
    lus += 1
    let texte: string
    try {
      const lu = await texteDuFichier(fichier.octets, format)
      texte = lu.texte
      if (lu.conversion !== null) {
        rapport.converties.push({ fichier: nom, raison: lu.conversion })
      }
    } catch (erreur) {
      journal.warn(
        {
          evenement: 'depot-fiche-illisible',
          organisationId,
          message: (erreur as Error).message,
        },
        'Un fichier déposé n’a pas pu être lu.'
      )
      ecarter(i18n._('fichier illisible'))
      continue
    }
    const fiche = lireFiche(nom, texte)
    if (accepterFiche(fiche, nom, role, provenance, rapport)) {
      fiches.push({ ...fiche, perimetreId })
    }
  }

  await ecrireFiches(organisationId, activiteId, fiches, rapport, {
    ...options,
    source: 'DEPOT',
    resume: 'Dépôt de fichiers',
    evenement: 'fiches-deposees',
    messageJournal: 'Des fiches ont été déposées depuis l’espace organisateur.',
  })
  return rapport
}

/**
 * Le périmètre visé s'il appartient à l'activité et reste ouvert, ou null pour
 * les fiches communes. Un périmètre d'une autre activité donne `false`.
 */
export async function perimetreDuDepot(
  activiteId: string,
  perimetreId: string | null
): Promise<string | null | false> {
  if (perimetreId === null) return null
  const ligne = await prisma.perimetre.findFirst({
    where: { id: perimetreId, activiteId, archivedAt: null },
    select: { id: true },
  })
  return ligne?.id ?? false
}
