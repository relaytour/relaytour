import {
  CloseOutlined,
  CopyOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  StarFilled,
  StarOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  type SelectProps,
} from 'antd'
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import Avancement from '../../composants/Avancement'
import CarteAvancement from '../../composants/CarteAvancement'
import MessageEquipe, { type CibleEquipe } from '../../composants/MessageEquipe'
import { Puces, SeparateurPuces } from '../../composants/Puces'
import ReglagePerimetre, {
  type PerimetreRegle,
} from '../../composants/ReglagePerimetre'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { EtatPostes } from '../../gql/graphql'
import { messageErreur } from '../../lib/erreurs'
import {
  FILTRES,
  TOUS_LES_GROUPES,
  ecrireReglages,
  filtrer,
  lireReglages,
  partFaite,
  trier,
  type Filtre,
  type LignePerimetre,
  type Reglages,
  type Tri,
  type Vue,
} from '../../lib/liste-perimetres'
import { usePremiereReception } from '../../lib/ordre'
import {
  ACTIVITES,
  AFFECTER,
  AVANCEMENT_GLOBAL,
  EDITIONS,
  PERIMETRES,
  RETIRER_AFFECTATION,
} from '../../lib/requetes'
import { useActivite } from '../../lib/activite'
import { useSession } from '../../lib/session'

const POSTES = graphql(`
  query PostesAPourvoir($editionId: ID!, $annuaire: Boolean!) {
    postesAPourvoir(editionId: $editionId) {
      effectif
      aPourvoir
      etat
      demandesEnAttente
      perimetre {
        id
        slug
        nom
        groupe
        couleur
        description
        ordre
        archive
        version
      }
      affectations {
        id
        contactPrincipal
        personne {
          id
          nom
        }
      }
      souhaits {
        id
        personne {
          id
          nom
        }
      }
    }
    appelPostes(editionId: $editionId)
    equipe {
      id
      nom
      estAdmin
    }
    personnes @include(if: $annuaire) {
      id
      nom
      attributions {
        activiteId
      }
    }
  }
`)

const DEFINIR_EFFECTIF = graphql(`
  mutation DefinirEffectif(
    $perimetreId: ID!
    $editionId: ID!
    $effectif: Int!
  ) {
    definirEffectif(
      perimetreId: $perimetreId
      editionId: $editionId
      effectif: $effectif
    )
  }
`)

const DEFINIR_CONTACT = graphql(`
  mutation DefinirContactPrincipal($id: ID!, $contactPrincipal: Boolean!) {
    definirContactPrincipal(
      affectationId: $id
      contactPrincipal: $contactPrincipal
    )
  }
`)

const RETIRER_SOUHAIT = graphql(`
  mutation RetirerSouhait($id: ID!) {
    retirerSouhait(id: $id)
  }
`)

const EFFECTIF_MAX = 50

const ETATS: Record<EtatPostes, { couleur: string }> = {
  SANS_PERSONNE: { couleur: 'red' },
  INCOMPLET: { couleur: 'orange' },
  COMPLET: { couleur: 'green' },
}

const LIBELLES_FILTRE: Record<Filtre, string> = {
  tous: 'Tous',
  aPourvoir: 'À pourvoir',
  retard: 'Tâches en retard',
  sansPersonne: 'Tâches sans personne',
}

const TRIS: { value: Tri; label: string }[] = [
  { value: 'priorite', label: 'Postes à pourvoir d’abord' },
  { value: 'ordre', label: 'Ordre de l’activité' },
  { value: 'nom', label: 'Nom' },
  { value: 'retard', label: 'Tâches en retard d’abord' },
  { value: 'avancement', label: 'Moins avancés d’abord' },
]

const SOUS_TITRES: Record<Vue, string> = {
  equipe:
    'Chaque carte porte l’effectif, les personnes affectées et les souhaits d’un périmètre. Les cartes gardent leur place pendant vos modifications.',
  avancement:
    'Chaque carte porte les tâches faites, en retard et sans personne d’un périmètre.',
}

