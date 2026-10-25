import { DownOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import {
  App,
  Button,
  Col,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Tag,
} from 'antd'
import { useState } from 'react'

import ReconductionEdition, {
  type PeriodeReconduction,
} from '../../composants/ReconductionEdition'
import Tableau from '../../composants/Tableau'
import TachesTypesEdition from '../../composants/TachesTypesEdition'
import Titre from '../../composants/Titre'
import { useActivite } from '../../lib/activite'
import { graphql } from '../../gql'
import type { EditionsQuery, StatutEdition } from '../../gql/graphql'
import { dateCourte, messageErreur } from '../../lib/erreurs'
import { majusculeInitiale } from '../../lib/langue'
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
  PREPARATION: {
    libelle: t({
      message: 'En préparation',
      comment: 'Statut d’une période',
    }),
    couleur: 'blue',
  },
  EN_COURS: {
    libelle: t({ message: 'En cours', comment: 'Statut d’une période' }),
    couleur: 'green',
  },
  ARCHIVEE: {
    libelle: majusculeInitiale(archivee),
    couleur: 'default',
  },
})

/** Point de départ d'une nouvelle période (ADR 0048). */
type Depart = 'vide' | 'types' | 'reprendre'

interface Valeurs {
  annee: number
  nom: string
  debut: string
  fin: string
  statut: StatutEdition
  depart: Depart
  source?: string
}

