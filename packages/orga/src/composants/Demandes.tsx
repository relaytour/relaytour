import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Form,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'

import { graphql } from '../gql'
import type { DemandesQuery, StatutDemande } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { useSession } from '../lib/session'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import { PERIMETRES } from '../lib/requetes'

import EtiquettePerimetre from './EtiquettePerimetre'

// File de revue des demandes pour rejoindre l'équipe d'une période (ADR 0015). Un
// admin de l'activité accepte une demande, ce qui crée le compte et les affectations
// qu'il choisit, ou la refuse. Aucun compte n'existe avant sa décision.

const DEMANDES = graphql(`
  query Demandes($editionId: ID!, $statut: StatutDemande) {
    demandes(editionId: $editionId, statut: $statut) {
      id
      nom
      adresse
      origine
      statut
      creeLe
      dejaMembre
      disponibilite
      question
      reponse
      texte
      traiteePar {
        id
        nom
      }
      perimetres {
        id
        mot
        perimetre {
          id
          nom
          couleur
        }
        proposePar {
          id
          nom
        }
      }
    }
  }
`)

// Les souhaits des membres attendent dans « Équipe » : la file en donne le nombre.
const SOUHAITS = graphql(`
  query SouhaitsEnAttente($editionId: ID!) {
    postesAPourvoir(editionId: $editionId) {
      perimetre {
        id
      }
      souhaits {
        id
      }
    }
  }
`)

const ACCEPTER = graphql(`
  mutation AccepterDemande($id: ID!, $affecter: [ID!]!) {
    accepterDemande(id: $id, affecter: $affecter) {
      id
      statut
    }
  }
`)

const REFUSER = graphql(`
  mutation RefuserDemande($id: ID!) {
    refuserDemande(id: $id) {
      id
      statut
    }
  }
`)

type Demande = DemandesQuery['demandes'][number]
type Filtre = 'EN_ATTENTE' | 'traitees'

const STATUTS: Record<StatutDemande, { libelle: string; couleur?: string }> = {
  EN_ATTENTE: { libelle: 'En attente', couleur: 'gold' },
  ACCEPTEE: { libelle: 'Acceptée', couleur: 'green' },
  REFUSEE: { libelle: 'Refusée' },
}

