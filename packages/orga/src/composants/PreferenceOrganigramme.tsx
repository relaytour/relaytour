import { ClusterOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Switch } from 'antd'

import { graphql } from '../gql'
import { messageErreur } from '../lib/erreurs'

import { Panneau } from './Panneau'

// Accord de la personne pour afficher son adresse dans l'organigramme (ADR 0036).
// Il vaut pour l'organisation active. L'adresse ne s'affiche que si le réglage de
// l'activité l'autorise aussi.

const ACCORD = graphql(`
  query MonAdresseVisible {
    moi {
      id
      adresseVisible
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierMonAdresseVisible($visible: Boolean!) {
    modifierMonAdresseVisible(visible: $visible)
  }
`)

export default function PreferenceOrganigramme() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { data } = useQuery(ACCORD)
  const [modifier, modification] = useMutation(MODIFIER, {
    refetchQueries: [ACCORD, 'Organigramme'],
  })
  const visible = data?.moi?.adresseVisible ?? false

  const changer = async (valeur: boolean) => {
    try {
      await modifier({ variables: { visible: valeur } })
      message.success(
        valeur
          ? t`Votre adresse peut s’afficher dans l’organigramme.`
          : t`Votre adresse ne s’affiche plus dans l’organigramme.`
      )
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Panneau
      titre={t`Votre adresse dans l’organigramme`}
      icone={<ClusterOutlined />}
    >
      <p className="rt-texte-secondaire">
        <Trans>
          L’organigramme présente l’équipe de chaque activité. Votre adresse s’y
          affiche seulement avec votre accord, et si les admins de l’activité
          l’autorisent.
        </Trans>
      </p>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ fontWeight: 600 }}>
          <Trans>Afficher mon adresse dans l’organigramme</Trans>
        </span>
        <Switch
          checked={visible}
          loading={modification.loading}
          disabled={data?.moi === undefined}
          onChange={v => void changer(v)}
        />
      </label>
      <p className="rt-note">
        <Trans>
          Seules les personnes de l’activité lisent votre adresse. Vous pouvez
          retirer votre accord à tout moment. Une adresse déjà copiée par une
          autre personne reste en sa possession.
        </Trans>
      </p>
    </Panneau>
  )
}
