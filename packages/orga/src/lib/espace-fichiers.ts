import {
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
} from '@ant-design/icons'

import { i18n, type MessageDescriptor } from '@lingui/core'
import { msg, t } from '@lingui/core/macro'

import { graphql } from '../gql'
import type { FormatApercu } from '../gql/graphql'

import { langueActive } from './langue'
import { activiteAffichee, organisationChoisie } from './selection'

// Espace de fichiers d'une organisation (ADR 0038) : requêtes et lecture des
// documents. Relaytour relaie un document à la demande et n'en garde aucune copie.

export const ESPACE_FICHIERS = graphql(`
  query EspaceFichiers {
    espaceFichiers {
      connexionsPossibles {
        fournisseur
        methode
      }
      connexion {
        fournisseur
        methode
        compte
        etat
        connecteeLe
        connecteePar
        portee
        accesVerifieLe
        accesErreur
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
    $portee: PorteeConnexionFichiers
  ) {
    commencerConnexionEspaceFichiers(fournisseur: $fournisseur, portee: $portee)
  }
`)

export const CONNECTER_COMPTE_SERVICE = graphql(`
  mutation ConnecterCompteServiceGoogle($cle: String!) {
    connecterCompteServiceGoogle(cle: $cle) {
      compte
    }
  }
`)

export const COMMENCER_NEXTCLOUD = graphql(`
  mutation CommencerConnexionNextcloud($adresse: String!) {
    commencerConnexionNextcloud(adresse: $adresse) {
      connexion
      etat
    }
  }
`)

export const TERMINER_NEXTCLOUD = graphql(`
  mutation TerminerConnexionNextcloud($etat: String!) {
    terminerConnexionNextcloud(etat: $etat)
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
      touteActivite
      attendus
      accesCrees
      perimetres {
        id
        slug
        nom
        couleur
        archive
      }
      groupes
      lecteursLus {
        touteActivite
        perimetres {
          id
          slug
          nom
          couleur
        }
        groupes
      }
    }
  }
`)

/** Les lecteurs d'un dossier lié (ADR 0043) : toute l'activité, ou une liste. */
export interface Lecteurs {
  touteActivite: boolean
  perimetres: string[]
  groupes: string[]
}

export const TOUTE_L_ACTIVITE: Lecteurs = {
  touteActivite: true,
  perimetres: [],
  groupes: [],
}

/** Les lecteurs sous la forme qu'attend le serveur. */
export const versSaisie = (l: Lecteurs) => ({
  touteActivite: l.touteActivite,
  perimetreIds: l.touteActivite ? [] : l.perimetres,
  groupes: l.touteActivite ? [] : l.groupes,
})

/** Vrai quand les lecteurs désignent toute l'activité ou au moins un élément. */
export const lecteursValides = (l: Lecteurs) =>
  l.touteActivite || l.perimetres.length + l.groupes.length > 0

export const EFFETS_LECTEURS = graphql(`
  query EffetsLecteursDossier($id: ID!, $lecteurs: LecteursDossierInput!) {
    effetsLecteursDossier(id: $id, lecteurs: $lecteurs) {
      documentsMasques
      fiches {
        id
        titre
      }
    }
  }
`)

export const CONTENU_DOSSIER = graphql(`
  query ContenuDossierLie($id: ID!, $chemin: [String!]!, $ressource: ID) {
    contenuDossierLie(id: $id, chemin: $chemin, ressource: $ressource) {
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
    $lecteurs: LecteursDossierInput!
    $emplacement: String!
    $chemin: [String!]!
  ) {
    lierDossier(
      activiteId: $activiteId
      lecteurs: $lecteurs
      emplacement: $emplacement
      chemin: $chemin
    ) {
      id
    }
  }
`)

export const MODIFIER_DOSSIER_LIE = graphql(`
  mutation ModifierDossierLie(
    $id: ID!
    $lecteurs: LecteursDossierInput!
    $nom: String
    $attendus: AttendusDossier
  ) {
    modifierDossierLie(
      id: $id
      lecteurs: $lecteurs
      nom: $nom
      attendus: $attendus
    ) {
      id
      nom
      touteActivite
      perimetres {
        id
      }
      groupes
    }
  }
`)

export const DELIER_DOSSIER = graphql(`
  mutation DelierDossier($id: ID!, $oublierAcces: Boolean) {
    delierDossier(id: $id, oublierAcces: $oublierAcces)
  }
`)

export const NOMS_FOURNISSEURS: Record<string, string> = {
  SHAREPOINT: 'SharePoint',
  GOOGLE_DRIVE: 'Google Drive',
  DROPBOX: 'Dropbox',
  NEXTCLOUD: 'Nextcloud',
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
  if (octets < 1024) return t`${octets} o`
  let valeur = octets / 1024
  let i = 0
  while (valeur >= 1024 && i < 2) {
    valeur /= 1024
    i++
  }
  const arrondi = new Intl.NumberFormat(langueActive(), {
    useGrouping: false,
    minimumFractionDigits: valeur < 10 ? 1 : 0,
    maximumFractionDigits: valeur < 10 ? 1 : 0,
  }).format(valeur)
  if (i === 0) return t`${arrondi} Ko`
  if (i === 1) return t`${arrondi} Mo`
  return t`${arrondi} Go`
}

