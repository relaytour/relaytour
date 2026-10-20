import { useMutation, useQuery } from '@apollo/client/react'
import { DeleteOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Checkbox, Form, Input, Modal, Result } from 'antd'
import { useEffect, useState } from 'react'

import Tableau from '../composants/Tableau'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { BenevolesQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { estRefus, messageErreur } from '../lib/erreurs'
import { BENEVOLES } from '../lib/requetes'

const CREER = graphql(`
  mutation CreerBenevole(
    $activiteId: ID!
    $nom: String!
    $courriel: String
    $telephone: String
    $note: String
    $accord: Boolean!
  ) {
    creerBenevole(
      activiteId: $activiteId
      nom: $nom
      courriel: $courriel
      telephone: $telephone
      note: $note
      accord: $accord
    ) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierBenevole(
    $id: ID!
    $nom: String!
    $courriel: String
    $telephone: String
    $note: String
  ) {
    modifierBenevole(
      id: $id
      nom: $nom
      courriel: $courriel
      telephone: $telephone
      note: $note
    ) {
      id
    }
  }
`)

const SUPPRIMER = graphql(`
  mutation SupprimerBenevole($id: ID!) {
    supprimerBenevole(id: $id)
  }
`)

type Fiche = BenevolesQuery['benevoles'][number]

interface Valeurs {
  nom: string
  courriel?: string
  telephone?: string
  note?: string
  accord?: boolean
}

const RELIRE = ['Benevoles', 'Programme']

/**
 * Fiches bénévoles d'une activité (ADR 0040) : des personnes qui aident sans
 * compte. Les coordonnées ne s'affichent qu'aux personnes que le serveur autorise.
 */
export default function Benevoles() {
  const { activite, gere } = useActivite()
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<Valeurs>()
  const { data, loading, error } = useQuery(BENEVOLES, {
    variables: { activiteId: activite.id },
    fetchPolicy: 'cache-and-network',
  })
  const [creer, creation] = useMutation(CREER, { refetchQueries: RELIRE })
  const [modifier, modification] = useMutation(MODIFIER, {
    refetchQueries: RELIRE,
  })
  const [supprimer] = useMutation(SUPPRIMER, { refetchQueries: RELIRE })
  const [fiche, setFiche] = useState<Fiche | 'nouvelle' | null>(null)

  useEffect(() => {
    if (fiche === null) return
    form.setFieldsValue(
      fiche === 'nouvelle'
        ? { nom: '', courriel: '', telephone: '', note: '', accord: false }
        : {
            nom: fiche.nom,
            courriel: fiche.courriel ?? '',
            telephone: fiche.telephone ?? '',
            note: fiche.note ?? '',
          }
    )
  }, [form, fiche])

  if (error && !data) {
    // Un refus d'accès se distingue d'une panne : une panne propose de
    // réessayer.
    return estRefus(error) ? (
      <Result
        status="info"
        icon={<LockOutlined />}
        title="Les fiches bénévoles sont réservées aux personnes qui organisent."
        subTitle="Les admins de l’activité et les personnes affectées à un de ses périmètres les lisent."
      />
    ) : (
      <Result
        status="warning"
        title="Les fiches bénévoles n’ont pas pu être chargées."
        subTitle={messageErreur(error)}
      />
    )
  }

  const enregistrer = async (v: Valeurs) => {
    const champs = {
      nom: v.nom,
      courriel: v.courriel ?? '',
      telephone: v.telephone ?? '',
      note: v.note ?? '',
    }
    try {
      if (fiche === 'nouvelle') {
        await creer({
          variables: {
            activiteId: activite.id,
            ...champs,
            accord: v.accord === true,
          },
        })
        message.success('Fiche créée.')
      } else if (fiche) {
        await modifier({ variables: { id: fiche.id, ...champs } })
        message.success('Fiche enregistrée.')
      }
      setFiche(null)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const confirmerSuppression = (f: Fiche) =>
    void modal.confirm({
      title: `Supprimer la fiche de ${f.nom} ?`,
      content:
        'La fiche et ses coordonnées disparaissent. La personne quitte les séquences où elle est placée.',
      okText: 'Supprimer',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await supprimer({ variables: { id: f.id } })
          message.success('Fiche supprimée.')
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })

  return (
    <>
      <Titre
        sousTitre="Les personnes qui aident sans compte dans l’application. Une fiche ne s’enregistre qu’avec leur accord."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setFiche('nouvelle')}
          >
            Nouvelle fiche
          </Button>
        }
      >
        Bénévoles
      </Titre>
      <Tableau<Fiche>
        id="benevoles"
        rowKey="id"
        loading={loading && !data}
        dataSource={data?.benevoles ?? []}
        pagination={false}
        ouvrir={f => setFiche(f)}
        peutOuvrir={f => f.peutModifier}
        libelleOuvrir={f => `Modifier la fiche de ${f.nom}`}
        locale={{ emptyText: 'Aucune fiche bénévole pour cette activité.' }}
        colonnes={[
          {
            key: 'nom',
            title: 'Nom',
            dataIndex: 'nom',
            tri: f => f.nom,
            recherche: f => f.nom,
          },
          {
            key: 'telephone',
            title: 'Téléphone',
            render: (_, f) =>
              f.coordonneesVisibles ? (
                f.telephone ? (
                  <a href={`tel:${f.telephone.replace(/\s/g, '')}`}>
                    {f.telephone}
                  </a>
                ) : (
                  '—'
                )
              ) : (
                <span className="rt-note">Réservé</span>
              ),
          },
          {
            key: 'courriel',
            title: 'Adresse',
            render: (_, f) =>
              f.coordonneesVisibles ? (
                f.courriel ? (
                  <a href={`mailto:${f.courriel}`}>{f.courriel}</a>
                ) : (
                  '—'
                )
              ) : (
                <span className="rt-note">Réservée</span>
              ),
          },
          {
            // La note (disponibilités, compétences) se lit avec les
            // coordonnées, même sans droit de modifier la fiche.
            key: 'note',
            title: 'Note',
            ellipsis: true,
            render: (_, f) =>
              f.coordonneesVisibles ? (
                f.note ? (
                  <span title={f.note}>{f.note}</span>
                ) : (
                  '—'
                )
              ) : (
                <span className="rt-note">Réservée</span>
              ),
          },
          {
            key: 'places',
            title: 'Séquences',
            dataIndex: 'places',
            width: 120,
            tri: f => f.places,
          },
          ...(gere
            ? [
                {
                  key: 'actions',
                  title: '',
                  width: 60,
                  redimensionnable: false,
                  render: (_: unknown, f: Fiche) => (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`Supprimer la fiche de ${f.nom}`}
                      onClick={() => confirmerSuppression(f)}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
      <p className="rt-note" style={{ margin: '12px 6px' }}>
        Les coordonnées d’une fiche se lisent par les admins de l’activité, par
        la personne qui l’a créée, et par les personnes d’un périmètre où elle
        est placée. Le serveur supprime une fiche inutilisée depuis deux ans.
      </p>

      <Modal
        open={fiche !== null}
        title={
          fiche === 'nouvelle' ? 'Nouvelle fiche bénévole' : 'Modifier la fiche'
        }
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={creation.loading || modification.loading}
        onOk={() => form.submit()}
        onCancel={() => setFiche(null)}
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
            label="Prénom et nom"
            name="nom"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Saisissez un nom.',
              },
              { max: 120, message: 'Le nom dépasse 120 caractères.' },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item label="Téléphone (facultatif)" name="telephone">
            <Input inputMode="tel" autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Adresse (facultative)"
            name="courriel"
            rules={[
              { type: 'email', message: 'Saisissez une adresse valide.' },
            ]}
          >
            <Input inputMode="email" autoComplete="off" />
          </Form.Item>
          <Form.Item label="Note (facultative)" name="note">
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder="Disponibilités, compétences, taille de t-shirt…"
            />
          </Form.Item>
          {fiche === 'nouvelle' && (
            <Form.Item
              name="accord"
              valuePropName="checked"
              rules={[
                {
                  validator: (_regle, valeur?: boolean) =>
                    valeur
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error(
                            'Une fiche ne s’enregistre qu’avec l’accord de la personne.'
                          )
                        ),
                },
              ]}
            >
              <Checkbox>
                La personne accepte que ses coordonnées soient enregistrées pour
                organiser l’activité.
              </Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
