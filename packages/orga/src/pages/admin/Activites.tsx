import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import ChampCouleur from '../../composants/ChampCouleur'
import ChampImage from '../../composants/ChampImage'
import Tableau from '../../composants/Tableau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { NatureActivite } from '../../gql/graphql'
import { formesPeriode, useActivite, type Activite } from '../../lib/activite'
import { messageErreur } from '../../lib/erreurs'
import { useOrganisation } from '../../lib/organisation'
import { joursRelatifs } from '../../lib/regroupement'
import { useSession } from '../../lib/session'
import { ACTIVITES } from '../../lib/requetes'

// Les activités de l'organisation (ADR 0008) : un événement, une section, une
// instance. Les admins les créent, les modifient et les archivent. Une activité
// archivée reste consultable ; l'archiver libère sa place dans les limites que
// l'hébergeur a pu fixer.

const CREER = graphql(`
  mutation CreerActivite(
    $slug: String!
    $nom: String!
    $sigle: String
    $nature: NatureActivite!
    $groupes: [GroupePerimetresInput!]
    $ordre: Int
  ) {
    creerActivite(
      slug: $slug
      nom: $nom
      sigle: $sigle
      nature: $nature
      groupes: $groupes
      ordre: $ordre
    ) {
      id
      slug
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierActivite(
    $id: ID!
    $nom: String!
    $sigle: String
    $nature: NatureActivite!
    $groupes: [GroupePerimetresInput!]!
    $phases: [PhaseInput!]
    $ordre: Int!
    $archive: Boolean
    $souhaitsOuverts: Boolean
    $formulaire: FormulaireInput
    $formulaireOuvert: Boolean
  ) {
    modifierActivite(
      id: $id
      nom: $nom
      sigle: $sigle
      nature: $nature
      groupes: $groupes
      phases: $phases
      ordre: $ordre
      archive: $archive
      souhaitsOuverts: $souhaitsOuverts
      formulaire: $formulaire
      formulaireOuvert: $formulaireOuvert
    ) {
      id
    }
  }
`)

const MODIFIER_IDENTITE = graphql(`
  mutation ModifierIdentiteActivite(
    $id: ID!
    $contactRecrutement: String
    $pageEquipe: String
    $logoPng: String
    $logoSvg: String
    $theme: JSONObject
  ) {
    modifierIdentiteActivite(
      id: $id
      contactRecrutement: $contactRecrutement
      pageEquipe: $pageEquipe
      logoPng: $logoPng
      logoSvg: $logoSvg
      theme: $theme
    ) {
      id
    }
  }
`)

const NATURES: { value: NatureActivite; label: string; aide: string }[] = [
  {
    value: 'EVENEMENT',
    label: 'Événement',
    aide: 'Une manifestation qui revient, une édition à la fois.',
  },
  {
    value: 'SAISON',
    label: 'Section',
    aide: 'Une activité permanente, une saison à la fois.',
  },
  {
    value: 'MANDAT',
    label: 'Instance',
    aide: 'Un bureau ou un conseil, un mandat à la fois.',
  },
]

interface Groupe {
  cle: string
  libelle: string
  libellePluriel: string
}

// Une phase de l'activité (ADR 0025). La borne compte les jours depuis le premier
// jour de la période ; la dernière phase n'en porte pas.
interface Phase {
  cle: string
  libelle: string
  jusquA?: string | null
}

const PHASES_MAX = 12
const BORNE = /^J[-+]\d{1,3}$/

/** Les phases telles que le serveur les attend : seule la dernière est sans borne. */
function phasesSaisies(phases: Phase[]): Phase[] {
  return phases.map((phase, rang) => ({
    cle: phase.cle.trim(),
    libelle: phase.libelle.trim(),
    jusquA:
      rang === phases.length - 1 ? null : (phase.jusquA ?? '').trim() || null,
  }))
}

