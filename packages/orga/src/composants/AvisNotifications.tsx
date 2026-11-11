import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Space } from 'antd'
import { useEffect, useRef } from 'react'

import { graphql } from '../gql'
import { ouvrirLaCloche } from '../lib/cloche'
import { aAnnoncer, AVIS_MAX } from '../lib/nouvelles-notifications'
import {
  MARQUER_NOTIFICATIONS,
  NOMBRE_NOTIFICATIONS,
} from '../lib/requetes-notifications'

import { useNavigationProtegee } from './navigation-protegee'

const DERNIERES = graphql(`
  query DernieresNotifications {
    notifications(nonLuesSeulement: true, limite: 10) {
      ...NotificationAffichee
    }
  }
`)

/** La durée d'un avis, en secondes. */
const DUREE = 10

/**
 * Annonce chaque nouvelle notification de la cloche par un avis discret, en bas de
 * l'écran (ADR 0065). Un clic sur l'avis ouvre l'objet de la notification et la
 * marque comme lue ; une saisie en cours demande d'abord une confirmation. Les
 * notifications présentes à l'ouverture de l'espace ne s'annoncent pas.
 */
export default function AvisNotifications() {
  const { t } = useLingui()
  const { notification } = App.useApp()
  const client = useApolloClient()
  const naviguer = useNavigationProtegee()
  const [marquer] = useMutation(MARQUER_NOTIFICATIONS, {
    refetchQueries: [NOMBRE_NOTIFICATIONS],
  })
  const { data } = useQuery(NOMBRE_NOTIFICATIONS)
  const nonLues = data?.nombreNotificationsNonLues
  const vues = useRef<Set<string> | null>(null)
  const precedent = useRef<number | undefined>(undefined)
  // Les actions changent d'identité à chaque navigation : l'effet les lit par une
  // référence, pour qu'une navigation n'annule pas une lecture en cours.
  // Les textes se composent ici, où la macro de Lingui les transforme : un `t`
  // relu dans une référence ne serait ni extrait ni traduit.
  const textes = {
    plusieurs: (nombre: number) => t`${nombre} nouvelles notifications`,
    une: () => t`Nouvelle notification`,
  }
  const actions = useRef({ notification, naviguer, marquer, textes })
  useEffect(() => {
    actions.current = { notification, naviguer, marquer, textes }
  })

  useEffect(() => {
    if (nonLues === undefined) return
    const avant = precedent.current
    precedent.current = nonLues
    const premiere = vues.current === null
    // Une baisse du nombre (une lecture) n'annonce rien.
    if (!premiere && avant !== undefined && nonLues <= avant) return
    const { notification, naviguer, marquer, textes } = actions.current
    void client
      .query({ query: DERNIERES, fetchPolicy: 'no-cache' })
      .then(({ data: lues }) => {
        if (!lues) return
        const recues = lues.notifications
        if (vues.current === null) {
          // L'ouverture de l'espace retient les notifications déjà là.
          vues.current = new Set(recues.map(n => n.id))
          return
        }
        const nouvelles = aAnnoncer(recues, vues.current)
        for (const n of nouvelles) vues.current.add(n.id)
        const nombre = nouvelles.length
        if (nombre > AVIS_MAX) {
          notification.info({
            key: 'notifications-nouvelles',
            placement: 'bottomRight',
            duration: DUREE,
            title: textes.plusieurs(nombre),
            actions: (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  notification.destroy('notifications-nouvelles')
                  ouvrirLaCloche()
                }}
              >
                <Trans>Voir dans la cloche</Trans>
              </Button>
            ),
          })
          return
        }
        for (const n of nouvelles) {
          const ouvrir = async () => {
            notification.destroy(n.id)
            if (await naviguer(n.lien)) {
              void marquer({ variables: { ids: [n.id] } })
            }
          }
          notification.open({
            key: n.id,
            placement: 'bottomRight',
            duration: DUREE,
            title:
              [n.activite?.nom, n.perimetre?.nom].filter(Boolean).join(' · ') ||
              textes.une(),
            description: n.message,
            onClick: () => void ouvrir(),
            style: { cursor: 'pointer' },
            actions: (
              <Space>
                <Button
                  size="small"
                  type="primary"
                  onClick={e => {
                    e.stopPropagation()
                    void ouvrir()
                  }}
                >
                  <Trans>Ouvrir</Trans>
                </Button>
                <Button
                  size="small"
                  onClick={e => {
                    e.stopPropagation()
                    notification.destroy(n.id)
                    ouvrirLaCloche()
                  }}
                >
                  <Trans>Voir dans la cloche</Trans>
                </Button>
              </Space>
            ),
          })
        }
      })
      .catch(() => {
        // Un avis manqué n'empêche rien : la cloche garde la notification.
      })
  }, [nonLues, client])

  return null
}
