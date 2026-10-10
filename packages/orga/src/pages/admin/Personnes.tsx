import {
  CheckOutlined,
  MailOutlined,
  SendOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Collapse,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'

import Demandes from '../../composants/Demandes'
import InvitationsEnAttente from '../../composants/InvitationsEnAttente'
import EcrireMessage, {
  type CibleMessage,
} from '../../composants/EcrireMessage'
import Messages from '../../composants/Messages'
import Tableau, { type ColonneTableau } from '../../composants/Tableau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type {
  EditionsQuery,
  PersonnesEquipeQuery,
  PersonnesQuery,
} from '../../gql/graphql'
import { messageErreur } from '../../lib/erreurs'
import { INVITATIONS_EN_ATTENTE } from '../../lib/invitations'
import { normaliser } from '../../lib/recherche'
import { type Activite, useActivite } from '../../lib/activite'
import {
  ACTIVITES,
  AFFECTER,
  DEFINIR_ADMIN_ACTIVITE,
  EDITIONS,
  MOI,
  PERIMETRES,
  RETIRER_AFFECTATION,
} from '../../lib/requetes'
import { comparer } from '../../lib/tableau'

// Un admin de l'organisation lit l'annuaire ; un admin d'activité lit l'équipe de
// l'activité affichée (ADR 0018). Les deux listes portent les mêmes champs, et
// l'annuaire ajoute les attributions. Deux requêtes distinctes : le serveur compte
// la complexité de chaque liste demandée, même écartée par une directive.
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
        contactPrincipal
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
      attributions {
        activiteId
        affectee
        interessee
        admin
      }
    }
  }
