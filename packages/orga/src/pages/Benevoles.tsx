import { useMutation, useQuery } from '@apollo/client/react'
import {
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Trans, useLingui } from '@lingui/react/macro'
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
  const { t } = useLingui()
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
        title={t`Les fiches bénévoles sont réservées aux personnes qui organisent.`}
        subTitle={t`Les admins de l’activité et les personnes affectées à un de ses périmètres les lisent.`}
      />
    ) : (
      <Result
        status="warning"
        title={t`Les fiches bénévoles n’ont pas pu être chargées.`}
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
        message.success(t`Fiche créée.`)
      } else if (fiche) {
        await modifier({ variables: { id: fiche.id, ...champs } })
        message.success(t`Fiche enregistrée.`)
      }
      setFiche(null)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const confirmerSuppression = (f: Fiche) => {
    const nomBenevole = f.nom
    void modal.confirm({
      title: t`Supprimer la fiche de ${nomBenevole} ?`,
      content: t`La fiche et ses coordonnées disparaissent. La personne quitte les séquences où elle est placée.`,
      okText: t`Supprimer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await supprimer({ variables: { id: f.id } })
          message.success(t`Fiche supprimée.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  const periodeUne = periode.une
  const libelleLienDe = (f: Fiche) => {
    const nomBenevole = f.nom
    return t`Lien personnel de ${nomBenevole}`
  }
  const libelleSuppression = (f: Fiche) => {
    const nomBenevole = f.nom
    return t`Supprimer la fiche de ${nomBenevole}`
  }
  const nbCandidatures = aTraiter?.candidatures.length ?? 0
  const nomLien = (lienDe && actuelle(lienDe)?.nom) ?? ''

  return (
    <>
      <Titre
        sousTitre={t`Les personnes qui aident sans compte dans l’application. Une fiche ne s’enregistre qu’avec leur accord.`}
        actions={
          onglet === 'fiches' ? (
            <Space wrap>
              <Link to={lien('/benevoles/import')}>
                <Button icon={<UploadOutlined />}>
                  <Trans>Importer une liste</Trans>
                </Button>
              </Link>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setFiche('nouvelle')}
              >
                <Trans>Nouvelle fiche</Trans>
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
        <Trans>Bénévoles</Trans>
      </Titre>
      <Tabs
        activeKey={onglet}
        onChange={cle => changer('onglet', cle === 'fiches' ? null : cle)}
        items={[
          { key: 'fiches', label: t`Fiches` },
          {
            key: 'candidatures',
            label:
              nbCandidatures > 0
                ? t`Candidatures (${nbCandidatures})`
                : t`Candidatures`,
          },
          { key: 'appels', label: t`Appels` },
          // Les doublons possibles et la fusion, réservés aux admins (ADR 0042).
          ...(gere ? [{ key: 'doublons', label: t`Doublons possibles` }] : []),
        ]}
      />
      {onglet === 'doublons' && <DoublonsBenevoles />}
      {(onglet === 'candidatures' || onglet === 'appels') &&
        (editionId === undefined ? (
          <Empty description={t`Créez d’abord ${periodeUne}.`} />
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
            libelleOuvrir={f => {
              const nomBenevole = f.nom
              return t`Modifier la fiche de ${nomBenevole}`
            }}
            locale={{
              emptyText: t`Aucune fiche bénévole pour cette activité.`,
            }}
            colonnes={[
              {
                key: 'nom',
                title: t({
                  message: 'Nom',
                  comment: 'Colonne du tableau des fiches bénévoles',
                }),
                dataIndex: 'nom',
                tri: f => f.nom,
                recherche: f => f.nom,
              },
              {
                key: 'telephone',
                title: t({
                  message: 'Téléphone',
                  comment: 'Colonne du tableau des fiches bénévoles',
                }),
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
                    <span className="rt-note">
                      {t({
                        message: 'Réservé',
                        comment:
                          'Téléphone d’une fiche bénévole que la personne ne peut pas lire',
                      })}
                    </span>
                  ),
              },
              {
                key: 'courriel',
                title: t({
                  message: 'Adresse',
                  comment: 'Colonne : adresse de courriel d’une fiche bénévole',
                }),
                render: (_, f) =>
                  f.coordonneesVisibles ? (
                    f.courriel ? (
                      <a href={`mailto:${f.courriel}`}>{f.courriel}</a>
                    ) : (
                      '—'
                    )
                  ) : (
                    <span className="rt-note">
                      {t({
                        message: 'Réservée',
                        comment:
                          'Adresse de courriel d’une fiche bénévole que la personne ne peut pas lire',
                      })}
                    </span>
                  ),
              },
              {
                // La note (disponibilités, compétences) se lit avec les
                // coordonnées, même sans droit de modifier la fiche.
                key: 'note',
                title: t({
                  message: 'Note',
                  comment: 'Colonne du tableau des fiches bénévoles',
                }),
                ellipsis: true,
                render: (_, f) =>
                  f.coordonneesVisibles ? (
                    f.note ? (
                      <span title={f.note}>{f.note}</span>
                    ) : (
                      '—'
                    )
                  ) : (
                    <span className="rt-note">
                      {t({
                        message: 'Réservée',
                        comment:
                          'Note d’une fiche bénévole que la personne ne peut pas lire',
                      })}
                    </span>
                  ),
              },
              {
                key: 'places',
                title: t({
                  message: 'Séquences',
                  comment: 'Colonne : nombre de places d’une fiche bénévole',
                }),
                dataIndex: 'places',
                width: 120,
                tri: f => f.places,
              },
              {
                // L'état du lien personnel (ADR 0041) : confirmée, lien envoyé, ou
                // aucun mail. Sans les coordonnées, l'absence d'adresse ne se
                // lit pas : la cellule l'indique comme réservée.
                key: 'lien',
                title: t`Participation`,
                width: 170,
                render: (_, f) => (
                  <span className="rt-cellule-lien">
                    {f.confirmeeLe ? (
                      <Tag color="success">
                        {t({
                          message: 'Confirmée',
                          comment: 'Participation d’un bénévole',
                        })}
                      </Tag>
                    ) : f.lienEnvoyeLe ? (
                      <Tag color="warning">{t`Lien envoyé`}</Tag>
                    ) : !f.coordonneesVisibles ? (
                      <span className="rt-note">
                        {t({
                          message: 'Réservée',
                          comment:
                            'Participation d’un bénévole que la personne ne peut pas lire',
                        })}
                      </span>
                    ) : f.prevenirParMail && f.courriel ? (
                      <span className="rt-note">
                        {t`Lien à la première place`}
                      </span>
                    ) : (
                      <span className="rt-note">{t`Sans mail`}</span>
                    )}
                    {f.coordonneesVisibles && !f.peutModifier && (
                      <Button
                        type="link"
                        size="small"
                        aria-label={libelleLienDe(f)}
                        onClick={() => setLienDe(f.id)}
                      >
                        {t({
                          message: 'Lien',
                          context: 'lien personnel d’un bénévole',
                          comment:
                            'Bouton qui ouvre le lien personnel d’un bénévole',
                        })}
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
                          aria-label={libelleSuppression(f)}
                          onClick={() => confirmerSuppression(f)}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <p className="rt-note" style={{ margin: '12px 6px' }}>
            <Trans>
              Les coordonnées d’une fiche se lisent par les admins de
              l’activité, par la personne qui l’a créée, et par les personnes
              d’un périmètre où elle est placée. Le serveur supprime une fiche
              inutilisée depuis deux ans.
            </Trans>
          </p>
        </>
      )}

      <Modal
        open={fiche !== null}
        title={
          fiche === 'nouvelle'
            ? t`Nouvelle fiche bénévole`
            : t({ message: 'Modifier la fiche', context: 'fiche bénévole' })
        }
        okText={t`Enregistrer`}
        cancelText={t`Annuler`}
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
            label={t`Prénom et nom`}
            name="nom"
            rules={[
              {
                required: true,
                whitespace: true,
                message: t`Saisissez un nom.`,
              },
              { max: 120, message: t`Le nom dépasse 120 caractères.` },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item label={t`Téléphone (facultatif)`} name="telephone">
            <Input inputMode="tel" autoComplete="off" />
          </Form.Item>
          <Form.Item
            label={t`Adresse (facultative)`}
            name="courriel"
            rules={[
              { type: 'email', message: t`Saisissez une adresse valide.` },
            ]}
          >
            <Input inputMode="email" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="prevenirParMail"
            valuePropName="checked"
            extra={t`Avec une adresse, la première place envoie à la personne un mail avec son lien personnel. Ses places restent à confirmer. Décochez pour une personne jointe autrement.`}
          >
            <Checkbox>
              <Trans>Prévenir par mail</Trans>
            </Checkbox>
          </Form.Item>
          <Form.Item label={t`Note (facultative)`} name="note">
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder={t`Disponibilités, compétences, taille de t-shirt…`}
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
                            t`Une fiche ne s’enregistre qu’avec l’accord de la personne.`
                          )
                        ),
                },
              ]}
            >
              <Checkbox>
                <Trans>
                  La personne accepte que ses coordonnées soient enregistrées
                  pour organiser l’activité.
                </Trans>
              </Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        open={lienDe !== null}
        title={t`Lien personnel de ${nomLien}`}
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
