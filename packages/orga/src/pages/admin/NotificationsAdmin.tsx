import { useMutation, useQuery } from '@apollo/client/react'
import { Button, Empty, Skeleton } from 'antd'
import { useNavigate } from 'react-router'

import ListeNotifications from '../../composants/ListeNotifications'
import Titre from '../../composants/Titre'
import {
  LISTE_NOTIFICATIONS_ADMIN,
  MARQUER_NOTIFICATIONS,
  NOMBRE_NOTIFICATIONS_ADMIN,
} from '../../lib/requetes-notifications'

/**
 * Les notifications d'admin (ADR 0033), à part de la cloche : rangées par
 * activité, puis par périmètre. Les notifications de l'organisation forment leur
 * groupe, en tête. Le serveur ne rend que celles des rôles que la personne tient
 * encore.
 */
export default function NotificationsAdmin() {
  const navigate = useNavigate()
  const liste = useQuery(LISTE_NOTIFICATIONS_ADMIN, {
    fetchPolicy: 'cache-and-network',
  })
  const [marquer] = useMutation(MARQUER_NOTIFICATIONS, {
    refetchQueries: [NOMBRE_NOTIFICATIONS_ADMIN, LISTE_NOTIFICATIONS_ADMIN],
  })
  // Le nombre de non lues vient du serveur : la liste n'en montre que les 200
  // dernières, et des notifications plus anciennes peuvent rester à lire.
  const { data: nombre } = useQuery(NOMBRE_NOTIFICATIONS_ADMIN)
  const notifications = liste.data?.notifications ?? []
  const nonLues = nombre?.nombreNotificationsNonLues ?? 0

  return (
    <>
      <Titre sousTitre="Les nouvelles de vos rôles d’admin : demandes, invitations et équipe, rangées par activité puis par périmètre.">
        Notifications d’admin
      </Titre>
      {liste.loading && !liste.data ? (
        <Skeleton active />
      ) : notifications.length === 0 ? (
        <Empty description="Aucune notification d’admin." />
      ) : (
        <div
          className="rt-verre rt-panneau"
          style={{ padding: '16px 20px', gap: 8 }}
        >
          {nonLues > 0 && (
            <Button
              size="small"
              style={{ alignSelf: 'flex-end' }}
              onClick={() =>
                void marquer({ variables: { ids: null, admin: true } })
              }
            >
              Tout marquer comme lu
            </Button>
          )}
          <ListeNotifications
            notifications={notifications}
            sansActivite="Organisation"
            parPerimetre
            avecRole
            onOuvrir={n => {
              if (!n.lue) void marquer({ variables: { ids: [n.id] } })
              navigate(n.lien)
            }}
            onMarquer={cible =>
              void marquer({
                variables:
                  cible.activiteId === null
                    ? { ids: cible.ids }
                    : {
                        admin: true,
                        activiteId: cible.activiteId,
                        perimetreId: cible.perimetreId,
                      },
              })
            }
          />
        </div>
      )}
    </>
  )
}
