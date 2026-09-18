import { BellOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Badge, Button, Drawer, Empty, Skeleton, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { graphql } from '../gql'

const NOMBRE = graphql(`
  query NombreNotificationsNonLues {
    nombreNotificationsNonLues
  }
`)

const LISTE = graphql(`
  query ListeNotifications {
    notifications(limite: 40) {
      id
      type
      message
      lien
      lue
      creeLe
    }
  }
`)

const MARQUER = graphql(`
  mutation MarquerNotificationsLues($ids: [ID!]) {
    marquerNotificationsLues(ids: $ids)
  }
`)

function ilYA(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.round(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })
}

/** Cloche de l'en-tête : nombre de notifications non lues et tiroir de consultation. */
export default function Notifications({ compact }: { compact: boolean }) {
  const navigate = useNavigate()
  const [ouvert, setOuvert] = useState(false)
  // Le nombre se rafraîchit chaque minute : les notifications viennent d'autres personnes.
  const { data: nombre } = useQuery(NOMBRE, { pollInterval: 60_000 })
  const liste = useQuery(LISTE, {
    skip: !ouvert,
    fetchPolicy: 'cache-and-network',
  })
  const [marquer] = useMutation(MARQUER, { refetchQueries: [NOMBRE, LISTE] })
  const nonLues = nombre?.nombreNotificationsNonLues ?? 0

  return (
    <>
      <Badge count={nonLues} size="small" offset={[-4, 4]}>
        <Button
          icon={<BellOutlined />}
          aria-label={
            nonLues > 0
              ? `Notifications, ${nonLues} non lue${nonLues > 1 ? 's' : ''}`
              : 'Notifications'
          }
          onClick={() => setOuvert(true)}
        >
          {compact ? null : 'Notifications'}
        </Button>
      </Badge>
      <Drawer
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Notifications"
        size={420}
        extra={
          nonLues > 0 && (
            <Button
              size="small"
              onClick={() => void marquer({ variables: { ids: null } })}
            >
              Tout marquer comme lu
            </Button>
          )
        }
      >
        {liste.loading && !liste.data ? (
          <Skeleton active />
        ) : (liste.data?.notifications ?? []).length === 0 ? (
          <Empty description="Aucune notification." />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {liste.data!.notifications.map(n => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.lue) void marquer({ variables: { ids: [n.id] } })
                    setOuvert(false)
                    navigate(n.lien)
                  }}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    display: 'block',
                    width: '100%',
                    padding: '12px 12px 12px 16px',
                    borderRadius: 'var(--rt-rayon-chip)',
                    marginBottom: 4,
                    background: n.lue
                      ? 'transparent'
                      : 'var(--rt-accent-clair)',
                  }}
                >
                  <Typography.Text strong={!n.lue} style={{ display: 'block' }}>
                    {n.message}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {ilYA(n.creeLe)}
                  </Typography.Text>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  )
}
