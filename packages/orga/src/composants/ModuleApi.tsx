import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Switch, Tag } from 'antd'

import { graphql } from '../gql'
import { messageErreur } from '../lib/erreurs'
import { API_ORGANISATION, apiOuverte } from '../lib/jetons'

import { Panneau } from './Panneau'

// Le module « API » de l'organisation, dans l'écran « Organisation » (ADR 0064).
// Un admin de l'organisation l'active ou le désactive. L'administration de
// l'installation peut l'imposer, l'interdire ou le suspendre : l'interrupteur se
// fige alors, et le panneau en donne la raison.

const ACTIVER = graphql(`
  mutation ActiverApi {
    activerApi {
      etat
      suspensionMotif
    }
  }
`)

const DESACTIVER = graphql(`
  mutation DesactiverApi {
    desactiverApi {
      etat
      suspensionMotif
    }
  }
`)

export default function ModuleApi() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { data } = useQuery(API_ORGANISATION)
  const options = { refetchQueries: [API_ORGANISATION] }
  const [activer, activation] = useMutation(ACTIVER, options)
  const [desactiver, desactivation] = useMutation(DESACTIVER, options)
  const etat = data?.apiOrganisation.etat
  const motif = data?.apiOrganisation.suspensionMotif
  // L'interrupteur suit le choix de l'organisation ; il se fige quand
  // l'administration de l'installation décide à sa place.
  const fige =
    etat === 'IMPOSEE' || etat === 'INTERDITE' || etat === 'SUSPENDUE'

  const basculer = (active: boolean) => {
    void (active ? activer() : desactiver()).then(
      () =>
        message.success(
          active ? t`L’API est activée.` : t`L’API est désactivée.`
        ),
      (e: unknown) => message.error(messageErreur(e))
    )
  }

  const libelle =
    etat === 'ACTIVE'
      ? t`Active`
      : etat === 'IMPOSEE'
        ? t`Activée par votre hébergeur`
        : etat === 'INTERDITE'
          ? t`Non proposée par votre hébergeur`
          : etat === 'SUSPENDUE'
            ? t`Suspendue`
            : t`Inactive`

  return (
    <Panneau titre={t`API pour les programmes tiers`}>
      <p className="rt-texte-secondaire">
        <Trans>
          L’API permet à un programme de travailler dans l’organisation au nom
          d’un membre : un script, une ligne de commande, un outil de gestion de
          projet. Chaque membre crée ses jetons d’accès dans ses préférences. Un
          jeton n’ouvre que ce que son membre voit.
        </Trans>
      </p>
      {etat !== undefined && (
        <div className="rt-reglage">
          <label htmlFor="api-active">
            <span className="rt-choix-titre">
              <Trans>Activer l’API</Trans>{' '}
              <Tag color={apiOuverte(etat) ? 'green' : undefined}>
                {libelle}
              </Tag>
            </span>
            <span className="rt-choix-detail">
              <Trans>
                Désactiver l’API ne révoque aucun jeton : ils cessent de
                répondre, puis répondent de nouveau à la réactivation.
              </Trans>
            </span>
          </label>
          <Switch
            id="api-active"
            checked={apiOuverte(etat)}
            disabled={fige}
            loading={activation.loading || desactivation.loading}
            onChange={basculer}
          />
        </div>
      )}
      {etat === 'SUSPENDUE' && (
        <Alert
          type="warning"
          showIcon
          title={t`L’administration de l’installation a suspendu l’API.`}
          description={
            motif
              ? t`Motif : ${motif}. Les jetons de l’organisation ont été révoqués.`
              : t`Les jetons de l’organisation ont été révoqués.`
          }
        />
      )}
      {etat === 'IMPOSEE' && (
        <p className="rt-note">
          <Trans>
            Votre hébergeur active l’API pour votre organisation : elle reste
            active quel que soit ce réglage.
          </Trans>
        </p>
      )}
    </Panneau>
  )
}
