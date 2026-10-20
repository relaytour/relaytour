import {
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
} from '@ant-design/icons'

import { graphql } from '../gql'
import type { FormatApercu } from '../gql/graphql'

import { activiteAffichee, organisationChoisie } from './selection'

// Espace de fichiers d'une organisation (ADR 0038) : requêtes et lecture des
// documents. Relaytour relaie un document à la demande et n'en garde aucune copie.

export const ESPACE_FICHIERS = graphql(`
  query EspaceFichiers {
    espaceFichiers {
      fournisseursDisponibles
      connexion {
        fournisseur
        compte
        etat
        connecteeLe
        connecteePar
        exportDossier
        exportRapport {
          exporteLe
          ecrites
          inchangees
          supprimees
          refusees {
            fiche
            raison
          }
          modifieesALaMain
          erreur
        }
      }
    }
  }
`)

export const COMMENCER_CONNEXION = graphql(`
  mutation CommencerConnexionEspaceFichiers(
    $fournisseur: FournisseurFichiers!
  ) {
    commencerConnexionEspaceFichiers(fournisseur: $fournisseur)
  }
`)

export const DECONNECTER = graphql(`
  mutation DeconnecterEspaceFichiers {
    deconnecterEspaceFichiers
  }
`)

export const CHOISIR_DOSSIER_EXPORT = graphql(`
  mutation ChoisirDossierExport($emplacement: String!, $chemin: [String!]!) {
    choisirDossierExport(emplacement: $emplacement, chemin: $chemin) {
      exportDossier
    }
  }
`)

export const RETIRER_DOSSIER_EXPORT = graphql(`
  mutation RetirerDossierExport {
    retirerDossierExport
  }
`)

export const EXPORTER_FICHES_MAINTENANT = graphql(`
  mutation ExporterFichesMaintenant {
    exporterFichesMaintenant
  }
`)

export const SIMULER_IMPORT = graphql(`
  query SimulerImportFiches(
    $activiteId: ID!
    $sources: [SourceImportFiches!]!
  ) {
    simulerImportFiches(activiteId: $activiteId, sources: $sources) {
      creees
      nouvellesVersions
      inchangees
      conflits {
        fiche
        raison
      }
      nonImportes {
        fichier
        raison
      }
      refusees {
        fichier
        raison
      }
      converties {
        fichier
        raison
      }
      incomplet
    }
  }
`)

export const IMPORTER_FICHES = graphql(`
  mutation ImporterFichesEspace(
    $activiteId: ID!
    $sources: [SourceImportFiches!]!
  ) {
    importerFichesEspace(activiteId: $activiteId, sources: $sources) {
      creees
      nouvellesVersions
      inchangees
      conflits {
        fiche
        raison
      }
      nonImportes {
        fichier
        raison
      }
      refusees {
        fichier
        raison
      }
      converties {
        fichier
        raison
      }
      incomplet
    }
  }
`)

export const DOSSIERS_LIES = graphql(`
  query DossiersLies($activiteId: ID, $perimetreId: ID) {
    dossiersLies(activiteId: $activiteId, perimetreId: $perimetreId) {
      id
      nom
      disponible
      fournisseur
      perimetre {
        id
        slug
        nom
        couleur
      }
    }
  }
`)

export const CONTENU_DOSSIER = graphql(`
  query ContenuDossierLie($id: ID!, $chemin: [String!]!) {
    contenuDossierLie(id: $id, chemin: $chemin) {
      complet
      elements {
        elementId
        nom
        dossier
        taille
        modifieLe
        lienWeb
        apercu
      }
    }
  }
`)

export const PERIMETRES_A_LIER = graphql(`
  query PerimetresALier($activiteId: ID) {
    perimetres(activiteId: $activiteId) {
      id
      slug
      nom
      couleur
    }
  }
`)

export const EMPLACEMENTS = graphql(`
  query EmplacementsFichiers {
    emplacementsFichiers {
      id
      nom
      site
    }
  }
`)

export const PARCOURIR = graphql(`
  query ParcourirEspaceFichiers($emplacement: String!, $chemin: [String!]!) {
    parcourirEspaceFichiers(emplacement: $emplacement, chemin: $chemin) {
      complet
      elements {
        elementId
        nom
      }
    }
  }
`)

export const LIER_DOSSIER = graphql(`
  mutation LierDossier(
    $activiteId: ID!
    $perimetreId: ID
    $emplacement: String!
    $chemin: [String!]!
  ) {
    lierDossier(
      activiteId: $activiteId
      perimetreId: $perimetreId
      emplacement: $emplacement
      chemin: $chemin
    ) {
      id
    }
  }
`)

export const DELIER_DOSSIER = graphql(`
  mutation DelierDossier($id: ID!) {
    delierDossier(id: $id)
  }
`)

