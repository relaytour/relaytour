import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Form, Input, Modal, Radio, Select } from 'antd'
import { useEffect } from 'react'

import { graphql } from '../gql'
import type { CibleConvocation } from '../gql/graphql'
import { lireConflit, relireApresConflit } from '../lib/conflit'
import { messageErreur } from '../lib/erreurs'
import { CONVOCABLES } from '../lib/requetes'

const CREER = graphql(`
  mutation CreerReunion(
    $editionId: ID!
    $perimetreId: ID
    $sondageId: ID
    $titre: String!
    $jour: Date!
    $jourFin: Date
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
      sondageId: $sondageId
      titre: $titre
      jour: $jour
      jourFin: $jourFin
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
    $jourFin: Date
    $heureDebut: String!
    $heureFin: String!
    $lieu: String
    $lienVisio: String
    $description: String
    $tacheIds: [ID!]
    $cible: CibleConvocation
    $personneIds: [ID!]
    $versionAttendue: Int!
  ) {
    modifierReunion(
      id: $id
      titre: $titre
      jour: $jour
      jourFin: $jourFin
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
  jourFin?: string | null
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
  /** Depuis un sondage clos (ADR 0037) : son créneau retenu et ses personnes. */
  jour?: string
  heureDebut?: string | null
  heureFin?: string | null
  cible?: CibleConvocation
  personneIds?: string[]
  sondageId?: string
}

type Cible = CibleConvocation | 'AUCUNE'

interface Valeurs {
  agenda: string
  titre: string
  jour: string
  jourFin?: string | null
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
  const { t } = useLingui()
  const longueurMaxTitre = TITRE_REUNION_MAX
  const { message } = App.useApp()
  const client = useApolloClient()
  const [form] = Form.useForm<Valeurs>()
  const relire = {
    refetchQueries: [
      'Agenda',
      'Reunions',
      'ReunionsDuPerimetre',
      'Reunion',
      'Sondages',
      'Sondage',
    ],
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
            jourFin:
              reunion.jourFin && reunion.jourFin !== reunion.jour
                ? reunion.jourFin
                : '',
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
            jour: reunion.jour ?? '',
            jourFin: '',
            heureDebut: reunion.heureDebut ?? '18:00',
            heureFin: reunion.heureFin ?? '19:00',
            lieu: '',
            lienVisio: '',
            description: '',
            tacheIds: reunion.tacheIds ?? [],
            cible:
              reunion.cible ??
              (reunion.perimetreId === null ? 'EQUIPE' : 'PERIMETRE'),
            personneIds: reunion.personneIds ?? [],
          }
    )
  }, [form, reunion])

  const optionsTaches = (taches?.retroplanning ?? [])
    .filter(tache => perimetreId === null || tache.perimetre.id === perimetreId)
    .map(tache => ({
      value: tache.id,
      label:
        perimetreId === null
          ? `${tache.titre} · ${tache.perimetre.nom}`
          : tache.titre,
    }))

  const enregistrer = async (v: Valeurs) => {
    const champs = {
      titre: v.titre,
      jour: v.jour,
      jourFin: v.jourFin ? v.jourFin : null,
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
        message.success(t`Réunion enregistrée.`)
      } else {
        await creer({
          variables: {
            editionId,
            perimetreId: v.agenda === GLOBAL ? null : v.agenda,
            sondageId:
              reunion !== null && !('id' in reunion)
                ? (reunion.sondageId ?? null)
                : null,
            ...champs,
          },
        })
        message.success(
          champs.cible === null
            ? t`Réunion ajoutée à l’agenda.`
            : t`Réunion ajoutée. Les convocations partent dans deux minutes.`
        )
      }
      onFermer()
    } catch (e) {
      if (lireConflit(e) !== null) {
        await relireApresConflit(
          client,
          relire.refetchQueries,
          texte => message.error(texte),
          {
            relu: t`Une autre personne a modifié cette réunion depuis votre lecture. L’agenda affiche maintenant sa version : reprenez votre modification.`,
            echec: t`La réunion n’a pas pu être rechargée. Votre saisie reste à l’écran : réessayez dans un instant.`,
          },
          onFermer
        )
        return
      }
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={reunion !== null}
      title={existante ? t`Modifier la réunion` : t`Nouvelle réunion`}
      okText={t`Enregistrer`}
      cancelText={t`Annuler`}
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
        <Form.Item label={t`Agenda`} name="agenda">
          <Select
            // Une réunion existante, ou née d'un sondage, garde son agenda : le
            // serveur exige l'agenda du sondage.
            disabled={
              existante !== null ||
              (reunion !== null &&
                'sondageId' in reunion &&
                !!reunion.sondageId)
            }
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
          label={t`Titre`}
          name="titre"
          rules={[
            {
              required: true,
              whitespace: true,
              message: t`Saisissez un titre.`,
            },
            {
              max: TITRE_REUNION_MAX,
              message: t`Le titre dépasse ${longueurMaxTitre} caractères.`,
            },
          ]}
        >
          <Input placeholder={t`Point d’étape du pôle`} />
        </Form.Item>
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16 }}>
          <Form.Item
            label={t({
              message: 'Jour',
              comment: 'Libellé : jour d’une réunion',
            })}
            name="jour"
            rules={[{ required: true, message: t`Choisissez un jour.` }]}
          >
            <Input type="date" style={{ maxWidth: 180 }} />
          </Form.Item>
          <Form.Item
            label={t`Dernier jour (facultatif)`}
            name="jourFin"
            dependencies={['jour']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_regle, valeur?: string) =>
                  !valeur || valeur >= String(getFieldValue('jour'))
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t`Le dernier jour suit le premier.`)
                      ),
              }),
            ]}
          >
            <Input type="date" style={{ maxWidth: 180 }} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16 }}>
          <Form.Item
            label={t({
              message: 'Début',
              comment: 'Libellé : heure de début d’une réunion',
            })}
            name="heureDebut"
            rules={[{ required: true, message: t`Choisissez une heure.` }]}
          >
            <Input type="time" style={{ maxWidth: 130 }} />
          </Form.Item>
          <Form.Item
            label={t({
              message: 'Fin',
              comment: 'Libellé : heure de fin d’une réunion',
            })}
            name="heureFin"
            dependencies={['heureDebut', 'jour', 'jourFin']}
            rules={[
              { required: true, message: t`Choisissez une heure.` },
              ({ getFieldValue }) => ({
                // Sur plusieurs jours, l'heure de fin vaut pour le dernier jour.
                validator: (_regle, valeur?: string) =>
                  !valeur ||
                  (getFieldValue('jourFin') &&
                    getFieldValue('jourFin') !== getFieldValue('jour')) ||
                  valeur > String(getFieldValue('heureDebut'))
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t`L’heure de fin suit l’heure de début.`)
                      ),
              }),
            ]}
          >
            <Input type="time" style={{ maxWidth: 130 }} />
          </Form.Item>
        </div>
        <Form.Item label={t`Lieu (facultatif)`} name="lieu">
          <Input placeholder={t`Salle des associations`} />
        </Form.Item>
        <Form.Item
          label={t`Lien de visio (facultatif)`}
          name="lienVisio"
          rules={[
            {
              type: 'url',
              message: t`Saisissez une adresse complète, en https://.`,
            },
          ]}
        >
          <Input placeholder="https://" inputMode="url" />
        </Form.Item>
        <Form.Item label={t`Description (facultative)`} name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} />
        </Form.Item>
        <Form.Item
          label={t`Tâches liées (facultatives)`}
          name="tacheIds"
          rules={[
            {
              type: 'array',
              max: 20,
              message: t`Une réunion lie 20 tâches au plus.`,
            },
          ]}
        >
          <Select
            mode="multiple"
            allowClear
            optionFilterProp="label"
            placeholder={t`Choisir des tâches de la période`}
            options={optionsTaches}
          />
        </Form.Item>
        <Form.Item label={t`Personnes convoquées`} name="cible">
          <Radio.Group
            options={[
              ...(perimetreId === null
                ? []
                : [{ value: 'PERIMETRE', label: t`Tout le périmètre` }]),
              { value: 'EQUIPE', label: t`Toute l’équipe` },
              { value: 'CHOIX', label: t`Des personnes choisies` },
              {
                value: 'AUCUNE',
                label: t({
                  message: 'Personne',
                  comment: 'Aucune personne convoquée',
                }),
              },
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
                message: t`Choisissez au moins une personne.`,
              },
            ]}
          >
            <Select
              mode="multiple"
              optionFilterProp="label"
              placeholder={t`Choisir des personnes de l’équipe`}
              options={(convocables?.personnesConvocables ?? []).map(p => ({
                value: p.personneId,
                label: p.duPerimetre ? `${p.nom} · ${t`du périmètre`}` : p.nom,
              }))}
            />
          </Form.Item>
        )}
        {cible !== 'AUCUNE' && (
          <p className="rt-note" style={{ marginTop: -8 }}>
            <Trans>
              Chaque personne convoquée reçoit un mail avec la réunion à ajouter
              à son agenda, et répond dans l’espace organisateur.
            </Trans>
          </p>
        )}
      </Form>
    </Modal>
  )
}
