import { graphql } from '../gql'

// Les requêtes des notifications (ADR 0032 et 0033), partagées par la cloche, le
// menu et l'écran des admins. Leurs noms figurent dans les listes de relecture
// (lib/rafraichissement.ts) et du flux (lib/flux.ts).

graphql(`
  fragment NotificationAffichee on Notification {
    id
    type
    niveau
    message
    lien
    lue
    creeLe
    periode
    activite {
      id
      slug
      nom
    }
    perimetre {
      id
      slug
      nom
      couleur
    }
  }
`)

export const NOMBRE_NOTIFICATIONS = graphql(`
  query NombreNotificationsNonLues {
    nombreNotificationsNonLues
  }
`)

export const NOMBRE_NOTIFICATIONS_ADMIN = graphql(`
  query NombreNotificationsAdmin {
    nombreNotificationsNonLues(admin: true)
  }
`)

export const LISTE_NOTIFICATIONS = graphql(`
  query ListeNotifications {
    notifications(limite: 60) {
      ...NotificationAffichee
    }
  }
`)

export const LISTE_NOTIFICATIONS_ADMIN = graphql(`
  query ListeNotificationsAdmin {
    notifications(admin: true, limite: 200) {
      ...NotificationAffichee
    }
  }
`)

export const AUTRES_ORGANISATIONS = graphql(`
  query NotificationsAutresOrganisations {
    notificationsAutresOrganisations {
      slug
      nom
      nonLues
    }
  }
`)

export const MARQUER_NOTIFICATIONS = graphql(`
  mutation MarquerNotificationsLues(
    $ids: [ID!]
    $admin: Boolean
    $activiteId: ID
    $perimetreId: ID
  ) {
    marquerNotificationsLues(
      ids: $ids
      admin: $admin
      activiteId: $activiteId
      perimetreId: $perimetreId
    )
  }
`)