export default function Demandes({
  editionId,
  archivee,
}: {
  editionId: string
  /** Une période archivée garde ses demandes en lecture seule. */
  archivee: boolean
}) {
  const { message } = App.useApp()
  const { activite, lien, periode } = useActivite()
  // Un admin d'activité n'apprend « déjà membre » que pour son équipe (ADR 0018).
  const gereOrganisation = useSession().moi.estAdmin === true
  const [filtre, setFiltre] = useState<Filtre>('EN_ATTENTE')
  const [enAcceptation, setEnAcceptation] = useState<Demande | null>(null)
  const [form] = Form.useForm<{ affecter: string[] }>()
  const { data, loading } = useQuery(DEMANDES, {
    variables: { editionId },
    fetchPolicy: 'cache-and-network',
  })
  const { data: postes } = useQuery(SOUHAITS, { variables: { editionId } })
  const { data: perimetres } = useQuery(PERIMETRES, {
    variables: { inclureArchives: false },
  })
  // L'acceptation crée un compte, des affectations et des souhaits : l'annuaire et
  // l'écran « Équipe » se relisent avec la file.
  const rafraichir = {
    refetchQueries: [
      'Demandes',
      'DemandesEnAttente',
      'SouhaitsEnAttente',
      'PostesAPourvoir',
      'Personnes',
    ],
  }
  const [accepter, acceptation] = useMutation(ACCEPTER, rafraichir)
  const [refuser] = useMutation(REFUSER, rafraichir)

  const toutes = data?.demandes ?? []
  const enAttente = toutes.filter(d => d.statut === 'EN_ATTENTE')
  const affichees =
    filtre === 'EN_ATTENTE'
      ? enAttente
      : toutes.filter(d => d.statut !== 'EN_ATTENTE')
  const souhaits = (postes?.postesAPourvoir ?? []).reduce(
    (total, p) => total + p.souhaits.length,
    0
  )

  const options = activite.groupes
    .map(groupe => ({
      label: groupe.libellePluriel,
      options: (perimetres?.perimetres ?? [])
        .filter(p => p.groupe === groupe.cle)
        .map(p => ({ value: p.id, label: p.nom })),
    }))
    .filter(groupe => groupe.options.length > 0)

  const ouvrir = (demande: Demande) => {
    setEnAcceptation(demande)
    // Les périmètres demandés sont proposés d'office : l'admin retire ceux qu'il
    // préfère laisser en souhait.
    const actifs = new Set((perimetres?.perimetres ?? []).map(p => p.id))
    form.setFieldsValue({
      // Deux personnes peuvent avoir proposé le même périmètre : il ne se choisit
      // qu'une fois.
      affecter: [
        ...new Set(demande.perimetres.map(p => p.perimetre.id)),
      ].filter(id => actifs.has(id)),
    })
  }

  const confirmer = async ({ affecter }: { affecter: string[] }) => {
    if (enAcceptation === null) return
    try {
      await accepter({ variables: { id: enAcceptation.id, affecter } })
      message.success(
        enAcceptation.dejaMembre
          ? 'Demande acceptée. La personne est affectée.'
          : 'Demande acceptée. Une personne sans compte reçoit son invitation par mail.'
      )
      setEnAcceptation(null)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <p className="rt-texte-secondaire" style={{ marginTop: 0 }}>
        Une demande vient d’une référente ou d’un référent, qui propose une
        personne pour son périmètre, ou du formulaire public de l’activité.
        Aucun compte n’existe avant votre décision.
      </p>
      {souhaits > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={
            <>
              {souhaits === 1
                ? '1 souhait d’un membre attend'
                : `${souhaits} souhaits de membres attendent`}{' '}
              aussi une affectation dans{' '}
              <Link to={lien('/admin/equipe')}>Équipe</Link>.
            </>
          }
        />
      )}
      <Segmented<Filtre>
        style={{ marginBottom: 16 }}
        value={filtre}
        onChange={setFiltre}
        options={[
          { value: 'EN_ATTENTE', label: `En attente (${enAttente.length})` },
          { value: 'traitees', label: 'Traitées' },
        ]}
      />
      <Table<Demande>
        rowKey="id"
        loading={loading && data === undefined}
        dataSource={affichees}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        expandable={{
          // Les réponses du formulaire public se déplient sous la demande.
          rowExpandable: d => Boolean(d.disponibilite ?? d.reponse ?? d.texte),
          expandedRowRender: d => (
            <dl className="rt-reponses" style={{ margin: 0 }}>
              {d.disponibilite && (
                <>
                  <dt>Disponibilité</dt>
                  <dd>{d.disponibilite}</dd>
                </>
              )}
              {d.reponse && (
                <>
                  <dt>{d.question ?? 'Question complémentaire'}</dt>
                  <dd>{d.reponse}</dd>
                </>
              )}
              {d.texte && (
                <>
                  <dt>Ce que la personne aime faire ou sait faire</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{d.texte}</dd>
                </>
              )}
            </dl>
          ),
        }}
        locale={{
          emptyText:
            filtre === 'EN_ATTENTE'
              ? `Aucune demande n’attend pour ${periode.cette}.`
              : `Aucune demande traitée pour ${periode.cette}.`,
        }}
        columns={[
          {
            title: 'Nom',
            dataIndex: 'nom',
            render: (nom: string, d) => (
              <Space style={{ whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600 }}>{nom}</span>
                {d.origine === 'FORMULAIRE' && <Tag>Formulaire public</Tag>}
                {d.dejaMembre && (
                  <Tooltip
                    title={
                      gereOrganisation
                        ? 'Un compte de l’organisation porte déjà cette adresse. Accepter la demande ne crée aucun compte.'
                        : 'Une personne de votre équipe porte déjà cette adresse. Accepter la demande ne crée aucun compte.'
                    }
                  >
                    <Tag>
                      {gereOrganisation
                        ? 'Déjà membre'
                        : 'Déjà dans votre équipe'}
                    </Tag>
                  </Tooltip>
                )}
              </Space>
            ),
          },
          { title: 'Adresse mail', dataIndex: 'adresse' },
          {
            title: 'Périmètres demandés',
            dataIndex: 'perimetres',
            render: (_, d) =>
              d.perimetres.length === 0 ? (
                <Typography.Text type="secondary">
                  Aucun : un rôle est à lui proposer
                </Typography.Text>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {d.perimetres.map(p => (
                    <li key={p.id} style={{ padding: '2px 0' }}>
                      <EtiquettePerimetre
                        nom={p.perimetre.nom}
                        couleur={p.perimetre.couleur}
                      />
                      {p.proposePar && (
                        <Typography.Text type="secondary">
                          {' '}
                          proposé par {p.proposePar.nom}
                        </Typography.Text>
                      )}
                      {p.mot && (
                        <div style={{ maxWidth: '48ch', fontSize: 13 }}>
                          « {p.mot} »
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            title: 'Reçue le',
            dataIndex: 'creeLe',
            render: (creeLe: string) => jourDeLInstant(creeLe),
          },
          {
            title: 'État',
            dataIndex: 'statut',
            render: (statut: StatutDemande, d) => (
              <Space size={4} wrap>
                <Tag
                  color={STATUTS[statut].couleur}
                  style={{ marginInlineEnd: 0 }}
                >
                  {STATUTS[statut].libelle}
                </Tag>
                {d.traiteePar && (
                  <Typography.Text type="secondary">
                    par {d.traiteePar.nom}
                  </Typography.Text>
                )}
              </Space>
            ),
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, d) =>
              d.statut === 'EN_ATTENTE' && (
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    // Sans la liste des périmètres, la fenêtre ne saurait pas
                    // lesquels proposer d'office à l'affectation.
                    disabled={archivee || perimetres === undefined}
                    aria-label={`Accepter la demande de ${d.nom}`}
                    onClick={() => ouvrir(d)}
                  >
                    Accepter
                  </Button>
                  <Popconfirm
                    title="Refuser cette demande ?"
                    description="Aucun compte n’est créé et aucun mail ne part."
                    okText="Refuser"
                    cancelText="Annuler"
                    disabled={archivee}
                    onConfirm={() =>
                      refuser({ variables: { id: d.id } }).catch((e: unknown) =>
                        message.error(messageErreur(e))
                      )
                    }
                  >
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      disabled={archivee}
                      aria-label={`Refuser la demande de ${d.nom}`}
                    >
                      Refuser
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]}
      />

      <Modal
        open={enAcceptation !== null}
        title={`Accepter la demande de ${enAcceptation?.nom ?? ''}`}
        okText="Accepter"
        cancelText="Annuler"
        confirmLoading={acceptation.loading}
        onOk={() => form.submit()}
        onCancel={() => setEnAcceptation(null)}
        destroyOnHidden
      >
        <p style={{ marginTop: 0 }}>
          {enAcceptation?.dejaMembre
            ? 'Cette personne a déjà un compte : l’acceptation n’en crée aucun. Un mail lui annonce ses nouveaux périmètres.'
            : 'L’acceptation fait entrer cette personne dans l’équipe. Si elle n’a pas de compte, elle reçoit une invitation par mail, avec ses périmètres.'}
        </p>
        <Form
          form={form}
          layout="vertical"
          onFinish={v => void confirmer(v)}
          requiredMark={false}
        >
          <Form.Item
            label="Périmètres à affecter"
            name="affecter"
            extra="Un périmètre demandé que vous n’affectez pas devient un souhait."
            rules={[
              {
                // Sans périmètre demandé, la personne rejoint l'équipe par une
                // affectation (ADR 0018).
                required: enAcceptation?.perimetres.length === 0,
                message:
                  'Choisissez au moins un périmètre : la personne rejoint l’équipe par ce périmètre.',
              },
            ]}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Aucun périmètre : la personne garde ses souhaits"
              optionFilterProp="label"
              options={options}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
