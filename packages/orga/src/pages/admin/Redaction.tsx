import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Card, Form, Popconfirm, Select, Space } from 'antd'

import Tableau from '../../composants/Tableau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { DroitsRedactionQuery } from '../../gql/graphql'
import { messageErreur } from '../../lib/erreurs'
import { PERIMETRES } from '../../lib/requetes'
import { useSession } from '../../lib/session'
import { comparer } from '../../lib/tableau'

const TOUTES_LES_FICHES = 'Toutes les fiches'

const DROITS = graphql(`
  query DroitsRedaction($annuaire: Boolean!) {
    droitsRedaction {
      id
      accordeLe
      personne {
        id
        nom
      }
      perimetre {
        id
        nom
      }
    }
    equipe {
      id
      nom
    }
    personnes @include(if: $annuaire) {
      id
      nom
    }
  }
`)

const ACCORDER = graphql(`
  mutation AccorderDroitRedaction($personneId: ID!, $perimetreId: ID) {
    accorderDroitRedaction(personneId: $personneId, perimetreId: $perimetreId) {
      id
    }
  }
`)

const RETIRER = graphql(`
  mutation RetirerDroitRedaction($id: ID!) {
    retirerDroitRedaction(id: $id)
  }
`)

type Droit = DroitsRedactionQuery['droitsRedaction'][number]
const TOUTES = 'toutes'

export default function Redaction() {
  // Un droit sur toutes les fiches vaut pour toute l'organisation : seul un admin de
  // l'organisation l'accorde (ADR 0010).
  const gereOrganisation = useSession().moi.estAdmin === true
  const { message } = App.useApp()
  // Un admin d'activité choisit dans son équipe ; un admin de l'organisation lit
  // l'annuaire (ADR 0018).
  const { data, loading } = useQuery(DROITS, {
    variables: { annuaire: gereOrganisation },
  })
  const { data: perimetres } = useQuery(PERIMETRES)
  const [form] = Form.useForm<{ personneId: string; perimetre: string }>()
  const [accorder, accord] = useMutation(ACCORDER, { refetchQueries: [DROITS] })
  const [retirer] = useMutation(RETIRER, { refetchQueries: [DROITS] })

  const ajouter = async (v: { personneId: string; perimetre: string }) => {
    try {
      await accorder({
        variables: {
          personneId: v.personneId,
          perimetreId: v.perimetre === TOUTES ? null : v.perimetre,
        },
      })
      message.success('Droit accordé.')
      form.resetFields()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre sousTitre="Les admins rédigent toutes les fiches. Les autres personnes ont besoin d’un droit de rédaction.">
        Rédaction des fiches
      </Titre>

      <Card style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={v => void ajouter(v)}
          requiredMark={false}
        >
          <Form.Item
            name="personneId"
            rules={[{ required: true, message: 'Choisissez une personne.' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Personne"
              style={{ minWidth: 200 }}
              options={(data?.personnes ?? data?.equipe ?? []).map(p => ({
                value: p.id,
                label: p.nom,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="perimetre"
            rules={[{ required: true, message: 'Choisissez un périmètre.' }]}
          >
            <Select
              placeholder="Fiches concernées"
              style={{ minWidth: 220 }}
              options={[
                ...(gereOrganisation
                  ? [
                      {
                        value: TOUTES,
                        label: 'Toutes les fiches, communes comprises',
                      },
                    ]
                  : []),
                ...(perimetres?.perimetres ?? []).map(p => ({
                  value: p.id,
                  label: p.nom,
                })),
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={accord.loading}>
              Accorder
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Tableau<Droit>
        id="redaction"
        rowKey="id"
        loading={loading}
        dataSource={data?.droitsRedaction ?? []}
        pagination={false}
        colonnes={[
          {
            key: 'personne',
            title: 'Personne',
            render: (_, d) => d.personne.nom,
            tri: d => d.personne.nom,
            recherche: d => d.personne.nom,
          },
          {
            key: 'fiches',
            title: 'Fiches',
            render: (_, d) => d.perimetre?.nom ?? TOUTES_LES_FICHES,
            tri: d => d.perimetre?.nom ?? TOUTES_LES_FICHES,
            filtre: {
              // La valeur est l'identifiant du périmètre : deux périmètres de
              // même nom restent deux options.
              options: [
                ...new Map(
                  (data?.droitsRedaction ?? []).map(d => [
                    d.perimetre?.id ?? TOUTES,
                    d.perimetre?.nom ?? TOUTES_LES_FICHES,
                  ])
                ),
              ]
                .sort((a, b) => comparer(a[1], b[1]))
                .map(([value, text]) => ({ text, value })),
              valeurs: d => d.perimetre?.id ?? TOUTES,
            },
          },
          {
            title: '',
            key: 'actions',
            redimensionnable: false,
            render: (_, d) => (
              <Space>
                <Popconfirm
                  title="Retirer ce droit ?"
                  okText="Retirer"
                  cancelText="Annuler"
                  onConfirm={async () => {
                    try {
                      await retirer({ variables: { id: d.id } })
                      message.success('Droit retiré.')
                    } catch (e) {
                      message.error(messageErreur(e))
                    }
                  }}
                >
                  <Button size="small" danger>
                    Retirer
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
