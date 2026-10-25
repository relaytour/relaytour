import { DownOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { App, Button, Dropdown, Form, Modal, Select, Space, Tag } from 'antd'
import { useState } from 'react'

import ChampsEdition from '../../composants/ChampsEdition'
import NouvelleEdition from '../../composants/NouvelleEdition'
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

interface Valeurs {
  annee: number
  nom: string
  debut: string
  fin: string
  statut: StatutEdition
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
    enregistree,
  } = periode
  const STATUTS = statuts(periode.archivee)
  const { data, loading } = useQuery(EDITIONS)
  const [enEdition, setEnEdition] = useState<Edition | null>(null)
  const [nouvelle, setNouvelle] = useState(false)
  const [form] = Form.useForm<Valeurs>()
  const [modifier, modification] = useMutation(MODIFIER, {
    refetchQueries: [EDITIONS, EDITION_COURANTE],
  })
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

  const ouvrir = (edition: Edition) => {
    setEnEdition(edition)
    form.setFieldsValue({
      annee: edition.annee,
      nom: edition.nom,
      debut: edition.debut.slice(0, 10),
      fin: edition.fin.slice(0, 10),
      statut: edition.statut,
    })
  }

  const enregistrer = async (valeurs: Valeurs) => {
    const { debut, fin } = valeurs
    try {
      if (enEdition) {
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
        onClick={() => setNouvelle(true)}
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
        title={t`Modifier ${laPeriode}`}
        okText={t`Enregistrer`}
        cancelText={t`Annuler`}
        confirmLoading={modification.loading}
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
          <ChampsEdition anneeModifiable={false} />
          <Form.Item
            label={t`Statut`}
            name="statut"
            extra={t`Archiver ${unePeriode} passe ses tâches en lecture seule. Ses demandes pour rejoindre l’équipe sont supprimées la nuit suivante ; les comptes et les affectations restent.`}
          >
            <Select
              options={Object.entries(STATUTS).map(([value, { libelle }]) => ({
                value,
                label: libelle,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <NouvelleEdition ouverte={nouvelle} onFermer={() => setNouvelle(false)} />
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
