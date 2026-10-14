import { BellOutlined, ExportOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Badge, Button, Drawer, Empty, Skeleton, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { useActivite } from '../lib/activite'
import { estInstallee } from '../lib/installation'
import { useOrganisation } from '../lib/organisation'
import { poserPastille } from '../lib/push'
import {
  AUTRES_ORGANISATIONS,
  LISTE_NOTIFICATIONS,
  MARQUER_NOTIFICATIONS,
  NOMBRE_NOTIFICATIONS,
  NOMBRE_NOTIFICATIONS_ADMIN,
} from '../lib/requetes-notifications'
import { choisirOrganisation } from '../lib/selection'

import ListeNotifications from './ListeNotifications'

/**
 * Cloche de l'en-tête (ADR 0032) : le nombre de notifications non lues de
 * l'organisation active, et un tiroir qui les range par activité. Les
 * notifications d'admin ont leur écran (ADR 0033) ; le tiroir y renvoie, puis
 * signale les nouvelles des autres organisations.
 */
export default function Notifications() {
  const navigate = useNavigate()
  const apollo = useApolloClient()
  const { activite, activites, gere } = useActivite()
  // L'écran des admins s'ouvre sous une activité que la personne administre :
  // l'activité affichée, sinon une autre de l'organisation. Le nombre des
  // notifications d'admin couvre tous ses rôles (ADR 0033).
  const activiteAdministree = gere
    ? activite
    : activites.find(a => a.estAdministree)
  const organisation = useOrganisation()
  const [ouvert, setOuvert] = useState(false)
  // Les notifications viennent d'autres personnes : la coquille relit les nombres
  // chaque minute, avec les écrans (lib/rafraichissement.ts).
  const { data: nombre } = useQuery(NOMBRE_NOTIFICATIONS)
  const { data: nombreAdmin } = useQuery(NOMBRE_NOTIFICATIONS_ADMIN)
  const liste = useQuery(LISTE_NOTIFICATIONS, {
    skip: !ouvert,
    fetchPolicy: 'cache-and-network',
  })
  const autres = useQuery(AUTRES_ORGANISATIONS, {
    skip: !ouvert,
    fetchPolicy: 'cache-and-network',
  })
  const [marquer] = useMutation(MARQUER_NOTIFICATIONS, {
    refetchQueries: [NOMBRE_NOTIFICATIONS, LISTE_NOTIFICATIONS],
  })
  const nonLues = nombre?.nombreNotificationsNonLues ?? 0
  const nonLuesAdmin = nombreAdmin?.nombreNotificationsNonLues ?? 0
  // L'icône de l'application installée compte toutes les notifications de
  // l'organisation, celles de la cloche et celles des admins (ADR 0024).
  useEffect(
    () => poserPastille(nonLues + nonLuesAdmin),
    [nonLues, nonLuesAdmin]
  )
  const autresOrganisations =
    autres.data?.notificationsAutresOrganisations ?? []

  // Une autre organisation s'ouvre dans un nouvel onglet, qui garde son propre
  // choix (ADR 0032). L'application installée n'a pas d'onglets : elle change
  // d'organisation dans la même fenêtre.
  const ouvrirOrganisation = (slug: string) => {
    if (!estInstallee()) {
      window.open(
        `/?organisation=${encodeURIComponent(slug)}`,
        '_blank',
        'noopener'
      )
      return
    }
    setOuvert(false)
    choisirOrganisation(slug)
    void apollo.resetStore().finally(() => navigate('/'))
  }

  return (
    <>
      <Badge
        count={nonLues}
        overflowCount={99}
        size="small"
        offset={[-6, 6]}
        color="var(--rt-accent)"
      >
        <Button
          shape="circle"
          className="rt-bouton-barre"
          icon={<BellOutlined />}
          aria-label={
            nonLues > 0
              ? `Notifications, ${nonLues} non lue${nonLues > 1 ? 's' : ''}`
              : 'Notifications'
          }
          onClick={() => setOuvert(true)}
        />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activiteAdministree !== undefined && nonLuesAdmin > 0 && (
            <ul className="rt-liste-liens">
              <li>
                <button
                  type="button"
                  className="rt-ligne-lien rt-non-lue"
                  onClick={() => {
                    setOuvert(false)
                    navigate(`/${activiteAdministree.slug}/admin/notifications`)
                  }}
                >
                  <span>
                    Vous avez {nonLuesAdmin} notification
                    {nonLuesAdmin > 1 ? 's' : ''} d’admin non lue
                    {nonLuesAdmin > 1 ? 's' : ''}.
                  </span>
                </button>
              </li>
            </ul>
          )}
          {liste.loading && !liste.data ? (
            <Skeleton active />
          ) : (liste.data?.notifications ?? []).length === 0 ? (
            <Empty description="Aucune notification." />
          ) : (
            <ListeNotifications
              notifications={liste.data!.notifications}
              sansActivite={organisation.nom}
              onOuvrir={n => {
                if (!n.lue) void marquer({ variables: { ids: [n.id] } })
                setOuvert(false)
                navigate(n.lien)
              }}
              onMarquer={cible =>
                void marquer({
                  variables:
                    cible.activiteId === null
                      ? { ids: cible.ids }
                      : { activiteId: cible.activiteId },
                })
              }
            />
          )}
          {autresOrganisations.length > 0 && (
            <section
              className="rt-verre rt-panneau"
              aria-labelledby="autres-organisations"
              style={{ padding: 16, gap: 8 }}
            >
              <Typography.Text strong id="autres-organisations">
                Vous avez d’autres notifications dans vos organisations
              </Typography.Text>
              <ul className="rt-liste-liens">
                {autresOrganisations.map(o => (
                  <li key={o.slug}>
                    <button
                      type="button"
                      className="rt-ligne-lien"
                      onClick={() => ouvrirOrganisation(o.slug)}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                        }}
                      >
                        <span style={{ overflowWrap: 'anywhere' }}>
                          {o.nom}
                        </span>
                        <Badge
                          count={o.nonLues}
                          size="small"
                          color="var(--rt-accent)"
                        />
                        {!estInstallee() && (
                          <ExportOutlined
                            aria-label="S’ouvre dans un nouvel onglet"
                            style={{ fontSize: 12, opacity: 0.6 }}
                          />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Drawer>
    </>
  )
}
