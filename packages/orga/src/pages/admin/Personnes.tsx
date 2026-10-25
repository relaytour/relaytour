import {
  CheckOutlined,
  MailOutlined,
  SendOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
import { Navigate, useNavigate, useSearchParams } from 'react-router'

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
      nomModifiable
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
        rattachee
        affectee
        interessee
        admin
      }
    }
  }
`)

const EQUIPE = graphql(`
  query PersonnesEquipe($editionId: ID, $gereOrganisation: Boolean!) {
    equipe {
      id
      nom
      email
      estAdmin
      activitesAdministrees
      archive
      # Réservé aux admins de l'organisation, qui corrigent le nom d'une personne
      # jamais connectée (ADR 0031).
      nomModifiable @include(if: $gereOrganisation)
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
    $activiteId: ID
    $editionId: ID
    $perimetresSouhaites: [ID!]
    $perimetresAffectes: [ID!]
  ) {
    inviterPersonne(
      email: $email
      nom: $nom
      activiteId: $activiteId
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

// Rattachement d'une personne à une activité, sans périmètre (ADR 0045).
const RATTACHER = graphql(`
  mutation RattacherALActivite($userId: ID!, $activiteId: ID!) {
    rattacherALActivite(userId: $userId, activiteId: $activiteId)
  }
`)

const RETIRER_DE_L_ACTIVITE = graphql(`
  mutation RetirerDeLActivite($userId: ID!, $activiteId: ID!) {
    retirerDeLActivite(userId: $userId, activiteId: $activiteId)
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
  // Le commentaire s'écrit en toutes lettres : l'extraction ne lit pas une variable.
  const roles = [
    a.admin
      ? t({
          message: 'admin',
          comment: 'Rôle d’une personne dans une activité, en liste',
        })
      : null,
    a.affectee
      ? t({
          message: 'affecté·e',
          comment: 'Rôle d’une personne dans une activité, en liste',
        })
      : a.interessee
        ? t({
            message: 'intéressé·e',
            comment: 'Rôle d’une personne dans une activité, en liste',
          })
        : a.rattachee
          ? t({
              message: 'sans périmètre',
              comment: 'Rôle d’une personne dans une activité, en liste',
            })
          : null,
  ].filter(role => role !== null)
  return roles.join(', ')
}

interface Role {
  libelle: MessageDescriptor
  couleur?: string
}

const ROLES = {
  admin: { libelle: msg`Admin de l’organisation`, couleur: 'blue' },
  membre: {
    libelle: msg({ message: 'Membre', comment: 'Rôle d’une personne' }),
  },
  adminActivite: { libelle: msg`Admin de l’activité`, couleur: 'geekblue' },
  referent: {
    libelle: msg({ message: 'Référent·e', comment: 'Rôle d’une personne' }),
  },
  interesse: {
    libelle: msg({ message: 'Intéressé·e', comment: 'Rôle d’une personne' }),
  },
  // Rattachée à l'activité, sans affectation ni souhait pour la période (ADR 0045).
  equipe: { libelle: msg`Sans périmètre` },
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
      { text: t`Aucun périmètre`, value: AUCUN },
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
  /** Activités où la personne est rattachée, dans l'annuaire (ADR 0045). */
  activites?: string[]
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
  const { t } = useLingui()
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
  const nomEdition = edition.nom
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
            ? t`Périmètres affectés pour ${nomEdition}`
            : t`Périmètres affectés`
        }
        name={['affectations', edition.id]}
      >
        {champ(t`Aucune affectation`)}
      </Form.Item>
      <Form.Item
        label={
          seul
            ? t`Périmètres souhaités pour ${nomEdition}`
            : t`Périmètres souhaités`
        }
        name={['souhaits', edition.id]}
      >
        {champ(t`Aucun souhait`)}
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
  const { t } = useLingui()
  const { activite, periode, libelleGroupe, lien } = useActivite()
  const navigate = useNavigate()
  const periodeUne = periode.une
  const periodeCette = periode.cette
  const nomActivite = activite.nom
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
  // Les rôles et l'archivage d'une personne relèvent des admins de
  // l'organisation. Le nom appartient à la personne dès sa première connexion
  // (ADR 0031). Un admin d'activité invite, affecte et note les souhaits.
  const gereOrganisation = session?.moi?.estAdmin ?? false
  // L'écran choisit la liste : l'annuaire de l'organisation, ou l'équipe de
  // l'activité affichée.
  const annuaire = useQuery(PERSONNES, {
    variables: { inclureArchives, editionId: editionId ?? null },
    skip: !modeAnnuaire,
    // L'interrupteur des personnes archivées change les variables : la liste gardée
    // en cache pour l'autre position date d'avant le dernier archivage.
    fetchPolicy: 'cache-and-network',
  })
  const equipe = useQuery(EQUIPE, {
    variables: { editionId: editionId ?? null, gereOrganisation },
    skip: modeAnnuaire || session === undefined,
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
  // Un admin de l'organisation corrige le nom d'une personne tant qu'elle ne
  // s'est jamais connectée (ADR 0031).
  const nomVerrouille =
    gereOrganisation &&
    enEdition !== null &&
    enEdition !== 'nouvelle' &&
    enEdition.nomModifiable === false
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
  const [rattacher, rattachement] = useMutation(RATTACHER, rafraichir)
  const [retirerDeLActivite] = useMutation(RETIRER_DE_L_ACTIVITE, rafraichir)
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
  const nbSelectionnees = selectionnees.length
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
  // Une personne archivée ne reçoit plus d'affectation ni de souhait.
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
              : ROLES.equipe

  const libelleRole = (p: Personne) => {
    const role = roleDe(p)
    return role ? t(role.libelle) : undefined
  }

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
            activites: [],
          }
        : {
            email: personne.email,
            nom: personne.nom,
            activitesAdministrees: personne.activitesAdministrees,
            activites: (personne.attributions ?? [])
              .filter(a => a.rattachee)
              .map(a => a.activiteId),
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
    // La personne rejoint l'équipe de chaque activité choisie, avec ou sans
    // périmètre (ADR 0045) : l'activité affichée pour l'équipe d'une activité, les
    // activités choisies dans l'annuaire.
    const activitesInvitees = modeAnnuaire ? (v.activites ?? []) : [activite.id]
    // Chaque appel ajoute sans rien retirer : les périmètres de chaque période, puis
    // chaque activité. Sans rien de tout cela, l'invitation se fait au niveau de
    // l'organisation.
    const appels: {
      activiteId?: string | null
      editionId?: string
      perimetresSouhaites?: string[]
      perimetresAffectes?: string[]
    }[] = [
      ...invites.map(i => ({
        editionId: i.editionId,
        perimetresSouhaites: i.souhaites,
        perimetresAffectes: i.affectes,
      })),
      ...activitesInvitees.map(activiteId => ({ activiteId })),
    ]
    if (appels.length === 0) appels.push({ activiteId: null })
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
                variables: { email: v.email, nom: v.nom, ...appels[0] },
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
              // Les autres périodes et les activités passent aussi par
              // l'invitation, qui ajoute sans rien retirer : la personne a
              // peut-être déjà un compte, des souhaits et des affectations, que ce
              // formulaire n'a pas lus.
              for (const appel of appels.slice(1)) {
                await inviter({
                  variables: { email: v.email, nom: v.nom, ...appel },
                })
              }
            },
            () =>
              enAttente
                ? (v.activitesAdministrees ?? []).length > 0
                  ? t`Invitation envoyée. Cette adresse a déjà un compte : la personne accepte ou refuse depuis son compte, et rien n’est créé avant son accord. Le rôle d’admin d’activité n’est pas gardé : nommez la personne après son accord.`
                  : t`Invitation envoyée. Cette adresse a déjà un compte : la personne accepte ou refuse depuis son compte, et rien n’est créé avant son accord.`
                : t`Invitation enregistrée. Une personne sans compte reçoit un mail avec le lien de connexion.`
          )
        : enEdition
          ? await executer(
              async () => {
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
                // Les rattachements de l'annuaire (ADR 0045) : les nouveaux d'abord,
                // les retraits à la fin.
                const rattacheesAvant = (enEdition.attributions ?? [])
                  .filter(a => a.rattachee)
                  .map(a => a.activiteId)
                const rattacheesApres =
                  modeAnnuaire && form.isFieldTouched('activites')
                    ? (v.activites ?? [])
                    : rattacheesAvant
                for (const activiteId of rattacheesApres) {
                  if (rattacheesAvant.includes(activiteId)) continue
                  await rattacher({
                    variables: { userId: enEdition.id, activiteId },
                  })
                }
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
                for (const activiteId of rattacheesAvant) {
                  if (rattacheesApres.includes(activiteId)) continue
                  await retirerDeLActivite({
                    variables: { userId: enEdition.id, activiteId },
                  })
                }
              },
              t`Compte enregistré.`
            )
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
      t`Le compte est créé et l’invitation est envoyée. Une partie des rôles ou des souhaits n’a pas été enregistrée : vérifiez-les, puis enregistrez de nouveau.`
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
            ? t`Tous les membres de l’organisation, avec les activités de chacun. Seules les personnes invitées peuvent se connecter à l’espace organisateur.`
            : t`L’équipe de cette activité : les personnes rattachées, affectées, intéressées ou admins. Vous y ajoutez une personne par son adresse.`
        }
        actions={
          modeAnnuaire ? undefined : (
            <Space>
              <span>{periode.Nom}</span>
              <Select
                style={{ minWidth: 200 }}
                value={editionId}
                onChange={setChoix}
                placeholder={t`Choisir ${periodeUne}`}
                options={(editions?.editions ?? []).map(e => ({
                  value: e.id,
                  label: e.nom,
                }))}
              />
            </Space>
          )
        }
      >
        {modeAnnuaire ? t`Annuaire` : t`Personnes`}
      </Titre>
      <Tabs
        activeKey={onglet}
        onChange={cle =>
          setParametres(cle === 'annuaire' ? {} : { onglet: cle })
        }
        items={[
          {
            key: 'annuaire',
            label: modeAnnuaire ? t`Annuaire` : t`Équipe de l’activité`,
          },
          // Les demandes valent pour une période d'une activité.
          ...(modeAnnuaire
            ? []
            : [
                {
                  key: 'demandes',
                  label:
                    demandesEnAttente > 0
                      ? t`Demandes (${demandesEnAttente})`
                      : t`Demandes`,
                },
              ]),
          ...(modeAnnuaire ? [{ key: 'messages', label: t`Messages` }] : []),
        ]}
      />
      {onglet === 'demandes' &&
        (editionId === undefined ? (
          <Empty description={t`Créez d’abord ${periodeUne}.`} />
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
            <Space wrap>
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => ouvrir('nouvelle')}
              >
                <Trans>Inviter une personne</Trans>
              </Button>
              {/* L'import vise l'équipe d'une activité (ADR 0049), pas l'annuaire. */}
              {!modeAnnuaire && (
                <Button onClick={() => navigate(lien('/admin/import/equipe'))}>
                  <Trans>Importer une liste</Trans>
                </Button>
              )}
            </Space>
            {modeAnnuaire && (
              <Space>
                <Switch
                  checked={inclureArchives}
                  onChange={setInclureArchives}
                />
                <span>
                  <Trans>Afficher les personnes archivées</Trans>
                </span>
              </Space>
            )}
          </Space>
          <Space wrap size={[16, 12]} style={{ marginBottom: 16 }}>
            <Segmented<FiltreRole>
              aria-label={t`Filtrer par rôle`}
              value={filtreRole}
              onChange={setFiltreRole}
              options={[
                {
                  value: 'tous',
                  label: t({
                    message: 'Tous',
                    comment:
                      'Filtre : toutes les personnes, quel que soit le rôle',
                  }),
                },
                { value: 'admins', label: t`Admins` },
                {
                  value: 'membres',
                  label: t({
                    message: 'Membres',
                    comment: 'Filtre : les personnes qui ne sont pas admins',
                  }),
                },
              ]}
            />
            <Input.Search
              allowClear
              placeholder={t`Rechercher un nom ou une adresse`}
              aria-label={t`Rechercher un nom ou une adresse`}
              style={{ width: 320, maxWidth: '100%' }}
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
            />
            {modeAnnuaire && (
              <Select
                style={{ minWidth: 220 }}
                aria-label={t`Filtrer par activité`}
                value={filtreActivite}
                onChange={setFiltreActivite}
                options={[
                  { value: TOUTES, label: t`Toutes les activités` },
                  ...(toutesActivites?.activites ?? []).map(a => ({
                    value: a.id,
                    label: a.nom,
                  })),
                  { value: SANS_ACTIVITE, label: t`Sans activité` },
                ]}
              />
            )}
            {!modeAnnuaire && (
              <Select
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                style={{ minWidth: 260 }}
                placeholder={t`Tous les périmètres`}
                aria-label={t`Filtrer par périmètre`}
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
                <Trans>Sans affectation pour {periodeCette}</Trans>
              </Checkbox>
            )}
            <Tooltip
              title={
                selectionnees.length === 0
                  ? t`Cochez d’abord des personnes dans le tableau.`
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
                  ? t`Écrire à la sélection`
                  : t`Écrire à la sélection (${nbSelectionnees})`}
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
              getCheckboxProps: p => {
                const nomPersonne = p.nom
                return {
                  disabled: p.archive || p.id === moiId,
                  'aria-label': t`Sélectionner ${nomPersonne}`,
                }
              },
            }}
            ouvrir={ouvrir}
            peutOuvrir={modifiable}
            libelleOuvrir={p => {
              const nomPersonne = p.nom
              return t`Modifier le compte de ${nomPersonne}`
            }}
            colonnes={[
              {
                key: 'nom',
                title: t`Nom`,
                dataIndex: 'nom',
                tri: p => p.nom,
                render: (nom: string, p) => (
                  <Space>
                    <span style={{ fontWeight: 600 }}>{nom}</span>
                    {p.id === moiId && (
                      <Tag>
                        <Trans>Vous</Trans>
                      </Tag>
                    )}
                  </Space>
                ),
              },
              {
                key: 'email',
                title: t`Adresse mail`,
                dataIndex: 'email',
                tri: p => p.email,
              },
              // Les affectations et les souhaits valent pour une période d'une
              // activité : l'annuaire montre les activités à la place.
              ...(modeAnnuaire
                ? []
                : ([
                    {
                      title: t`Affectations`,
                      key: 'affectations',
                      filtre: filtreParPerimetre(
                        personnes,
                        p => p.affectations
                      ),
                      render: (_, p) =>
                        p.affectations.length === 0 ? (
                          <Typography.Text type="secondary">
                            {t({
                              message: 'Aucune',
                              comment: 'Aucune affectation',
                            })}
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
                      title: t`Souhaits`,
                      key: 'souhaits',
                      filtre: filtreParPerimetre(personnes, p => p.souhaits),
                      render: (_, p) =>
                        p.souhaits.length === 0 ? (
                          <Typography.Text type="secondary">
                            {t({
                              message: 'Aucun',
                              comment: 'Aucun souhait',
                            })}
                          </Typography.Text>
                        ) : (
                          <Space size={[4, 4]} wrap>
                            {p.souhaits.map(souhait => (
                              <Tag
                                key={souhait.id}
                                icon={
                                  souhait.satisfait ? (
                                    <CheckOutlined
                                      aria-label={t`Satisfait :`}
                                    />
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
                      title: t`Activités`,
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
                            {t({
                              message: 'Aucune',
                              comment: 'Aucune activité',
                            })}
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
                title: modeAnnuaire
                  ? t({ message: 'Rôle', comment: 'Colonne de l’annuaire' })
                  : t`Rôle dans l’activité`,
                key: 'role',
                render: (_, p) => {
                  const role = roleDe(p)
                  return (
                    role && <Tag color={role.couleur}>{t(role.libelle)}</Tag>
                  )
                },
                tri: p => libelleRole(p),
                filtre: {
                  options: (modeAnnuaire
                    ? [ROLES.admin, ROLES.membre]
                    : [
                        ROLES.admin,
                        ROLES.adminActivite,
                        ROLES.referent,
                        ROLES.interesse,
                        ROLES.equipe,
                      ]
                  ).map(r => ({ text: t(r.libelle), value: t(r.libelle) })),
                  valeurs: p => libelleRole(p) ?? [],
                },
              },
              {
                title: t`Actions`,
                key: 'actions',
                redimensionnable: false,
                render: (_, p) => {
                  const nomPersonne = p.nom
                  return !modifiable(p) ||
                    (p.archive && !modeAnnuaire) ? null : p.archive ? (
                    <Button
                      size="small"
                      onClick={() =>
                        void executer(
                          () =>
                            archiver({
                              variables: { id: p.id, archive: false },
                            }),
                          t`Personne restaurée.`
                        )
                      }
                    >
                      <Trans>Restaurer</Trans>
                    </Button>
                  ) : (
                    <Space>
                      {p.id !== moiId && (
                        <Button
                          size="small"
                          icon={<SendOutlined />}
                          aria-label={t`Écrire à ${nomPersonne}`}
                          onClick={() =>
                            setCibleMessage({
                              destinataires: [
                                { id: p.id, nom: p.nom, email: p.email },
                              ],
                              toutLeMonde: false,
                            })
                          }
                        >
                          <Trans>Écrire</Trans>
                        </Button>
                      )}
                      <Button
                        size="small"
                        icon={<MailOutlined />}
                        onClick={() =>
                          void executer(
                            () => renvoyer({ variables: { id: p.id } }),
                            t`Invitation renvoyée.`
                          )
                        }
                      >
                        <Trans>Renvoyer l’invitation</Trans>
                      </Button>
                      {/* Une personne sans affectation pour la période quitte
                          l'équipe de l'activité (ADR 0045). Le serveur refuse si
                          elle reste affectée dans une autre période en cours. */}
                      {!modeAnnuaire &&
                        p.id !== moiId &&
                        p.estAdmin !== true &&
                        p.affectations.length === 0 &&
                        !p.activitesAdministrees.includes(activite.id) && (
                          <Popconfirm
                            title={t`Retirer cette personne de l’activité ?`}
                            description={t`Elle quitte l’équipe de l’activité, et ses souhaits des périodes en cours sont retirés. Son compte reste dans l’organisation.`}
                            okText={t`Retirer`}
                            cancelText={t`Annuler`}
                            onConfirm={() =>
                              executer(
                                () =>
                                  retirerDeLActivite({
                                    variables: {
                                      userId: p.id,
                                      activiteId: activite.id,
                                    },
                                  }),
                                t`Personne retirée de l’activité.`
                              )
                            }
                          >
                            <Button size="small">
                              <Trans>Retirer de l’activité</Trans>
                            </Button>
                          </Popconfirm>
                        )}
                      {p.id !== moiId && modeAnnuaire && (
                        <Popconfirm
                          title={t`Archiver cette personne ?`}
                          description={t`La personne perd l’accès à votre organisation. Son compte et son historique restent conservés.`}
                          okText={t`Archiver`}
                          cancelText={t`Annuler`}
                          onConfirm={() =>
                            executer(
                              () =>
                                archiver({
                                  variables: { id: p.id, archive: true },
                                }),
                              t`Personne archivée.`
                            )
                          }
                        >
                          <Button size="small" danger>
                            <Trans>Archiver</Trans>
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>
                  )
                },
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
            ? t`Inviter une personne`
            : t`Modifier le compte`
        }
        okText={
          enEdition === 'nouvelle' ? t`Envoyer l’invitation` : t`Enregistrer`
        }
        cancelText={t`Annuler`}
        confirmLoading={
          invitation.loading ||
          modification.loading ||
          definition.loading ||
          affectation.loading ||
          retrait.loading ||
          rattachement.loading
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
            label={t`Prénom et nom`}
            name="nom"
            rules={[{ required: true, message: t`Saisissez un nom.` }]}
            extra={
              nomVerrouille
                ? t`Cette personne s’est déjà connectée : elle modifie son nom dans ses préférences.`
                : undefined
            }
          >
            <Input
              autoComplete="off"
              disabled={
                enEdition !== 'nouvelle' && (!gereOrganisation || nomVerrouille)
              }
            />
          </Form.Item>
          <Form.Item
            label={t`Adresse mail`}
            name="email"
            rules={[
              {
                required: true,
                type: 'email',
                message: t`Saisissez une adresse mail valide.`,
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
                label={t`Équipes des activités`}
                name="activites"
                extra={t`La personne rejoint l’équipe de chaque activité choisie, sans périmètre. Elle y découvre les périmètres. Une affectation l’ajoute aussi à l’équipe de son activité.`}
              >
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={t`Aucune activité`}
                  // Une activité archivée ne reçoit plus de rattachement, mais un
                  // rattachement existant garde son nom.
                  options={(toutesActivites?.activites ?? [])
                    .filter(
                      a =>
                        !a.archive ||
                        (enEdition !== null &&
                          enEdition !== 'nouvelle' &&
                          (enEdition.attributions ?? []).some(
                            x => x.activiteId === a.id && x.rattachee
                          ))
                    )
                    .map(a => {
                      const nomAffiche = a.nom
                      return {
                        value: a.id,
                        label: a.archive ? t`${nomAffiche} (archivée)` : a.nom,
                      }
                    })}
                />
              </Form.Item>
              <Form.Item
                label={t`Admin des activités`}
                name="activitesAdministrees"
                extra={t`Un admin d’activité gère ses périodes, ses périmètres, ses affectations et ses fiches. Il ne voit pas les autres activités. Le rôle d’admin de l’organisation se donne depuis l’écran Admins.`}
              >
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={t`Aucune activité`}
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
              label={t`Admin de l’activité`}
              name="activitesAdministrees"
              extra={
                gereOrganisation
                  ? t`Un admin de l’activité gère ses périodes, ses périmètres, ses affectations et ses fiches.`
                  : t`Un admin de l’activité gère avec vous ses périodes, ses périmètres, ses affectations et ses fiches. Vous ne retirez pas votre propre rôle.`
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
              title={t`La personne rejoint l’équipe de ${nomActivite}, avec ou sans périmètre. Sans périmètre, elle découvre les périmètres de l’activité. Si elle a déjà un compte dans votre organisation, ce compte rejoint l’équipe et garde son nom. Si son compte existe hors de votre organisation, l’invitation attend son accord.`}
            />
          )}
          {champSouhaits && activitesSouhaits.length > 0 && (
            <>
              <Typography.Title level={5}>
                <Trans>Affectations et souhaits</Trans>
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                <Trans>
                  Une affectation rend la personne référent·e du périmètre :
                  elle y modifie les tâches et reçoit un mail qui l’annonce. Un
                  souhait note seulement un intérêt : il ne donne aucun accès,
                  et seuls les admins le voient.
                </Trans>
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
                      ? t`Inviter aussi dans d’autres activités`
                      : t`Affecter aussi dans d’autres activités`,
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
