import { BellOutlined, ExportOutlined, SafetyOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Badge,
  Button,
  Drawer,
  Empty,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd'
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
  NOMBRE_NOTIFICATIONS_PAR_ACTIVITE,
} from '../lib/requetes-notifications'
import { choisirOrganisation } from '../lib/selection'

import ListeNotifications from './ListeNotifications'

/**
 * Cloche de l'en-tête (ADR 0032) : le nombre de notifications non lues de
 * l'activité affichée, une seconde pastille pour les autres activités qui en ont,
 * et un tiroir qui les range par activité. Une troisième pastille, en haut à
 * gauche, compte les notifications d'admin non lues ; le pied du tiroir mène à
 * leur écran. Les
 * notifications d'admin ont leur écran (ADR 0033) ; le tiroir y renvoie, puis
 * signale les nouvelles des autres organisations.
 */
export default function Notifications() {
  const { t } = useLingui()
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
  const { data: parActivite } = useQuery(NOMBRE_NOTIFICATIONS_PAR_ACTIVITE)
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
    refetchQueries: [
      NOMBRE_NOTIFICATIONS,
      NOMBRE_NOTIFICATIONS_PAR_ACTIVITE,
      LISTE_NOTIFICATIONS,
    ],
  })
  const nonLues = nombre?.nombreNotificationsNonLues ?? 0
  const nonLuesAdmin = nombreAdmin?.nombreNotificationsNonLues ?? 0
  // La cloche compte l'activité affichée et les notifications de l'organisation
  // qui ne concernent aucune activité. Les autres activités ont leur pastille.
  const comptes = parActivite?.nombreNotificationsNonLuesParActivite
  const nonLuesIci =
    comptes === undefined
      ? nonLues
      : comptes
          .filter(c => c.activiteId === null || c.activiteId === activite.id)
          .reduce((total, c) => total + c.nonLues, 0)
  // Les notifications d'admin ne s'annoncent qu'à une personne qui en a l'écran.
  const adminIci = activiteAdministree !== undefined ? nonLuesAdmin : 0
  const autresActivites = (comptes ?? []).filter(
    c => c.activiteId !== null && c.activiteId !== activite.id && c.nonLues > 0
  ).length
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
      <span className="rt-cloche">
        <Tooltip
          // Le résumé se ferme avec le tiroir, qu'il couvrirait sinon.
          open={ouvert ? false : undefined}
          title={
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span>
                {nonLuesIci > 0
                  ? plural(nonLuesIci, {
                      one: '# notification non lue dans cette activité',
                      other: '# notifications non lues dans cette activité',
                    })
                  : t`Aucune notification non lue dans cette activité`}
              </span>
              {autresActivites > 0 && (
                <span>
                  {plural(autresActivites, {
                    one: '# autre activité avec des notifications',
                    other: '# autres activités avec des notifications',
                  })}
                </span>
              )}
              {adminIci > 0 && (
                <span>
                  {plural(adminIci, {
                    one: '# notification d’admin non lue',
                    other: '# notifications d’admin non lues',
                  })}
                </span>
              )}
            </span>
          }
        >
          <Badge
            count={nonLuesIci}
            overflowCount={99}
            size="small"
            offset={[-6, 6]}
            color="var(--rt-accent)"
          >
            <Button
              shape="circle"
              className="rt-bouton-barre"
              icon={<BellOutlined />}
              aria-label={[
                t`Notifications`,
                ...(nonLuesIci > 0
                  ? [
                      plural(nonLuesIci, {
                        one: '# non lue dans cette activité',
                        other: '# non lues dans cette activité',
                      }),
                    ]
                  : []),
                ...(autresActivites > 0
                  ? [
                      plural(autresActivites, {
                        one: 'd’autres dans # autre activité',
                        other: 'd’autres dans # autres activités',
                      }),
                    ]
                  : []),
                ...(adminIci > 0
                  ? [
                      plural(adminIci, {
                        one: '# notification d’admin non lue',
                        other: '# notifications d’admin non lues',
                      }),
                    ]
                  : []),
              ].join(', ')}
              onClick={() => setOuvert(true)}
            />
          </Badge>
        </Tooltip>
        {autresActivites > 0 && (
          <span
            className="rt-cloche-autres"
            aria-hidden="true"
            title={plural(autresActivites, {
              one: 'Notifications non lues dans # autre activité',
              other: 'Notifications non lues dans # autres activités',
            })}
          >
            {autresActivites > 9 ? '9+' : `${autresActivites}+`}
          </span>
        )}
        {adminIci > 0 && (
          <span
            className="rt-cloche-admin"
            aria-hidden="true"
            title={plural(adminIci, {
              one: '# notification d’admin non lue',
              other: '# notifications d’admin non lues',
            })}
          >
            <SafetyOutlined />
            {adminIci > 9 ? '9+' : adminIci}
          </span>
        )}
      </span>
      <Drawer
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t`Notifications`}
        size={420}
        // Le pied reste visible sous la liste : il mène à l'écran des
        // notifications d'admin (ADR 0033).
        footer={
          activiteAdministree !== undefined && (
            <Button
              block
              className="rt-cloche-pied"
              icon={<SafetyOutlined />}
              onClick={() => {
                setOuvert(false)
                navigate(`/${activiteAdministree.slug}/admin/notifications`)
              }}
            >
              <Trans>Notifications d’admin</Trans>
              {nonLuesAdmin > 0 && (
                <Badge
                  count={nonLuesAdmin}
                  overflowCount={99}
                  color="var(--rt-alerte)"
                  aria-label={plural(nonLuesAdmin, {
                    one: '# en attente',
                    other: '# en attente',
                  })}
                />
              )}
            </Button>
          )
        }
        extra={
          nonLues > 0 && (
            <Button
              size="small"
              onClick={() => void marquer({ variables: { ids: null } })}
            >
              <Trans>Tout marquer comme lu</Trans>
            </Button>
          )
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {liste.loading && !liste.data ? (
            <Skeleton active />
          ) : (liste.data?.notifications ?? []).length === 0 ? (
            <Empty description={t`Aucune notification.`} />
          ) : (
            <ListeNotifications
              // Une autre activité remet l'ordre et les groupes dépliés à zéro.
              key={activite.id}
              notifications={liste.data!.notifications}
              sansActivite={organisation.nom}
              activiteCourante={activite}
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
                <Trans>
                  Vous avez d’autres notifications dans vos organisations
                </Trans>
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
                            aria-label={t`S’ouvre dans un nouvel onglet`}
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