const memesPhases = (a: Phase[], b: Phase[]) =>
  a.length === b.length &&
  a.every(
    (phase, rang) =>
      phase.cle === b[rang]?.cle &&
      phase.libelle === b[rang]?.libelle &&
      (phase.jusquA ?? null) === (b[rang]?.jusquA ?? null)
  )

interface Valeurs {
  slug: string
  nom: string
  sigle?: string
  nature: NatureActivite
  ordre: number
  groupes: Groupe[]
  phases: Phase[]
  archive: boolean
  souhaitsOuverts: boolean
  // Formulaire public pour rejoindre l'équipe (ADR 0015).
  formulaireOuvert: boolean
  introduction?: string
  question?: string
  paliers: string[]
  // Identité propre de l'activité (ADR 0009) : un champ vide reprend la valeur
  // de l'organisation.
  contactRecrutement?: string
  pageEquipe?: string
  logoPng: string | null
  primaire: string | null
  accent: string | null
}

type ThemeActivite = {
  couleurs?: Record<string, string>
  [cle: string]: unknown
}

/** Le thème de l'activité, avec la primaire et l'accent du formulaire. */
function themeActivite(
  actuel: ThemeActivite | null | undefined,
  primaire: string | null,
  accent: string | null
): ThemeActivite | null {
  const couleurs = Object.fromEntries(
    Object.entries({ ...actuel?.couleurs, primaire, accent }).filter(
      ([, v]) => typeof v === 'string' && v !== ''
    )
  ) as Record<string, string>
  const theme: ThemeActivite = { ...actuel }
  if (Object.keys(couleurs).length > 0) theme.couleurs = couleurs
  else delete theme.couleurs
  return Object.keys(theme).length > 0 ? theme : null
}

