import { useMutation, useQuery } from '@apollo/client/react'
import {
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Result,
  Space,
  Tabs,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import AppelsBenevoles from '../composants/AppelsBenevoles'
import CandidaturesBenevoles from '../composants/CandidaturesBenevoles'
import ChoixEdition from '../composants/ChoixEdition'
import DoublonsBenevoles from '../composants/DoublonsBenevoles'
import LienBenevole from '../composants/LienBenevole'
import Tableau from '../composants/Tableau'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { BenevolesQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { estRefus, messageErreur } from '../lib/erreurs'
import { BENEVOLES, EDITION_COURANTE, EDITIONS } from '../lib/requetes'
import { CANDIDATURES } from '../lib/requetes-benevoles'

const CREER = graphql(`
  mutation CreerBenevole(
    $activiteId: ID!
    $nom: String!
    $courriel: String
    $telephone: String
    $note: String
    $prevenirParMail: Boolean
    $accord: Boolean!
  ) {
    creerBenevole(
      activiteId: $activiteId
      nom: $nom
      courriel: $courriel
      telephone: $telephone
      note: $note
      prevenirParMail: $prevenirParMail
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
    $prevenirParMail: Boolean
  ) {
    modifierBenevole(
      id: $id
      nom: $nom
      courriel: $courriel
      telephone: $telephone
      note: $note
      prevenirParMail: $prevenirParMail
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
  prevenirParMail?: boolean
  accord?: boolean
}

type Onglet = 'fiches' | 'candidatures' | 'appels' | 'doublons'

const RELIRE = ['Benevoles', 'Programme']

/**
 * Bénévoles d'une activité : les fiches (ADR 0040), les candidatures et les
 * appels d'une période (ADR 0041). Les coordonnées ne s'affichent qu'aux
 * personnes que le serveur autorise.
 */
export default function Benevoles() {
  const { activite, gere, lien, periode } = useActivite()
  const [parametres, setParametres] = useSearchParams()
  const { data: courante } = useQuery(EDITION_COURANTE)
  const { data: editions } = useQuery(EDITIONS)
  const editionId =
    parametres.get('edition') ?? courante?.editionCourante?.id ?? undefined
  const edition = editions?.editions.find(e => e.id === editionId)
  const archivee = edition?.statut === 'ARCHIVEE'
  const ongletDemande = parametres.get('onglet')
  const onglet: Onglet =
    ongletDemande === 'candidatures' ||
    ongletDemande === 'appels' ||
    (ongletDemande === 'doublons' && gere)
      ? ongletDemande
      : 'fiches'
  // Le nombre de candidatures à traiter, pour le libellé de l'onglet.
  const { data: aTraiter } = useQuery(CANDIDATURES, {
    variables: { editionId: editionId ?? '', statut: 'EN_ATTENTE' },
    skip: editionId === undefined,
  })
  const changer = (cle: string, valeur: string | null) => {
    const suite = new URLSearchParams(parametres)
    if (valeur === null) suite.delete(cle)
    else suite.set(cle, valeur)
    setParametres(suite)
  }
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
  // La fiche dont le lien personnel s'affiche, pour une personne qui lit ses
  // coordonnées sans pouvoir la modifier.
  const [lienDe, setLienDe] = useState<string | null>(null)
  // Le panneau du lien lit la fiche actualisée : après une copie ou un renvoi,
  // ses boutons suivent l'état du serveur.
  const actuelle = (id: string) => data?.benevoles.find(b => b.id === id)

  useEffect(() => {
    if (fiche === null) return
    form.setFieldsValue(
      fiche === 'nouvelle'
        ? {
            nom: '',
            courriel: '',
            telephone: '',
            note: '',
            prevenirParMail: true,
            accord: false,
          }
        : {
            nom: fiche.nom,
            courriel: fiche.courriel ?? '',
            telephone: fiche.telephone ?? '',
            note: fiche.note ?? '',
            prevenirParMail: fiche.prevenirParMail,
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
      prevenirParMail: v.prevenirParMail ?? true,
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
          onglet === 'fiches' ? (
            <Space wrap>
              <Link to={lien('/benevoles/import')}>
                <Button icon={<UploadOutlined />}>Importer une liste</Button>
              </Link>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setFiche('nouvelle')}
              >
                Nouvelle fiche
              </Button>
            </Space>
          ) : onglet === 'doublons' ? null : (
            <ChoixEdition
              valeur={editionId}
              onChange={id => changer('edition', id)}
            />
          )
        }
      >
        Bénévoles
      </Titre>
      <Tabs
        activeKey={onglet}
        onChange={cle => changer('onglet', cle === 'fiches' ? null : cle)}
        items={[
          { key: 'fiches', label: 'Fiches' },
          {
            key: 'candidatures',
            label:
              (aTraiter?.candidatures.length ?? 0) > 0
                ? `Candidatures (${aTraiter!.candidatures.length})`
                : 'Candidatures',
          },
          { key: 'appels', label: 'Appels' },
          // Les doublons possibles et la fusion, réservés aux admins (ADR 0042).
          ...(gere ? [{ key: 'doublons', label: 'Doublons possibles' }] : []),
        ]}
      />
      {onglet === 'doublons' && <DoublonsBenevoles />}
      {(onglet === 'candidatures' || onglet === 'appels') &&
        (editionId === undefined ? (
          <Empty description={`Créez d’abord ${periode.une}.`} />
        ) : onglet === 'candidatures' ? (
          <CandidaturesBenevoles editionId={editionId} archivee={archivee} />
        ) : (
          <AppelsBenevoles editionId={editionId} archivee={archivee} />
        ))}
      {onglet === 'fiches' && (
        <>
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
              {
                // L'état du lien personnel (ADR 0041) : confirmée, lien envoyé, ou
                // aucun mail. Sans les coordonnées, l'absence d'adresse ne se
                // lit pas : la cellule l'indique comme réservée.
                key: 'lien',
                title: 'Participation',
                width: 170,
                render: (_, f) => (
                  <span className="rt-cellule-lien">
                    {f.confirmeeLe ? (
                      <Tag color="success">Confirmée</Tag>
                    ) : f.lienEnvoyeLe ? (
                      <Tag color="warning">Lien envoyé</Tag>
                    ) : !f.coordonneesVisibles ? (
                      <span className="rt-note">Réservée</span>
                    ) : f.prevenirParMail && f.courriel ? (
                      <span className="rt-note">Lien à la première place</span>
                    ) : (
                      <span className="rt-note">Sans mail</span>
                    )}
                    {f.coordonneesVisibles && !f.peutModifier && (
                      <Button
                        type="link"
                        size="small"
                        aria-label={`Lien personnel de ${f.nom}`}
                        onClick={() => setLienDe(f.id)}
                      >
                        Lien
                      </Button>
                    )}
                  </span>
                ),
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
            Les coordonnées d’une fiche se lisent par les admins de l’activité,
            par la personne qui l’a créée, et par les personnes d’un périmètre
            où elle est placée. Le serveur supprime une fiche inutilisée depuis
            deux ans.
          </p>
        </>
      )}

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
          <Form.Item
            name="prevenirParMail"
            valuePropName="checked"
            extra="Avec une adresse, la première place envoie à la personne un mail avec son lien personnel. Ses places restent à confirmer. Décochez pour une personne jointe autrement."
          >
            <Checkbox>Prévenir par mail</Checkbox>
          </Form.Item>
          <Form.Item label="Note (facultative)" name="note">
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder="Disponibilités, compétences, taille de t-shirt…"
            />
          </Form.Item>
          {fiche !== null &&
            fiche !== 'nouvelle' &&
            fiche.coordonneesVisibles && (
              <LienBenevole fiche={actuelle(fiche.id) ?? fiche} />
            )}
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

      <Modal
        open={lienDe !== null}
        title={`Lien personnel de ${(lienDe && actuelle(lienDe)?.nom) ?? ''}`}
        footer={null}
        onCancel={() => setLienDe(null)}
        destroyOnHidden
      >
        {lienDe !== null && actuelle(lienDe) && (
          <LienBenevole fiche={actuelle(lienDe)!} />
        )}
      </Modal>
    </>
  )
}