export const NOMS_FOURNISSEURS: Record<string, string> = {
  SHAREPOINT: 'SharePoint',
}

/** L'icône d'un fichier, selon ce que la liseuse en affiche. */
export const ICONES_APERCU: Record<FormatApercu, typeof FileOutlined> = {
  PDF: FilePdfOutlined,
  PDF_CONVERTI: FileTextOutlined,
  IMAGE: FileImageOutlined,
  TEXTE: FileTextOutlined,
  MARKDOWN: FileTextOutlined,
  AUCUN: FileOutlined,
}

/** Formats que la liseuse affiche dans la page. */
export const FORMATS_AFFICHES: readonly FormatApercu[] = [
  'PDF',
  'PDF_CONVERTI',
  'IMAGE',
  'TEXTE',
  'MARKDOWN',
]

/** Taille lisible d'un fichier : « 12 Ko », « 3,4 Mo ». */
export function tailleLisible(octets: number | null | undefined): string {
  if (octets === null || octets === undefined) return ''
  if (octets < 1024) return `${octets} o`
  const unites = ['Ko', 'Mo', 'Go']
  let valeur = octets / 1024
  let i = 0
  while (valeur >= 1024 && i < unites.length - 1) {
    valeur /= 1024
    i++
  }
  const arrondi =
    valeur < 10 ? valeur.toFixed(1) : Math.round(valeur).toString()
  return `${arrondi.replace('.', ',')} ${unites[i]}`
}

/** Adresse de la route d'aperçu d'un fichier d'un dossier lié. */
export function adresseApercu(
  dossierId: string,
  chemin: readonly string[],
  telecharger = false
): string {
  const parametres = new URLSearchParams({
    dossier: dossierId,
    chemin: chemin.join('/'),
  })
  if (telecharger) parametres.set('telecharger', '1')
  return `/medias/espace-fichiers/apercu?${parametres.toString()}`
}

/** Raison d'un refus de la route d'aperçu, lisible par la personne. */
function messageRefus(statut: number): string {
  switch (statut) {
    case 401:
      return 'Votre session a expiré. Reconnectez-vous.'
    case 404:
      return 'Ce document n’existe plus, ou vous n’y avez pas accès.'
    case 409:
      return 'L’espace de fichiers n’est pas connecté.'
    case 413:
      return 'Ce document dépasse 50 Mo. Ouvrez-le dans l’espace de fichiers.'
    default:
      return 'L’espace de fichiers ne répond pas. Réessayez dans quelques instants.'
  }
}

/**
 * Lit un fichier par la route d'aperçu, avec l'organisation et l'activité
 * choisies en en-tête, comme une requête GraphQL.
 */
export async function lireFichier(
  dossierId: string,
  chemin: readonly string[],
  telecharger = false,
  signal?: AbortSignal
): Promise<Blob> {
  const organisation = organisationChoisie()
  const activite = activiteAffichee()
  const reponse = await fetch(adresseApercu(dossierId, chemin, telecharger), {
    credentials: 'same-origin',
    signal,
    headers: {
      ...(organisation === null
        ? {}
        : { 'X-Relaytour-Organisation': organisation }),
      ...(activite === null ? {} : { 'X-Relaytour-Activite': activite }),
    },
  })
  if (!reponse.ok) throw new Error(messageRefus(reponse.status))
  return reponse.blob()
}

/** Télécharge un fichier sous son nom. */
export async function telechargerFichier(
  dossierId: string,
  chemin: readonly string[]
): Promise<void> {
  const blob = await lireFichier(dossierId, chemin, true)
  const adresse = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = adresse
  lien.download = chemin[chemin.length - 1] ?? 'document'
  document.body.append(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(adresse), 10_000)
}

// ── Ressources liées à une fiche ─────────────────────────────────────────────

export const RESSOURCES_FICHE = graphql(`
  query RessourcesFiche($slug: String!) {
    fiche(slug: $slug) {
      id
      ressources {
        id
        nom
        type
        chemin
        apercu
        existe
        lienWeb
        dossierLie {
          id
          nom
          disponible
          fournisseur
        }
      }
    }
  }
`)

export const LIER_RESSOURCE = graphql(`
  mutation LierRessourceFiche(
    $ficheId: ID!
    $dossierLieId: ID!
    $chemin: [String!]!
  ) {
    lierRessourceFiche(
      ficheId: $ficheId
      dossierLieId: $dossierLieId
      chemin: $chemin
    ) {
      id
    }
  }
`)

export const DELIER_RESSOURCE = graphql(`
  mutation DelierRessourceFiche($id: ID!) {
    delierRessourceFiche(id: $id)
  }
`)
