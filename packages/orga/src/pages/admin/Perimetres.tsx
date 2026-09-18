import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Switch,
  Table,
  Tag,
} from 'antd'
import { useState } from 'react'

import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { PerimetresQuery, TypePerimetre } from '../../gql/graphql'
import { messageErreur } from '../../lib/erreurs'
import { PERIMETRES } from '../../lib/requetes'

const CREER = graphql(`
  mutation CreerPerimetre(
    $slug: String!
    $nom: String!
    $type: TypePerimetre!
    $couleur: String
    $ordre: Int
  ) {
    creerPerimetre(
      slug: $slug
      nom: $nom
      type: $type
      couleur: $couleur
      ordre: $ordre
    ) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierPerimetre(
    $id: ID!
    $nom: String!
    $type: TypePerimetre!
    $couleur: String
    $ordre: Int!
    $archive: Boolean!
  ) {
    modifierPerimetre(
      id: $id
      nom: $nom
      type: $type
      couleur: $couleur
      ordre: $ordre
      archive: $archive
    ) {
      id
    }
  }
`)

type Perimetre = PerimetresQuery['perimetres'][number]

interface Valeurs {
  slug: string
  nom: string
  type: TypePerimetre
  couleur: string | null
  ordre: number
  archive: boolean
}

const TYPES = [
  { value: 'SPORT', label: 'Sport' },
  { value: 'POLE', label: 'Pôle' },
]

export default function Perimetres() {
  const { message } = App.useApp()
  const { data, loading } = useQuery(PERIMETRES, {
    variables: { inclureArchives: true },
  })
  const [enEdition, setEnEdition] = useState<Perimetre | 'nouveau' | null>(null)
  const [form] = Form.useForm<Valeurs>()
  const rafraichir = { refetchQueries: [PERIMETRES] }
  const [creer, creation] = useMutation(CREER, rafraichir)
  const [modifier, modification] = useMutation(MODIFIER, rafraichir)

  const ouvrir = (perimetre: Perimetre | 'nouveau') => {
    setEnEdition(perimetre)
    form.setFieldsValue(
      perimetre === 'nouveau'
        ? {
            slug: '',
            nom: '',
            type: 'SPORT',
            couleur: null,
            ordre: 0,
            archive: false,
          }
        : { ...perimetre }
    )
  }

  const enregistrer = async (v: Valeurs) => {
    const couleur =
      typeof v.couleur === 'string'
        ? v.couleur
        : ((
            v.couleur as { toHexString?: () => string } | null
          )?.toHexString?.() ?? null)
    try {
      if (enEdition === 'nouveau') {
        await creer({
          variables: {
            slug: v.slug,
            nom: v.nom,
            type: v.type,
            couleur,
            ordre: v.ordre,
          },
        })
        message.success('Périmètre créé.')
      } else if (enEdition) {
        await modifier({
          variables: {
            id: enEdition.id,
            nom: v.nom,
            type: v.type,
            couleur,
            ordre: v.ordre,
            archive: v.archive,
          },
        })
        message.success('Périmètre enregistré.')
      }
      setEnEdition(null)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre sousTitre="Un périmètre est un sport ou un pôle transverse. Il reste le même d’une édition à l’autre.">
        Périmètres
      </Titre>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        style={{ marginBottom: 16 }}
        onClick={() => ouvrir('nouveau')}
      >
        Nouveau périmètre
      </Button>
      <Table<Perimetre>
        rowKey="id"
        loading={loading}
        dataSource={data?.perimetres ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={p => ({
          onClick: () => ouvrir(p),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: '',
            dataIndex: 'couleur',
            width: 24,
            render: (c: string | null) => (
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: c ?? 'transparent',
                  border: '1px solid var(--rt-encre-14)',
                }}
              />
            ),
          },
          { title: 'Nom', dataIndex: 'nom' },
          { title: 'Identifiant', dataIndex: 'slug' },
          {
            title: 'Type',
            dataIndex: 'type',
            render: (t: TypePerimetre) => (t === 'SPORT' ? 'Sport' : 'Pôle'),
          },
          { title: 'Ordre', dataIndex: 'ordre', width: 80 },
          {
            title: 'État',
            dataIndex: 'archive',
            render: (a: boolean) =>
              a ? <Tag>Archivé</Tag> : <Tag color="green">Actif</Tag>,
          },
        ]}
      />

      <Modal
        open={enEdition !== null}
        title={
          enEdition === 'nouveau'
            ? 'Nouveau périmètre'
            : 'Modifier le périmètre'
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
          <Form.Item
            label="Nom"
            name="nom"
            rules={[{ required: true, message: 'Saisissez un nom.' }]}
          >
            <Input placeholder="Natation" />
          </Form.Item>
          <Form.Item
            label="Identifiant"
            name="slug"
            extra="Minuscules, chiffres et tirets. Il ne change plus après la création."
            rules={[
              { required: true, message: 'Saisissez un identifiant.' },
              {
                pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
                message: 'Minuscules, chiffres et tirets seulement.',
              },
            ]}
          >
            <Input placeholder="natation" disabled={enEdition !== 'nouveau'} />
          </Form.Item>
          <Form.Item label="Type" name="type">
            <Segmented options={TYPES} />
          </Form.Item>
          <Form.Item label="Couleur" name="couleur">
            <ColorPicker format="hex" allowClear />
          </Form.Item>
          <Form.Item label="Ordre d’affichage" name="ordre">
            <InputNumber min={0} max={999} />
          </Form.Item>
          {enEdition !== 'nouveau' && (
            <Form.Item
              label="Archivé"
              name="archive"
              valuePropName="checked"
              extra="Un périmètre archivé disparaît des listes, mais son historique reste consultable."
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
