import { useMutation } from '@apollo/client/react'
import { useLingui } from '@lingui/react/macro'
import { App, Col, Form, Input, Modal, Row } from 'antd'

import { ChampGroupes, ChampNature } from './ChampsActivite'
import { graphql } from '../gql'
import type { NatureActivite } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { groupesSaisis, type Groupe } from '../lib/natures'
import { ACTIVITES } from '../lib/requetes'

// Première étape de la liste « Premiers pas » (ADR 0048) : l'admin vérifie le nom,
// la nature et les groupes de l'activité créée avec l'organisation, puis confirme.
// Les autres réglages restent dans l'écran Activités.

const DECRIRE = graphql(`
  mutation DecrireActivite(
    $id: ID!
    $nom: String!
    $sigle: String
    $nature: NatureActivite!
    $groupes: [GroupePerimetresInput!]!
    $ordre: Int!
  ) {
    modifierActivite(
      id: $id
      nom: $nom
      sigle: $sigle
      nature: $nature
      groupes: $groupes
      ordre: $ordre
    ) {
      id
    }
  }
`)

const CONFIRMER_ACTIVITE = graphql(`
  mutation ConfirmerActivite($activiteId: ID) {
    confirmerActivite(activiteId: $activiteId) {
      masques
    }
  }
`)

interface Valeurs {
  nom: string
  sigle?: string
  nature: NatureActivite
  groupes: Groupe[]
}

export default function DescriptionActivite({
  ouverte,
  onFermer,
}: {
  ouverte: boolean
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { activite } = useActivite()
  const [decrire, description] = useMutation(DECRIRE, {
    refetchQueries: [ACTIVITES],
  })
  const [confirmer, confirmation] = useMutation(CONFIRMER_ACTIVITE)

  const enregistrer = async (v: Valeurs) => {
    try {
      await decrire({
        variables: {
          id: activite.id,
          nom: v.nom,
          sigle: v.sigle?.trim() || null,
          nature: v.nature,
          groupes: groupesSaisis(v.groupes),
          ordre: activite.ordre,
        },
      })
      await confirmer({ variables: { activiteId: activite.id } })
      message.success(t`Activité enregistrée.`)
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouverte}
      title={t`Décrire l’activité`}
      width={680}
      okText={t`Enregistrer`}
      cancelText={t`Annuler`}
      confirmLoading={description.loading || confirmation.loading}
      okButtonProps={{ htmlType: 'submit', form: 'description-activite' }}
      onCancel={onFermer}
      destroyOnHidden
    >
      <Form<Valeurs>
        id="description-activite"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          nom: activite.nom,
          sigle: activite.sigle ?? undefined,
          nature: activite.nature,
          groupes: activite.groupes.map(g => ({
            cle: g.cle,
            libelle: g.libelle,
            libellePluriel: g.libellePluriel,
          })),
        }}
        onFinish={v => void enregistrer(v)}
      >
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.Item
              label={t`Nom`}
              name="nom"
              rules={[{ required: true, message: t`Saisissez un nom.` }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item label={t`Sigle (facultatif)`} name="sigle">
              <Input maxLength={20} />
            </Form.Item>
          </Col>
        </Row>
        <ChampNature />
        <ChampGroupes />
      </Form>
    </Modal>
  )
}
