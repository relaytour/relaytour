import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Space } from 'antd'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import {
  cleAvis,
  dernierAvis,
  doitProposer,
  jourLocal,
  noterAvis,
} from '../lib/proposition-modele'

import { useModelesNotification } from './modeles-notification'

const PROPOSITION = graphql(`
  query PropositionModele {
    mesPreferencesNotification {
      propositionModele
    }
  }
`)

const APPLIQUER = graphql(`
  mutation AppliquerModelePropose($modele: ModeleNotification!) {
    appliquerModeleNotification(modele: $modele) {
      modele
      propositionModele
    }
  }
`)

const ECARTER = graphql(`
  mutation EcarterPropositionModele {
    ecarterPropositionModele {
      propositionModele
    }
  }
`)

const CLE = 'proposition-modele'

/**
 * Propose le modèle de notifications du rôle de la personne (ADR 0065) : un avis
 * discret, au plus une fois par jour, tant qu'elle ne l'a ni appliqué ni refusé.
 * La proposition ne change aucun réglage sans son accord.
 */
export default function PropositionModele({
  organisation,
}: {
  organisation: string
}) {
  const { t } = useLingui()
  const { notification, message } = App.useApp()
  const navigate = useNavigate()
  const { lien } = useActivite()
  const modeles = useModelesNotification()
  const { data } = useQuery(PROPOSITION)
  const [appliquer] = useMutation(APPLIQUER)
  const [ecarter] = useMutation(ECARTER)
  const propose = data?.mesPreferencesNotification.propositionModele ?? null

  useEffect(() => {
    const cle = propose === null ? '' : cleAvis(organisation, propose)
    const jour = jourLocal()
    if (!doitProposer(propose, dernierAvis(cle), jour)) return
    noterAvis(cle, jour)
    const titre = modeles.find(m => m.valeur === propose)?.titre ?? propose
    const fermer = () => notification.destroy(CLE)
    notification.info({
      key: CLE,
      placement: 'bottomRight',
      duration: 0,
      title: t`Adapter vos notifications à votre rôle`,
      description: t`Le modèle « ${titre} » correspond à votre rôle. Il règle vos mails et vos notifications en un geste.`,
      actions: (
        <Space wrap>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              fermer()
              void appliquer({
                variables: { modele: propose },
                refetchQueries: ['MesPreferencesNotification'],
              })
                .then(() => message.success(t`Modèle appliqué.`))
                .catch((e: unknown) => message.error(messageErreur(e)))
            }}
          >
            <Trans>Appliquer</Trans>
          </Button>
          <Button
            size="small"
            onClick={() => {
              fermer()
              navigate(lien('/preferences'))
            }}
          >
            <Trans>Voir mes préférences</Trans>
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              fermer()
              void ecarter().catch((e: unknown) =>
                message.error(messageErreur(e))
              )
            }}
          >
            <Trans>Ne plus proposer</Trans>
          </Button>
        </Space>
      ),
    })
  }, [
    propose,
    organisation,
    modeles,
    notification,
    message,
    appliquer,
    ecarter,
    navigate,
    lien,
    t,
  ])

  return null
}