/** Libellé lu par les lecteurs d'écran à la place de « 1 / 2 ». */
function libelleCompte(affectes: number, effectif: number | null): string {
  const personnes =
    affectes === 0
      ? 'Aucune personne affectée'
      : `${affectes} ${affectes > 1 ? 'personnes affectées' : 'personne affectée'}`
  if (effectif === null) return `${personnes}. Effectif à définir.`
  return `${personnes} sur ${effectif} ${effectif > 1 ? 'souhaitées' : 'souhaitée'}.`
}

// Effectif souhaité d'un périmètre, enregistré à la sortie du champ ou avec Entrée.
function ChampEffectif({
  id,
  perimetre,
  effectif,
  desactive,
  enregistrer,
}: {
  id: string
  perimetre: string
  effectif: number | null
  desactive: boolean
  enregistrer: (valeur: number) => Promise<boolean>
}) {
  const [valeur, setValeur] = useState<number | null>(effectif)
  // Les références évitent un double envoi quand Entrée précède la sortie du champ.
  const saisie = useRef<number | null>(effectif)
  const connue = useRef<number | null>(effectif)

  const valider = async () => {
    const nouvelle = saisie.current
    if (nouvelle === null) {
      saisie.current = connue.current
      setValeur(connue.current)
      return
    }
    if (nouvelle === connue.current) return
    const precedente = connue.current
    connue.current = nouvelle
    if (!(await enregistrer(nouvelle))) {
      connue.current = precedente
      saisie.current = precedente
      setValeur(precedente)
    }
  }

  return (
    <Space>
      <label htmlFor={id}>Effectif souhaité</label>
      <InputNumber
        id={id}
        aria-label={`Effectif souhaité pour ${perimetre}`}
        size="small"
        min={0}
        max={EFFECTIF_MAX}
        precision={0}
        value={valeur}
        placeholder="?"
        disabled={desactive}
        onChange={v => {
          saisie.current = v
          setValeur(v)
        }}
        onBlur={() => void valider()}
        onPressEnter={() => void valider()}
        style={{ width: 72 }}
      />
    </Space>
  )
}

/**
 * Les périmètres d'une période, en deux vues. La vue « Équipe » porte l'effectif,
 * les personnes affectées et les souhaits, et ouvre le réglage de chaque périmètre,
 * qui ne dépend pas de la période. La vue « Avancement » porte l'état des tâches.
 * Les deux vues partagent la période, le filtre, la recherche et le tri.
 */
