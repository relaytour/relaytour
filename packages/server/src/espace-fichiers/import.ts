import { prisma } from '@relaytour/database'

import { donneesPersonnelles } from '../lib/contenu.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import { configurationOrganisation } from '../lib/organisation.ts'
import { importerFiches, type RapportFiches } from '../orga/import-fiches.ts'

import { cheminValide } from './chemin.ts'
import {
  formatImport,
  lireFiche,
  wordVersMarkdown,
  type FicheLue,
} from './conversion.ts'
import { planifierExportFiches } from './export.ts'
import { DOCUMENT_GOOGLE } from './google.ts'
import { documentNatif } from './index.ts'
import { lignee } from './isolement.ts'
import { ouvrirEspace } from './index.ts'
import type { ElementEspace, EspaceFichiers } from './types.ts'

// Import initial des fiches depuis l'espace de fichiers (ADR 0038). Un admin de
// l'organisation désigne un dossier source par périmètre, et un dossier pour les
// fiches communes. L'import suit les règles de `orga:importer` : une version ne
// se crée que si le texte change, une fiche modifiée dans Relaytour reste
// entière et se signale en conflit, une coordonnée personnelle fait refuser la
// fiche. Il se lance d'abord en simulation.

export interface SourceImport {
  /** Null : les fiches communes de l'activité. */
  perimetreId: string | null
  emplacement: string
  chemin: string[]
}

export interface FichierEcarte {
  fichier: string
  raison: string
}

export interface RapportImportEspace extends Omit<RapportFiches, 'conflits'> {
  conflits: { fiche: string; raison: string }[]
  nonImportes: FichierEcarte[]
  refusees: FichierEcarte[]
  /** Documents Word convertis en Markdown, avec ce que la conversion a perdu. */
  converties: FichierEcarte[]
  /** Vrai quand un dossier source compte plus d'éléments que Relaytour n'en lit. */
  incomplet: boolean
}

const TAILLE_MAX = 2 * 1024 * 1024
const CONTENU_MAX = 200_000
const FICHIERS_MAX = 300
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

async function lireOctets(
  espace: EspaceFichiers,
  position: { emplacement: string; base: string | null; chemin: string[] }
): Promise<Buffer> {
  const { flux } = await espace.ouvrir(position, { pdf: false })
  const morceaux: Uint8Array[] = []
  let total = 0
  for await (const morceau of flux) {
    total += morceau.length
    if (total > TAILLE_MAX) throw new Error('Fichier plus lourd que la limite.')
    morceaux.push(morceau)
  }
  return Buffer.concat(morceaux)
}

/**
 * Lit les dossiers sources, convertit leurs fichiers, puis importe les fiches
 * dans l'activité. Sans `ecrire`, rien ne change en base : le rapport décrit ce
 * que l'import ferait.
 */
