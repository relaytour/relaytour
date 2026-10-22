import { graphql } from '../gql'

// Requêtes de l'import de listes de bénévoles, des doublons et de la fusion
// (ADR 0042), partagées par l'assistant et l'écran « Bénévoles ».

export const SEQUENCES_IMPORT = graphql(`
  query SequencesPourImport($editionId: ID!) {
    programme(editionId: $editionId) {
      id
      titre
      jour
      heureDebut
      heureFin
      besoinBenevoles
      perimetre {
        id
        nom
      }
    }
  }
`)

export const SIMULER_IMPORT = graphql(`
  query SimulerImportBenevoles(
    $editionId: ID!
    $perimetreId: ID
    $source: String!
    $mode: ModeImport!
    $prevenirParMail: Boolean
    $accepterTout: Boolean
    $accord: Boolean!
    $personnes: [PersonneImportInput!]!
  ) {
    simulerImportBenevoles(
      editionId: $editionId
      perimetreId: $perimetreId
      source: $source
      mode: $mode
      prevenirParMail: $prevenirParMail
      accepterTout: $accepterTout
      accord: $accord
      personnes: $personnes
    ) {
      aImporter
      dejaImportees
      ecartees
      fichesCreees
      fichesRattachees
      places
      fichesRestantes
      depassements {
        sequenceId
        titre
        besoin
        renforts
      }
      lignes {
        cle
        etat
        motif
        rattacheeA
        compte
        rapprochement {
          benevoleId
          nom
          niveau
        }
      }
    }
  }
`)

export const IMPORTER = graphql(`
  mutation ImporterBenevoles(
    $editionId: ID!
    $perimetreId: ID
    $source: String!
    $mode: ModeImport!
    $prevenirParMail: Boolean
    $accepterTout: Boolean
    $accord: Boolean!
    $personnes: [PersonneImportInput!]!
  ) {
    importerBenevoles(
      editionId: $editionId
      perimetreId: $perimetreId
      source: $source
      mode: $mode
      prevenirParMail: $prevenirParMail
      accepterTout: $accepterTout
      accord: $accord
      personnes: $personnes
    ) {
      aImporter
      dejaImportees
      ecartees
      fichesCreees
      fichesRattachees
      places
      lignes {
        cle
        etat
        motif
      }
    }
  }
`)

export const CORRESPONDANCES = graphql(`
  query CorrespondancesImport($activiteId: ID!) {
    correspondancesImport(activiteId: $activiteId) {
      id
      nom
      entetes
      associations
      reglages
      peutSupprimer
    }
  }
`)

export const ENREGISTRER_CORRESPONDANCE = graphql(`
  mutation EnregistrerCorrespondanceImport(
    $activiteId: ID!
    $nom: String!
    $entetes: [String!]!
    $associations: JSONObject!
    $reglages: JSONObject!
  ) {
    enregistrerCorrespondanceImport(
      activiteId: $activiteId
      nom: $nom
      entetes: $entetes
      associations: $associations
      reglages: $reglages
    ) {
      id
    }
  }
`)

export const DOUBLONS = graphql(`
  query DoublonsBenevoles($activiteId: ID!) {
    doublonsBenevoles(activiteId: $activiteId) {
      niveau
      a {
        id
        nom
        courriel
        telephone
        places
        origine
        sourceImport
      }
      b {
        id
        nom
        courriel
        telephone
        places
        origine
        sourceImport
      }
    }
  }
`)

export const FUSIONNER = graphql(`
  mutation FusionnerBenevoles(
    $gardeeId: ID!
    $autreId: ID!
    $nomDe: CoteFusion!
    $courrielDe: CoteFusion!
    $telephoneDe: CoteFusion!
  ) {
    fusionnerBenevoles(
      gardeeId: $gardeeId
      autreId: $autreId
      nomDe: $nomDe
      courrielDe: $courrielDe
      telephoneDe: $telephoneDe
    ) {
      id
    }
  }
`)

export const DISTINCTS = graphql(`
  mutation MarquerBenevolesDistincts($aId: ID!, $bId: ID!) {
    marquerBenevolesDistincts(aId: $aId, bId: $bId)
  }
`)
