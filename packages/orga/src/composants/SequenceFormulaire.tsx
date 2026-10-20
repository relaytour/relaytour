import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Form, Input, Modal, Radio, Select } from 'antd'
import { useEffect } from 'react'

import { graphql } from '../gql'
import type { RolePlace } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import type { AgendaEcrit } from '../lib/agendas-ecrits'
import { lireConflit } from '../lib/conflit'
import { messageErreur } from '../lib/erreurs'
import { BENEVOLES, CONVOCABLES, LIEUX } from '../lib/requetes'

const CREER = graphql(`
  mutation CreerSequence(
    $editionId: ID!
    $perimetreId: ID
    $lieuId: ID
    $titre: String!
    $jour: Date!
    $jourFin: Date
    $heureDebut: String!
    $heureFin: String!
    $description: String
    $places: [PlaceSequenceInput!]
  ) {
    creerSequence(
      editionId: $editionId
      perimetreId: $perimetreId
      lieuId: $lieuId
      titre: $titre
      jour: $jour
      jourFin: $jourFin
      heureDebut: $heureDebut
      heureFin: $heureFin
      description: $description
      places: $places
    ) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierSequence(
    $id: ID!
    $lieuId: ID
    $titre: String!
    $jour: Date!
    $jourFin: Date
    $heureDebut: String!
    $heureFin: String!
    $description: String
    $places: [PlaceSequenceInput!]
    $versionAttendue: Int
  ) {
    modifierSequence(
      id: $id
      lieuId: $lieuId
      titre: $titre
      jour: $jour
      jourFin: $jourFin
      heureDebut: $heureDebut
      heureFin: $heureFin
      description: $description
      places: $places
      versionAttendue: $versionAttendue
    ) {
      id
    }
  }
`)

export interface PlaceSaisie {
  /** `p:<compte>` pour une personne de l'équipe, `b:<fiche>` pour une ou un bénévole. */
  personne: string
  role: RolePlace
}

/** Une séquence existante, pour la modification. */
export interface SequenceSaisie {
  id: string
  perimetreId: string | null
  lieuId: string | null
  titre: string
  jour: string
  jourFin: string
  heureDebut: string
  heureFin: string
  description?: string | null
  places: PlaceSaisie[]
  version: number
}

export interface NouvelleSequence {
  perimetreId: string | null
  jour?: string
  lieuId?: string | null
}

interface Valeurs {
  agenda: string
  titre: string
  jour: string
  jourFin?: string
  heureDebut: string
  heureFin: string
  lieuId?: string | null
  description?: string
  places: PlaceSaisie[]
}

const GLOBAL = 'global'

