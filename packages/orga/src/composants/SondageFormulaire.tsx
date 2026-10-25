import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Form, Input, Modal, Radio, Select } from 'antd'
import { useEffect } from 'react'

import { graphql } from '../gql'
import type { CibleConvocation } from '../gql/graphql'
import { lireConflit, relireApresConflit } from '../lib/conflit'
import { messageErreur } from '../lib/erreurs'

import { CONVOCABLES } from '../lib/requetes'

import type { AgendaEcrit } from './ReunionFormulaire'

const CREER = graphql(`
  mutation CreerSondage(
    $editionId: ID!
    $perimetreId: ID
    $titre: String!
    $description: String
    $creneaux: [CreneauSondageInput!]!
    $cible: CibleConvocation!
    $personneIds: [ID!]
  ) {
    creerSondage(
      editionId: $editionId
      perimetreId: $perimetreId
      titre: $titre
      description: $description
      creneaux: $creneaux
      cible: $cible
      personneIds: $personneIds
    ) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierSondage(
    $id: ID!
    $titre: String!
    $description: String
    $creneaux: [CreneauSondageInput!]!
    $versionAttendue: Int!
  ) {
    modifierSondage(
      id: $id
      titre: $titre
      description: $description
      creneaux: $creneaux
      versionAttendue: $versionAttendue
    ) {
      id
    }
  }
`)

export interface CreneauSaisi {
  id?: string
  jour: string
  heureDebut?: string | null
  heureFin?: string | null
}

/** Un sondage existant, pour la modification. */
export interface SondageSaisi {
  id: string
  perimetreId: string | null
  titre: string
  description?: string | null
  creneaux: CreneauSaisi[]
  version: number
}

/** Un nouveau sondage, dans un agenda choisi. */
export interface NouveauSondage {
  perimetreId: string | null
}

interface Valeurs {
  agenda: string
  titre: string
  description?: string
  creneaux: CreneauSaisi[]
  cible: CibleConvocation
  personneIds: string[]
}

const GLOBAL = 'global'
export const CRENEAUX_MAX = 20

/**
 * Fenêtre de création ou de modification d'un sondage de dates (ADR 0037). Un
 * créneau est un jour, avec un horaire facultatif. Retirer un créneau efface ses
 * réponses.
 */
