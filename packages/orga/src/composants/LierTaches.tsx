import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Form, Modal, Select } from 'antd'
import { useEffect } from 'react'

import { dateCourte } from '../lib/erreurs'
import {
  LIER_TACHES,
  STATUTS,
  TACHES_A_LIER,
  TACHES_DU_JALON,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

interface Valeurs {
  perimetre?: string
  taches?: string[]
}

/** Un périmètre où chercher les tâches à lier : celui du jalon, ou un autre. */
export interface PerimetreDesTaches {
  id: string
  slug: string
  nom: string
}

/**
 * Lie à un jalon des tâches de la même période, dans son périmètre ou dans un autre
 * périmètre de l'activité (ADR 0062). Le lien ne change pas la tâche liée : il
 * suffit de consulter son périmètre.
 */
export default function LierTaches({
  jalon,
  perimetres,
  editionId,
  onFermer,
}: {
  jalon: { id: string; titre: string } | null
  /** Le périmètre du jalon d'abord, puis les autres périmètres de l'activité. */
  perimetres: PerimetreDesTaches[]
  editionId: string
  onFermer: () => void
}) {
  const { t } = useLingui()
  const [form] = Form.useForm<Valeurs>()
  const executer = useActionTache()
  const choisi = Form.useWatch('perimetre', form)
  const slug = perimetres.find(p => p.id === choisi)?.slug
  const { data: liees } = useQuery(TACHES_DU_JALON, {
    variables: { id: jalon?.id ?? '' },
    skip: jalon === null,
  })
  const { data, loading, error } = useQuery(TACHES_A_LIER, {
    variables: { slug: slug ?? '', editionId },
    skip: slug === undefined,
  })
  const [lier, liaison] = useMutation(LIER_TACHES, {
    refetchQueries: [...VUES_TACHES, 'TachesDuJalon'],
  })
  useEffect(() => {
    if (jalon !== null) form.resetFields()
  }, [jalon, form])

  const dejaLiees = new Set((liees?.tache?.tachesLiees ?? []).map(x => x.id))
  // Le jalon ne se lie pas à lui-même, et une tâche déjà liée ne se propose plus.
  const candidates = (data?.perimetre?.taches ?? []).filter(
    x => x.id !== jalon?.id && !dejaLiees.has(x.id)
  )

  const enregistrer = async (v: Valeurs) => {
    if (jalon === null || (v.taches ?? []).length === 0) return
    const ok = await executer(
      () => lier({ variables: { id: jalon.id, tacheIds: v.taches ?? [] } }),
      t`Les tâches sont liées au jalon.`
    )
    if (ok) onFermer()
  }

  const titreJalon = jalon?.titre
  return (
    <Modal
      open={jalon !== null}
      title={t`Lier des tâches au jalon`}
      okText={t`Lier`}
      cancelText={t`Annuler`}
      confirmLoading={liaison.loading}
      onOk={() => form.submit()}
      onCancel={onFermer}
      destroyOnHidden
      rootClassName="rt-modale-pleine"
    >
      {jalon !== null && (
        <>
          <p style={{ fontWeight: 600 }}>
            <Trans>« {titreJalon} »</Trans>
          </p>
          <p className="rt-texte-secondaire" style={{ marginTop: 0 }}>
            <Trans>
              Les tâches choisies comptent dans le décompte du jalon. Elles ne
              changent pas, et leur périmètre voit le jalon qu’elles servent.
              Choisissez un périmètre, puis une ou plusieurs tâches.
            </Trans>
          </p>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={v => void enregistrer(v)}
            onValuesChange={changes => {
              if ('perimetre' in changes) form.setFieldValue('taches', [])
            }}
          >
            <Form.Item
              label={t`Périmètre`}
              name="perimetre"
              rules={[{ required: true, message: t`Choisissez un périmètre.` }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t`Choisir un périmètre`}
                options={perimetres.map(p => ({ value: p.id, label: p.nom }))}
              />
            </Form.Item>
            <Form.Item
              label={t`Tâches`}
              name="taches"
              extra={
                error
                  ? t`Les tâches de ce périmètre n’ont pas pu être chargées.`
                  : slug !== undefined && !loading && candidates.length === 0
                    ? t`Toutes les tâches de ce périmètre sont déjà liées à ce jalon.`
                    : undefined
              }
              rules={[
                {
                  required: true,
                  type: 'array',
                  min: 1,
                  message: t`Choisissez au moins une tâche.`,
                },
              ]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                loading={loading}
                disabled={slug === undefined || candidates.length === 0}
                placeholder={t`Choisir des tâches`}
                options={candidates.map(x => ({
                  value: x.id,
                  label: [
                    x.titre,
                    STATUTS[x.statut].libelle,
                    x.echeance ? dateCourte(x.echeance) : null,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                }))}
              />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  )
}
