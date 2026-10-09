import { graphql } from '../gql'

// Messages (ADR 0020) : l'historique et ses écritures, partagés par la fenêtre de
// rédaction et par l'historique des messages.

export const MESSAGES = graphql(`
  query Messages($activiteId: ID) {
    messages(activiteId: $activiteId) {
      id
      modele
      objet
      corps
      champ
      statut
      statutLe
      creeLe
      activiteId
      perimetreId
      estLeMien
      auteur {
        id
        nom
      }
      destinataires {
        id
        enCopie
        personne {
          id
          nom
        }
      }
    }
  }
`)

export const CREER_MESSAGE = graphql(`
  mutation CreerMessage($message: MessageInput!) {
    creerMessage(message: $message) {
      id
      statut
    }
  }
`)

export const DEFINIR_STATUT_MESSAGE = graphql(`
  mutation DefinirStatutMessage($id: ID!, $statut: StatutMessage!) {
    definirStatutMessage(id: $id, statut: $statut) {
      id
      statut
      statutLe
    }
  }
`)

// Ce que les modèles lisent dans l'application : les tâches de la période et les
// périmètres qui manquent de référentes et de référents.
export const INFORMATIONS_MESSAGE = graphql(`
  query InformationsMessage($editionId: ID!) {
    retroplanning(editionId: $editionId) {
      id
      titre
      echeance
      statut
      enRetard
      perimetre {
        id
        nom
      }
    }
    postesAPourvoir(editionId: $editionId) {
      aPourvoir
      perimetre {
        id
        nom
        groupe
      }
    }
  }
`)

// Les adresses de l'équipe de l'activité affichée, pour un message écrit depuis
// l'écran « Équipe ».
export const ADRESSES_EQUIPE = graphql(`
  query AdressesEquipe {
    equipe {
      id
      nom
      email
    }
  }
`)
