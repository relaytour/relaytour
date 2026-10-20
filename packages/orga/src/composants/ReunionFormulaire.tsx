import { useMutation, useQuery } from '@apollo/client/react'
import { App, Form, Input, Modal, Radio, Select } from 'antd'
import { useEffect } from 'react'

import { graphql } from '../gql'
import type { CibleConvocation } from '../gql/graphql'
import { lireConflit } from '../lib/conflit'
import { messageErreur } from '../lib/erreurs'

const CREER = graphql(`
  mutation CreerReunion(
    $editionId: ID!
    $perimetreId: ID
    $titre: String!
    $jour: Date!
    $heureDebut: String!
    $heureFin: String!
    $lieu: String
    $lienVisio: String
    $description: String
    $tacheIds: [ID!]
    $cible: CibleConvocation
    $personneIds: [ID!]
  ) {
    creerReunion(
      editionId: $editionId
      perimetreId: $perimetreId
      titre: $titre
      jour: $jour
      heureDebut: $heureDebut
      heureFin: $heureFin
      lieu: $lieu
      lienVisio: $lienVisio
      description: $description
      tacheIds: $tacheIds
      cible: $cible
      personneIds: $personneIds
    ) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierReunion(
    $id: ID!
    $titre: String!
    $jour: Date!
    $heureDebut: String!
    $heureFin: String!
    $lieu: String
    $lienVisio: String
    $description: String
    $tacheIds: [ID!]
    $cible: CibleConvocation
    $personneIds: [ID!]
    $versionAttendue: Int
  ) {
    modifierReunion(
      id: $id
      titre: $titre
      jour: $jour
      heureDebut: $heureDebut
      heureFin: $heureFin
      lieu: $lieu
      lienVisio: $lienVisio
      description: $description
      tacheIds: $tacheIds
      cible: $cible
      personneIds: $personneIds
      versionAttendue: $versionAttendue
    ) {
      id
    }
  }
`)

// Les tâches de la période, pour les lier à la réunion. Le rétroplanning les
// liste toutes, rangées dans leur périmètre.
const TACHES = graphql(`
  query TachesPourReunion($editionId: ID!) {
    retroplanning(editionId: $editionId) {
      id
      titre
      perimetre {
        id
        nom
      }
    }
  }
`)

const CONVOCABLES = graphql(`
  query PersonnesConvocables($editionId: ID!, $perimetreId: ID) {
    personnesConvocables(editionId: $editionId, perimetreId: $perimetreId) {
      personneId
      nom
      duPerimetre
    }
  }
`)

/** Un agenda où la personne écrit : l'agenda global (`null`) ou un périmètre. */
export interface AgendaEcrit {
  perimetreId: string | null
  nom: string
}

/** Les champs lus d'une réunion existante. */
export interface ReunionSaisie {
  id: string
  perimetreId: string | null
  titre: string
  jour: string
  heureDebut: string
  heureFin: string
  lieu?: string | null
  lienVisio?: string | null
  description?: string | null
  tacheIds: string[]
  cible?: CibleConvocation | null
  personneIds: string[]
  version: number
}

/** Ce que la fenêtre préremplit pour une nouvelle réunion. */
export interface NouvelleReunion {
  perimetreId: string | null
  titre?: string
  tacheIds?: string[]
}

type Cible = CibleConvocation | 'AUCUNE'

interface Valeurs {
  agenda: string
  titre: string
  jour: string
  heureDebut: string
  heureFin: string
  lieu?: string
  lienVisio?: string
  description?: string
  tacheIds: string[]
  cible: Cible
  personneIds: string[]
}

export const TITRE_REUNION_MAX = 200
// L'agenda global n'a pas d'identifiant : la valeur du choix le remplace.
const GLOBAL = 'global'

/**
 * Fenêtre de création ou de modification d'une réunion (ADR 0037). L'horaire se
 * saisit dans le fuseau de l'organisation, que le serveur applique.
 */