const GROUPES_PAR_DEFAUT: Groupe[] = [
  { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
  { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
]

export default function Activites() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { activite: affichee } = useActivite()
  const organisation = useOrganisation()
  // Créer et archiver une activité relève de l'admin de l'organisation ; l'admin
  // d'une activité ne modifie que la sienne (ADR 0010).
  const gereOrganisation = useSession().moi.estAdmin
  const { data, loading } = useQuery(ACTIVITES)
  const [enEdition, setEnEdition] = useState<Activite | 'nouvelle' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [form] = Form.useForm<Valeurs>()
  // La navigation vers une activité créée attend la liste à jour : sinon le
  // fournisseur d'activité ne la connaît pas encore et renvoie ailleurs.
  const rafraichir = { refetchQueries: [ACTIVITES], awaitRefetchQueries: true }
  const [creer, creation] = useMutation(CREER, rafraichir)
  const [modifier, modification] = useMutation(MODIFIER, rafraichir)
  const [modifierIdentite, modificationIdentite] = useMutation(
    MODIFIER_IDENTITE,
    rafraichir
  )

  const ouvrir = (activite: Activite | 'nouvelle') => {
    setErreur(null)
    setEnEdition(activite)
    form.setFieldsValue(
      activite === 'nouvelle'
        ? {
            slug: '',
            nom: '',
            sigle: '',
            nature: 'SAISON',
            ordre: (data?.activites.length ?? 0) + 1,
            groupes: GROUPES_PAR_DEFAUT,
            // Une activité nouvelle garde les phases par défaut : elles se règlent
            // après sa création.
            phases: [],
            archive: false,
            souhaitsOuverts: false,
            formulaireOuvert: false,
            introduction: '',
            question: '',
            paliers: [],
            contactRecrutement: '',
            pageEquipe: '',
            logoPng: null,
            primaire: null,
            accent: null,
          }
        : {
            slug: activite.slug,
            nom: activite.nom,
            sigle: activite.sigle ?? '',
            nature: activite.nature,
            ordre: activite.ordre,
            groupes: activite.groupes.map(g => ({ ...g })),
            phases: activite.phases.map(p => ({ ...p })),
            archive: activite.archive,
            souhaitsOuverts: activite.souhaitsOuverts,
            formulaireOuvert: activite.formulaireOuvert,
            introduction: activite.formulaire.introduction ?? '',
            question: activite.formulaire.question ?? '',
            paliers: [...activite.formulaire.paliers],
            contactRecrutement: activite.identite.contactRecrutement ?? '',
            pageEquipe: activite.identite.pageEquipe ?? '',
            logoPng: activite.identite.logoPng ?? null,
            primaire:
              (activite.identite.theme as ThemeActivite | null)?.couleurs
                ?.primaire ?? null,
            accent:
              (activite.identite.theme as ThemeActivite | null)?.couleurs
                ?.accent ?? null,
          }
    )
  }

  const enregistrer = async (v: Valeurs) => {
    setErreur(null)
    const groupes = v.groupes.map(g => ({
      cle: g.cle.trim(),
      libelle: g.libelle.trim(),
      libellePluriel: g.libellePluriel.trim(),
    }))
    const sigle = v.sigle?.trim() || null
    const identite = (id: string, actuel?: Activite) => ({
      id,
      contactRecrutement: v.contactRecrutement?.trim() || null,
      pageEquipe: v.pageEquipe?.trim() || null,
      logoPng: v.logoPng,
      // Le SVG ne se choisit pas ici : il suit le PNG tant que ce dernier reste.
      logoSvg:
        v.logoPng !== null && v.logoPng === actuel?.identite.logoPng
          ? (actuel.identite.logoSvg ?? null)
          : null,
      theme: themeActivite(
        actuel?.identite.theme as ThemeActivite | null,
        v.primaire,
        v.accent
      ),
    })
    try {
      if (enEdition === 'nouvelle') {
        const r = await creer({
          variables: {
            slug: v.slug.trim(),
            nom: v.nom,
            sigle,
            nature: v.nature,
            groupes,
            ordre: v.ordre,
          },
        })
        const creee = r.data?.creerActivite
        if (creee) {
          await modifierIdentite({ variables: identite(creee.id) })
        }
        message.success('Activité créée.')
        setEnEdition(null)
        const slug = creee?.slug
        if (slug) navigate(`/${slug}/`)
        return
      }
      if (enEdition) {
        // Les phases ne partent que si elles changent : une activité qui n'en
        // déclare pas garde ainsi les phases par défaut (ADR 0025).
        const phases = phasesSaisies(v.phases)
        // L'identité se vérifie d'abord. La modification et l'archivage suivent
        // dans une seule transaction : une limite atteinte annule les deux.
        await modifierIdentite({
          variables: identite(enEdition.id, enEdition),
        })
        await modifier({
          variables: {
            id: enEdition.id,
            nom: v.nom,
            sigle,
            nature: v.nature,
            groupes,
            phases: memesPhases(phases, enEdition.phases) ? null : phases,
            ordre: v.ordre,
            archive: v.archive === enEdition.archive ? null : v.archive,
            souhaitsOuverts: v.souhaitsOuverts,
            formulaire: {
              introduction: v.introduction ?? '',
              question: v.question ?? '',
              paliers: v.paliers,
            },
            formulaireOuvert: v.formulaireOuvert,
          },
        })
        message.success('Activité enregistrée.')
        setEnEdition(null)
      }
    } catch (e) {
      // Une limite atteinte, un groupe encore utilisé ou des phases mal ordonnées
      // s'affichent dans la fenêtre.
      setErreur(messageErreur(e))
    }
  }

  return (
    <>
      <Titre sousTitre="Un événement, une section ou une instance : chaque activité a ses périodes, ses périmètres, ses fiches et ses tâches types.">
        Activités
      </Titre>
      {gereOrganisation && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ marginBottom: 16 }}
          onClick={() => ouvrir('nouvelle')}
        >
          Nouvelle activité
        </Button>
      )}
      <Tableau<Activite>
        id="activites"
        rowKey="id"
        loading={loading}
        dataSource={data?.activites ?? []}
        pagination={false}
        ouvrir={ouvrir}
        peutOuvrir={a => a.estAdministree}
        libelleOuvrir={a => `Modifier ${a.nom}`}
        colonnes={[
          {
            key: 'nom',
            title: 'Nom',
            dataIndex: 'nom',
            tri: a => a.nom,
            recherche: a => a.nom,
            render: (nom: string, a) => (
              <>
                {nom}
                {a.id === affichee.id && (
                  <Tag style={{ marginInlineStart: 8 }}>Affichée</Tag>
                )}
              </>
            ),
          },
          {
            key: 'slug',
            title: 'Identifiant',
            dataIndex: 'slug',
            tri: a => a.slug,
          },
          {
            key: 'nature',
            title: 'Nature',
            dataIndex: 'nature',
            render: (n: NatureActivite) =>
              `${NATURES.find(x => x.value === n)?.label ?? n} (${formesPeriode(n).nom})`,
            filtre: {
              options: NATURES.map(n => ({ text: n.label, value: n.value })),
              valeurs: a => a.nature,
            },
          },
          {
            key: 'groupes',
            title: 'Groupes',
            render: (_, a) => a.groupes.map(g => g.libellePluriel).join(', '),
          },
          {
            key: 'phases',
            title: 'Phases',
            render: (_, a) => a.phases.map(p => p.libelle).join(', '),
          },
          {
            key: 'etat',
            title: 'État',
            dataIndex: 'archive',
            render: (archive: boolean) =>
              archive ? <Tag>Archivée</Tag> : <Tag color="green">Ouverte</Tag>,
            filtre: {
              options: [
                { text: 'Ouverte', value: 'ouverte' },
                { text: 'Archivée', value: 'archivee' },
              ],
              valeurs: a => (a.archive ? 'archivee' : 'ouverte'),
            },
          },
        ]}
      />

      <Modal
        open={enEdition !== null}
        title={
          enEdition === 'nouvelle' ? 'Nouvelle activité' : 'Modifier l’activité'
        }
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={
          creation.loading ||
          modification.loading ||
          modificationIdentite.loading
        }
        onOk={() => form.submit()}
        onCancel={() => setEnEdition(null)}
        destroyOnHidden
        width={620}
        rootClassName="rt-modale-pleine"
      >
        {erreur && (
          <Alert
            type="error"
            showIcon
            title={erreur}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={v => void enregistrer(v)}
          requiredMark={false}
        >
          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item
                label="Nom"
                name="nom"
                rules={[{ required: true, message: 'Saisissez un nom.' }]}
              >
                <Input placeholder="Section natation" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item label="Sigle (facultatif)" name="sigle">
                <Input placeholder="Natation" maxLength={20} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item
                label="Identifiant"
                name="slug"
                extra="Il apparaît dans l’adresse des pages et ne change plus."
                rules={[
                  { required: true, message: 'Saisissez un identifiant.' },
                  {
                    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: 'Minuscules, chiffres et tirets seulement.',
                  },
                ]}
              >
                <Input
                  placeholder="section-natation"
                  disabled={enEdition !== 'nouvelle'}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item label="Ordre" name="ordre">
                <InputNumber min={0} max={999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Nature"
            name="nature"
            extra={
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) =>
                  NATURES.find(n => n.value === getFieldValue('nature'))?.aide
                }
              </Form.Item>
            }
          >
            <Select
              options={NATURES.map(({ value, label }) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item
            label="Groupes de périmètres"
            extra="Chaque périmètre appartient à un groupe : un sport, un pôle, une équipe, une commission…"
          >
            <Form.List name="groupes">
              {(champs, { add, remove }) => (
                <>
                  {champs.map(champ => (
                    <Row gutter={8} key={champ.key} align="top">
                      <Col xs={24} sm={7}>
                        <Form.Item
                          name={[champ.name, 'cle']}
                          rules={[
                            { required: true, message: 'Clé requise.' },
                            {
                              pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                              message: 'Minuscules, chiffres, tirets.',
                            },
                          ]}
                        >
                          <Input placeholder="clé" aria-label="Clé du groupe" />
                        </Form.Item>
                      </Col>
                      <Col xs={11} sm={7}>
                        <Form.Item
                          name={[champ.name, 'libelle']}
                          rules={[
                            { required: true, message: 'Libellé requis.' },
                          ]}
                        >
                          <Input
                            placeholder="Équipe"
                            aria-label="Libellé du groupe"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={11} sm={8}>
                        <Form.Item
                          name={[champ.name, 'libellePluriel']}
                          rules={[
                            { required: true, message: 'Pluriel requis.' },
                          ]}
                        >
                          <Input
                            placeholder="Équipes"
                            aria-label="Libellé pluriel du groupe"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={2} sm={2}>
                        <Button
                          icon={<DeleteOutlined />}
                          aria-label="Retirer le groupe"
                          disabled={champs.length === 1}
                          onClick={() => remove(champ.name)}
                        />
                      </Col>
                    </Row>
                  ))}
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({ cle: '', libelle: '', libellePluriel: '' })
                    }
                    disabled={champs.length >= 10}
                  >
                    Ajouter un groupe
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          {enEdition !== 'nouvelle' && (
            <Form.Item
              label="Phases"
              extra="Une tâche se range par son échéance dans la première phase dont la borne n’est pas dépassée. La borne compte les jours depuis le premier jour de la période : J-120 pour 120 jours avant, J+30 pour 30 jours après. La dernière phase reçoit tout ce qui suit."
            >
              <Form.List name="phases">
                {(champs, { add, remove }) => (
                  <>
                    {champs.map((champ, rang) => (
                      <Row gutter={8} key={champ.key} align="top">
                        <Col xs={24} sm={7}>
                          <Form.Item
                            name={[champ.name, 'cle']}
                            rules={[
                              { required: true, message: 'Clé requise.' },
                              {
                                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                                message: 'Minuscules, chiffres, tirets.',
                              },
                            ]}
                          >
                            <Input
                              placeholder="clé"
                              aria-label="Clé de la phase"
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={12} sm={8}>
                          <Form.Item
                            name={[champ.name, 'libelle']}
                            rules={[
                              { required: true, message: 'Libellé requis.' },
                            ]}
                          >
                            <Input
                              placeholder="Préparation"
                              maxLength={60}
                              aria-label="Libellé de la phase"
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={10} sm={7}>
                          {rang === champs.length - 1 ? (
                            <Form.Item>
                              <Input
                                disabled
                                placeholder="sans borne"
                                aria-label="Dernier jour de la phase : aucun, la dernière phase reçoit tout ce qui suit"
                              />
                            </Form.Item>
                          ) : (
                            <Form.Item
                              name={[champ.name, 'jusquA']}
                              dependencies={
                                rang === 0
                                  ? undefined
                                  : [['phases', rang - 1, 'jusquA']]
                              }
                              rules={[
                                { required: true, message: 'Borne requise.' },
                                {
                                  pattern: BORNE,
                                  message: 'Forme J-120 ou J+30.',
                                },
                                // Le serveur applique la même règle : ce contrôle
                                // place le message sous le champ concerné.
                                ({ getFieldValue }) => ({
                                  validator: (_regle, valeur: string) => {
                                    const borne = joursRelatifs(valeur)
                                    const precedente =
                                      rang === 0
                                        ? null
                                        : joursRelatifs(
                                            getFieldValue([
                                              'phases',
                                              rang - 1,
                                              'jusquA',
                                            ]) as string | undefined
                                          )
                                    return borne === null ||
                                      precedente === null ||
                                      borne > precedente
                                      ? Promise.resolve()
                                      : Promise.reject(
                                          new Error(
                                            'La borne doit dépasser la précédente.'
                                          )
                                        )
                                  },
                                }),
                              ]}
                            >
                              <Input
                                placeholder="J-120"
                                aria-label="Dernier jour de la phase"
                              />
                            </Form.Item>
                          )}
                        </Col>
                        <Col xs={2} sm={2}>
                          <Button
                            icon={<DeleteOutlined />}
                            aria-label="Retirer la phase"
                            disabled={champs.length === 1}
                            onClick={() => remove(champ.name)}
                          />
                        </Col>
                      </Row>
                    ))}
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => add({ cle: '', libelle: '', jusquA: '' })}
                      disabled={champs.length >= PHASES_MAX}
                    >
                      Ajouter une phase
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
          )}
          <Divider titlePlacement="start" plain>
            Identité propre (facultatif)
          </Divider>
          <p className="rt-texte-secondaire">
            Un champ vide reprend la valeur de l’organisation. Le contact reste
            une adresse de rôle de l’organisation.
          </p>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Contact de l’activité"
                name="contactRecrutement"
                extra="Cette adresse reçoit les réponses aux mails de l’activité."
              >
                <Input type="email" placeholder="Celui de l’organisation" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Page de l’équipe" name="pageEquipe">
                <Input type="url" placeholder="https://" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Logo PNG" name="logoPng">
            <ChampImage format="PNG" libelle="Logo de l’activité" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Couleur primaire" name="primaire">
                <ChampCouleur heritee={organisation.theme.couleurs.primaire} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Couleur d’accent" name="accent">
                <ChampCouleur heritee={organisation.theme.couleurs.accent} />
              </Form.Item>
            </Col>
          </Row>
          {enEdition !== 'nouvelle' && (
            <Form.Item
              label="Ouverte aux souhaits"
              name="souhaitsOuverts"
              valuePropName="checked"
              extra="Tous les membres de l’organisation découvrent les périmètres dans « Tous les périmètres » et formulent leurs souhaits. Les tâches et les fiches restent réservées aux personnes affectées."
            >
              <Switch />
            </Form.Item>
          )}
          {enEdition !== null && enEdition !== 'nouvelle' && (
            <>
              <Divider titlePlacement="start" plain>
                Formulaire public
              </Divider>
              <p className="rt-texte-secondaire">
                Une personne extérieure remplit ce formulaire pour rejoindre
                l’équipe. Sa demande arrive dans l’onglet « Demandes » de
                l’écran « Personnes ». Aucun compte n’existe avant votre
                décision.
              </p>
              <Form.Item
                label="Formulaire ouvert"
                name="formulaireOuvert"
                valuePropName="checked"
                extra={
                  <>
                    Adresse à partager :{' '}
                    <Typography.Text copyable>
                      {`${window.location.origin}/rejoindre/${organisation.slug}/${enEdition.slug}`}
                    </Typography.Text>
                  </>
                }
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="Introduction"
                name="introduction"
                extra="Ce texte ouvre le formulaire. Il est public : n’y écrivez aucune coordonnée personnelle."
              >
                <Input.TextArea rows={3} maxLength={600} showCount />
              </Form.Item>
              <Form.Item
                label="Question complémentaire"
                name="question"
                extra="Le libellé d’une question propre à votre organisation, par exemple « Votre club ». Un champ vide ne pose aucune question."
              >
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item
                label="Paliers de disponibilité"
                name="paliers"
                extra="Saisissez un palier, puis validez avec Entrée. Le formulaire en propose huit au plus."
              >
                <Select
                  mode="tags"
                  maxCount={8}
                  open={false}
                  suffixIcon={null}
                  placeholder="Quelques heures pendant l’événement"
                />
              </Form.Item>
            </>
          )}
          {enEdition !== 'nouvelle' && gereOrganisation && (
            <Form.Item
              label="Archivée"
              name="archive"
              valuePropName="checked"
              extra="Une activité archivée disparaît du sélecteur et reste consultable."
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
