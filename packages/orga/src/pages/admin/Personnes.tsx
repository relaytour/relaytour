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
import { EDITIONS, MOI, PERIMETRES } from '../../lib/requetes'

const PERSONNES = graphql(`
  query Personnes($inclureArchives: Boolean, $editionId: ID) {
    personnes(inclureArchives: $inclureArchives) {
      id
      nom
      email
      estAdmin
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
  perimetresSouhaites?: string[]
}

const SOUHAITS_MAX = 30

/** Deux listes d'identifiants contiennent les mêmes éléments, dans n'importe quel ordre. */
function memesIdentifiants(a: string[], b: string[]): boolean {
  const ensemble = new Set(a)
  return ensemble.size === new Set(b).size && b.every(id => ensemble.has(id))
}

export default function Personnes() {
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
  const moiId = session?.moi?.id
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
      [
        { label: 'Sports', type: 'SPORT' },
        { label: 'Pôles', type: 'POLE' },
      ]
        .map(({ label, type }) => ({
          label,
          options: (perimetres?.perimetres ?? [])
            .filter(p => p.type === type)
            .map(p => ({ value: p.id, label: p.nom })),
        }))
        .filter(groupe => groupe.options.length > 0),
    [perimetres]
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
        ? { email: '', nom: '', estAdmin: false, perimetresSouhaites: [] }
        : {
            email: personne.email,
            nom: personne.nom,
            estAdmin: personne.estAdmin,
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
        ? await executer(
            () =>
              inviter({
                variables: {
                  email: v.email,
                  nom: v.nom,
                  estAdmin: v.estAdmin,
                  editionId: souhaites.length > 0 ? editionId : null,
                  perimetresSouhaites: souhaites,
                },
              }),
            'Invitation envoyée. La personne reçoit un mail avec le lien de connexion.'
          )
        : enEdition
          ? await executer(async () => {
              await modifier({
                variables: {
                  id: enEdition.id,
                  nom: v.nom,
                  estAdmin: v.estAdmin,
                },
              })
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
          <span>Édition</span>
          <Select
            style={{ minWidth: 200 }}
            value={editionId}
            onChange={setChoix}
            placeholder="Choisir une édition"
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
          Sans affectation pour cette édition
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
                        borderInlineStart: `4px solid ${a.perimetre.couleur ?? '#2F6B4F'}`,
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
                        borderInlineStart: `4px solid ${souhait.perimetre.couleur ?? '#2F6B4F'}`,
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
            render: (a: boolean) =>
              a ? <Tag color="blue">Admin</Tag> : <Tag>Référent·e</Tag>,
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, p) =>
              p.archive ? (
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
                  {p.id !== moiId && (
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
            <Input autoComplete="off" />
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
          <Form.Item
            label="Admin"
            name="estAdmin"
            valuePropName="checked"
            extra="Les admins voient l’avancement global et gèrent les comptes et les affectations."
          >
            <Switch
              disabled={enEdition !== 'nouvelle' && enEdition?.id === moiId}
            />
          </Form.Item>
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