export default function Editions() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { periode } = useActivite()
  // Les formes du mot qui désigne une période arrivent accordées dans la langue active.
  const {
    nom: mot,
    Nom: Mot,
    la: laPeriode,
    une: unePeriode,
    creee,
    enregistree,
  } = periode
  const STATUTS = statuts(periode.archivee)
  const { data, loading } = useQuery(EDITIONS)
  const [enEdition, setEnEdition] = useState<Edition | 'nouvelle' | null>(null)
  const [form] = Form.useForm<Valeurs>()
  const rafraichir = { refetchQueries: [EDITIONS, EDITION_COURANTE] }
  const [creer, creation] = useMutation(CREER, rafraichir)
  const [modifier, modification] = useMutation(MODIFIER, rafraichir)
  const [tachesTypesPour, setTachesTypesPour] =
    useState<PeriodeReconduction | null>(null)
  const [reconduction, setReconduction] = useState<{
    cible: PeriodeReconduction
    source?: string
  } | null>(null)
  const periodes: PeriodeReconduction[] = (data?.editions ?? []).map(e => ({
    id: e.id,
    nom: e.nom,
  }))

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
            depart: periodes.length > 0 ? 'reprendre' : 'vide',
            source: periodes[0]?.id,
          }
        : {
            annee: edition.annee,
            nom: edition.nom,
            debut: edition.debut.slice(0, 10),
            fin: edition.fin.slice(0, 10),
            statut: edition.statut,
            depart: 'vide',
          }
    )
  }

  const enregistrer = async (valeurs: Valeurs) => {
    const { debut, fin } = valeurs
    try {
      if (enEdition === 'nouvelle') {
        const resultat = await creer({
          variables: { annee: valeurs.annee, nom: valeurs.nom, debut, fin },
        })
        message.success(t`${Mot} ${creee}.`)
        const id = resultat.data?.creerEdition.id
        if (id !== undefined) {
          const nouvelle = { id, nom: valeurs.nom }
          if (valeurs.depart === 'types') setTachesTypesPour(nouvelle)
          if (valeurs.depart === 'reprendre') {
            setReconduction({ cible: nouvelle, source: valeurs.source })
          }
        }
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
        message.success(t`${Mot} ${enregistree}.`)
      }
      setEnEdition(null)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre
        sousTitre={t`Chaque ${mot} sert de repère aux échéances des tâches.`}
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
      <Tableau<Edition>
        id="editions"
        rowKey="id"
        loading={loading}
        dataSource={data?.editions ?? []}
        pagination={false}
        ouvrir={ouvrir}
        libelleOuvrir={e => {
          const nom = e.nom
          return t`Modifier ${nom}`
        }}
        colonnes={[
          {
            key: 'annee',
            title: t`Année`,
            dataIndex: 'annee',
            width: 110,
            tri: e => e.annee,
          },
          {
            key: 'nom',
            title: t`Nom`,
            dataIndex: 'nom',
            tri: e => e.nom,
            recherche: e => e.nom,
          },
          {
            key: 'dates',
            title: t`Dates`,
            render: (_, e) => {
              const debut = dateCourte(e.debut)
              const fin = dateCourte(e.fin)
              return t`${debut} au ${fin}`
            },
            tri: e => e.debut,
          },
          {
            key: 'statut',
            title: t`Statut`,
            dataIndex: 'statut',
            render: (s: StatutEdition) => (
              <Tag color={STATUTS[s].couleur}>{STATUTS[s].libelle}</Tag>
            ),
            filtre: {
              options: Object.entries(STATUTS).map(([value, s]) => ({
                text: s.libelle,
                value,
              })),
              valeurs: e => e.statut,
            },
          },
          {
            title: '',
            key: 'actions',
            redimensionnable: false,
            render: (_, e) =>
              e.statut !== 'ARCHIVEE' && (
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'types', label: t`Appliquer les tâches types` },
                      ...(periodes.length > 1
                        ? [
                            {
                              key: 'reprendre',
                              label: t`Reprendre des tâches existantes`,
                            },
                          ]
                        : []),
                    ],
                    onClick: ({ key }) => {
                      const cible = { id: e.id, nom: e.nom }
                      if (key === 'types') setTachesTypesPour(cible)
                      else setReconduction({ cible })
                    },
                  }}
                >
                  <Button size="small">
                    <Space size={4}>
                      {t`Ajouter des tâches`}
                      <DownOutlined />
                    </Space>
                  </Button>
                </Dropdown>
              ),
          },
        ]}
      />

      <Modal
        open={enEdition !== null}
        title={
          enEdition === 'nouvelle' ? periode.Nouvelle : t`Modifier ${laPeriode}`
        }
        okText={t`Enregistrer`}
        cancelText={t`Annuler`}
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
          <Form.Item label={t`Année`} name="annee" rules={[{ required: true }]}>
            <InputNumber
              min={2020}
              max={2100}
              disabled={enEdition !== 'nouvelle'}
            />
          </Form.Item>
          <Form.Item
            label={t`Nom`}
            name="nom"
            rules={[{ required: true, message: t`Saisissez un nom.` }]}
          >
            <Input placeholder={t`${Mot} 2027`} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={t`Premier jour`}
                name="debut"
                rules={[{ required: true, message: t`Choisissez une date.` }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={t`Dernier jour`}
                name="fin"
                dependencies={['debut']}
                rules={[
                  { required: true, message: t`Choisissez une date.` },
                  ({ getFieldValue }) => ({
                    validator: (_, fin: string) =>
                      !fin || fin >= (getFieldValue('debut') as string)
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(t`Le dernier jour suit le premier.`)
                          ),
                  }),
                ]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          {enEdition === 'nouvelle' && (
            <Form.Item
              label={t`Partir de`}
              name="depart"
              extra={t`Vous pourrez aussi ajouter des tâches plus tard, depuis cet écran.`}
            >
              <Radio.Group>
                <Space orientation="vertical">
                  <Radio value="vide">{t`Aucune tâche`}</Radio>
                  <Radio value="types">{t`Les tâches types des périmètres`}</Radio>
                  {periodes.length > 0 && (
                    <Radio value="reprendre">
                      <Space wrap>
                        {t`Les tâches de`}
                        <Form.Item name="source" noStyle>
                          <Select
                            aria-label={t`Reprendre les tâches de`}
                            style={{ minWidth: 200 }}
                            options={periodes.map(p => ({
                              value: p.id,
                              label: p.nom,
                            }))}
                          />
                        </Form.Item>
                      </Space>
                    </Radio>
                  )}
                </Space>
              </Radio.Group>
            </Form.Item>
          )}
          {enEdition !== 'nouvelle' && (
            <Form.Item
              label={t`Statut`}
              name="statut"
              extra={t`Archiver ${unePeriode} passe ses tâches en lecture seule. Ses demandes pour rejoindre l’équipe sont supprimées la nuit suivante ; les comptes et les affectations restent.`}
            >
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

      <TachesTypesEdition
        edition={tachesTypesPour}
        onFermer={() => setTachesTypesPour(null)}
      />
      <ReconductionEdition
        key={reconduction?.cible.id ?? 'fermee'}
        cible={reconduction?.cible ?? null}
        periodes={periodes}
        sourceInitiale={reconduction?.source}
        onFermer={() => setReconduction(null)}
      />
    </>
  )
}
