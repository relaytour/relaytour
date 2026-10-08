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

import ChoixPerimetresCibles, {
  type PerimetreCible,
} from './ChoixPerimetresCibles'
import { AideDeclinaison } from './DeclinerTache'

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
  // Tâche partagée (ADR 0026) : les périmètres où la décliner, et ce qu'ils
  // reçoivent quand il diffère de la tâche.
  cibles?: string[]
  titreDeclinaison?: string
  descriptionDeclinaison?: string
  echeanceDeclinaison?: string
}

/** Création (tache = 'nouvelle') ou modification d'une tâche. */
export default function TacheFormulaire({
  tache,
  perimetreId,
  editionId,
  fiches = [],
  perimetresCibles = [],
  estAdmin = false,
  onFermer,
  onEnregistree,
}: {
  /** Fiches liables : celles du périmètre et les fiches communes. */
  fiches?: FicheChoix[]
  tache: TacheChampsFragment | 'nouvelle' | null
  /** Les autres périmètres de l'activité, où décliner une tâche nouvelle. */
  perimetresCibles?: PerimetreCible[]
  /** Un admin de l'activité décline sans attendre l'accord des périmètres. */
  estAdmin?: boolean
  perimetreId: string
  editionId: string
  onFermer: () => void
  onEnregistree: () => void
}) {
  const [form] = Form.useForm<Valeurs>()
  const cibles = Form.useWatch('cibles', form) ?? []
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
            cibles: [],
            titreDeclinaison: '',
            descriptionDeclinaison: '',
            echeanceDeclinaison: '',
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
                  declinaison:
                    (v.cibles ?? []).length === 0
                      ? null
                      : {
                          perimetreIds: v.cibles ?? [],
                          titre: v.titreDeclinaison?.trim() || null,
                          description: v.descriptionDeclinaison?.trim() || null,
                          echeance: v.echeanceDeclinaison || null,
                        },
                },
              }),
            (v.cibles ?? []).length === 0
              ? 'Tâche créée.'
              : estAdmin
                ? 'Tâche créée et ajoutée aux périmètres choisis.'
                : 'Tâche créée et proposée aux périmètres choisis.'
          )
        : tache
          ? await executer(
              reprise =>
                modifier({
                  variables: {
                    ...commun,
                    id: tache.id,
                    confirmer: reprise.confirmer,
                    // La version lue à l'ouverture de la fenêtre : le serveur
                    // refuse d'écraser une modification faite depuis.
                    versionAttendue: reprise.versionAttendue ?? tache.version,
                  },
                }),
              'Tâche enregistrée.',
              { apresRechargement: onFermer }
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
      rootClassName="rt-modale-pleine"
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
        {tache === 'nouvelle' && perimetresCibles.length > 0 && (
          <>
            <Form.Item
              label="Décliner dans d’autres périmètres (facultatif)"
              name="cibles"
              extra="Un pôle demande par exemple la même tâche à chaque sport."
            >
              <ChoixPerimetresCibles perimetres={perimetresCibles} />
            </Form.Item>
            {cibles.length > 0 && (
              <>
                <AideDeclinaison estAdmin={estAdmin} />
                <Form.Item
                  label="Titre dans ces périmètres (facultatif)"
                  name="titreDeclinaison"
                  extra="Sans titre, les périmètres reçoivent celui de cette tâche."
                  rules={[
                    { max: 200, message: 'Le titre dépasse 200 caractères.' },
                  ]}
                >
                  <Input placeholder="Transmettre les besoins au pôle" />
                </Form.Item>
                <Form.Item
                  label="Description dans ces périmètres (facultatif)"
                  name="descriptionDeclinaison"
                >
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} />
                </Form.Item>
                <Form.Item
                  label="Échéance dans ces périmètres (facultatif)"
                  name="echeanceDeclinaison"
                >
                  <Input type="date" style={{ maxWidth: 200 }} />
                </Form.Item>
              </>
            )}
          </>
        )}
      </Form>
    </Modal>
  )
}