export default function SondageFormulaire({
  editionId,
  agendas,
  sondage,
  onFermer,
}: {
  editionId: string
  agendas: AgendaEcrit[]
  sondage: SondageSaisi | NouveauSondage | null
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const client = useApolloClient()
  const [form] = Form.useForm<Valeurs>()
  const relire = { refetchQueries: ['Sondages', 'Sondage'] }
  const [creer, creation] = useMutation(CREER, relire)
  const [modifier, modification] = useMutation(MODIFIER, relire)
  const existant = sondage !== null && 'id' in sondage ? sondage : null
  const agenda = Form.useWatch('agenda', form) ?? GLOBAL
  const cible = Form.useWatch('cible', form)
  const perimetreId = agenda === GLOBAL ? null : agenda
  const { data: convocables } = useQuery(CONVOCABLES, {
    variables: { editionId, perimetreId },
    skip: sondage === null || existant !== null || cible !== 'CHOIX',
  })

  useEffect(() => {
    if (sondage === null) return
    form.setFieldsValue(
      'id' in sondage
        ? {
            agenda: sondage.perimetreId ?? GLOBAL,
            titre: sondage.titre,
            description: sondage.description ?? '',
            creneaux: sondage.creneaux.map(c => ({
              id: c.id,
              jour: c.jour,
              heureDebut: c.heureDebut ?? '',
              heureFin: c.heureFin ?? '',
            })),
          }
        : {
            agenda: sondage.perimetreId ?? GLOBAL,
            titre: '',
            description: '',
            creneaux: [
              { jour: '', heureDebut: '', heureFin: '' },
              { jour: '', heureDebut: '', heureFin: '' },
            ],
            cible: sondage.perimetreId === null ? 'EQUIPE' : 'PERIMETRE',
            personneIds: [],
          }
    )
  }, [form, sondage])

  const enregistrer = async (v: Valeurs) => {
    const creneaux = v.creneaux.map(c => ({
      ...(c.id ? { id: c.id } : {}),
      jour: c.jour,
      heureDebut: c.heureDebut || null,
      heureFin: c.heureFin || null,
    }))
    try {
      if (existant) {
        await modifier({
          variables: {
            id: existant.id,
            titre: v.titre,
            description: v.description ?? '',
            creneaux,
            versionAttendue: existant.version,
          },
        })
        message.success(t`Sondage enregistré.`)
      } else {
        await creer({
          variables: {
            editionId,
            perimetreId: v.agenda === GLOBAL ? null : v.agenda,
            titre: v.titre,
            description: v.description ?? '',
            creneaux,
            cible: v.cible,
            personneIds: v.cible === 'CHOIX' ? v.personneIds : [],
          },
        })
        message.success(
          t`Sondage ouvert. Les personnes visées le trouvent dans leur agenda.`
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
            relu: t`Une autre personne a modifié ce sondage depuis votre lecture. L’agenda affiche maintenant sa version : reprenez votre modification.`,
            echec: t`Le sondage n’a pas pu être rechargé. Votre saisie reste à l’écran : réessayez dans un instant.`,
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
      open={sondage !== null}
      title={existant ? t`Modifier le sondage` : t`Nouveau sondage de dates`}
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
            disabled={existant !== null}
            options={agendas.map(a => ({
              value: a.perimetreId ?? GLOBAL,
              label: a.nom,
            }))}
            onChange={(valeur: string) =>
              form.setFieldsValue({
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
            { max: 200, message: t`Le titre dépasse 200 caractères.` },
          ]}
        >
          <Input placeholder={t`Date du point d’étape`} />
        </Form.Item>
        <Form.Item label={t`Description (facultative)`} name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
        </Form.Item>
        <Form.List
          name="creneaux"
          rules={[
            {
              validator: (_regle, liste?: unknown[]) =>
                liste && liste.length > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error(t`Proposez au moins un créneau.`)),
            },
          ]}
        >
          {(champs, { add, remove }, { errors }) => (
            <fieldset className="rt-sondage-creneaux">
              <legend>
                <Trans>Créneaux proposés</Trans>
              </legend>
              <p className="rt-note">
                <Trans>
                  Un créneau est un jour, avec un horaire facultatif.
                </Trans>
                {existant &&
                  ` ${t`Retirer un créneau efface les réponses qu’il a reçues.`}`}
              </p>
              {champs.map(champ => (
                <div key={champ.key} className="rt-sondage-creneau">
                  <Form.Item name={[champ.name, 'id']} hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name={[champ.name, 'jour']}
                    rules={[
                      { required: true, message: t`Choisissez un jour.` },
                    ]}
                  >
                    <Input
                      type="date"
                      aria-label={t({
                        message: 'Jour',
                        comment: 'Libellé : jour d’un créneau',
                      })}
                    />
                  </Form.Item>
                  <Form.Item name={[champ.name, 'heureDebut']}>
                    <Input
                      type="time"
                      aria-label={t({
                        message: 'Début',
                        comment: 'Libellé : heure de début d’un créneau',
                      })}
                    />
                  </Form.Item>
                  <Form.Item name={[champ.name, 'heureFin']}>
                    <Input
                      type="time"
                      aria-label={t({
                        message: 'Fin',
                        comment: 'Libellé : heure de fin d’un créneau',
                      })}
                    />
                  </Form.Item>
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    aria-label={t`Retirer ce créneau`}
                    onClick={() => remove(champ.name)}
                  />
                </div>
              ))}
              <Form.ErrorList errors={errors} />
              <Button
                icon={<PlusOutlined />}
                disabled={champs.length >= CRENEAUX_MAX}
                onClick={() => add({ jour: '', heureDebut: '', heureFin: '' })}
              >
                <Trans>Ajouter un créneau</Trans>
              </Button>
            </fieldset>
          )}
        </Form.List>
        {!existant && (
          <>
            <Form.Item
              label={t`Personnes visées`}
              name="cible"
              style={{ marginTop: 16 }}
            >
              <Radio.Group
                options={[
                  ...(perimetreId === null
                    ? []
                    : [{ value: 'PERIMETRE', label: t`Tout le périmètre` }]),
                  { value: 'EQUIPE', label: t`Toute l’équipe` },
                  { value: 'CHOIX', label: t`Des personnes choisies` },
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
                    label: p.duPerimetre
                      ? `${p.nom} · ${t`du périmètre`}`
                      : p.nom,
                  }))}
                />
              </Form.Item>
            )}
          </>
        )}
      </Form>
    </Modal>
  )
}
