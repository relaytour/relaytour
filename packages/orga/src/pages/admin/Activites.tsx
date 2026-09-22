import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
  Table,
  Tag,
} from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { NatureActivite } from '../../gql/graphql'
import { formesPeriode, useActivite, type Activite } from '../../lib/activite'
import { messageErreur } from '../../lib/erreurs'
import { ACTIVITES } from '../../lib/requetes'

// Les activités de l'organisation (ADR 0008) : un événement, une section, une
// instance. Les admins les créent, les modifient et les archivent. Une activité
// archivée reste consultable ; l'archiver libère sa place dans les limites que
// l'hébergeur a pu fixer.

const CREER = graphql(`
  mutation CreerActivite(
    $slug: String!
    $nom: String!
    $sigle: String
    $nature: NatureActivite!
    $groupes: [GroupePerimetresInput!]
    $ordre: Int
  ) {
    creerActivite(
      slug: $slug
      nom: $nom
      sigle: $sigle
      nature: $nature
      groupes: $groupes
      ordre: $ordre
    ) {
      id
      slug
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierActivite(
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

const ARCHIVER = graphql(`
  mutation ArchiverActivite($id: ID!, $archive: Boolean!) {
    archiverActivite(id: $id, archive: $archive) {
      id
      archive
    }
  }
`)

const NATURES: { value: NatureActivite; label: string; aide: string }[] = [
  {
    value: 'EVENEMENT',
    label: 'Événement',
    aide: 'Une manifestation qui revient, une édition à la fois.',
  },
  {
    value: 'SAISON',
    label: 'Section',
    aide: 'Une activité permanente, une saison à la fois.',
  },
  {
    value: 'MANDAT',
    label: 'Instance',
    aide: 'Un bureau ou un conseil, un mandat à la fois.',
  },
]

interface Groupe {
  cle: string
  libelle: string
  libellePluriel: string
}

interface Valeurs {
  slug: string
  nom: string
  sigle?: string
  nature: NatureActivite
  ordre: number
  groupes: Groupe[]
  archive: boolean
}

const GROUPES_PAR_DEFAUT: Groupe[] = [
  { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
  { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
]

export default function Activites() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { activite: affichee } = useActivite()
  const { data, loading } = useQuery(ACTIVITES)
  const [enEdition, setEnEdition] = useState<Activite | 'nouvelle' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [form] = Form.useForm<Valeurs>()
  const rafraichir = { refetchQueries: [ACTIVITES] }
  const [creer, creation] = useMutation(CREER, rafraichir)
  const [modifier, modification] = useMutation(MODIFIER, rafraichir)
  const [archiver, archivage] = useMutation(ARCHIVER, rafraichir)

  const ouvrir = (activite: Activite | 'nouvelle') => {
    setErreur(null)
    setEnEdition(activite)
    form.setFieldsValue(
      activite === 'nouvelle'
        ? {
            slug: '',
            nom: '',
            sigle: '',
            nature: 'SAISON',
            ordre: (data?.activites.length ?? 0) + 1,
            groupes: GROUPES_PAR_DEFAUT,
            archive: false,
          }
        : {
            slug: activite.slug,
            nom: activite.nom,
            sigle: activite.sigle ?? '',
            nature: activite.nature,
            ordre: activite.ordre,
            groupes: activite.groupes.map(g => ({ ...g })),
            archive: activite.archive,
          }
    )
  }

  const enregistrer = async (v: Valeurs) => {
    setErreur(null)
    const groupes = v.groupes.map(g => ({
      cle: g.cle.trim(),
      libelle: g.libelle.trim(),
      libellePluriel: g.libellePluriel.trim(),
    }))
    const sigle = v.sigle?.trim() || null
    try {
      if (enEdition === 'nouvelle') {
        const r = await creer({
          variables: {
            slug: v.slug.trim(),
            nom: v.nom,
            sigle,
            nature: v.nature,
            groupes,
            ordre: v.ordre,
          },
        })
        message.success('Activité créée.')
        setEnEdition(null)
        const slug = r.data?.creerActivite.slug
        if (slug) navigate(`/${slug}/`)
        return
      }
      if (enEdition) {
        await modifier({
          variables: {
            id: enEdition.id,
            nom: v.nom,
            sigle,
            nature: v.nature,
            groupes,
            ordre: v.ordre,
          },
        })
        if (v.archive !== enEdition.archive) {
          await archiver({
            variables: { id: enEdition.id, archive: v.archive },
          })
        }
        message.success('Activité enregistrée.')
        setEnEdition(null)
      }
    } catch (e) {
      // Une limite atteinte ou un groupe encore utilisé s'affichent dans la fenêtre.
      setErreur(messageErreur(e))
    }
  }

  return (
    <>
      <Titre sousTitre="Un événement, une section ou une instance : chaque activité a ses périodes, ses périmètres, ses fiches et ses tâches types.">
        Activités
      </Titre>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        style={{ marginBottom: 16 }}
        onClick={() => ouvrir('nouvelle')}
      >
        Nouvelle activité
      </Button>
      <Table<Activite>
        rowKey="id"
        loading={loading}
        dataSource={data?.activites ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={activite => ({
          onClick: () => ouvrir(activite),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: 'Nom',
            dataIndex: 'nom',
            render: (nom: string, a) => (
              <>
                {nom}
                {a.id === affichee.id && (
                  <Tag style={{ marginInlineStart: 8 }}>Affichée</Tag>
                )}
              </>
            ),
          },
          { title: 'Identifiant', dataIndex: 'slug' },
          {
            title: 'Nature',
            dataIndex: 'nature',
            render: (n: NatureActivite) =>
              `${NATURES.find(x => x.value === n)?.label ?? n} (${formesPeriode(n).nom})`,
          },
          {
            title: 'Groupes',
            render: (_, a) => a.groupes.map(g => g.libellePluriel).join(', '),
          },
          {
            title: 'État',
            dataIndex: 'archive',
            render: (archive: boolean) =>
              archive ? <Tag>Archivée</Tag> : <Tag color="green">Ouverte</Tag>,
          },
        ]}
      />

      <Modal
        open={enEdition !== null}
        title={
          enEdition === 'nouvelle' ? 'Nouvelle activité' : 'Modifier l’activité'
        }
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={
          creation.loading || modification.loading || archivage.loading
        }
        onOk={() => form.submit()}
        onCancel={() => setEnEdition(null)}
        destroyOnHidden
        width={620}
      >
        {erreur && (
          <Alert
            type="error"
            showIcon
            title={erreur}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={v => void enregistrer(v)}
          requiredMark={false}
        >
          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item
                label="Nom"
                name="nom"
                rules={[{ required: true, message: 'Saisissez un nom.' }]}
              >
                <Input placeholder="Section natation" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item label="Sigle (facultatif)" name="sigle">
                <Input placeholder="Natation" maxLength={20} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item
                label="Identifiant"
                name="slug"
                extra="Il apparaît dans l’adresse des pages et ne change plus."
                rules={[
                  { required: true, message: 'Saisissez un identifiant.' },
                  {
                    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: 'Minuscules, chiffres et tirets seulement.',
                  },
                ]}
              >
                <Input
                  placeholder="section-natation"
                  disabled={enEdition !== 'nouvelle'}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item label="Ordre" name="ordre">
                <InputNumber min={0} max={999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Nature"
            name="nature"
            extra={
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) =>
                  NATURES.find(n => n.value === getFieldValue('nature'))?.aide
                }
              </Form.Item>
            }
          >
            <Select
              options={NATURES.map(({ value, label }) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item
            label="Groupes de périmètres"
            extra="Chaque périmètre appartient à un groupe : un sport, un pôle, une équipe, une commission…"
          >
            <Form.List name="groupes">
              {(champs, { add, remove }) => (
                <>
                  {champs.map(champ => (
                    <Row gutter={8} key={champ.key} align="top">
                      <Col xs={24} sm={7}>
                        <Form.Item
                          name={[champ.name, 'cle']}
                          rules={[
                            { required: true, message: 'Clé requise.' },
                            {
                              pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                              message: 'Minuscules, chiffres, tirets.',
                            },
                          ]}
                        >
                          <Input placeholder="clé" aria-label="Clé du groupe" />
                        </Form.Item>
                      </Col>
                      <Col xs={11} sm={7}>
                        <Form.Item
                          name={[champ.name, 'libelle']}
                          rules={[
                            { required: true, message: 'Libellé requis.' },
                          ]}
                        >
                          <Input
                            placeholder="Équipe"
                            aria-label="Libellé du groupe"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={11} sm={8}>
                        <Form.Item
                          name={[champ.name, 'libellePluriel']}
                          rules={[
                            { required: true, message: 'Pluriel requis.' },
                          ]}
                        >
                          <Input
                            placeholder="Équipes"
                            aria-label="Libellé pluriel du groupe"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={2} sm={2}>
                        <Button
                          icon={<DeleteOutlined />}
                          aria-label="Retirer le groupe"
                          disabled={champs.length === 1}
                          onClick={() => remove(champ.name)}
                        />
                      </Col>
                    </Row>
                  ))}
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({ cle: '', libelle: '', libellePluriel: '' })
                    }
                    disabled={champs.length >= 10}
                  >
                    Ajouter un groupe
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          {enEdition !== 'nouvelle' && (
            <Form.Item
              label="Archivée"
              name="archive"
              valuePropName="checked"
              extra="Une activité archivée disparaît du sélecteur et reste consultable."
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
