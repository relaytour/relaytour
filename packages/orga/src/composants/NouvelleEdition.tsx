import { useMutation, useQuery } from '@apollo/client/react'
import { useLingui } from '@lingui/react/macro'
import { App, Form, Modal, Radio, Select, Space } from 'antd'
import { useState } from 'react'

import ChampsEdition from './ChampsEdition'
import ReconductionEdition, {
  type PeriodeReconduction,
} from './ReconductionEdition'
import TachesTypesEdition from './TachesTypesEdition'
import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { EDITION_COURANTE, EDITIONS } from '../lib/requetes'

// Création d'une période et choix de son point de départ (ADR 0048) : aucune
// tâche, les tâches types des périmètres, ou les tâches d'une autre période. Le
// point de départ ouvre ensuite la fenêtre qui montre ce qui sera créé. L'écran
// Éditions et la liste « Premiers pas » partagent cette fenêtre.

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

/** Point de départ d'une nouvelle période. */
type Depart = 'vide' | 'types' | 'reprendre'

interface Valeurs {
  annee: number
  nom: string
  debut: string
  fin: string
  depart: Depart
  source?: string
}

export default function NouvelleEdition({
  ouverte,
  onFermer,
}: {
  ouverte: boolean
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { Nom: Mot, Nouvelle, Pluriel, creee } = useActivite().periode
  const { data } = useQuery(EDITIONS)
  const periodes: PeriodeReconduction[] = (data?.editions ?? []).map(e => ({
    id: e.id,
    nom: e.nom,
  }))
  const [creer, creation] = useMutation(CREER, {
    refetchQueries: [EDITIONS, EDITION_COURANTE],
  })
  const [tachesTypesPour, setTachesTypesPour] =
    useState<PeriodeReconduction | null>(null)
  const [reconduction, setReconduction] = useState<{
    cible: PeriodeReconduction
    source?: string
  } | null>(null)

  const enregistrer = async (valeurs: Valeurs) => {
    try {
      const resultat = await creer({
        variables: {
          annee: valeurs.annee,
          nom: valeurs.nom,
          debut: valeurs.debut,
          fin: valeurs.fin,
        },
      })
      message.success(t`${Mot} ${creee}.`)
      onFermer()
      const id = resultat.data?.creerEdition.id
      if (id === undefined) return
      const nouvelle = { id, nom: valeurs.nom }
      if (valeurs.depart === 'types') setTachesTypesPour(nouvelle)
      if (valeurs.depart === 'reprendre') {
        setReconduction({ cible: nouvelle, source: valeurs.source })
      }
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Modal
        open={ouverte}
        title={Nouvelle}
        okText={t`Enregistrer`}
        cancelText={t`Annuler`}
        confirmLoading={creation.loading}
        okButtonProps={{ htmlType: 'submit', form: 'nouvelle-edition' }}
        onCancel={onFermer}
        destroyOnHidden
      >
        <Form<Valeurs>
          id="nouvelle-edition"
          layout="vertical"
          requiredMark={false}
          initialValues={{
            annee: new Date().getFullYear() + 1,
            depart: periodes.length > 0 ? 'reprendre' : 'vide',
            source: periodes[0]?.id,
          }}
          onFinish={v => void enregistrer(v)}
        >
          <ChampsEdition anneeModifiable />
          <Form.Item
            label={t`Partir de`}
            name="depart"
            extra={t`Vous pourrez aussi ajouter des tâches plus tard, depuis l’écran ${Pluriel}.`}
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
