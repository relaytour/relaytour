import { GlobalOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Radio } from 'antd'

import { graphql } from '../gql'
import { messageErreur } from '../lib/erreurs'
import { LANGUES_PROPOSEES, NOMS_DES_LANGUES } from '../lib/langue'
import { useOrganisation } from '../lib/organisation'
import { LANGUE_DE_MOI } from '../lib/requetes'

import { Panneau } from './Panneau'

// Langue de l'interface, des mails et des notifications (ADR 0047). Elle appartient
// à la personne et vaut dans toutes ses organisations, comme son nom.

const MODIFIER = graphql(`
  mutation ModifierMaLangue($langue: String) {
    modifierMaLangue(langue: $langue) {
      id
      langue
    }
  }
`)

/** Valeur du choix « langue de l'organisation », qui efface la préférence. */
const ORGANISATION = 'organisation'

export default function PreferenceLangue() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { nomCourt } = useOrganisation()
  const { data } = useQuery(LANGUE_DE_MOI)
  // L'organisation se relit : le lien des modes d'emploi suit la langue (ADR 0047).
  const [modifier, modification] = useMutation(MODIFIER, {
    refetchQueries: ['Organisation'],
  })

  // Une seule langue proposée : aucun choix à faire.
  if (LANGUES_PROPOSEES.length < 2) return null

  const choix = data?.moi?.langue ?? ORGANISATION
  const changer = async (valeur: string) => {
    try {
      await modifier({
        variables: { langue: valeur === ORGANISATION ? null : valeur },
      })
      message.success(t`Votre langue est enregistrée.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Panneau titre={t`Langue`} icone={<GlobalOutlined />}>
      <p className="rt-texte-secondaire">
        <Trans>
          L’espace organisateur, vos mails et vos notifications s’affichent dans
          cette langue. Le contenu écrit par votre organisation garde la sienne.
        </Trans>
      </p>
      <Radio.Group
        value={choix}
        disabled={data?.moi === undefined || modification.loading}
        onChange={e => void changer(String(e.target.value))}
        options={[
          {
            value: ORGANISATION,
            label: t`Langue de ${nomCourt}`,
          },
          ...LANGUES_PROPOSEES.map(langue => ({
            value: langue,
            label: NOMS_DES_LANGUES[langue],
          })),
        ]}
        style={{ display: 'grid', gap: 8 }}
      />
    </Panneau>
  )
}
