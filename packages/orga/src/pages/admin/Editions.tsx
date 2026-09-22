import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Table,
  Tag,
} from 'antd'
import { useState } from 'react'

import Titre from '../../composants/Titre'
import { useActivite } from '../../lib/activite'
import { graphql } from '../../gql'
import type { EditionsQuery, StatutEdition } from '../../gql/graphql'
import { dateCourte, messageErreur } from '../../lib/erreurs'
import { EDITION_COURANTE, EDITIONS } from '../../lib/requetes'

const CREER = graphql(`
  mutation CreerEdition(
    $annee: Int!
    $nom: String!
    $debut: Date!
    $fin: Date!
  ) {
    creerEdition(annee: $annee, nom: $nom, debut: $debut, fin: $fin) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierEdition(
    $id: ID!
    $nom: String!
    $debut: Date!
    $fin: Date!
    $statut: StatutEdition!
  ) {
    modifierEdition(
      id: $id
      nom: $nom
      debut: $debut
      fin: $fin
      statut: $statut
    ) {
      id
      nom
      debut
      fin
      statut
    }
  }
`)

type Edition = EditionsQuery['editions'][number]

const statuts = (
  archivee: string
): Record<StatutEdition, { libelle: string; couleur: string }> => ({
  PREPARATION: { libelle: 'En préparation', couleur: 'blue' },
  EN_COURS: { libelle: 'En cours', couleur: 'green' },
  ARCHIVEE: {
    libelle: archivee.charAt(0).toUpperCase() + archivee.slice(1),
    couleur: 'default',
  },
})

interface Valeurs {
  annee: number
  nom: string
  debut: string
  fin: string
  statut: StatutEdition
}

export default function Editions() {
  const { message } = App.useApp()
  const { periode } = useActivite()
  const STATUTS = statuts(periode.archivee)
  const { data, loading } = useQuery(EDITIONS)
  const [enEdition, setEnEdition] = useState<Edition | 'nouvelle' | null>(null)
  const [form] = Form.useForm<Valeurs>()
  const rafraichir = { refetchQueries: [EDITIONS, EDITION_COURANTE] }
  const [creer, creation] = useMutation(CREER, rafraichir)
  const [modifier, modification] = useMutation(MODIFIER, rafraichir)

  const ouvrir = (edition: Edition | 'nouvelle') => {
    setEnEdition(edition)
    form.setFieldsValue(
      edition === 'nouvelle'
        ? {
            annee: new Date().getFullYear() + 1,
            nom: '',
            debut: '',
            fin: '',
            statut: 'PREPARATION',
          }
        : {
            annee: edition.annee,
            nom: edition.nom,
            debut: edition.debut.slice(0, 10),
            fin: edition.fin.slice(0, 10),
            statut: edition.statut,
          }
    )
  }

  const enregistrer = async (valeurs: Valeurs) => {
    const { debut, fin } = valeurs
    try {
      if (enEdition === 'nouvelle') {
        await creer({
          variables: { annee: valeurs.annee, nom: valeurs.nom, debut, fin },
        })
        message.success(`${periode.Nom} ${periode.creee}.`)
      } else if (enEdition) {
        await modifier({
          variables: {
            id: enEdition.id,
            nom: valeurs.nom,
            debut,
            fin,
            statut: valeurs.statut,
          },
        })
        message.success(`${periode.Nom} ${periode.enregistree}.`)
      }
      setEnEdition(null)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre
        sousTitre={`Chaque ${periode.nom} sert de repère aux échéances des tâches.`}
      >
        {periode.Pluriel}
      </Titre>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        style={{ marginBottom: 16 }}
        onClick={() => ouvrir('nouvelle')}
      >
        {periode.Nouvelle}
      </Button>
      <Table<Edition>
        rowKey="id"
        loading={loading}
        dataSource={data?.editions ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={edition => ({
          onClick: () => ouvrir(edition),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: 'Année', dataIndex: 'annee', width: 90 },
          { title: 'Nom', dataIndex: 'nom' },
          {
            title: 'Dates',
            render: (_, e) => `${dateCourte(e.debut)} au ${dateCourte(e.fin)}`,
          },
          {
            title: 'Statut',
            dataIndex: 'statut',
            render: (s: StatutEdition) => (
              <Tag color={STATUTS[s].couleur}>{STATUTS[s].libelle}</Tag>
            ),
          },
        ]}
      />

      <Modal
        open={enEdition !== null}
        title={
          enEdition === 'nouvelle' ? periode.Nouvelle : `Modifier ${periode.la}`
        }
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={creation.loading || modification.loading}
        onOk={() => form.submit()}
        onCancel={() => setEnEdition(null)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={v => void enregistrer(v)}
          requiredMark={false}
        >
          <Form.Item label="Année" name="annee" rules={[{ required: true }]}>
            <InputNumber
              min={2020}
              max={2100}
              disabled={enEdition !== 'nouvelle'}
            />
          </Form.Item>
          <Form.Item
            label="Nom"
            name="nom"
            rules={[{ required: true, message: 'Saisissez un nom.' }]}
          >
            <Input placeholder={`${periode.Nom} 2027`} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Premier jour"
                name="debut"
                rules={[{ required: true, message: 'Choisissez une date.' }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Dernier jour"
                name="fin"
                dependencies={['debut']}
                rules={[
                  { required: true, message: 'Choisissez une date.' },
                  ({ getFieldValue }) => ({
                    validator: (_, fin: string) =>
                      !fin || fin >= (getFieldValue('debut') as string)
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error('Le dernier jour suit le premier.')
                          ),
                  }),
                ]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          {enEdition !== 'nouvelle' && (
            <Form.Item label="Statut" name="statut">
              <Select
                options={Object.entries(STATUTS).map(
                  ([value, { libelle }]) => ({
                    value,
                    label: libelle,
                  })
                )}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
