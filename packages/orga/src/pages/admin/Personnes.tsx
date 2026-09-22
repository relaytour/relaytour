import { CheckOutlined, MailOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'

import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { PersonnesQuery } from '../../gql/graphql'
import { messageErreur } from '../../lib/erreurs'
import { normaliser } from '../../lib/recherche'
import { ACTIVITES, EDITIONS, MOI, PERIMETRES } from '../../lib/requetes'
import { useActivite } from '../../lib/activite'

const PERSONNES = graphql(`
  query Personnes($inclureArchives: Boolean, $editionId: ID) {
    personnes(inclureArchives: $inclureArchives) {
      id
      nom
      email
      estAdmin
      activitesAdministrees
      archive
      affectations(editionId: $editionId) {
        id
        perimetre {
          id
          nom
          couleur
        }
      }
      souhaits(editionId: $editionId) {
        id
        satisfait
        perimetre {
          id
          nom
          couleur
        }
      }
    }
  }
`)

const INVITER = graphql(`
  mutation InviterPersonne(
    $email: String!
    $nom: String!
    $estAdmin: Boolean
    $editionId: ID
    $perimetresSouhaites: [ID!]
  ) {
    inviterPersonne(
      email: $email
      nom: $nom
      estAdmin: $estAdmin
      editionId: $editionId
      perimetresSouhaites: $perimetresSouhaites
    ) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierPersonne($id: ID!, $nom: String!, $estAdmin: Boolean!) {
    modifierPersonne(id: $id, nom: $nom, estAdmin: $estAdmin) {
      id
      nom
      estAdmin
    }
  }
`)

const ARCHIVER = graphql(`
  mutation ArchiverPersonne($id: ID!, $archive: Boolean!) {
    archiverPersonne(id: $id, archive: $archive) {
      id
      archive
    }
  }
`)

const DEFINIR_SOUHAITS = graphql(`
  mutation DefinirSouhaits(
    $personneId: ID!
    $editionId: ID!
    $perimetreIds: [ID!]!
  ) {
    definirSouhaits(
      personneId: $personneId
      editionId: $editionId
      perimetreIds: $perimetreIds
    ) {
      id
    }
  }
`)

const DEFINIR_ADMIN_ACTIVITE = graphql(`
  mutation DefinirAdminActivite(
    $personneId: ID!
    $activiteId: ID!
    $admin: Boolean!
  ) {
    definirAdminActivite(
      personneId: $personneId
      activiteId: $activiteId
      admin: $admin
    )
  }
`)

const RENVOYER = graphql(`
  mutation RenvoyerInvitation($id: ID!) {
    renvoyerInvitation(id: $id)
  }
`)

type Personne = PersonnesQuery['personnes'][number]

interface Valeurs {
  email: string
  nom: string
  estAdmin: boolean
  /** Activités dont la personne est admin (ADR 0010). */
  activitesAdministrees?: string[]
  perimetresSouhaites?: string[]
}

const SOUHAITS_MAX = 30

/** Deux listes d'identifiants contiennent les mêmes éléments, dans n'importe quel ordre. */
function memesIdentifiants(a: string[], b: string[]): boolean {
  const ensemble = new Set(a)
  return ensemble.size === new Set(b).size && b.every(id => ensemble.has(id))
}

export default function Personnes() {
  const { activite, periode } = useActivite()
  const { message } = App.useApp()
  const [inclureArchives, setInclureArchives] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [choix, setChoix] = useState<string | undefined>()
  const [sansAffectation, setSansAffectation] = useState(false)
  const { data: session } = useQuery(MOI)
  const { data: editions } = useQuery(EDITIONS)
  const { data: perimetres } = useQuery(PERIMETRES)
  const editionId =
    choix ?? editions?.editions.find(e => e.statut !== 'ARCHIVEE')?.id
  const edition = editions?.editions.find(e => e.id === editionId)
  // Les souhaits se notent pour l'édition choisie, tant qu'elle n'est pas archivée.
  const souhaitsModifiables =
    edition !== undefined && edition.statut !== 'ARCHIVEE'
  const { data, loading } = useQuery(PERSONNES, {
    variables: { inclureArchives, editionId: editionId ?? null },
  })
  const [enEdition, setEnEdition] = useState<Personne | 'nouvelle' | null>(null)
  const [form] = Form.useForm<Valeurs>()
  const rafraichir = { refetchQueries: [PERSONNES] }
  const [inviter, invitation] = useMutation(INVITER, rafraichir)
  const [modifier, modification] = useMutation(MODIFIER, rafraichir)
  const [archiver] = useMutation(ARCHIVER, rafraichir)
  const [definirSouhaits, definition] = useMutation(
    DEFINIR_SOUHAITS,
    rafraichir
  )
  const [renvoyer] = useMutation(RENVOYER)
  const [definirAdminActivite] = useMutation(DEFINIR_ADMIN_ACTIVITE, rafraichir)
  const { data: toutesActivites } = useQuery(ACTIVITES)
  const moiId = session?.moi?.id
  // Les rôles, le nom et l'archivage d'un compte relèvent des admins de
  // l'organisation. Un admin d'activité invite, affecte et note les souhaits.
  const gereOrganisation = session?.moi?.estAdmin ?? false
  const nomsActivites = new Map(
    (toutesActivites?.activites ?? []).map(a => [a.id, a.nom])
  )

  /** Nomme ou retire les admins d'activité pour aller de `avant` à `apres`. */
  const ajusterAdminsActivite = async (
    personneId: string,
    avant: string[],
    apres: string[]
  ) => {
    for (const activiteId of apres.filter(id => !avant.includes(id))) {
      await definirAdminActivite({
        variables: { personneId, activiteId, admin: true },
      })
    }
    for (const activiteId of avant.filter(id => !apres.includes(id))) {
      await definirAdminActivite({
        variables: { personneId, activiteId, admin: false },
      })
    }
  }
  // Un compte archivé ne reçoit plus de souhaits.
  const champSouhaits =
    souhaitsModifiables &&
    enEdition !== null &&
    (enEdition === 'nouvelle' || !enEdition.archive)

  // Recherche insensible aux accents et à la casse, sur le nom et l'adresse.
  const personnes = useMemo(() => {
    const filtre = normaliser(recherche.trim())
    return (data?.personnes ?? []).filter(
      p =>
        (filtre === '' ||
          normaliser(p.nom).includes(filtre) ||
          normaliser(p.email).includes(filtre)) &&
        (!sansAffectation ||
          editionId === undefined ||
          p.affectations.length === 0)
    )
  }, [data, recherche, sansAffectation, editionId])

  const perimetresConnus = useMemo(
    () => new Set((perimetres?.perimetres ?? []).map(p => p.id)),
    [perimetres]
  )
  const optionsPerimetres = useMemo(
    () =>
      activite.groupes
        .map(groupe => ({
          label: groupe.libellePluriel,
          options: (perimetres?.perimetres ?? [])
            .filter(p => p.groupe === groupe.cle)
            .map(p => ({ value: p.id, label: p.nom })),
        }))
        .filter(groupe => groupe.options.length > 0),
    [perimetres, activite.groupes]
  )

  // Souhaits de la personne pour l'édition choisie, limités aux périmètres non archivés.
  const souhaitsInitiaux = (personne: Personne) =>
    personne.souhaits
      .map(souhait => souhait.perimetre.id)
      .filter(id => perimetresConnus.has(id))

  const ouvrir = (personne: Personne | 'nouvelle') => {
    setEnEdition(personne)
    form.setFieldsValue(
      personne === 'nouvelle'
        ? {
            email: '',
            nom: '',
            estAdmin: false,
            activitesAdministrees: [],
            perimetresSouhaites: [],
          }
        : {
            email: personne.email,
            nom: personne.nom,
            estAdmin: personne.estAdmin ?? false,
            activitesAdministrees: personne.activitesAdministrees,
            perimetresSouhaites: souhaitsInitiaux(personne),
          }
    )
  }

  const executer = async (action: () => Promise<unknown>, succes: string) => {
    try {
      await action()
      message.success(succes)
      return true
    } catch (e) {
      message.error(messageErreur(e))
      return false
    }
  }

  const enregistrer = async (v: Valeurs) => {
    const souhaites = champSouhaits ? (v.perimetresSouhaites ?? []) : []
    const ok =
      enEdition === 'nouvelle'
        ? await executer(async () => {
            const r = await inviter({
              variables: {
                email: v.email,
                nom: v.nom,
                estAdmin: gereOrganisation && v.estAdmin,
                editionId: souhaites.length > 0 ? editionId : null,
                perimetresSouhaites: souhaites,
              },
            })
            const id = r.data?.inviterPersonne.id
            if (gereOrganisation && id !== undefined) {
              await ajusterAdminsActivite(id, [], v.activitesAdministrees ?? [])
            }
          }, 'Invitation envoyée. La personne reçoit un mail avec le lien de connexion.')
        : enEdition
          ? await executer(async () => {
              if (gereOrganisation) {
                await modifier({
                  variables: {
                    id: enEdition.id,
                    nom: v.nom,
                    estAdmin: v.estAdmin,
                  },
                })
                await ajusterAdminsActivite(
                  enEdition.id,
                  enEdition.activitesAdministrees,
                  v.activitesAdministrees ?? []
                )
              }
              // Les souhaits ne sont envoyés que si l'ensemble a changé.
              if (
                champSouhaits &&
                editionId !== undefined &&
                !memesIdentifiants(souhaites, souhaitsInitiaux(enEdition))
              ) {
                await definirSouhaits({
                  variables: {
                    personneId: enEdition.id,
                    editionId,
                    perimetreIds: souhaites,
                  },
                })
              }
            }, 'Compte enregistré.')
          : false
    if (ok) setEnEdition(null)
  }

  return (
    <>
      <Titre sousTitre="Seules les personnes invitées ici peuvent se connecter à l’espace organisateur.">
        Personnes
      </Titre>
      <Space
        wrap
        style={{
          marginBottom: 16,
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => ouvrir('nouvelle')}
        >
          Inviter une personne
        </Button>
        <Space>
          <Switch checked={inclureArchives} onChange={setInclureArchives} />
          <span>Afficher les comptes archivés</span>
        </Space>
      </Space>
      <Space wrap size={[16, 12]} style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Rechercher un nom ou une adresse"
          aria-label="Rechercher un nom ou une adresse"
          style={{ width: 320, maxWidth: '100%' }}
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
        <Space>
          <span>{periode.Nom}</span>
          <Select
            style={{ minWidth: 200 }}
            value={editionId}
            onChange={setChoix}
            placeholder={`Choisir ${periode.une}`}
            options={(editions?.editions ?? []).map(e => ({
              value: e.id,
              label: e.nom,
            }))}
          />
        </Space>
        <Checkbox
          checked={sansAffectation && editionId !== undefined}
          disabled={editionId === undefined}
          onChange={e => setSansAffectation(e.target.checked)}
        >
          Sans affectation pour {periode.cette}
        </Checkbox>
      </Space>

      <Table<Personne>
        rowKey="id"
        loading={loading}
        dataSource={personnes}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: 'Nom',
            dataIndex: 'nom',
            render: (nom: string, p) => (
              <Space style={{ whiteSpace: 'nowrap' }}>
                <Typography.Link onClick={() => ouvrir(p)}>
                  {nom}
                </Typography.Link>
                {p.id === moiId && <Tag>Vous</Tag>}
              </Space>
            ),
          },
          { title: 'Adresse mail', dataIndex: 'email' },
          {
            title: 'Affectations',
            key: 'affectations',
            render: (_, p) =>
              p.affectations.length === 0 ? (
                <Typography.Text type="secondary">Aucune</Typography.Text>
              ) : (
                <Space size={[4, 4]} wrap>
                  {p.affectations.map(a => (
                    <Tag
                      key={a.id}
                      style={{
                        borderInlineStart: `4px solid ${a.perimetre.couleur ?? 'var(--rt-primaire)'}`,
                      }}
                    >
                      {a.perimetre.nom}
                    </Tag>
                  ))}
                </Space>
              ),
          },
          {
            title: 'Souhaits',
            key: 'souhaits',
            render: (_, p) =>
              p.souhaits.length === 0 ? (
                <Typography.Text type="secondary">Aucun</Typography.Text>
              ) : (
                <Space size={[4, 4]} wrap>
                  {p.souhaits.map(souhait => (
                    <Tag
                      key={souhait.id}
                      icon={
                        souhait.satisfait ? (
                          <CheckOutlined aria-label="Satisfait :" />
                        ) : undefined
                      }
                      style={{
                        borderInlineStart: `4px solid ${souhait.perimetre.couleur ?? 'var(--rt-primaire)'}`,
                      }}
                    >
                      {souhait.perimetre.nom}
                    </Tag>
                  ))}
                </Space>
              ),
          },
          {
            title: 'Rôle',
            dataIndex: 'estAdmin',
            render: (a: boolean, p) =>
              a ? (
                <Tag color="blue">Admin de l’organisation</Tag>
              ) : p.activitesAdministrees.length > 0 ? (
                <Space size={4} wrap>
                  {p.activitesAdministrees.map(id => (
                    <Tag key={id} color="geekblue">
                      Admin · {nomsActivites.get(id) ?? 'activité'}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Tag>Référent·e</Tag>
              ),
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, p) =>
              p.archive && !gereOrganisation ? null : p.archive ? (
                <Button
                  size="small"
                  onClick={() =>
                    void executer(
                      () =>
                        archiver({ variables: { id: p.id, archive: false } }),
                      'Compte restauré.'
                    )
                  }
                >
                  Restaurer
                </Button>
              ) : (
                <Space>
                  <Button
                    size="small"
                    icon={<MailOutlined />}
                    onClick={() =>
                      void executer(
                        () => renvoyer({ variables: { id: p.id } }),
                        'Invitation renvoyée.'
                      )
                    }
                  >
                    Renvoyer l’invitation
                  </Button>
                  {p.id !== moiId && gereOrganisation && (
                    <Popconfirm
                      title="Archiver ce compte ?"
                      description="La personne est déconnectée et ne peut plus se connecter. Son historique reste conservé."
                      okText="Archiver"
                      cancelText="Annuler"
                      onConfirm={() =>
                        executer(
                          () =>
                            archiver({
                              variables: { id: p.id, archive: true },
                            }),
                          'Compte archivé.'
                        )
                      }
                    >
                      <Button size="small" danger>
                        Archiver
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
          },
        ]}
      />

      <Modal
        open={enEdition !== null}
        title={
          enEdition === 'nouvelle'
            ? 'Inviter une personne'
            : 'Modifier le compte'
        }
        okText={
          enEdition === 'nouvelle' ? 'Envoyer l’invitation' : 'Enregistrer'
        }
        cancelText="Annuler"
        confirmLoading={
          invitation.loading || modification.loading || definition.loading
        }
        onOk={() => form.submit()}
        onCancel={() => setEnEdition(null)}
        destroyOnHidden
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
            rules={[{ required: true, message: 'Saisissez un nom.' }]}
          >
            <Input
              autoComplete="off"
              disabled={enEdition !== 'nouvelle' && !gereOrganisation}
            />
          </Form.Item>
          <Form.Item
            label="Adresse mail"
            name="email"
            rules={[
              {
                required: true,
                type: 'email',
                message: 'Saisissez une adresse mail valide.',
              },
            ]}
          >
            <Input
              type="email"
              autoComplete="off"
              disabled={enEdition !== 'nouvelle'}
            />
          </Form.Item>
          {gereOrganisation && (
            <>
              <Form.Item
                label="Admin de l’organisation"
                name="estAdmin"
                valuePropName="checked"
                extra="Un admin de l’organisation gère toutes les activités, les comptes et l’identité de l’organisation."
              >
                <Switch
                  disabled={enEdition !== 'nouvelle' && enEdition?.id === moiId}
                />
              </Form.Item>
              <Form.Item
                label="Admin des activités"
                name="activitesAdministrees"
                extra="Un admin d’activité gère ses périodes, ses périmètres, ses affectations et ses fiches. Il ne voit pas les autres activités."
              >
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Aucune activité"
                  options={(toutesActivites?.activites ?? []).map(a => ({
                    value: a.id,
                    label: a.nom,
                  }))}
                />
              </Form.Item>
            </>
          )}
          {champSouhaits && (
            <Form.Item
              label={`Périmètres souhaités pour ${edition.nom}`}
              name="perimetresSouhaites"
              extra="Seuls les admins voient les souhaits. Un souhait ne donne aucun accès."
            >
              <Select
                mode="multiple"
                allowClear
                placeholder="Choisir des périmètres"
                optionFilterProp="label"
                maxCount={SOUHAITS_MAX}
                options={optionsPerimetres}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