export default function ReunionFormulaire({
  editionId,
  agendas,
  reunion,
  onFermer,
}: {
  editionId: string
  /** Les agendas où la personne écrit : l'agenda global, ses périmètres. */
  agendas: AgendaEcrit[]
  /** La réunion à modifier, une nouvelle réunion préremplie, ou `null` pour fermer. */
  reunion: ReunionSaisie | NouvelleReunion | null
  onFermer: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Valeurs>()
  const relire = {
    refetchQueries: ['Agenda', 'Reunions', 'ReunionsDuPerimetre', 'Reunion'],
  }
  const [creer, creation] = useMutation(CREER, relire)
  const [modifier, modification] = useMutation(MODIFIER, relire)
  const existante = reunion !== null && 'id' in reunion ? reunion : null
  const agenda = Form.useWatch('agenda', form) ?? GLOBAL
  const cible = Form.useWatch('cible', form) ?? 'AUCUNE'
  const perimetreId = agenda === GLOBAL ? null : agenda
  const { data: taches } = useQuery(TACHES, {
    variables: { editionId },
    skip: reunion === null,
  })
  const { data: convocables } = useQuery(CONVOCABLES, {
    variables: { editionId, perimetreId },
    skip: reunion === null || cible !== 'CHOIX',
  })

  useEffect(() => {
    if (reunion === null) return
    form.setFieldsValue(
      'id' in reunion
        ? {
            agenda: reunion.perimetreId ?? GLOBAL,
            titre: reunion.titre,
            jour: reunion.jour,
            heureDebut: reunion.heureDebut,
            heureFin: reunion.heureFin,
            lieu: reunion.lieu ?? '',
            lienVisio: reunion.lienVisio ?? '',
            description: reunion.description ?? '',
            tacheIds: reunion.tacheIds,
            cible: reunion.cible ?? 'AUCUNE',
            personneIds: reunion.personneIds,
          }
        : {
            agenda: reunion.perimetreId ?? GLOBAL,
            titre: reunion.titre ?? '',
            jour: '',
            heureDebut: '18:00',
            heureFin: '19:00',
            lieu: '',
            lienVisio: '',
            description: '',
            tacheIds: reunion.tacheIds ?? [],
            cible: reunion.perimetreId === null ? 'EQUIPE' : 'PERIMETRE',
            personneIds: [],
          }
    )
  }, [form, reunion, agendas])

  const optionsTaches = (taches?.retroplanning ?? [])
    .filter(t => perimetreId === null || t.perimetre.id === perimetreId)
    .map(t => ({
      value: t.id,
      label: perimetreId === null ? `${t.titre} · ${t.perimetre.nom}` : t.titre,
    }))

  const enregistrer = async (v: Valeurs) => {
    const champs = {
      titre: v.titre,
      jour: v.jour,
      heureDebut: v.heureDebut,
      heureFin: v.heureFin,
      lieu: v.lieu ?? '',
      lienVisio: v.lienVisio ?? '',
      description: v.description ?? '',
      tacheIds: v.tacheIds,
      cible: v.cible === 'AUCUNE' ? null : v.cible,
      personneIds: v.cible === 'CHOIX' ? v.personneIds : [],
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
        message.success('Réunion enregistrée.')
      } else {
        await creer({
          variables: {
            editionId,
            perimetreId: v.agenda === GLOBAL ? null : v.agenda,
            ...champs,
          },
        })
        message.success(
          champs.cible === null
            ? 'Réunion ajoutée à l’agenda.'
            : 'Réunion ajoutée. Les convocations partent dans deux minutes.'
        )
      }
      onFermer()
    } catch (e) {
      if (lireConflit(e) !== null) {
        message.error(
          'Une autre personne a modifié cette réunion depuis votre lecture. L’agenda affiche maintenant sa version : reprenez votre modification.'
        )
        onFermer()
        return
      }
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={reunion !== null}
      title={existante ? 'Modifier la réunion' : 'Nouvelle réunion'}
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
        <Form.Item label="Agenda" name="agenda">
          <Select
            disabled={existante !== null}
            options={agendas.map(a => ({
              value: a.perimetreId ?? GLOBAL,
              label: a.nom,
            }))}
            onChange={(valeur: string) =>
              form.setFieldsValue({
                tacheIds: [],
                personneIds: [],
                cible: valeur === GLOBAL ? 'EQUIPE' : 'PERIMETRE',
              })
            }
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
            {
              max: TITRE_REUNION_MAX,
              message: `Le titre dépasse ${TITRE_REUNION_MAX} caractères.`,
            },
          ]}
        >
          <Input placeholder="Point d’étape du pôle" />
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
            rules={[{ required: true, message: 'Choisissez une heure.' }]}
          >
            <Input type="time" style={{ maxWidth: 130 }} />
          </Form.Item>
          <Form.Item
            label="Fin"
            name="heureFin"
            dependencies={['heureDebut']}
            rules={[
              { required: true, message: 'Choisissez une heure.' },
              ({ getFieldValue }) => ({
                validator: (_regle, valeur?: string) =>
                  !valeur || valeur > String(getFieldValue('heureDebut'))
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error('L’heure de fin suit l’heure de début.')
                      ),
              }),
            ]}
          >
            <Input type="time" style={{ maxWidth: 130 }} />
          </Form.Item>
        </div>
        <Form.Item label="Lieu (facultatif)" name="lieu">
          <Input placeholder="Salle des associations" />
        </Form.Item>
        <Form.Item
          label="Lien de visio (facultatif)"
          name="lienVisio"
          rules={[
            {
              type: 'url',
              message: 'Saisissez une adresse complète, en https://.',
            },
          ]}
        >
          <Input placeholder="https://" inputMode="url" />
        </Form.Item>
        <Form.Item label="Description (facultative)" name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} />
        </Form.Item>
        <Form.Item
          label="Tâches liées (facultatives)"
          name="tacheIds"
          rules={[
            {
              type: 'array',
              max: 20,
              message: 'Une réunion lie 20 tâches au plus.',
            },
          ]}
        >
          <Select
            mode="multiple"
            allowClear
            optionFilterProp="label"
            placeholder="Choisir des tâches de la période"
            options={optionsTaches}
          />
        </Form.Item>
        <Form.Item label="Personnes convoquées" name="cible">
          <Radio.Group
            options={[
              ...(perimetreId === null
                ? []
                : [{ value: 'PERIMETRE', label: 'Tout le périmètre' }]),
              { value: 'EQUIPE', label: 'Toute l’équipe' },
              { value: 'CHOIX', label: 'Des personnes choisies' },
              { value: 'AUCUNE', label: 'Personne' },
            ]}
          />
        </Form.Item>
        {cible === 'CHOIX' && (
          <Form.Item
            name="personneIds"
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: 'Choisissez au moins une personne.',
              },
            ]}
          >
            <Select
              mode="multiple"
              optionFilterProp="label"
              placeholder="Choisir des personnes de l’équipe"
              options={(convocables?.personnesConvocables ?? []).map(p => ({
                value: p.personneId,
                label: p.duPerimetre ? `${p.nom} · du périmètre` : p.nom,
              }))}
            />
          </Form.Item>
        )}
        {cible !== 'AUCUNE' && (
          <p className="rt-note" style={{ marginTop: -8 }}>
            Chaque personne convoquée reçoit un mail avec la réunion à ajouter à
            son agenda, et répond dans l’espace organisateur.
          </p>
        )}
      </Form>
    </Modal>
  )
}
