import { graphql } from '../gql'

// Requêtes des appels à bénévoles et des candidatures (ADR 0041), partagées par
// l'écran « Bénévoles » et ses onglets.

export const CANDIDATURES = graphql(`
  query Candidatures($editionId: ID!, $statut: StatutCandidature) {
    candidatures(editionId: $editionId, statut: $statut) {
      id
      statut
      nom
      courriel
      telephone
      message
      precisionsDisponibilite
      ouAilleurs
      deposeeLe
      appelNom
      benevoleId
      peutEcarter
      plages {
        jour
        heureDebut
        jourFin
        heureFin
      }
      choix {
        id
        statut
        sequenceId
        titre
        jour
        heureDebut
        jourFin
        heureFin
        lieu
        peutTraiter
        perimetre {
          id
          nom
          couleur
        }
      }
    }
  }
`)

export const APPELS = graphql(`
  query AppelsBenevoles($editionId: ID!) {
    appelsBenevoles(editionId: $editionId) {
      id
      nom
      portee
      sequenceId
      sequenceTitre
      introduction
      ouvertLe
      fermeLe
      etat
      finAdresse
      adresse
      candidaturesEnAttente
      version
      peutModifier
      perimetre {
        id
        nom
      }
    }
  }
`)
