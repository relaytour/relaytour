import { useMutation } from '@apollo/client/react'
import { Checkbox, Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'

import type { TacheChampsFragment } from '../gql/graphql'
import {
  CREER_TACHE,
  MODIFIER_TACHE,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

export interface FicheChoix {
  id: string
  titre: string
}

interface Valeurs {
  ficheId?: string | null
  titre: string
  description?: string
  echeance?: string
  mAssigner?: boolean
}

/** Création (tache = 'nouvelle') ou modification d'une tâche. */
export default function TacheFormulaire({
  tache,
  perimetreId,
  editionId,
  fiches = [],
  onFermer,
  onEnregistree,
}: {
  /** Fiches liables : celles du périmètre et les fiches communes. */
  fiches?: FicheChoix[]
  tache: TacheChampsFragment | 'nouvelle' | null
  perimetreId: string
  editionId: string
  onFermer: () => void
  onEnregistree: () => void
}) {
  const [form] = Form.useForm<Valeurs>()
  const executer = useActionTache()
  const [creer, creation] = useMutation(CREER_TACHE, {
    refetchQueries: VUES_TACHES,
  })
  const [modifier, modification] = useMutation(MODIFIER_TACHE, {
    refetchQueries: VUES_TACHES,
  })

  useEffect(() => {
    if (tache === null) return
    form.setFieldsValue(
      tache === 'nouvelle'
        ? {
            titre: '',
            description: '',
            echeance: '',
            ficheId: null,
            mAssigner: true,
          }
        : {
            ficheId: tache.fiche?.id ?? null,
            titre: tache.titre,
            description: tache.description ?? '',
            echeance: tache.echeance?.slice(0, 10) ?? '',
          }
    )
  }, [tache, form])

  const enregistrer = async (v: Valeurs) => {
    const commun = {
      titre: v.titre,
      description: v.description?.trim() || null,
      echeance: v.echeance || null,
      ficheId: v.ficheId ?? null,
    }
    const ok =
      tache === 'nouvelle'
        ? await executer(
            () =>
              creer({
                variables: {
                  ...commun,
                  perimetreId,
                  editionId,
                  mAssigner: v.mAssigner ?? false,
                },
              }),
            'Tâche créée.'
          )
        : tache
          ? await executer(
              confirmer =>
                modifier({ variables: { ...commun, id: tache.id, confirmer } }),
              'Tâche enregistrée.'
            )
          : false
    if (ok) onEnregistree()
  }

  return (
    <Modal
      open={tache !== null}
      title={tache === 'nouvelle' ? 'Nouvelle tâche' : 'Modifier la tâche'}
      okText="Enregistrer"
      cancelText="Annuler"
      confirmLoading={creation.loading || modification.loading}
      onOk={() => form.submit()}
      onCancel={onFermer}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={v => void enregistrer(v)}
        requiredMark={false}
      >
        <Form.Item
          label="Titre"
          name="titre"
          rules={[
            { required: true, message: 'Saisissez un titre.' },
            { max: 200, message: 'Le titre dépasse 200 caractères.' },
          ]}
        >
          <Input placeholder="Réserver les lignes d’eau" />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} />
        </Form.Item>
        <Form.Item label="Échéance" name="echeance">
          <Input type="date" style={{ maxWidth: 200 }} />
        </Form.Item>
        {fiches.length > 0 && (
          <Form.Item label="Fiche méthode" name="ficheId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Lier une fiche (facultatif)"
              options={fiches.map(f => ({ value: f.id, label: f.titre }))}
            />
          </Form.Item>
        )}
        {tache === 'nouvelle' && (
          <Form.Item name="mAssigner" valuePropName="checked">
            <Checkbox>Je m’en occupe</Checkbox>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
