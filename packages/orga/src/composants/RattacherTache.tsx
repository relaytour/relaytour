import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, Form, Modal, Select } from 'antd'
import { useEffect } from 'react'

import type { TacheChampsFragment } from '../gql/graphql'
import { dateCourte } from '../lib/erreurs'
import {
  DECLINAISONS_TACHE,
  RATTACHER_DECLINAISON,
  STATUTS,
  TACHES_A_RATTACHER,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

import type { PerimetreCible } from './ChoixPerimetresCibles'

interface Valeurs {
  perimetre?: string
  tache?: string
}

/**
 * Rattache une tâche existante d'un autre périmètre à cette tâche : elle en devient
 * la déclinaison, sans rien perdre de son statut, de ses personnes assignées ni de
 * son fil (ADR 0061). Seules les tâches que la personne peut rattacher se proposent.
 */
export default function RattacherTache({
  tache,
  dejaPartagee,
  perimetres,
  editionId,
  onFermer,
}: {
  tache: TacheChampsFragment | null
  /** Vrai quand la tâche a déjà des déclinaisons : leurs périmètres ne se proposent plus. */
  dejaPartagee: boolean
  perimetres: PerimetreCible[]
  editionId: string
  onFermer: () => void
}) {
  const { t } = useLingui()
  const [form] = Form.useForm<Valeurs>()
  const executer = useActionTache()
  const choisi = Form.useWatch('perimetre', form)
  const { data: servis, error: erreurServis } = useQuery(DECLINAISONS_TACHE, {
    variables: { id: tache?.id ?? '' },
    skip: tache === null || !dejaPartagee,
  })
  const servisConnus = !dejaPartagee || servis?.tache != null
  const slug = perimetres.find(p => p.id === choisi)?.slug
  const { data, loading, error } = useQuery(TACHES_A_RATTACHER, {
    variables: { slug: slug ?? '', editionId },
    skip: slug === undefined,
  })
  const [rattacher, rattachement] = useMutation(RATTACHER_DECLINAISON, {
    refetchQueries: [...VUES_TACHES, 'DeclinaisonsTache'],
  })
  useEffect(() => {
    if (tache !== null) form.resetFields()
  }, [tache, form])

  const dejaServis = new Set(
    (servis?.tache?.declinaisons ?? []).map(d => d.perimetre.id)
  )
  const libres = perimetres.filter(p => !dejaServis.has(p.id))
  // Une déclinaison ou une tâche partagée ne se rattache pas : le lien garde un
  // seul niveau (ADR 0026). Le serveur refuse aussi ce que la personne n'écrit pas.
  const candidates = (data?.perimetre?.taches ?? []).filter(
    x => x.peutModifier && !x.origine && x.resumeDeclinaisons.total === 0
  )

  const enregistrer = async (v: Valeurs) => {
    if (tache === null || v.tache === undefined) return
    const nomPerimetre = perimetres.find(p => p.id === v.perimetre)?.nom ?? ''
    const ok = await executer(
      () => rattacher({ variables: { id: tache.id, tacheId: v.tache ?? '' } }),
      t`La tâche du périmètre ${nomPerimetre} est rattachée.`
    )
    if (ok) onFermer()
  }

  const titreTache = tache?.titre
  return (
    <Modal
      open={tache !== null}
      title={t`Rattacher une tâche existante`}
      okText={t`Rattacher`}
      cancelText={t`Annuler`}
      confirmLoading={rattachement.loading}
      okButtonProps={{ disabled: !servisConnus }}
      onOk={() => form.submit()}
      onCancel={onFermer}
      destroyOnHidden
      rootClassName="rt-modale-pleine"
    >
      {tache !== null && (
        <>
          <p style={{ fontWeight: 600 }}>
            <Trans>« {titreTache} »</Trans>
          </p>
          <p className="rt-texte-secondaire" style={{ marginTop: 0 }}>
            <Trans>
              La tâche choisie devient une déclinaison de cette tâche. Elle
              garde son titre, son statut, ses personnes assignées et ses
              commentaires. Vous suivez son avancement depuis cette tâche, et
              vous pouvez la détacher plus tard.
            </Trans>
          </p>
          {!servisConnus && erreurServis && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title={t`Les périmètres qui portent déjà cette tâche n’ont pas pu être chargés.`}
              description={t`Fermez cette fenêtre et réessayez dans un instant.`}
            />
          )}
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={v => void enregistrer(v)}
            onValuesChange={changes => {
              if ('perimetre' in changes) form.setFieldValue('tache', undefined)
            }}
          >
            <Form.Item
              label={t`Périmètre`}
              name="perimetre"
              extra={
                libres.length === 0
                  ? t`Tous les périmètres de l’activité portent déjà cette tâche.`
                  : undefined
              }
              rules={[{ required: true, message: t`Choisissez un périmètre.` }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                disabled={libres.length === 0 || !servisConnus}
                placeholder={t`Choisir un périmètre`}
                options={libres.map(p => ({ value: p.id, label: p.nom }))}
              />
            </Form.Item>
            <Form.Item
              label={t`Tâche`}
              name="tache"
              extra={
                slug !== undefined &&
                !loading &&
                !error &&
                candidates.length === 0
                  ? t`Aucune tâche de ce périmètre ne peut être rattachée. Une déclinaison et une tâche partagée ne se rattachent pas.`
                  : error
                    ? t`Les tâches de ce périmètre n’ont pas pu être chargées.`
                    : undefined
              }
              rules={[{ required: true, message: t`Choisissez une tâche.` }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={loading}
                disabled={slug === undefined || candidates.length === 0}
                placeholder={t`Choisir une tâche`}
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