export default function Equipe() {
  const { activite, periode, libelleGroupe, lien } = useActivite()
  // Un admin d'activité affecte les personnes de son équipe. Seul un admin de
  // l'organisation lit l'annuaire et choisit hors de l'équipe (ADR 0018).
  const gereOrganisation = useSession().moi.estAdmin === true
  const { data: activites } = useQuery(ACTIVITES, { skip: !gereOrganisation })
  const { message } = App.useApp()
  const { data: editions } = useQuery(EDITIONS)
  const [parametres, setParametres] = useSearchParams()
  const reglages = lireReglages(
    parametres,
    activite.groupes.map(g => g.cle)
  )
  const { vue, groupe, q, tri, filtre } = reglages
  // La saisie de la recherche remplace l'entrée d'historique au lieu d'en ajouter une
  // par caractère.
  const regler = (changements: Partial<Reglages>, remplacer = false) =>
    setParametres(precedents => ecrireReglages(precedents, changements), {
      replace: remplacer,
    })
  const [appelOuvert, setAppelOuvert] = useState(false)
  // Les personnes à qui la fenêtre de rédaction écrit (ADR 0020).
  const [cibleMessage, setCibleMessage] = useState<CibleEquipe | null>(null)
  const [enReglage, setEnReglage] = useState<PerimetreRegle | 'nouveau' | null>(
    null
  )
  // Les périmètres archivés sortent des cartes : ils se règlent, et se désarchivent,
  // depuis leur propre liste.
  const { data: tous } = useQuery(PERIMETRES, {
    variables: { inclureArchives: true },
  })
  const archives = (tous?.perimetres ?? []).filter(p => p.archive)
  const edition =
    editions?.editions.find(e => e.id === reglages.edition) ??
    editions?.editions.find(e => e.statut !== 'ARCHIVEE')
  const editionId = edition?.id
  const archivee = edition?.statut === 'ARCHIVEE'
  const { data, loading } = useQuery(POSTES, {
    variables: { editionId: editionId ?? '', annuaire: gereOrganisation },
    skip: editionId === undefined,
  })
  const { data: taches, loading: chargementTaches } = useQuery(
    AVANCEMENT_GLOBAL,
    {
      variables: { editionId: editionId ?? '' },
      skip: editionId === undefined,
    }
  )
  const rafraichir = { refetchQueries: ['PostesAPourvoir'] }
  const [definirEffectif] = useMutation(DEFINIR_EFFECTIF, rafraichir)
  const [affecter] = useMutation(AFFECTER, rafraichir)
  const [retirer] = useMutation(RETIRER_AFFECTATION, rafraichir)
  const [definirContact] = useMutation(DEFINIR_CONTACT, rafraichir)
  const [retirerSouhait] = useMutation(RETIRER_SOUHAIT, rafraichir)

  const postes = data?.postesAPourvoir ?? []
  const avancements = new Map(
    (taches?.avancementGlobal ?? []).map(a => [a.perimetre.id, a.avancement])
  )
  const rangsGroupes = new Map(activite.groupes.map((g, i) => [g.cle, i]))
  const lignes = postes.map(poste => {
    const avancement = avancements.get(poste.perimetre.id)
    return {
      id: poste.perimetre.id,
      nom: poste.perimetre.nom,
      groupe: poste.perimetre.groupe,
      rangGroupe:
        rangsGroupes.get(poste.perimetre.groupe) ?? activite.groupes.length,
      ordre: poste.perimetre.ordre,
      personnes: poste.affectations.map(a => a.personne.nom),
      aPourvoir: poste.aPourvoir,
      enRetard: avancement?.enRetard ?? 0,
      sansPersonne: avancement?.sansPersonne ?? 0,
      part: avancement === undefined ? null : partFaite(avancement),
      poste,
      avancement,
    } satisfies LignePerimetre & Record<string, unknown>
  })
  // Les cartes gardent la place et la présence de leur première réception : une
  // affectation ne déplace pas la carte en cours de modification, et une carte qui
  // ne répond plus au filtre reste affichée jusqu'au prochain changement de réglage.
  const pret = data !== undefined && taches !== undefined
  const ordre = usePremiereReception(
    [editionId, vue, groupe, q, tri, filtre].join('|'),
    pret ? trier(filtrer(lignes, reglages), tri).map(l => l.id) : []
  )
  const parId = new Map(lignes.map(l => [l.id, l]))
  const affiches = ordre.flatMap(id => parId.get(id) ?? [])
  const filtres = groupe !== TOUS_LES_GROUPES || q !== '' || filtre !== 'tous'
  const appel = data?.appelPostes ?? null
  const affectees = [
    ...new Set(postes.flatMap(p => p.affectations.map(a => a.personne.id))),
  ]
  const contactsPrincipaux = postes.flatMap(p =>
    p.affectations.filter(a => a.contactPrincipal).map(a => a.personne.id)
  )
  const dansLEquipe = new Set((data?.equipe ?? []).map(p => p.id))
  const nomsActivites = new Map(
    (activites?.activites ?? []).map(a => [a.id, a.nom])
  )
  const totalAPourvoir = postes.reduce((total, p) => total + p.aPourvoir, 0)
  const sansPersonne = postes.filter(p => p.etat === 'SANS_PERSONNE').length
  const souhaitsEnAttente = postes.reduce(
    (total, p) => total + p.souhaits.length,
    0
  )
  const totaux = [...avancements.values()].reduce(
    (acc, a) => ({
      utiles: acc.utiles + a.total - a.abandonnees,
      faites: acc.faites + a.faites,
      enRetard: acc.enRetard + a.enRetard,
      sansPersonne: acc.sansPersonne + a.sansPersonne,
    }),
    { utiles: 0, faites: 0, enRetard: 0, sansPersonne: 0 }
  )

  const executer = async (action: () => Promise<unknown>) => {
    try {
      await action()
      return true
    } catch (e) {
      message.error(messageErreur(e))
      return false
    }
  }

  const copierAppel = async () => {
    if (appel === null) return
    try {
      await navigator.clipboard.writeText(appel)
      message.success('L’appel est copié.')
      setAppelOuvert(false)
    } catch {
      message.error(
        'La copie a échoué. Utilisez l’icône de copie à la fin du texte.'
      )
    }
  }

  return (
    <>
      <Titre
        sousTitre={SOUS_TITRES[vue]}
        actions={
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setEnReglage('nouveau')}
          >
            Nouveau périmètre
          </Button>
        }
      >
        Équipe
      </Titre>
      <Space wrap size={[16, 12]} style={{ marginBottom: 16 }}>
        <Segmented<Vue>
          aria-label="Vue"
          value={vue}
          onChange={valeur => regler({ vue: valeur, filtre: 'tous' })}
          options={[
            { value: 'equipe', label: 'Équipe' },
            { value: 'avancement', label: 'Avancement' },
          ]}
        />
        <Space>
          <span>{periode.Nom}</span>
          <Select
            style={{ minWidth: 200 }}
            value={editionId}
            onChange={(id: string) => regler({ edition: id })}
            placeholder={`Choisir ${periode.une}`}
            options={(editions?.editions ?? []).map(e => ({
              value: e.id,
              label: e.nom,
            }))}
          />
        </Space>
        <Button
          icon={<CopyOutlined />}
          disabled={appel === null}
          onClick={() => setAppelOuvert(true)}
        >
          Copier l’appel
        </Button>
        <Button
          icon={<SendOutlined />}
          disabled={affectees.length === 0}
          onClick={() =>
            setCibleMessage({ personneIds: affectees, toutLeMonde: true })
          }
        >
          Écrire à l’équipe
        </Button>
        <Link to={lien('/admin/messages')}>Historique des messages</Link>
      </Space>
      <div className="rt-puces" style={{ marginBottom: 24, rowGap: 10 }}>
        {activite.groupes.length > 1 && (
          <>
            <Puces<string>
              libelle="Groupe de périmètres"
              valeur={groupe}
              onChange={valeur => regler({ groupe: valeur })}
              options={[
                {
                  valeur: TOUS_LES_GROUPES,
                  libelle: 'Tous',
                  compte: postes.length,
                },
                ...activite.groupes.map(g => ({
                  valeur: g.cle,
                  libelle: g.libellePluriel,
                  compte: postes.filter(p => p.perimetre.groupe === g.cle)
                    .length,
                })),
              ]}
            />
            <SeparateurPuces />
          </>
        )}
        <Puces<Filtre>
          libelle="Filtre des périmètres"
          valeur={filtre}
          onChange={valeur => regler({ filtre: valeur })}
          options={FILTRES[vue].map(valeur => ({
            valeur,
            libelle: LIBELLES_FILTRE[valeur],
          }))}
        />
        <Input
          allowClear
          prefix={<SearchOutlined aria-hidden />}
          aria-label="Rechercher un périmètre ou une personne"
          placeholder="Rechercher un périmètre ou une personne"
          value={q}
          onChange={e => regler({ q: e.target.value }, true)}
          style={{
            flex: '1 1 240px',
            minWidth: 0,
            maxWidth: 320,
          }}
        />
        <Select<Tri>
          aria-label="Tri des périmètres"
          value={tri}
          onChange={valeur => regler({ tri: valeur })}
          options={TRIS}
          style={{ flex: '0 1 240px', minWidth: 0 }}
        />
      </div>

      {editionId === undefined ? (
        <Empty description={`Créez d’abord ${periode.une}.`} />
      ) : (loading && data === undefined) ||
        (chargementTaches && taches === undefined) ? (
        <Skeleton active />
      ) : (
        <>
          {vue === 'avancement' ? (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="Tâches faites"
                    value={totaux.faites}
                    suffix={`/ ${totaux.utiles}`}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="En retard"
                    value={totaux.enRetard}
                    styles={
                      totaux.enRetard > 0
                        ? { content: { color: 'var(--rt-erreur)' } }
                        : undefined
                    }
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="Sans personne"
                    value={totaux.sansPersonne}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic title="Périmètres" value={postes.length} />
                </Card>
              </Col>
            </Row>
          ) : (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="Postes à pourvoir"
                    value={totalAPourvoir}
                    styles={
                      totalAPourvoir > 0
                        ? { content: { color: 'var(--rt-erreur)' } }
                        : undefined
                    }
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="Périmètres sans personne"
                    value={sansPersonne}
                    styles={
                      sansPersonne > 0
                        ? { content: { color: 'var(--rt-erreur)' } }
                        : undefined
                    }
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card>
                  <Statistic
                    title="Souhaits en attente"
                    value={souhaitsEnAttente}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {affiches.length === 0 ? (
            <Empty
              description={
                postes.length === 0
                  ? 'Cette activité n’a aucun périmètre actif. Créez-en un avec « Nouveau périmètre ».'
                  : filtre === 'aPourvoir' && groupe === TOUS_LES_GROUPES && !q
                    ? 'Tous les périmètres ont leurs référentes et référents.'
                    : 'Aucun périmètre ne correspond à ces filtres.'
              }
            >
              {postes.length > 0 && filtres && (
                <Button
                  onClick={() =>
                    regler({ groupe: TOUS_LES_GROUPES, q: '', filtre: 'tous' })
                  }
                >
                  Effacer les filtres
                </Button>
              )}
            </Empty>
          ) : (
            <Row gutter={[16, 16]}>
              {affiches.map(({ poste, avancement }) => {
                const { perimetre, affectations, effectif, souhaits } = poste
                const versPerimetre = lien(
                  `/perimetres/${perimetre.slug}?edition=${editionId}`
                )
                const compte = (
                  <Tag
                    color={ETATS[poste.etat].couleur}
                    role="img"
                    aria-label={libelleCompte(affectations.length, effectif)}
                    style={{ marginInlineEnd: 0 }}
                  >
                    {affectations.length} / {effectif ?? '?'}
                  </Tag>
                )
                if (vue === 'avancement') {
                  return (
                    <Col key={perimetre.id} xs={24} md={12} xl={8}>
                      <CarteAvancement
                        perimetre={perimetre}
                        groupe={libelleGroupe(perimetre.groupe)}
                        avancement={avancement}
                        affectations={affectations}
                        compte={compte}
                        versPerimetre={versPerimetre}
                        gererEquipe={() =>
                          regler({
                            vue: 'equipe',
                            q: perimetre.nom,
                            groupe: TOUS_LES_GROUPES,
                            filtre: 'tous',
                          })
                        }
                      />
                    </Col>
                  )
                }
                const dejaAffectes = new Set(
                  affectations.map(a => a.personne.id)
                )
                const interesses = new Set(souhaits.map(x => x.personne.id))
                const affecterPersonne = (personneId: string) =>
                  executer(() =>
                    affecter({
                      variables: {
                        personneId,
                        perimetreId: perimetre.id,
                        editionId,
                      },
                    })
                  )
                const libres = (
                  personnes: readonly { id: string; nom: string }[]
                ) =>
                  personnes
                    .filter(
                      p => !dejaAffectes.has(p.id) && !interesses.has(p.id)
                    )
                    .map(p => ({ value: p.id, label: p.nom }))
                // Les personnes intéressées apparaissent en premier, puis l'équipe de
                // l'activité. Seul un admin de l'organisation choisit hors de l'équipe.
                const options: SelectProps['options'] = [
                  {
                    label: 'Intéressé·es',
                    options: souhaits.map(x => ({
                      value: x.personne.id,
                      label: x.personne.nom,
                    })),
                  },
                  {
                    label: 'Équipe de l’activité',
                    // Un admin d'activité n'affecte pas un admin de
                    // l'organisation (ADR 0019).
                    options: libres(
                      (data?.equipe ?? []).filter(
                        p => gereOrganisation || p.estAdmin !== true
                      )
                    ),
                  },
                  {
                    label: 'Autres membres de l’organisation',
                    // Chaque nom porte ses activités : l'admin de l'organisation
                    // voit d'où vient la personne avant de l'affecter.
                    options: libres(
                      (data?.personnes ?? [])
                        .filter(p => !dansLEquipe.has(p.id))
                        .map(p => ({
                          id: p.id,
                          nom: `${p.nom} (${
                            p.attributions
                              .map(a => nomsActivites.get(a.activiteId))
                              .filter(nom => nom !== undefined)
                              .join(', ') || 'sans activité'
                          })`,
                        }))
                    ),
                  },
                ].filter(groupe => groupe.options.length > 0)
                return (
                  <Col key={perimetre.id} xs={24} md={12} xl={8}>
                    <Card
                      title={
                        <Space wrap size={8}>
                          <Link to={versPerimetre}>{perimetre.nom}</Link>
                          <Tag>{libelleGroupe(perimetre.groupe)}</Tag>
                        </Space>
                      }
                      extra={
                        <Space size={4}>
                          {effectif === null ? (
                            <Tooltip title="Effectif à définir">
                              {compte}
                            </Tooltip>
                          ) : (
                            compte
                          )}
                          <Tooltip title="Écrire aux référentes et aux référents">
                            <Button
                              type="text"
                              size="small"
                              icon={<SendOutlined />}
                              disabled={affectations.length === 0}
                              aria-label={`Écrire aux référentes et aux référents du périmètre ${perimetre.nom}`}
                              onClick={() =>
                                setCibleMessage({
                                  personneIds: affectations.map(
                                    a => a.personne.id
                                  ),
                                  toutLeMonde: false,
                                  perimetreId: perimetre.id,
                                })
                              }
                            />
                          </Tooltip>
                          <Tooltip title="Régler le périmètre">
                            <Button
                              type="text"
                              size="small"
                              icon={<SettingOutlined />}
                              aria-label={`Régler le périmètre ${perimetre.nom}`}
                              onClick={() => setEnReglage(perimetre)}
                            />
                          </Tooltip>
                        </Space>
                      }
                      style={{
                        borderTop: `6px solid ${perimetre.couleur ?? 'var(--rt-primaire)'}`,
                        height: '100%',
                      }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <ChampEffectif
                          key={`${editionId}-${perimetre.id}-${effectif}`}
                          id={`effectif-${perimetre.slug}`}
                          perimetre={perimetre.nom}
                          effectif={effectif ?? null}
                          desactive={archivee}
                          enregistrer={valeur =>
                            executer(() =>
                              definirEffectif({
                                variables: {
                                  perimetreId: perimetre.id,
                                  editionId,
                                  effectif: valeur,
                                },
                              })
                            )
                          }
                        />
                      </div>
                      <Space wrap style={{ marginBottom: 12, minHeight: 24 }}>
                        {affectations.length === 0 && (
                          <Typography.Text type="secondary">
                            Aucune personne affectée.
                          </Typography.Text>
                        )}
                        {affectations.map(a => (
                          <Tag
                            key={a.id}
                            color={a.contactPrincipal ? 'gold' : undefined}
                            closable
                            closeIcon={
                              <CloseOutlined
                                aria-label={`Retirer ${a.personne.nom}`}
                              />
                            }
                            onClose={e => {
                              e.preventDefault()
                              void executer(() =>
                                retirer({ variables: { id: a.id } })
                              )
                            }}
                          >
                            <Tooltip
                              title={
                                a.contactPrincipal
                                  ? 'Contact principal. Cliquez pour retirer la désignation.'
                                  : 'Désigner comme contact principal, sans droit supplémentaire.'
                              }
                            >
                              <Button
                                type="text"
                                size="small"
                                className="rt-bouton-etoile"
                                icon={
                                  a.contactPrincipal ? (
                                    <StarFilled aria-hidden />
                                  ) : (
                                    <StarOutlined aria-hidden />
                                  )
                                }
                                aria-pressed={a.contactPrincipal}
                                aria-label={`${a.personne.nom}, contact principal de ${perimetre.nom}`}
                                disabled={archivee}
                                onClick={() =>
                                  void executer(() =>
                                    definirContact({
                                      variables: {
                                        id: a.id,
                                        contactPrincipal: !a.contactPrincipal,
                                      },
                                    })
                                  )
                                }
                                style={{
                                  height: 20,
                                  width: 20,
                                  minWidth: 20,
                                  marginInlineEnd: 2,
                                }}
                              />
                            </Tooltip>
                            {a.personne.nom}
                          </Tag>
                        ))}
                      </Space>
                      {poste.demandesEnAttente > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Link to={lien('/admin/personnes?onglet=demandes')}>
                            {poste.demandesEnAttente === 1
                              ? '1 demande en attente'
                              : `${poste.demandesEnAttente} demandes en attente`}
                          </Link>
                        </div>
                      )}
                      {souhaits.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Typography.Text
                            strong
                            id={`interesses-${perimetre.slug}`}
                          >
                            Intéressé·es
                          </Typography.Text>
                          <ul
                            aria-labelledby={`interesses-${perimetre.slug}`}
                            style={{
                              listStyle: 'none',
                              margin: '4px 0 0',
                              padding: 0,
                            }}
                          >
                            {souhaits.map(souhait => (
                              <li
                                key={souhait.id}
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  padding: '4px 0',
                                }}
                              >
                                <span>{souhait.personne.nom}</span>
                                <Space size={4}>
                                  <Button
                                    size="small"
                                    icon={<UserAddOutlined />}
                                    aria-label={`Affecter ${souhait.personne.nom} à ${perimetre.nom}`}
                                    onClick={() =>
                                      void affecterPersonne(souhait.personne.id)
                                    }
                                  >
                                    Affecter
                                  </Button>
                                  <Popconfirm
                                    title="Retirer ce souhait ?"
                                    okText="Retirer"
                                    cancelText="Annuler"
                                    disabled={archivee}
                                    onConfirm={() =>
                                      executer(() =>
                                        retirerSouhait({
                                          variables: { id: souhait.id },
                                        })
                                      )
                                    }
                                  >
                                    <Button
                                      size="small"
                                      type="text"
                                      icon={<CloseOutlined />}
                                      aria-label={`Retirer le souhait de ${souhait.personne.nom}`}
                                      disabled={archivee}
                                    />
                                  </Popconfirm>
                                </Space>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Select
                        showSearch
                        style={{ width: '100%' }}
                        placeholder="Affecter une personne"
                        aria-label={`Affecter une personne à ${perimetre.nom}`}
                        value={null}
                        optionFilterProp="label"
                        options={options}
                        notFoundContent={
                          gereOrganisation
                            ? 'Aucune personne à affecter.'
                            : 'Aucune autre personne dans votre équipe. Invitez-la par son adresse depuis l’écran Personnes.'
                        }
                        onChange={(personneId: string) =>
                          void affecterPersonne(personneId)
                        }
                      />
                      {avancement !== undefined && (
                        <div style={{ marginTop: 12 }}>
                          <Avancement avancement={avancement} compact />
                        </div>
                      )}
                    </Card>
                  </Col>
                )
              })}
            </Row>
          )}
        </>
      )}

      {archives.length > 0 && (
        <Collapse
          style={{ marginTop: 24 }}
          items={[
            {
              key: 'archives',
              label: `Périmètres archivés (${archives.length})`,
              children: (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {archives.map(p => (
                    <li
                      key={p.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '4px 0',
                      }}
                    >
                      <Space wrap size={8}>
                        <span>{p.nom}</span>
                        <Tag>{libelleGroupe(p.groupe)}</Tag>
                      </Space>
                      <Button
                        size="small"
                        icon={<SettingOutlined />}
                        aria-label={`Régler le périmètre ${p.nom}`}
                        onClick={() => setEnReglage(p)}
                      >
                        Régler
                      </Button>
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      )}

      <ReglagePerimetre
        perimetre={enReglage}
        onFermer={() => setEnReglage(null)}
      />

      <Modal
        open={appelOuvert}
        title="Appel aux référentes et référents"
        okText="Copier"
        okButtonProps={{ icon: <CopyOutlined /> }}
        cancelText="Fermer"
        onOk={() => void copierAppel()}
        onCancel={() => setAppelOuvert(false)}
        destroyOnHidden
      >
        <Typography.Paragraph
          copyable={appel === null ? false : { text: appel }}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {appel}
        </Typography.Paragraph>
      </Modal>
      <MessageEquipe
        cible={cibleMessage}
        fermer={() => setCibleMessage(null)}
        editionId={editionId}
        contactsPrincipaux={contactsPrincipaux}
      />
    </>
  )
}
