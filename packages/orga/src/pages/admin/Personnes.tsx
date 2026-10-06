import { CheckOutlined, MailOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import Demandes from '../../composants/Demandes'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { EditionsQuery, PersonnesQuery } from '../../gql/graphql'
import { messageErreur } from '../../lib/erreurs'
import { normaliser } from '../../lib/recherche'
import { type Activite, useActivite } from '../../lib/activite'
import { ACTIVITES, EDITIONS, MOI } from '../../lib/requetes'

// Un admin de l'organisation lit l'annuaire ; un admin d'activité lit l'équipe de
// l'activité affichée (ADR 0018). Les deux listes portent les mêmes champs.
const PERSONNES = graphql(`
  query Personnes(
    $inclureArchives: Boolean
    $editionId: ID
    $annuaire: Boolean!
  ) {
    personnes(inclureArchives: $inclureArchives) @include(if: $annuaire) {
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
    equipe @skip(if: $annuaire) {
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

// Le nombre de demandes en attente d'une période, pour le libellé de l'onglet.
const DEMANDES_EN_ATTENTE = graphql(`
  query DemandesEnAttente($editionId: ID!) {
    demandes(editionId: $editionId, statut: EN_ATTENTE) {
      id
    }
  }
`)

// L'édition en cours et les périmètres d'une activité, pour noter des souhaits
// dans chaque activité administrée.
const SOUHAITS_ACTIVITE = graphql(`
  query SouhaitsActivite($activiteId: ID!) {
    editionCourante(activiteId: $activiteId) {
      id
      nom
    }
    perimetres(activiteId: $activiteId) {
      id
      nom
      groupe
    }
  }
`)

// Les souhaits d'une édition d'une autre activité que celle affichée, lus à
// l'ouverture du formulaire pour le préremplir. L'activité affichée n'en a pas
// besoin : la liste de la page porte déjà les souhaits de son édition. Une personne
// absente de l'équipe de cette activité n'y a aucun souhait.
const SOUHAITS_EDITION = graphql(`
  query SouhaitsEdition($activiteId: ID!, $editionId: ID!) {
    equipe(activiteId: $activiteId) {
      id
      souhaits(editionId: $editionId) {
        id
        perimetre {
          id
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

type Personne = NonNullable<PersonnesQuery['personnes']>[number]

interface Valeurs {
  email: string
  nom: string
  estAdmin: boolean
  /** Activités dont la personne est admin (ADR 0010). */
  activitesAdministrees?: string[]
  /** Périmètres souhaités, par identifiant d'édition. */
  souhaits?: Record<string, string[] | undefined>
}

const SOUHAITS_MAX = 30

/**
 * Champ des périmètres souhaités pour une activité. L'activité affichée passe
 * l'édition choisie sur la page et les souhaits déjà lus par la liste ; les autres
 * activités utilisent leur édition en cours et lisent leurs souhaits à l'ouverture.
 */
function ChampSouhaits({
  activite,
  edition: editionChoisie,
  connus,
  personne,
  seul,
  extra,
}: {
  activite: Activite
  edition?: Pick<EditionsQuery['editions'][number], 'id' | 'nom'>
  /** Périmètres déjà souhaités pour l'édition choisie, lus par la liste de la page. */
  connus?: string[]
  personne: Personne | 'nouvelle'
  /** Vrai quand le formulaire ne propose qu'une activité. */
  seul: boolean
  extra?: string
}) {
  const form = Form.useFormInstance<Valeurs>()
  const { data } = useQuery(SOUHAITS_ACTIVITE, {
    variables: { activiteId: activite.id },
  })
  const edition = editionChoisie ?? data?.editionCourante ?? undefined
  const editionId = edition?.id
  const nouvelle = personne === 'nouvelle'
  const personneId = nouvelle ? undefined : personne.id
  // Lecture fraîche à chaque ouverture, pour une autre activité seulement : la liste
  // de la page ne porte que les souhaits de l'édition affichée.
  const { data: existants } = useQuery(SOUHAITS_EDITION, {
    variables: { activiteId: activite.id, editionId: editionId ?? '' },
    skip: nouvelle || connus !== undefined || editionId === undefined,
    fetchPolicy: 'network-only',
  })
  const lus =
    connus ??
    (existants === undefined
      ? undefined
      : (existants.equipe
          .find(p => p.id === personneId)
          ?.souhaits.map(souhait => souhait.perimetre.id) ?? []))
  // Souhaits de la personne, limités aux périmètres non archivés.
  const initiaux =
    data === undefined || editionId === undefined
      ? undefined
      : nouvelle
        ? []
        : lus?.filter(id => data.perimetres.some(p => p.id === id))
  const pret = initiaux !== undefined
  useEffect(() => {
    // Une saisie en cours n'est jamais remplacée : après une invitation enregistrée
    // en partie, la fenêtre passe en modification et garde les choix à renvoyer.
    if (
      editionId !== undefined &&
      initiaux !== undefined &&
      !form.isFieldTouched(['souhaits', editionId])
    ) {
      form.setFieldValue(['souhaits', editionId], initiaux)
    }
    // Le champ se remplit une fois, quand les souhaits sont lus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editionId, pret])

  if (edition === undefined) return null
  const options = activite.groupes
    .map(groupe => ({
      label: groupe.libellePluriel,
      options: (data?.perimetres ?? [])
        .filter(p => p.groupe === groupe.cle)
        .map(p => ({ value: p.id, label: p.nom })),
    }))
    .filter(groupe => groupe.options.length > 0)
  return (
    <Form.Item
      label={
        seul
          ? `Périmètres souhaités pour ${edition.nom}`
          : `${activite.nom} (${edition.nom})`
      }
      name={['souhaits', edition.id]}
      extra={extra}
    >
      <Select
        mode="multiple"
        allowClear
        placeholder="Choisir des périmètres"
        optionFilterProp="label"
        maxCount={SOUHAITS_MAX}
        options={options}
        loading={!pret}
        disabled={!pret}
      />
    </Form.Item>
  )
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
  const editionId =
    choix ?? editions?.editions.find(e => e.statut !== 'ARCHIVEE')?.id
  const edition = editions?.editions.find(e => e.id === editionId)
  // Les souhaits se notent pour l'édition choisie, tant qu'elle n'est pas archivée.
  const souhaitsModifiables =
    edition !== undefined && edition.statut !== 'ARCHIVEE'
  const { data, loading, refetch } = useQuery(PERSONNES, {
    variables: {
      inclureArchives,
      editionId: editionId ?? null,
      annuaire: session?.moi?.estAdmin ?? false,
    },
    // Le rôle choisit la liste : la requête attend la session.
    skip: session === undefined,
  })
  const { data: demandes } = useQuery(DEMANDES_EN_ATTENTE, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  const demandesEnAttente = demandes?.demandes.length ?? 0
  // L'onglet se lit dans l'adresse : une notification mène droit aux demandes.
  const [parametres, setParametres] = useSearchParams()
  const onglet =
    parametres.get('onglet') === 'demandes' ? 'demandes' : 'annuaire'
  const [enEdition, setEnEdition] = useState<Personne | 'nouvelle' | null>(null)
  // Compteur d'ouvertures : la fenêtre reste montée d'une ouverture à l'autre, et
  // les champs de souhaits doivent relire les souhaits à chaque fois.
  const [ouverture, setOuverture] = useState(0)
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
    enEdition !== null && (enEdition === 'nouvelle' || !enEdition.archive)
  // Les souhaits se notent dans chaque activité administrée, l'activité affichée
  // en premier. Elle sort de la liste quand l'édition choisie sur la page est
  // archivée : son champ noterait sinon les souhaits sur une autre édition.
  const activitesSouhaits = (toutesActivites?.activites ?? [])
    .filter(a => a.estAdministree && !a.archive)
    .filter(a => a.id !== activite.id || souhaitsModifiables)
    .sort((a, b) => Number(b.id === activite.id) - Number(a.id === activite.id))

  // Recherche insensible aux accents et à la casse, sur le nom et l'adresse.
  const personnes = useMemo(() => {
    const filtre = normaliser(recherche.trim())
    return (data?.personnes ?? data?.equipe ?? []).filter(
      p =>
        (filtre === '' ||
          normaliser(p.nom).includes(filtre) ||
          normaliser(p.email).includes(filtre)) &&
        (!sansAffectation ||
          editionId === undefined ||
          p.affectations.length === 0)
    )
  }, [data, recherche, sansAffectation, editionId])

  const ouvrir = (personne: Personne | 'nouvelle') => {
    setEnEdition(personne)
    setOuverture(n => n + 1)
    // Les souhaits d'une ouverture précédente ne doivent pas rester dans le formulaire.
    form.resetFields()
    form.setFieldsValue(
      personne === 'nouvelle'
        ? {
            email: '',
            nom: '',
            estAdmin: false,
            activitesAdministrees: [],
          }
        : {
            email: personne.email,
            nom: personne.nom,
            estAdmin: personne.estAdmin ?? false,
            activitesAdministrees: personne.activitesAdministrees,
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
    // Souhaits saisis, par édition. L'invitation porte ceux de la première édition
    // renseignée ; les autres suivent une fois le compte créé.
    const souhaits = champSouhaits
      ? Object.entries(v.souhaits ?? {}).map(([editionId, ids]) => ({
          editionId,
          ids: ids ?? [],
        }))
      : []
    const premiers = souhaits.find(s => s.ids.length > 0)
    // Un admin d'activité fait entrer la personne dans son équipe par un périmètre
    // (ADR 0018). Le serveur refuse aussi une invitation sans périmètre.
    if (
      enEdition === 'nouvelle' &&
      !gereOrganisation &&
      premiers === undefined
    ) {
      message.error(
        'Choisissez au moins un périmètre : la personne rejoint votre équipe par ce périmètre.'
      )
      return
    }
    // Le compte créé par l'invitation, pour reprendre la suite si elle échoue.
    let cree: string | undefined
    const ok =
      enEdition === 'nouvelle'
        ? await executer(async () => {
            const r = await inviter({
              variables: {
                email: v.email,
                nom: v.nom,
                estAdmin: gereOrganisation && v.estAdmin,
                editionId: premiers?.editionId ?? null,
                perimetresSouhaites: premiers?.ids ?? [],
              },
            })
            const id = r.data?.inviterPersonne.id
            if (id === undefined) return
            cree = id
            if (gereOrganisation) {
              await ajusterAdminsActivite(id, [], v.activitesAdministrees ?? [])
            }
            for (const s of souhaits) {
              if (s === premiers || s.ids.length === 0) continue
              await definirSouhaits({
                variables: {
                  personneId: id,
                  editionId: s.editionId,
                  perimetreIds: s.ids,
                },
              })
            }
          }, 'Invitation enregistrée. Une personne sans compte reçoit un mail avec le lien de connexion.')
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
              // Les souhaits d'une édition ne sont envoyés que si le champ a été modifié.
              for (const s of souhaits) {
                if (!form.isFieldTouched(['souhaits', s.editionId])) continue
                await definirSouhaits({
                  variables: {
                    personneId: enEdition.id,
                    editionId: s.editionId,
                    perimetreIds: s.ids,
                  },
                })
              }
            }, 'Compte enregistré.')
          : false
    if (ok) {
      setEnEdition(null)
      return
    }
    if (cree === undefined) return
    // Le compte existe et l'invitation est partie, mais un rôle ou un souhait a
    // échoué. Une nouvelle invitation serait refusée : la fenêtre passe en
    // modification de ce compte et garde la saisie, pour ne renvoyer que le reste.
    const relue = (await refetch()).data
    const creee = (relue?.personnes ?? relue?.equipe)?.find(p => p.id === cree)
    if (creee === undefined) {
      setEnEdition(null)
      return
    }
    setEnEdition(creee)
    message.warning(
      'Le compte est créé et l’invitation est envoyée. Une partie des rôles ou des souhaits n’a pas été enregistrée : vérifiez-les, puis enregistrez de nouveau.'
    )
  }

  return (
    <>
      <Titre
        sousTitre={
          gereOrganisation
            ? 'Seules les personnes invitées ici peuvent se connecter à l’espace organisateur.'
            : 'Vous lisez l’équipe de cette activité : les personnes affectées, intéressées ou admins. Vous y ajoutez une personne par son adresse.'
        }
        actions={
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
        }
      >
        Personnes
      </Titre>
      <Tabs
        activeKey={onglet}
        onChange={cle =>
          setParametres(cle === 'demandes' ? { onglet: 'demandes' } : {})
        }
        items={[
          {
            key: 'annuaire',
            label: gereOrganisation ? 'Annuaire' : 'Votre équipe',
          },
          {
            key: 'demandes',
            label:
              demandesEnAttente > 0
                ? `Demandes (${demandesEnAttente})`
                : 'Demandes',
          },
        ]}
      />
      {onglet === 'demandes' &&
        (editionId === undefined ? (
          <Empty description={`Créez d’abord ${periode.une}.`} />
        ) : (
          <Demandes
            editionId={editionId}
            archivee={edition?.statut === 'ARCHIVEE'}
          />
        ))}
      {onglet === 'annuaire' && (
        <>
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
            {gereOrganisation && (
              <Space>
                <Switch
                  checked={inclureArchives}
                  onChange={setInclureArchives}
                />
                <span>Afficher les comptes archivés</span>
              </Space>
            )}
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
                title: gereOrganisation ? 'Rôle' : 'Rôle dans l’activité',
                dataIndex: 'estAdmin',
                render: (a: boolean, p) =>
                  !gereOrganisation ? (
                    // Un admin d'activité ne lit que les rôles de son activité.
                    p.activitesAdministrees.includes(activite.id) ? (
                      <Tag color="geekblue">Admin de l’activité</Tag>
                    ) : p.affectations.length > 0 ? (
                      <Tag>Référent·e</Tag>
                    ) : p.souhaits.length > 0 ? (
                      <Tag>Intéressé·e</Tag>
                    ) : null
                  ) : a ? (
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
                            archiver({
                              variables: { id: p.id, archive: false },
                            }),
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
        </>
      )}

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
          {enEdition === 'nouvelle' && !gereOrganisation && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={
                activitesSouhaits.length === 0
                  ? `Ouvrez d’abord ${periode.une} : une invitation porte au moins un périmètre.`
                  : 'Choisissez au moins un périmètre : la personne rejoint votre équipe par ce périmètre. Si elle a déjà un compte, ce compte est rattaché et garde son nom.'
              }
            />
          )}
          {champSouhaits && activitesSouhaits.length > 1 && (
            <Typography.Title level={5}>Périmètres souhaités</Typography.Title>
          )}
          {champSouhaits &&
            activitesSouhaits.map((a, i) => (
              <ChampSouhaits
                key={`${a.id}-${ouverture}`}
                activite={a}
                edition={a.id === activite.id ? edition : undefined}
                connus={
                  a.id === activite.id && enEdition !== 'nouvelle'
                    ? enEdition.souhaits.map(s => s.perimetre.id)
                    : undefined
                }
                personne={enEdition}
                seul={activitesSouhaits.length === 1}
                extra={
                  i === activitesSouhaits.length - 1
                    ? 'Seuls les admins voient les souhaits. Un souhait ne donne aucun accès.'
                    : undefined
                }
              />
            ))}
        </Form>
      </Modal>
    </>
  )
}