/** Fenêtre de création ou de modification d'une séquence du programme (ADR 0040). */
export default function SequenceFormulaire({
  editionId,
  agendas,
  sequence,
  onFermer,
}: {
  editionId: string
  agendas: AgendaEcrit[]
  sequence: SequenceSaisie | NouvelleSequence | null
  onFermer: () => void
}) {
  const { message } = App.useApp()
  const { activite } = useActivite()
  const [form] = Form.useForm<Valeurs>()
  const relire = { refetchQueries: ['Programme', 'ProgrammePerimetre'] }
  const [creer, creation] = useMutation(CREER, relire)
  const [modifier, modification] = useMutation(MODIFIER, relire)
  const existante = sequence !== null && 'id' in sequence ? sequence : null
  const agenda = Form.useWatch('agenda', form) ?? GLOBAL
  const perimetreId = agenda === GLOBAL ? null : agenda
  const ouvert = sequence !== null
  const { data: lieux } = useQuery(LIEUX, {
    variables: { activiteId: activite.id },
    skip: !ouvert,
  })
  const { data: equipe } = useQuery(CONVOCABLES, {
    variables: { editionId, perimetreId },
    skip: !ouvert,
  })
  const { data: benevoles } = useQuery(BENEVOLES, {
    variables: { activiteId: activite.id },
    skip: !ouvert,
  })

  useEffect(() => {
    if (sequence === null) return
    form.setFieldsValue(
      'id' in sequence
        ? {
            agenda: sequence.perimetreId ?? GLOBAL,
            titre: sequence.titre,
            jour: sequence.jour,
            jourFin: sequence.jourFin === sequence.jour ? '' : sequence.jourFin,
            heureDebut: sequence.heureDebut,
            heureFin: sequence.heureFin,
            lieuId: sequence.lieuId,
            description: sequence.description ?? '',
            places: sequence.places,
          }
        : {
            agenda: sequence.perimetreId ?? GLOBAL,
            titre: '',
            jour: sequence.jour ?? '',
            jourFin: '',
            heureDebut: '09:00',
            heureFin: '10:00',
            lieuId: sequence.lieuId ?? null,
            description: '',
            places: [],
          }
    )
  }, [form, sequence])

  const optionsPersonnes = [
    {
      label: 'Équipe',
      options: (equipe?.personnesConvocables ?? []).map(p => ({
        value: `p:${p.personneId}`,
        label: p.duPerimetre ? `${p.nom} · du périmètre` : p.nom,
      })),
    },
    {
      label: 'Bénévoles',
      options: (benevoles?.benevoles ?? []).map(b => ({
        value: `b:${b.id}`,
        label: `${b.nom} · bénévole`,
      })),
    },
  ]

  const enregistrer = async (v: Valeurs) => {
    const champs = {
      titre: v.titre,
      jour: v.jour,
      jourFin: v.jourFin ? v.jourFin : null,
      heureDebut: v.heureDebut,
      heureFin: v.heureFin,
      lieuId: v.lieuId ?? null,
      description: v.description ?? '',
      places: (v.places ?? [])
        .filter(p => p?.personne)
        .map(p =>
          p.personne.startsWith('b:')
            ? { benevoleId: p.personne.slice(2), role: p.role }
            : { personneId: p.personne.slice(2), role: p.role }
        ),
    }
    try {
      if (existante) {
        await modifier({
          variables: {
            id: existante.id,
            versionAttendue: existante.version,
            ...champs,
          },
        })
        message.success('Séquence enregistrée.')
      } else {
        await creer({
          variables: {
            editionId,
            perimetreId: v.agenda === GLOBAL ? null : v.agenda,
            ...champs,
          },
        })
        message.success('Séquence ajoutée au programme.')
      }
      onFermer()
    } catch (e) {
      if (lireConflit(e) !== null) {
        message.error(
          'Une autre personne a modifié cette séquence depuis votre lecture. Le programme affiche maintenant sa version : reprenez votre modification.'
        )
        onFermer()
        return
      }
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouvert}
      title={existante ? 'Modifier la séquence' : 'Nouvelle séquence'}
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
        <Form.Item label="Périmètre" name="agenda">
          <Select
            disabled={existante !== null}
            options={agendas.map(a => ({
              value: a.perimetreId ?? GLOBAL,
              label: a.nom,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="Titre"
          name="titre"
          rules={[
            {
              required: true,
              whitespace: true,
              message: 'Saisissez un titre.',
            },
            { max: 200, message: 'Le titre dépasse 200 caractères.' },
          ]}
        >
          <Input placeholder="Matchs de poule" />
        </Form.Item>
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16 }}>
          <Form.Item
            label="Jour"
            name="jour"
            rules={[{ required: true, message: 'Choisissez un jour.' }]}
          >
            <Input type="date" style={{ maxWidth: 180 }} />
          </Form.Item>
          <Form.Item
            label="Début"
            name="heureDebut"
            rules={[{ required: true }]}
          >
            <Input type="time" style={{ maxWidth: 130 }} />
          </Form.Item>
          <Form.Item label="Fin" name="heureFin" rules={[{ required: true }]}>
            <Input type="time" style={{ maxWidth: 130 }} />
          </Form.Item>
          <Form.Item
            label="Le lendemain (facultatif)"
            name="jourFin"
            extra="Pour une séquence qui passe minuit."
          >
            <Input type="date" style={{ maxWidth: 180 }} />
          </Form.Item>
        </div>
        <Form.Item label="Lieu (facultatif)" name="lieuId">
          <Select
            allowClear
            placeholder="Choisir un lieu"
            options={(lieux?.lieux ?? []).map(l => ({
              value: l.id,
              label: l.nom,
            }))}
          />
        </Form.Item>
        <Form.Item label="Description (facultative)" name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
        </Form.Item>
        <Form.List name="places">
          {(champs, { add, remove }) => (
            <fieldset className="rt-sondage-creneaux">
              <legend>Personnes placées</legend>
              {champs.map(champ => (
                <div key={champ.key} className="rt-sequence-place">
                  <Form.Item
                    name={[champ.name, 'personne']}
                    rules={[
                      { required: true, message: 'Choisissez une personne.' },
                    ]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Une personne de l’équipe, ou une ou un bénévole"
                      aria-label="Personne"
                      options={optionsPersonnes}
                    />
                  </Form.Item>
                  <Form.Item name={[champ.name, 'role']} initialValue="RENFORT">
                    <Radio.Group
                      optionType="button"
                      size="small"
                      options={[
                        { value: 'RESPONSABLE', label: 'Responsable' },
                        { value: 'RENFORT', label: 'Renfort' },
                      ]}
                    />
                  </Form.Item>
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    aria-label="Retirer cette personne"
                    onClick={() => remove(champ.name)}
                  />
                </div>
              ))}
              <Button
                icon={<PlusOutlined />}
                disabled={champs.length >= 50}
                onClick={() => add({ personne: undefined, role: 'RENFORT' })}
              >
                Placer une personne
              </Button>
              <p className="rt-note">
                Une ou un bénévole sans compte se crée d’abord dans l’écran «
                Bénévoles ».
              </p>
            </fieldset>
          )}
        </Form.List>
      </Form>
    </Modal>
  )
}
