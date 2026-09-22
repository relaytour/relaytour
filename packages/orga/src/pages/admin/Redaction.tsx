import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Card, Form, Popconfirm, Select, Space, Table } from 'antd'

import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { DroitsRedactionQuery } from '../../gql/graphql'
import { messageErreur } from '../../lib/erreurs'
import { PERIMETRES } from '../../lib/requetes'
import { useSession } from '../../lib/session'

const DROITS = graphql(`
  query DroitsRedaction {
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
    personnes {
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
  const gereOrganisation = useSession().moi.estAdmin
  const { message } = App.useApp()
  const { data, loading } = useQuery(DROITS)
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
              options={(data?.personnes ?? []).map(p => ({
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

      <Table<Droit>
        rowKey="id"
        loading={loading}
        dataSource={data?.droitsRedaction ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Personne', render: (_, d) => d.personne.nom },
          {
            title: 'Fiches',
            render: (_, d) => d.perimetre?.nom ?? 'Toutes les fiches',
          },
          {
            title: '',
            key: 'actions',
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
