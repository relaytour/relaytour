import { useMutation, useQuery } from '@apollo/client/react'
import { Alert, Form, Input, Modal } from 'antd'
import { useEffect } from 'react'

import type { TacheChampsFragment } from '../gql/graphql'
import {
  DECLINAISONS_TACHE,
  DECLINER_TACHE,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

import ChoixPerimetresCibles, {
  type PerimetreCible,
} from './ChoixPerimetresCibles'

interface Valeurs {
  cibles: string[]
  titre?: string
  echeance?: string
}

/** Le texte qui dit ce que devient une tâche dans les périmètres choisis. */
export function AideDeclinaison({ estAdmin }: { estAdmin: boolean }) {
  return (
    <p className="rt-texte-secondaire" style={{ marginTop: 0 }}>
      Chaque périmètre choisi reçoit sa propre tâche, avec son statut et ses
      personnes assignées. Vous suivez leur avancement depuis cette tâche.{' '}
      {estAdmin
        ? 'Comme admin de l’activité, vous ajoutez ces tâches sans attendre l’accord des périmètres.'
        : 'Les référentes et référents de chaque périmètre acceptent ou refusent la tâche. Elle entre sans attendre dans un périmètre où vous êtes vous-même affecté·e.'}
    </p>
  )
}

/**
 * Décline une tâche du périmètre dans d'autres périmètres de l'activité
 * (ADR 0026). Un périmètre déjà servi n'est plus proposé.
 */
export default function DeclinerTache({
  tache,
  dejaPartagee,
  perimetres,
  estAdmin,
  onFermer,
}: {
  tache: TacheChampsFragment | null
  /** Vrai quand la tâche a déjà des déclinaisons : leurs périmètres ne se proposent plus. */
  dejaPartagee: boolean
  perimetres: PerimetreCible[]
  estAdmin: boolean
  onFermer: () => void
}) {
  const [form] = Form.useForm<Valeurs>()
  const executer = useActionTache()
  const { data, error } = useQuery(DECLINAISONS_TACHE, {
    variables: { id: tache?.id ?? '' },
    skip: tache === null || !dejaPartagee,
  })
  // Une tâche déjà partagée ne propose que les périmètres qui ne l'ont pas : tant
  // que leur liste n'est pas lue, le formulaire reste fermé.
  const servisConnus = !dejaPartagee || data?.tache != null
  const [decliner, declinaison] = useMutation(DECLINER_TACHE, {
    refetchQueries: VUES_TACHES,
  })
  useEffect(() => {
    if (tache !== null)
      form.setFieldsValue({ cibles: [], titre: '', echeance: '' })
  }, [tache, form])

  const servis = new Set(
    (data?.tache?.declinaisons ?? []).map(d => d.perimetre.id)
  )
  const libres = perimetres.filter(p => !servis.has(p.id))

  const enregistrer = async (v: Valeurs) => {
    if (tache === null) return
    const ok = await executer(
      () =>
        decliner({
          variables: {
            id: tache.id,
            perimetreIds: v.cibles,
            titre: v.titre?.trim() || null,
            echeance: v.echeance || null,
          },
        }),
      estAdmin
        ? 'La tâche est ajoutée aux périmètres choisis.'
        : 'La tâche est partagée avec les périmètres choisis.'
    )
    if (ok) onFermer()
  }

  return (
    <Modal
      open={tache !== null}
      title="Décliner dans d’autres périmètres"
      okText={estAdmin ? 'Ajouter' : 'Proposer'}
      cancelText="Annuler"
      confirmLoading={declinaison.loading}
      okButtonProps={{ disabled: !servisConnus }}
      onOk={() => form.submit()}
      onCancel={onFermer}
      destroyOnHidden
      rootClassName="rt-modale-pleine"
    >
      {tache !== null && (
        <>
          <p style={{ fontWeight: 600 }}>« {tache.titre} »</p>
          <AideDeclinaison estAdmin={estAdmin} />
          {!servisConnus && error && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title="Les périmètres qui portent déjà cette tâche n’ont pas pu être chargés."
              description="Fermez cette fenêtre et réessayez dans un instant."
            />
          )}
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={v => void enregistrer(v)}
          >
            <Form.Item
              label="Périmètres"
              name="cibles"
              extra={
                libres.length === 0
                  ? 'Tous les périmètres de l’activité portent déjà cette tâche.'
                  : undefined
              }
              rules={[
                {
                  required: true,
                  type: 'array',
                  min: 1,
                  message: 'Choisissez au moins un périmètre.',
                },
              ]}
            >
              <ChoixPerimetresCibles
                perimetres={libres}
                disabled={libres.length === 0 || !servisConnus}
              />
            </Form.Item>
            <Form.Item
              label="Titre dans ces périmètres (facultatif)"
              name="titre"
              extra="Sans titre, les périmètres reçoivent celui de cette tâche."
              rules={[
                { max: 200, message: 'Le titre dépasse 200 caractères.' },
              ]}
            >
              <Input placeholder={tache.titre} />
            </Form.Item>
            <Form.Item
              label="Échéance dans ces périmètres (facultatif)"
              name="echeance"
              extra="Sans date, les périmètres reçoivent l’échéance de cette tâche."
            >
              <Input type="date" style={{ maxWidth: 200 }} />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  )
}