`)

const EQUIPE = graphql(`
  query PersonnesEquipe($editionId: ID) {
    equipe {
      id
      nom
      email
      estAdmin
      activitesAdministrees
      archive
      affectations(editionId: $editionId) {
        id
        contactPrincipal
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

// L'édition en cours et les périmètres d'une activité, pour affecter une personne
// et noter ses souhaits dans chaque activité administrée.
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

// Les affectations et les souhaits d'une édition d'une autre activité que celle
// affichée, lus à l'ouverture du formulaire pour le préremplir. L'activité affichée
// n'en a pas besoin : la liste de la page les porte déjà pour son édition. Une
// personne absente de l'équipe de cette activité n'y a ni affectation ni souhait.
const SOUHAITS_EDITION = graphql(`
  query SouhaitsEdition($activiteId: ID!, $editionId: ID!) {
    equipe(activiteId: $activiteId) {
      id
      affectations(editionId: $editionId) {
        id
        perimetre {
          id
        }
      }
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
    $editionId: ID
    $perimetresSouhaites: [ID!]
    $perimetresAffectes: [ID!]
  ) {
    inviterPersonne(
      email: $email
      nom: $nom
      editionId: $editionId
      perimetresSouhaites: $perimetresSouhaites
      perimetresAffectes: $perimetresAffectes
    ) {
      enAttente
      personne {
        id
      }
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

type Membre = PersonnesQuery['personnes'][number]
// Une ligne de l'annuaire ou de l'équipe : seul l'annuaire porte les attributions.
type Personne = PersonnesEquipeQuery['equipe'][number] &
  Partial<Pick<Membre, 'attributions'>>

// Filtre de l'annuaire : toutes les personnes, celles d'une activité, ou celles
// qui ne participent à aucune.
const TOUTES = 'toutes'
const SANS_ACTIVITE = 'sans-activite'

/** Le rôle d'une personne dans une activité, pour l'étiquette de l'annuaire. */
function libelleAttribution(a: Membre['attributions'][number]): string {
  const roles = [
    a.admin ? 'admin' : null,
    a.affectee ? 'affecté·e' : a.interessee ? 'intéressé·e' : null,
  ].filter(role => role !== null)
  return roles.join(', ')
}

interface Role {
  libelle: string
  couleur?: string
}

const ROLES = {
  admin: { libelle: 'Admin de l’organisation', couleur: 'blue' },
  membre: { libelle: 'Membre' },
  adminActivite: { libelle: 'Admin de l’activité', couleur: 'geekblue' },
  referent: { libelle: 'Référent·e' },
  interesse: { libelle: 'Intéressé·e' },
} satisfies Record<string, Role>

/** Valeur de filtre d'une personne sans périmètre dans la colonne. */
const AUCUN = 'aucun'

/** Filtre d'une colonne de périmètres : ceux que portent les lignes affichées. */
function filtreParPerimetre<T>(
  lignes: T[],
  liens: (ligne: T) => { perimetre: { id: string; nom: string } }[]
): NonNullable<ColonneTableau<T>['filtre']> {
  const noms = new Map(
    lignes.flatMap(l => liens(l).map(x => [x.perimetre.id, x.perimetre.nom]))
  )
  return {
    options: [
      { text: 'Aucun périmètre', value: AUCUN },
      ...[...noms]
        .sort((a, b) => comparer(a[1], b[1]))
        .map(([value, text]) => ({ text, value })),
    ],
    valeurs: l => {
      const ids = liens(l).map(x => x.perimetre.id)
      return ids.length === 0 ? AUCUN : ids
    },
  }
}

interface Valeurs {
  email: string
  nom: string
  /** Activités dont la personne est admin (ADR 0010). */
  activitesAdministrees?: string[]
  /** Périmètres souhaités, par identifiant d'édition. */
  souhaits?: Record<string, string[] | undefined>
  /** Périmètres affectés, par identifiant d'édition. */
  affectations?: Record<string, string[] | undefined>
}

/** Une affectation lue à l'ouverture de la fenêtre. */
interface AffectationLue {
  id: string
  perimetreId: string
}

const SOUHAITS_MAX = 30

/**
 * Champs des périmètres d'une activité pour une personne : ceux où elle est
 * affectée, puis ceux qu'elle souhaite. L'activité affichée passe l'édition choisie
 * sur la page, avec les affectations et les souhaits déjà lus par la liste ; les
 * autres activités utilisent leur édition en cours et les lisent à l'ouverture. Une
 * invitation part de champs vides.
 */
function ChampsPerimetres({
  activite,
  edition: editionChoisie,
  connus,
  personne,
  seul,
  surLecture,
}: {
  activite: Activite
  edition?: Pick<EditionsQuery['editions'][number], 'id' | 'nom'>
  /** Affectations et souhaits de l'édition choisie, lus par la liste de la page. */
  connus?: { affectations: AffectationLue[]; souhaits: string[] }
  personne: Personne | 'nouvelle'
  /** Vrai pour l'activité affichée : ses champs portent le nom de la période. */
  seul: boolean
  /** Reçoit les affectations lues, pour calculer celles à créer et à retirer. */
  surLecture: (editionId: string, affectations: AffectationLue[]) => void
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
  // de la page ne porte que les périmètres de l'édition affichée.
  const { data: existants } = useQuery(SOUHAITS_EDITION, {
    variables: { activiteId: activite.id, editionId: editionId ?? '' },
    skip: nouvelle || connus !== undefined || editionId === undefined,
    fetchPolicy: 'network-only',
  })
  const membre = existants?.equipe.find(p => p.id === personneId)
  const lus =
    connus ??
    (existants === undefined
      ? undefined
      : {
          affectations: (membre?.affectations ?? []).map(a => ({
            id: a.id,
            perimetreId: a.perimetre.id,
          })),
          souhaits: (membre?.souhaits ?? []).map(
            souhait => souhait.perimetre.id
          ),
        })
  // Périmètres de la personne, limités aux périmètres non archivés.
  const actif = (id: string) => data?.perimetres.some(p => p.id === id) ?? false
  const initiaux =
    data === undefined || editionId === undefined
      ? undefined
      : nouvelle
        ? { affectations: [], souhaits: [] }
        : lus && {
            affectations: lus.affectations.filter(a => actif(a.perimetreId)),
            souhaits: lus.souhaits.filter(actif),
          }
  const pret = initiaux !== undefined
  useEffect(() => {
    if (editionId === undefined || initiaux === undefined) return
    surLecture(editionId, initiaux.affectations)
    // Une saisie en cours n'est jamais remplacée : après une invitation enregistrée
    // en partie, la fenêtre passe en modification et garde les choix à renvoyer.
    if (!form.isFieldTouched(['souhaits', editionId])) {
      form.setFieldValue(['souhaits', editionId], initiaux.souhaits)
    }
    if (!form.isFieldTouched(['affectations', editionId])) {
      form.setFieldValue(
        ['affectations', editionId],
        initiaux.affectations.map(a => a.perimetreId)
      )
    }
    // Les champs se remplissent une fois, quand les périmètres sont lus.
    // Une invitation enregistrée en partie passe en modification : les affectations
    // du compte créé se relisent alors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editionId, pret, nouvelle])

  if (edition === undefined) return null
  const options = activite.groupes
    .map(groupe => ({
      label: groupe.libellePluriel,
      options: (data?.perimetres ?? [])
        .filter(p => p.groupe === groupe.cle)
        .map(p => ({ value: p.id, label: p.nom })),
    }))
    .filter(groupe => groupe.options.length > 0)
  const champ = (placeholder: string) => (
    <Select
      mode="multiple"
      allowClear
      placeholder={placeholder}
      optionFilterProp="label"
      maxCount={SOUHAITS_MAX}
      options={options}
      loading={!pret}
      disabled={!pret}
    />
  )
  return (
    <>
      {!seul && (
        <Typography.Title level={5}>
          {activite.nom} ({edition.nom})
        </Typography.Title>
      )}
      <Form.Item
        label={
          seul
            ? `Périmètres affectés pour ${edition.nom}`
            : 'Périmètres affectés'
        }
        name={['affectations', edition.id]}
      >
        {champ('Aucune affectation')}
      </Form.Item>
      <Form.Item
        label={
          seul
            ? `Périmètres souhaités pour ${edition.nom}`
            : 'Périmètres souhaités'
        }
        name={['souhaits', edition.id]}
      >
        {champ('Aucun souhait')}
      </Form.Item>
    </>
  )
}

/** Le rôle d'admin de l'activité affichée, lu dans la liste des activités administrées. */
function InterrupteurAdmin({
  value = [],
  onChange,
  activiteId,
  disabled,
}: {
  value?: string[]
  onChange?: (valeur: string[]) => void
  activiteId: string
  disabled: boolean
}) {
  return (
    <Switch
      checked={value.includes(activiteId)}
      disabled={disabled}
      onChange={admin =>
        onChange?.(
          admin ? [...value, activiteId] : value.filter(id => id !== activiteId)
        )
      }
    />
  )
}

type FiltreRole = 'tous' | 'admins' | 'membres'

/**
 * Les personnes, sous deux formes (ADR 0018). Dans « Gérer l'activité », l'écran
 * liste l'équipe de l'activité affichée, pour tout admin. Avec `annuaire`, dans
 * « Gérer l'organisation », il liste tous les membres de l'organisation, pour ses
 * admins seulement.
 */
export default function Personnes({
  annuaire: modeAnnuaire = false,
}: {
  annuaire?: boolean
}) {
  const { activite, periode, libelleGroupe, lien } = useActivite()
  const { message } = App.useApp()
  const [inclureArchives, setInclureArchives] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [choix, setChoix] = useState<string | undefined>()
  const [sansAffectation, setSansAffectation] = useState(false)
  const [filtreRole, setFiltreRole] = useState<FiltreRole>('tous')
  const [filtreActivite, setFiltreActivite] = useState(TOUTES)
  const [filtrePerimetres, setFiltrePerimetres] = useState<string[]>([])
  const { data: perimetres } = useQuery(PERIMETRES, { skip: modeAnnuaire })
  const { data: session } = useQuery(MOI)
  const { data: editions } = useQuery(EDITIONS)
  const editionId =
    choix ?? editions?.editions.find(e => e.statut !== 'ARCHIVEE')?.id
  const edition = editions?.editions.find(e => e.id === editionId)
  // Les affectations et les souhaits se modifient pour l'édition choisie, tant
  // qu'elle n'est pas archivée.
  const souhaitsModifiables =
    edition !== undefined && edition.statut !== 'ARCHIVEE'
  // Les rôles, le nom et l'archivage d'un compte relèvent des admins de
  // l'organisation. Un admin d'activité invite, affecte et note les souhaits.
  const gereOrganisation = session?.moi?.estAdmin ?? false
  // L'écran choisit la liste : l'annuaire de l'organisation, ou l'équipe de
  // l'activité affichée.
  const annuaire = useQuery(PERSONNES, {
    variables: { inclureArchives, editionId: editionId ?? null },
    skip: !modeAnnuaire,
  })
  const equipe = useQuery(EQUIPE, {
    variables: { editionId: editionId ?? null },
    skip: modeAnnuaire,
  })
  const liste: Personne[] | undefined = modeAnnuaire
    ? annuaire.data?.personnes
    : equipe.data?.equipe
  const loading = modeAnnuaire ? annuaire.loading : equipe.loading
  const { data: demandes } = useQuery(DEMANDES_EN_ATTENTE, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined || modeAnnuaire,
  })
  const demandesEnAttente = demandes?.demandes.length ?? 0
  // L'onglet se lit dans l'adresse : une notification mène droit aux demandes.
  const [parametres, setParametres] = useSearchParams()
  const ongletDemande = parametres.get('onglet')
  // L'historique des messages d'une activité a son écran (ADR 0027). L'annuaire
  // garde l'onglet qui montre les messages de toute l'organisation.
  const onglet =
    (modeAnnuaire && ongletDemande === 'messages') ||
    (!modeAnnuaire && ongletDemande === 'demandes')
      ? ongletDemande
      : 'annuaire'
  // Les personnes cochées dans le tableau, et celles à qui la fenêtre de rédaction
  // écrit (ADR 0020).
  const [selection, setSelection] = useState<string[]>([])
  const [cibleMessage, setCibleMessage] = useState<CibleMessage | null>(null)
  const [enEdition, setEnEdition] = useState<Personne | 'nouvelle' | null>(null)
  // Compteur d'ouvertures : la fenêtre reste montée d'une ouverture à l'autre, et
  // les champs de souhaits doivent relire les souhaits à chaque fois.
  const [ouverture, setOuverture] = useState(0)
  const [form] = Form.useForm<Valeurs>()
  const rafraichir = {
    refetchQueries: [modeAnnuaire ? PERSONNES : EQUIPE],
  }
  const [inviter, invitation] = useMutation(INVITER, {
    refetchQueries: [...rafraichir.refetchQueries, INVITATIONS_EN_ATTENTE],
  })
  const [modifier, modification] = useMutation(MODIFIER, rafraichir)
  const [archiver] = useMutation(ARCHIVER, rafraichir)
  const [definirSouhaits, definition] = useMutation(
    DEFINIR_SOUHAITS,
    rafraichir
  )
  const [affecter, affectation] = useMutation(AFFECTER, rafraichir)
  const [retirerAffectation, retrait] = useMutation(
    RETIRER_AFFECTATION,
    rafraichir
  )
  // Affectations lues à l'ouverture de la fenêtre, par édition puis par périmètre.
  // Chaque écriture réussie les met à jour : un second enregistrement après un
  // échec ne renvoie que le reste.
  const affectationsLues = useRef(new Map<string, Map<string, string>>())
  const [renvoyer] = useMutation(RENVOYER)
  const [definirAdminActivite] = useMutation(DEFINIR_ADMIN_ACTIVITE, rafraichir)
  const { data: toutesActivites } = useQuery(ACTIVITES)
  const moiId = session?.moi?.id

  // Un message s'écrit à des comptes actifs, sauf à soi-même (ADR 0020).
  const joignables = useMemo(
    () =>
      (liste ?? [])
        .filter(p => !p.archive && p.id !== moiId)
        .map(p => ({ id: p.id, nom: p.nom, email: p.email })),
    [liste, moiId]
  )
  const selectionnees = joignables.filter(p => selection.includes(p.id))
  const contactsPrincipaux = (liste ?? [])
    .filter(p => p.affectations.some(a => a.contactPrincipal))
    .map(p => p.id)

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
  // Un compte archivé ne reçoit plus d'affectation ni de souhait.
  const champSouhaits =
    enEdition !== null && (enEdition === 'nouvelle' || !enEdition.archive)
  // Les périmètres se choisissent dans chaque activité administrée, l'activité
  // affichée en premier. Elle sort de la liste quand l'édition choisie sur la page
  // est archivée : ses champs écriraient sinon sur une autre édition.
  // Un admin d'activité ne gère ici que l'activité affichée, même s'il en administre
  // une autre : seul un admin de l'organisation agit sur plusieurs activités.
  const activitesSouhaits = (toutesActivites?.activites ?? [])
    .filter(a => a.estAdministree && !a.archive)
    .filter(a => gereOrganisation || a.id === activite.id)
    .filter(a => a.id !== activite.id || souhaitsModifiables)
    .sort((a, b) => Number(b.id === activite.id) - Number(a.id === activite.id))

  // Recherche insensible aux accents et à la casse, sur le nom et l'adresse.
  const personnes = useMemo(() => {
    const filtre = normaliser(recherche.trim())
    // Le filtre « Admins » réunit les admins de l'organisation et les admins
    // d'activité : de toute activité dans l'annuaire, de l'activité affichée dans
    // l'équipe.
    const estAdmin = (p: Personne) =>
      p.estAdmin === true ||
      (modeAnnuaire
        ? p.activitesAdministrees.length > 0
        : p.activitesAdministrees.includes(activite.id))
    return (liste ?? []).filter(
      p =>
        (filtreRole === 'tous' || estAdmin(p) === (filtreRole === 'admins')) &&
        (filtre === '' ||
          normaliser(p.nom).includes(filtre) ||
          normaliser(p.email).includes(filtre)) &&
        (modeAnnuaire ||
          !sansAffectation ||
          editionId === undefined ||
          p.affectations.length === 0) &&
        // Une personne répond au filtre par une affectation ou un souhait dans l'un
        // des périmètres choisis.
        (modeAnnuaire ||
          filtrePerimetres.length === 0 ||
          [...p.affectations, ...p.souhaits].some(x =>
            filtrePerimetres.includes(x.perimetre.id)
          )) &&
        (!modeAnnuaire ||
          filtreActivite === TOUTES ||
          p.attributions === undefined ||
          (filtreActivite === SANS_ACTIVITE
            ? p.attributions.length === 0
            : p.attributions.some(a => a.activiteId === filtreActivite)))
    )
  }, [
    liste,
    recherche,
    sansAffectation,
    editionId,
    filtreActivite,
    filtreRole,
    filtrePerimetres,
    modeAnnuaire,
    activite.id,
  ])

  // Un admin d'activité n'agit pas sur un admin de l'organisation (ADR 0019).
  const modifiable = (p: Personne) => gereOrganisation || p.estAdmin !== true

  // L'écran d'une activité montre les rôles de cette activité, et qui administre
  // l'organisation (ADR 0019).
  const roleDe = (p: Personne): Role | null =>
    p.estAdmin
      ? ROLES.admin
      : modeAnnuaire
        ? ROLES.membre
        : p.activitesAdministrees.includes(activite.id)
          ? ROLES.adminActivite
          : p.affectations.length > 0
            ? ROLES.referent
            : p.souhaits.length > 0
              ? ROLES.interesse
              : null

  const ouvrir = (personne: Personne | 'nouvelle') => {
    setEnEdition(personne)
    setOuverture(n => n + 1)
    affectationsLues.current = new Map()
    // Les souhaits d'une ouverture précédente ne doivent pas rester dans le formulaire.
    form.resetFields()
    form.setFieldsValue(
      personne === 'nouvelle'
        ? {
            email: '',
            nom: '',
            activitesAdministrees: [],
          }
        : {
            email: personne.email,
            nom: personne.nom,
            activitesAdministrees: personne.activitesAdministrees,
          }
    )
  }

  const executer = async (
    action: () => Promise<unknown>,
    succes: string | (() => string)
  ) => {
    try {
      await action()
      message.success(typeof succes === 'string' ? succes : succes())
      return true
    } catch (e) {
      message.error(messageErreur(e))
      return false
    }
  }

  const enregistrer = async (v: Valeurs) => {
    // Souhaits saisis, par édition.
    const souhaits = champSouhaits
      ? Object.entries(v.souhaits ?? {}).map(([editionId, ids]) => ({
          editionId,
          ids: ids ?? [],
        }))
      : []
    // Périmètres d'une invitation, par édition : l'invitation porte ceux de la
    // première édition renseignée ; les autres suivent une fois le compte créé.
    const invites = champSouhaits
      ? [
          ...new Set([
            ...Object.keys(v.souhaits ?? {}),
            ...Object.keys(v.affectations ?? {}),
          ]),
        ]
          .map(editionId => ({
            editionId,
            souhaites: v.souhaits?.[editionId] ?? [],
            affectes: v.affectations?.[editionId] ?? [],
          }))
          .filter(i => i.souhaites.length + i.affectes.length > 0)
      : []
    const premiers = invites[0]
    // Un admin d'activité fait entrer la personne dans son équipe par un périmètre,
    // souhaité ou affecté (ADR 0018, 0019). Le serveur refuse aussi une invitation
    // sans périmètre.
    if (enEdition === 'nouvelle' && !modeAnnuaire && premiers === undefined) {
      message.error(
        'Choisissez au moins un périmètre : la personne rejoint votre équipe par ce périmètre.'
      )
      return
    }
    // Le compte créé par l'invitation, pour reprendre la suite si elle échoue.
    let cree: string | undefined
    // Vrai quand l'adresse a déjà un compte hors de l'organisation : l'invitation
    // attend l'accord de la personne, et rien n'est créé en son nom (ADR 0030).
    let enAttente = false
    const ok =
      enEdition === 'nouvelle'
        ? await executer(
            async () => {
              const r = await inviter({
                variables: {
                  email: v.email,
                  nom: v.nom,
                  editionId: premiers?.editionId ?? null,
                  perimetresSouhaites: premiers?.souhaites ?? [],
                  perimetresAffectes: premiers?.affectes ?? [],
                },
              })
              enAttente = r.data?.inviterPersonne.enAttente ?? false
              const id = r.data?.inviterPersonne.personne?.id
              // Un rôle d'admin d'activité se donne à un membre. Une invitation en
              // attente ne le garde pas : l'admin nomme la personne après son
              // accord, et le message de fin le lui rappelle.
              if (id !== undefined) {
                cree = id
                await ajusterAdminsActivite(
                  id,
                  [],
                  v.activitesAdministrees ?? []
                )
              } else if (!enAttente) return
              // Les autres périodes passent aussi par l'invitation, qui ajoute sans
              // rien retirer : la personne a peut-être déjà un compte, des souhaits
              // et des affectations, que ce formulaire n'a pas lus.
              for (const i of invites.slice(1)) {
                await inviter({
                  variables: {
                    email: v.email,
                    nom: v.nom,
                    editionId: i.editionId,
                    perimetresSouhaites: i.souhaites,
                    perimetresAffectes: i.affectes,
                  },
                })
              }
            },
            () =>
              enAttente
                ? `Invitation envoyée. Cette adresse a déjà un compte : la personne accepte ou refuse depuis son compte, et rien n’est créé avant son accord.${
                    (v.activitesAdministrees ?? []).length > 0
                      ? ' Le rôle d’admin d’activité n’est pas gardé : nommez la personne après son accord.'
                      : ''
                  }`
                : 'Invitation enregistrée. Une personne sans compte reçoit un mail avec le lien de connexion.'
          )
        : enEdition
          ? await executer(async () => {
              if (gereOrganisation) {
                await modifier({
                  variables: {
                    id: enEdition.id,
                    nom: v.nom,
                    // Le rôle d'admin de l'organisation se donne sur l'écran
                    // « Admins » : cette fenêtre le laisse tel quel.
                    estAdmin: enEdition.estAdmin ?? false,
                  },
                })
              }
              // Les nominations passent avant tout le reste, les retraits de rôle
              // à la fin : la personne ne sort pas de l'équipe entre deux écritures
              // (ADR 0018).
              const adminsAvant = enEdition.activitesAdministrees
              const adminsApres = v.activitesAdministrees ?? adminsAvant
              const adminsReunis = [
                ...new Set([...adminsAvant, ...adminsApres]),
              ]
              await ajusterAdminsActivite(
                enEdition.id,
                adminsAvant,
                adminsReunis
              )
              // Les affectations d'une édition ne sont envoyées que si le champ a
              // été modifié. Les nouvelles passent avant les souhaits, les retraits
              // après : la personne ne sort pas de l'équipe entre deux écritures
              // (ADR 0018).
              const affectations = champSouhaits
                ? Object.entries(v.affectations ?? {}).flatMap(
                    ([editionId, ids]) => {
                      const lues = affectationsLues.current.get(editionId)
                      return lues !== undefined &&
                        form.isFieldTouched(['affectations', editionId])
                        ? [{ editionId, ids: ids ?? [], lues }]
                        : []
                    }
                  )
                : []
              for (const { editionId, ids, lues } of affectations) {
                for (const perimetreId of ids) {
                  if (lues.has(perimetreId)) continue
                  const r = await affecter({
                    variables: {
                      personneId: enEdition.id,
                      perimetreId,
                      editionId,
                    },
                  })
                  const id = r.data?.affecter.id
                  if (id !== undefined) lues.set(perimetreId, id)
                }
              }
              // Les souhaits d'une édition ne sont envoyés que si le champ a été
              // modifié. Les périodes qui gardent des souhaits passent avant celles
              // qui se vident : une personne déplacée d'une activité à l'autre ne
              // sort pas de l'équipe entre les deux écritures (ADR 0018).
              const ordonnes = [
                ...souhaits.filter(s => s.ids.length > 0),
                ...souhaits.filter(s => s.ids.length === 0),
              ]
              for (const s of ordonnes) {
                if (!form.isFieldTouched(['souhaits', s.editionId])) continue
                await definirSouhaits({
                  variables: {
                    personneId: enEdition.id,
                    editionId: s.editionId,
                    perimetreIds: s.ids,
                  },
                })
              }
              for (const { ids, lues } of affectations) {
                for (const [perimetreId, id] of [...lues]) {
                  if (ids.includes(perimetreId)) continue
                  await retirerAffectation({ variables: { id } })
                  lues.delete(perimetreId)
                }
              }
              await ajusterAdminsActivite(
                enEdition.id,
                adminsReunis,
                adminsApres
              )
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
    const relue: Personne[] | undefined = modeAnnuaire
      ? (await annuaire.refetch()).data?.personnes
      : (await equipe.refetch()).data?.equipe
    const creee = relue?.find(p => p.id === cree)
    if (creee === undefined) {
      setEnEdition(null)
      return
    }
    setEnEdition(creee)
    message.warning(
      'Le compte est créé et l’invitation est envoyée. Une partie des rôles ou des souhaits n’a pas été enregistrée : vérifiez-les, puis enregistrez de nouveau.'
    )
  }

  // L'activité affichée passe en premier ; les autres se rangent dans un volet.
  const autresActivites = activitesSouhaits.filter(a => a.id !== activite.id)
  const champsPerimetres = (a: Activite, seul: boolean) =>
    enEdition === null ? null : (
      <ChampsPerimetres
        key={`${a.id}-${ouverture}`}
        activite={a}
        edition={a.id === activite.id ? edition : undefined}
        connus={
          a.id === activite.id && enEdition !== 'nouvelle'
            ? {
                affectations: enEdition.affectations.map(x => ({
                  id: x.id,
                  perimetreId: x.perimetre.id,
                })),
                souhaits: enEdition.souhaits.map(x => x.perimetre.id),
              }
            : undefined
        }
        personne={enEdition}
        seul={seul}
        surLecture={(editionId, lues) =>
          affectationsLues.current.set(
            editionId,
            new Map(lues.map(x => [x.perimetreId, x.id]))
          )
        }
      />
    )

  // Ancienne adresse de l'historique des messages d'une activité.
  if (!modeAnnuaire && ongletDemande === 'messages') {
    return <Navigate to={lien('/admin/messages')} replace />
  }

  return (
    <>
      <Titre
        sousTitre={
          modeAnnuaire
            ? 'Tous les membres de l’organisation, avec les activités de chacun. Seules les personnes invitées peuvent se connecter à l’espace organisateur.'
            : 'L’équipe de cette activité : les personnes affectées, intéressées ou admins. Vous y ajoutez une personne par son adresse.'
        }
        actions={
          modeAnnuaire ? undefined : (
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
          )
        }
      >
        {modeAnnuaire ? 'Annuaire' : 'Personnes'}
      </Titre>
      <Tabs
        activeKey={onglet}
        onChange={cle =>
          setParametres(cle === 'annuaire' ? {} : { onglet: cle })
        }
        items={[
          {
            key: 'annuaire',
            label: modeAnnuaire ? 'Annuaire' : 'Équipe de l’activité',
          },
          // Les demandes valent pour une période d'une activité.
          ...(modeAnnuaire
            ? []
            : [
                {
                  key: 'demandes',
                  label:
                    demandesEnAttente > 0
                      ? `Demandes (${demandesEnAttente})`
                      : 'Demandes',
                },
              ]),
          ...(modeAnnuaire ? [{ key: 'messages', label: 'Messages' }] : []),
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
      {onglet === 'messages' && (
        <Messages annuaire={modeAnnuaire} personnes={joignables} />
      )}
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
            {modeAnnuaire && (
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
            <Segmented<FiltreRole>
              aria-label="Filtrer par rôle"
              value={filtreRole}
              onChange={setFiltreRole}
              options={[
                { value: 'tous', label: 'Tous' },
                { value: 'admins', label: 'Admins' },
                { value: 'membres', label: 'Membres' },
              ]}
            />
            <Input.Search
              allowClear
              placeholder="Rechercher un nom ou une adresse"
              aria-label="Rechercher un nom ou une adresse"
              style={{ width: 320, maxWidth: '100%' }}
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
            />
            {modeAnnuaire && (
              <Select
                style={{ minWidth: 220 }}
                aria-label="Filtrer par activité"
                value={filtreActivite}
                onChange={setFiltreActivite}
                options={[
                  { value: TOUTES, label: 'Toutes les activités' },
                  ...(toutesActivites?.activites ?? []).map(a => ({
                    value: a.id,
                    label: a.nom,
                  })),
                  { value: SANS_ACTIVITE, label: 'Sans activité' },
                ]}
              />
            )}
            {!modeAnnuaire && (
              <Select
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                style={{ minWidth: 260 }}
                placeholder="Tous les périmètres"
                aria-label="Filtrer par périmètre"
                optionFilterProp="label"
                value={filtrePerimetres}
                onChange={setFiltrePerimetres}
                options={activite.groupes
                  .map(groupe => ({
                    label: libelleGroupe(groupe.cle, true),
                    options: (perimetres?.perimetres ?? [])
                      .filter(p => p.groupe === groupe.cle)
                      .map(p => ({ value: p.id, label: p.nom })),
                  }))
                  .filter(groupe => groupe.options.length > 0)}
              />
            )}
            {!modeAnnuaire && (
              <Checkbox
                checked={sansAffectation && editionId !== undefined}
                disabled={editionId === undefined}
                onChange={e => setSansAffectation(e.target.checked)}
              >
                Sans affectation pour {periode.cette}
              </Checkbox>
            )}
            <Tooltip
              title={
                selectionnees.length === 0
                  ? 'Cochez d’abord des personnes dans le tableau.'
                  : undefined
              }
            >
              <Button
                icon={<SendOutlined />}
                disabled={selectionnees.length === 0}
                onClick={() =>
                  setCibleMessage({
                    destinataires: selectionnees,
                    toutLeMonde: selectionnees.length === joignables.length,
                  })
                }
              >
                {selectionnees.length === 0
                  ? 'Écrire à la sélection'
                  : `Écrire à la sélection (${selectionnees.length})`}
              </Button>
            </Tooltip>
          </Space>

          <InvitationsEnAttente
            {...(modeAnnuaire ? {} : { activiteId: activite.id })}
          />
          <Tableau<Personne>
            id="personnes"
            rowKey="id"
            loading={loading}
            dataSource={personnes}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            rowSelection={{
              selectedRowKeys: selection,
              onChange: cles => setSelection(cles.map(String)),
              preserveSelectedRowKeys: true,
              selections: [Table.SELECTION_ALL, Table.SELECTION_NONE],
              getCheckboxProps: p => ({
                disabled: p.archive || p.id === moiId,
                'aria-label': `Sélectionner ${p.nom}`,
              }),
            }}
            ouvrir={ouvrir}
            peutOuvrir={modifiable}
            libelleOuvrir={p => `Modifier le compte de ${p.nom}`}
            colonnes={[
              {
                key: 'nom',
                title: 'Nom',
                dataIndex: 'nom',
                tri: p => p.nom,
                render: (nom: string, p) => (
                  <Space>
                    <span style={{ fontWeight: 600 }}>{nom}</span>
                    {p.id === moiId && <Tag>Vous</Tag>}
                  </Space>
                ),
              },
              {
                key: 'email',
                title: 'Adresse mail',
                dataIndex: 'email',
                tri: p => p.email,
              },
              // Les affectations et les souhaits valent pour une période d'une
              // activité : l'annuaire montre les activités à la place.
              ...(modeAnnuaire
                ? []
                : ([
                    {
                      title: 'Affectations',
                      key: 'affectations',
                      filtre: filtreParPerimetre(
                        personnes,
                        p => p.affectations
                      ),
                      render: (_, p) =>
                        p.affectations.length === 0 ? (
                          <Typography.Text type="secondary">
                            Aucune
                          </Typography.Text>
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
                      filtre: filtreParPerimetre(personnes, p => p.souhaits),
                      render: (_, p) =>
                        p.souhaits.length === 0 ? (
                          <Typography.Text type="secondary">
                            Aucun
                          </Typography.Text>
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
                  ] satisfies ColonneTableau<Personne>[])),
              // L'admin de l'organisation lit qui participe à quelle activité, toutes
              // périodes confondues (ADR 0018).
              ...(modeAnnuaire
                ? [
                    {
                      title: 'Activités',
                      key: 'activites',
                      render: (_: unknown, p: Personne) => {
                        const attributions = (
                          toutesActivites?.activites ?? []
                        ).flatMap(a => {
                          const lien = p.attributions?.find(
                            x => x.activiteId === a.id
                          )
                          return lien === undefined ? [] : [{ a, lien }]
                        })
                        return attributions.length === 0 ? (
                          <Typography.Text type="secondary">
                            Aucune
                          </Typography.Text>
                        ) : (
                          <Space size={[4, 4]} wrap>
                            {attributions.map(({ a, lien }) => (
                              <Tag
                                key={a.id}
                                color={lien.admin ? 'geekblue' : undefined}
                              >
                                {a.nom} : {libelleAttribution(lien)}
                              </Tag>
                            ))}
                          </Space>
                        )
                      },
                    } satisfies ColonneTableau<Personne>,
                  ]
                : []),
              {
                title: modeAnnuaire ? 'Rôle' : 'Rôle dans l’activité',
                key: 'role',
                render: (_, p) => {
                  const role = roleDe(p)
                  return role && <Tag color={role.couleur}>{role.libelle}</Tag>
                },
                tri: p => roleDe(p)?.libelle,
                filtre: {
                  options: (modeAnnuaire
                    ? [ROLES.admin, ROLES.membre]
                    : [
                        ROLES.admin,
                        ROLES.adminActivite,
                        ROLES.referent,
                        ROLES.interesse,
                      ]
                  ).map(r => ({ text: r.libelle, value: r.libelle })),
                  valeurs: p => roleDe(p)?.libelle ?? [],
                },
              },
              {
                title: 'Actions',
                key: 'actions',
                redimensionnable: false,
                render: (_, p) =>
                  !modifiable(p) ||
                  (p.archive && !modeAnnuaire) ? null : p.archive ? (
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
                      {p.id !== moiId && (
                        <Button
                          size="small"
                          icon={<SendOutlined />}
                          aria-label={`Écrire à ${p.nom}`}
                          onClick={() =>
                            setCibleMessage({
                              destinataires: [
                                { id: p.id, nom: p.nom, email: p.email },
                              ],
                              toutLeMonde: false,
                            })
                          }
                        >
                          Écrire
                        </Button>
                      )}
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
                      {p.id !== moiId && modeAnnuaire && (
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

      <EcrireMessage
        cible={cibleMessage}
        fermer={() => setCibleMessage(null)}
        annuaire={modeAnnuaire}
        editionId={editionId}
        contactsPrincipaux={contactsPrincipaux}
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
          invitation.loading ||
          modification.loading ||
          definition.loading ||
          affectation.loading ||
          retrait.loading
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
          {modeAnnuaire && (
            <>
              <Form.Item
                label="Admin des activités"
                name="activitesAdministrees"
                extra="Un admin d’activité gère ses périodes, ses périmètres, ses affectations et ses fiches. Il ne voit pas les autres activités. Le rôle d’admin de l’organisation se donne depuis l’écran Admins."
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
          {!modeAnnuaire && (
            <Form.Item
              label="Admin de l’activité"
              name="activitesAdministrees"
              extra={
                gereOrganisation
                  ? 'Un admin de l’activité gère ses périodes, ses périmètres, ses affectations et ses fiches.'
                  : 'Un admin de l’activité gère avec vous ses périodes, ses périmètres, ses affectations et ses fiches. Vous ne retirez pas votre propre rôle.'
              }
            >
              <InterrupteurAdmin
                activiteId={activite.id}
                disabled={
                  !gereOrganisation &&
                  enEdition !== 'nouvelle' &&
                  enEdition?.id === moiId
                }
              />
            </Form.Item>
          )}
          {enEdition === 'nouvelle' && !modeAnnuaire && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={
                activitesSouhaits.length === 0
                  ? `Ouvrez d’abord ${periode.une} : une invitation porte au moins un périmètre.`
                  : 'Choisissez au moins un périmètre, affecté ou souhaité : la personne rejoint votre équipe par ce périmètre. Si elle a déjà un compte dans votre organisation, ce compte rejoint l’équipe et garde son nom. Si son compte existe hors de votre organisation, l’invitation attend son accord.'
              }
            />
          )}
          {champSouhaits && activitesSouhaits.length > 0 && (
            <>
              <Typography.Title level={5}>
                Affectations et souhaits
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                Une affectation rend la personne référent·e du périmètre : elle
                y modifie les tâches et reçoit un mail qui l’annonce. Un souhait
                note seulement un intérêt : il ne donne aucun accès, et seuls
                les admins le voient.
              </Typography.Paragraph>
            </>
          )}
          {champSouhaits &&
            activitesSouhaits
              .filter(a => a.id === activite.id)
              .map(a => champsPerimetres(a, true))}
          {champSouhaits && autresActivites.length > 0 && (
            // Le volet se referme à chaque ouverture de la fenêtre. Ses champs ne se
            // montent qu'une fois déplié : rien ne part pour une activité restée
            // repliée.
            <Collapse
              key={ouverture}
              ghost
              items={[
                {
                  key: 'autres',
                  label:
                    enEdition === 'nouvelle'
                      ? 'Inviter aussi dans d’autres activités'
                      : 'Affecter aussi dans d’autres activités',
                  children: autresActivites.map(a =>
                    champsPerimetres(a, false)
                  ),
                },
              ]}
            />
          )}
        </Form>
      </Modal>
    </>
  )
}
