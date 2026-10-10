import { useQuery } from '@apollo/client/react'

import { graphql } from '../gql'

// Invitations entre organisations (ADR 0030) : les requêtes que plusieurs écrans
// partagent.

/** Les invitations de l'organisation qui attendent un accord, lues par ses admins. */
export const INVITATIONS_EN_ATTENTE = graphql(`
  query InvitationsEnAttente($activiteId: ID) {
    invitationsEnAttente(activiteId: $activiteId) {
      id
      nom
      email
      estAdmin
      expireLe
      perimetresAffectes {
        id
        nom
        couleur
      }
      perimetresSouhaites {
        id
        nom
        couleur
      }
    }
  }
`)

/** Les invitations qui attendent l'accord de la personne connectée. */
export const MES_INVITATIONS = graphql(`
  query MesInvitations {
    mesInvitations {
      id
      organisationNom
      estAdmin
      perimetres
      expireLe
    }
  }
`)

export function useMesInvitations() {
  return useQuery(MES_INVITATIONS).data?.mesInvitations ?? []
}