/**
 * Adresse de la route d'aperçu d'un fichier d'un dossier lié. `ressourceId` désigne
 * un document lié ouvert aux lecteurs de sa fiche (ADR 0043).
 */
export function adresseApercu(
  dossierId: string,
  chemin: readonly string[],
  telecharger = false,
  ressourceId: string | null = null
): string {
  const parametres = new URLSearchParams({
    dossier: dossierId,
    chemin: chemin.join('/'),
  })
  if (telecharger) parametres.set('telecharger', '1')
  if (ressourceId !== null) parametres.set('ressource', ressourceId)
  return `/medias/espace-fichiers/apercu?${parametres.toString()}`
}

/** Raison d'un refus de la route d'aperçu, lisible par la personne. */
function messageRefus(statut: number): string {
  switch (statut) {
    case 401:
      return t`Votre session a expiré. Reconnectez-vous.`
    case 404:
      return t`Ce document n’existe plus, ou vous n’y avez pas accès.`
    case 409:
      return t`Le fournisseur cloud n’est pas connecté.`
    case 413:
      return t`Ce document dépasse 50 Mo. Ouvrez-le chez le fournisseur cloud.`
    default:
      return t`Le fournisseur cloud ne répond pas. Réessayez dans quelques instants.`
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
  signal?: AbortSignal,
  ressourceId: string | null = null
): Promise<Blob> {
  return (
    await demanderFichier(dossierId, chemin, telecharger, signal, ressourceId)
  ).blob()
}

async function demanderFichier(
  dossierId: string,
  chemin: readonly string[],
  telecharger: boolean,
  signal?: AbortSignal,
  ressourceId: string | null = null
): Promise<Response> {
  const organisation = organisationChoisie()
  const activite = activiteAffichee()
  const adresse = adresseApercu(dossierId, chemin, telecharger, ressourceId)
  const reponse = await fetch(adresse, {
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
  return reponse
}

/** Le nom que l'API donne au fichier (`filename*`), ou null. */
export function nomServi(entete: string | null): string | null {
  const nom = /filename\*=UTF-8''([^;]+)/i.exec(entete ?? '')?.[1]
  if (nom === undefined) return null
  try {
    return decodeURIComponent(nom)
  } catch {
    return null
  }
}

/**
 * Télécharge un fichier sous le nom que l'API lui donne. Un document Google
 * natif y gagne l'extension de son format d'export.
 */
export async function telechargerFichier(
  dossierId: string,
  chemin: readonly string[],
  ressourceId: string | null = null
): Promise<void> {
  const reponse = await demanderFichier(
    dossierId,
    chemin,
    true,
    undefined,
    ressourceId
  )
  const nom =
    nomServi(reponse.headers.get('content-disposition')) ??
    chemin[chemin.length - 1] ??
    t({
      message: 'document',
      comment: 'Nom d’un fichier téléchargé sans nom connu',
    })
  const adresse = URL.createObjectURL(await reponse.blob())
  const lien = document.createElement('a')
  lien.href = adresse
  lien.download = nom
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
      concerneGroupes
      ressources {
        id
        nom
        type
        chemin
        ouvrable
        ouverteAuxLecteurs
        apercu
        existe
        lienWeb
        perimetresSansAcces {
          id
          nom
          couleur
        }
        dossierLie {
          id
          nom
          disponible
          fournisseur
          touteActivite
          perimetres {
            id
          }
          groupes
        }
      }
    }
  }
`)

export const OUVRIR_DOCUMENT = graphql(`
  mutation OuvrirDocumentLie($id: ID!, $ouvert: Boolean!) {
    ouvrirDocumentLie(id: $id, ouvert: $ouvert) {
      id
      ouverteAuxLecteurs
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

// ── Vérification des accès chez le fournisseur (ADR 0044) ────────────────────

export const VERIFICATION_ACCES = graphql(`
  query VerificationAcces($activiteId: ID!) {
    verificationAcces(activiteId: $activiteId) {
      verifieLe
      dossier {
        id
        nom
        touteActivite
        attendus
        accesFournisseur
        groupeFournisseurId
        groupeFournisseurNom
        roleFournisseur
        fournisseur
        ajoutsAutomatiques
        invitationFournisseur
        groupes
        perimetres {
          id
          nom
          couleur
        }
      }
      perimetres {
        id
        nom
        couleur
      }
      propositions {
        id
        action
        etat
        erreur
        cible
        parGroupe
        personne {
          id
          nom
          email
        }
      }
      lignes {
        nom
        etat
        via
        perimetreIds
        personne {
          id
          email
        }
      }
    }
  }
`)

export const COMPTES_FOURNISSEUR = graphql(`
  query ComptesFournisseur {
    comptesFournisseur {
      etat
      adresseSaisie
      verifieLe
      personne {
        id
        nom
        email
      }
    }
  }
`)

export const VERIFIER_ACCES = graphql(`
  mutation VerifierAccesFournisseur {
    verifierAccesFournisseur
  }
`)

export const SAISIR_ADRESSE_FOURNISSEUR = graphql(`
  mutation SaisirAdresseFournisseur($userId: ID!, $adresse: String) {
    saisirAdresseFournisseur(userId: $userId, adresse: $adresse) {
      adresseSaisie
    }
  }
`)

/** Comment une personne a accès, lisible : « directement », « par le groupe… ». */
export function voieLisible(via: string | null): string | null {
  if (via === null) return null
  if (via === 'direct') return t`Directement`
  if (via === 'domaine') return t`Par toute l’organisation`
  if (via.startsWith('groupe:')) {
    const nomGroupe = via.slice('groupe:'.length)
    return t`Par le groupe « ${nomGroupe} »`
  }
  return via
}

export const REGLER_PORTEE = graphql(`
  mutation ReglerPorteeConnexion($portee: PorteeConnexionFichiers!) {
    reglerPorteeConnexion(portee: $portee) {
      portee
    }
  }
`)

/**
 * Comment chaque fournisseur active la vérification et la gestion des accès
 * (ADR 0044) : une reconnexion qui demande de nouvelles autorisations, ou un
 * simple réglage quand l'accès accordé les couvre déjà.
 */
export const ACTIVATION_ACCES: Record<string, 'reconnexion' | 'reglage'> = {
  SHAREPOINT: 'reconnexion',
  DROPBOX: 'reconnexion',
  GOOGLE_DRIVE: 'reglage',
  NEXTCLOUD: 'reglage',
}

/** Les fournisseurs qui publient un annuaire des comptes. */
export const AVEC_ANNUAIRE = new Set(['SHAREPOINT', 'NEXTCLOUD'])

/** Ce que l'activation demande chez le fournisseur, pour l'admin qui l'active. */
export const CONSENTEMENT: Record<string, MessageDescriptor> = {
  SHAREPOINT: msg`La connexion demande de nouvelles autorisations : un admin Microsoft Entra les accepte pour l’organisation.`,
  DROPBOX: msg`La connexion demande de lire, puis de modifier, les membres des dossiers partagés.`,
  GOOGLE_DRIVE: msg`L’accès déjà accordé à Google Drive suffit : aucune reconnexion n’est nécessaire.`,
  NEXTCLOUD: msg`L’accès déjà accordé à Nextcloud suffit. Les membres d’un groupe ne se lisent que si le compte connecté administre ce groupe.`,
}

export const GROUPES_DU_DOSSIER = graphql(`
  query GroupesDuDossier($id: ID!) {
    groupesDuDossier(id: $id) {
      identifiant
      nom
    }
  }
`)

export const REGLER_ACCES = graphql(`
  mutation ReglerAccesFournisseur(
    $id: ID!
    $mode: AccesFournisseurDossier!
    $groupeId: ID
    $role: RoleFournisseur!
    $ajoutsAutomatiques: Boolean!
    $invitation: Boolean!
  ) {
    reglerAccesFournisseur(
      id: $id
      mode: $mode
      groupeId: $groupeId
      role: $role
      ajoutsAutomatiques: $ajoutsAutomatiques
      invitation: $invitation
    ) {
      id
      accesFournisseur
    }
  }
`)

export const APPLIQUER_PROPOSITION = graphql(`
  mutation AppliquerPropositionAcces($id: ID!) {
    appliquerPropositionAcces(id: $id)
  }
`)

export const APPLIQUER_PROPOSITIONS = graphql(`
  mutation AppliquerPropositionsDossier($dossierId: ID!) {
    appliquerPropositionsDossier(dossierId: $dossierId)
  }
`)

export const ECARTER_PROPOSITION = graphql(`
  mutation EcarterPropositionAcces($id: ID!) {
    ecarterPropositionAcces(id: $id)
  }
`)

/** Les modes d'accès d'un dossier lié chez le fournisseur (ADR 0044). */
export const MODES_ACCES = {
  AUCUN: msg`Vérifier seulement`,
  PARTAGE: msg`Partager le dossier`,
  GROUPE: msg`Gérer un groupe du fournisseur`,
} satisfies Record<string, MessageDescriptor>

/** Le résumé du mode d'accès d'un dossier lié. */
export function resumeMode(d: {
  accesFournisseur: keyof typeof MODES_ACCES
  roleFournisseur: string
  groupeFournisseurNom?: string | null
  ajoutsAutomatiques: boolean
}): string {
  if (d.accesFournisseur === 'AUCUN') return i18n._(MODES_ACCES.AUCUN)
  const auto = d.ajoutsAutomatiques
  if (d.accesFournisseur === 'PARTAGE') {
    if (d.roleFournisseur === 'ECRITURE') {
      return auto
        ? t`Partage du dossier en écriture, ajouts automatiques`
        : t`Partage du dossier en écriture`
    }
    return auto
      ? t`Partage du dossier en lecture, ajouts automatiques`
      : t`Partage du dossier en lecture`
  }
  const nomGroupe = d.groupeFournisseurNom ?? '?'
  return auto
    ? t`Groupe « ${nomGroupe} », ajouts automatiques`
    : t`Groupe « ${nomGroupe} »`
}