export async function importerDepuisEspace(
  organisationId: string,
  activiteId: string,
  sources: readonly SourceImport[],
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

  // Une source par périmètre de l'activité, et une pour les fiches communes.
  const perimetres = await prisma.perimetre.findMany({
    where: { organisationId, activiteId },
    select: { id: true, slug: true },
  })
  const slugsPerimetres = new Map(perimetres.map(p => [p.id, p.slug]))
  const vus = new Set<string | null>()
  for (const source of sources) {
    if (source.perimetreId !== null && !slugsPerimetres.has(source.perimetreId))
      throw erreurSaisie(i18n._('Ce périmètre n’appartient pas à l’activité.'))
    if (vus.has(source.perimetreId))
      throw erreurSaisie(i18n._('Un périmètre reçoit un seul dossier source.'))
    if (!cheminValide(source.chemin))
      throw erreurSaisie(i18n._('Chemin invalide.'))
    vus.add(source.perimetreId)
  }

  const { espace } = await ouvrirEspace(organisationId)
  const exportation = await prisma.connexionFichiers.findUnique({
    where: { organisationId },
    select: { exportElement: true },
  })
  const configuration = await configurationOrganisation(organisationId)
  const role = {
    domaines: configuration.domainesCourrielAutorises,
    adresses: configuration.adressesRoleAutorisees,
  }

  const fiches: (FicheLue & { perimetreId: string | null })[] = []
  const provenance = new Map<string, string>()
  let lus = 0
  for (const source of sources) {
    const position = {
      emplacement: source.emplacement,
      base: null,
      chemin: source.chemin,
    }
    // Le dossier d'export ne sert jamais de source : ses fichiers sont des
    // copies écrites par Relaytour. Le contrôle vaut quel que soit
    // l'emplacement par lequel l'admin le voit.
    if (
      exportation?.exportElement != null &&
      (await lignee(espace, source.emplacement, source.chemin)).includes(
        exportation.exportElement
      )
    ) {
      throw erreurSaisie(
        i18n._(
          'Le dossier d’export des fiches ne sert pas de source : ses fichiers sont des copies écrites par Relaytour.'
        )
      )
    }
    const liste = await espace.lister(position)
    if (liste === null)
      throw erreurSaisie(i18n._('Un dossier source est introuvable.'))
    if (!liste.complet) rapport.incomplet = true
    const nomSource = source.chemin.join(' / ') || i18n._('racine')
    const fichiers = liste.elements
      .filter((e: ElementEspace) => !e.dossier)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    for (const fichier of fichiers) {
      const nomComplet = `${nomSource} / ${fichier.nom}`
      const ecarter = (raison: string) =>
        rapport.nonImportes.push({ fichier: nomComplet, raison })
      // Un document Google natif n'a pas d'extension : Drive l'exporte en Markdown.
      // Son nom ne dit rien de son contenu : un tableur nommé « Plan.md » ne
      // s'importe pas.
      const documentGoogle =
        fichier.typeMime === DOCUMENT_GOOGLE &&
        espace.lireMarkdown !== undefined
      const format = documentGoogle
        ? 'GOOGLE'
        : documentNatif(espace.fournisseur, fichier.typeMime)
          ? null
          : formatImport(fichier.nom)
      if (format === null) {
        ecarter(i18n._('format que Relaytour n’importe pas'))
        continue
      }
      if (lus >= FICHIERS_MAX) {
        ecarter(
          i18n._('au-delà de {max} fichiers par import', { max: FICHIERS_MAX })
        )
        continue
      }
      if (fichier.taille !== null && fichier.taille > TAILLE_MAX) {
        ecarter(i18n._('plus de 2 Mo'))
        continue
      }
      lus += 1
      let texte: string
      try {
        if (format === 'GOOGLE') {
          texte = await espace.lireMarkdown!({
            ...position,
            chemin: [...source.chemin, fichier.nom],
          })
          rapport.converties.push({
            fichier: nomComplet,
            raison: i18n._('document Google exporté en Markdown'),
          })
          if (texte.length > TAILLE_MAX) throw new Error('Document trop long.')
        } else {
          const octets = await lireOctets(espace, {
            ...position,
            chemin: [...source.chemin, fichier.nom],
          })
          if (format === 'WORD') {
            const converti = await wordVersMarkdown(octets)
            texte = converti.texte
            rapport.converties.push({
              fichier: nomComplet,
              raison:
                // La conversion ne perd aujourd'hui que les images.
                converti.pertes.length === 0
                  ? i18n._('converti en Markdown')
                  : i18n._('converti en Markdown, sans les images'),
            })
          } else {
            texte = octets.toString('utf8')
          }
        }
      } catch (erreur) {
        journal.warn(
          {
            evenement: 'import-fiche-illisible',
            organisationId,
            message: (erreur as Error).message,
          },
          'Un fichier de l’espace de fichiers n’a pas pu être lu.'
        )
        ecarter(i18n._('fichier illisible'))
        continue
      }
      // Le nom d'un document Google n'a pas d'extension : la lecture en ajoute une.
      const fiche = lireFiche(
        format === 'GOOGLE' ? `${fichier.nom}.gdoc` : fichier.nom,
        texte
      )
      if (!SLUG.test(fiche.slug) || fiche.slug.length > 60) {
        ecarter(i18n._('nom de fichier sans identifiant utilisable'))
        continue
      }
      if (fiche.contenu.length > CONTENU_MAX) {
        ecarter(i18n._('plus de 200 000 caractères'))
        continue
      }
      const deja = provenance.get(fiche.slug)
      if (deja !== undefined) {
        ecarter(i18n._('même identifiant que {fichier}', { fichier: deja }))
        continue
      }
      const personnelles = donneesPersonnelles(
        `${fiche.titre}\n${fiche.contenu}`,
        role
      )
      if (personnelles.length > 0) {
        rapport.refusees.push({
          fichier: nomComplet,
          raison: i18n._('coordonnées personnelles ({valeurs})', {
            valeurs: personnelles.join(', '),
          }),
        })
        continue
      }
      provenance.set(fiche.slug, nomComplet)
      fiches.push({ ...fiche, perimetreId: source.perimetreId })
    }
  }

  const rapportFiches: RapportFiches = {
    creees: [],
    nouvellesVersions: [],
    inchangees: [],
    conflits: [],
  }
  const { raisons } = await prisma.$transaction(
    tx =>
      importerFiches(
        tx,
        fiches,
        {
          organisationId,
          activiteId,
          source: 'ESPACE_FICHIERS',
          resume: 'Import depuis le fournisseur cloud',
          // Une fiche écrite dans Relaytour l'emporte ; une fiche venue du dépôt
          // ou d'un import précédent se met à jour.
          protegees: ['APP'],
          autreActivite: 'conflit',
          ecrire: options.ecrire,
          auteurId: options.auteurId,
        },
        rapportFiches
      ),
    { timeout: 60_000 }
  )
  rapport.creees = rapportFiches.creees
  rapport.nouvellesVersions = rapportFiches.nouvellesVersions
  rapport.inchangees = rapportFiches.inchangees
  rapport.conflits = rapportFiches.conflits.map(fiche => ({
    fiche,
    raison: raisons.get(fiche) ?? i18n._('conflit'),
  }))

  if (options.ecrire) {
    journal.info(
      {
        evenement: 'fiches-importees-espace',
        organisationId,
        activiteId,
        acteurId: options.auteurId,
        creees: rapport.creees.length,
        nouvellesVersions: rapport.nouvellesVersions.length,
      },
      'Des fiches ont été importées de l’espace de fichiers.'
    )
    if (rapport.creees.length + rapport.nouvellesVersions.length > 0) {
      publierPourActivite('FICHE', organisationId, activiteId)
      planifierExportFiches(organisationId)
    }
  }
  return rapport
}
