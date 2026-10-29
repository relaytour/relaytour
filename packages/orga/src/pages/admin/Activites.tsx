import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
  Radio,
  Row,
  Select,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import ChampCouleur from '../../composants/ChampCouleur'
import {
  ChampGroupes,
  ChampModules,
  ChampNature,
} from '../../composants/ChampsActivite'
import ChampImage from '../../composants/ChampImage'
import DepotContenu from '../../composants/DepotContenu'
import ReprendreMonAdresse from '../../composants/ReprendreMonAdresse'
import { Panneau } from '../../composants/Panneau'
import Tableau from '../../composants/Tableau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type {
  AdressesOrganigramme,
  ModuleActivite,
  NatureActivite,
} from '../../gql/graphql'
import { formesPeriode, useActivite, type Activite } from '../../lib/activite'
import { messageErreur } from '../../lib/erreurs'
import { useOrganisation } from '../../lib/organisation'
import { groupesSaisis, NATURES, type Groupe } from '../../lib/natures'
import { joursRelatifs } from '../../lib/regroupement'
import { useSession } from '../../lib/session'
import { themeActivite, type ThemeActivite } from '../../lib/theme'
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
    $adressesOrganigramme: AdressesOrganigramme
    $modules: [ModuleActivite!]
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
      adressesOrganigramme: $adressesOrganigramme
      modules: $modules
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
  // Adresses de l'organigramme (ADR 0036).
  adressesOrganigramme: AdressesOrganigramme
  // Modules actifs de l'activité (ADR 0052).
  modules: ModuleActivite[]
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

/** Les groupes proposés à la création d'une activité, dans la langue active. */
const groupesParDefaut = (): Groupe[] => [
  { cle: 'sport', libelle: t`Sport`, libellePluriel: t`Sports` },
  {
    cle: 'pole',
    libelle: t({ message: 'Pôle', comment: 'Groupe de périmètres' }),
    libellePluriel: t({ message: 'Pôles', comment: 'Groupe de périmètres' }),
  },
]

export default function Activites() {
  const { t } = useLingui()
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
  // Le dépôt d'un dossier de contenu porte sur une activité ouverte que la
  // personne administre, l'activité affichée par défaut (ADR 0049).
  const importables = (data?.activites ?? []).filter(
    a => a.estAdministree && !a.archive
  )
  const [activiteImportee, setActiviteImportee] = useState<string | null>(null)
  const aImporter =
    importables.find(a => a.id === activiteImportee)?.id ??
    importables.find(a => a.id === affichee.id)?.id ??
    importables[0]?.id ??
    null

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
            groupes: groupesParDefaut(),
            // Une activité nouvelle garde les phases par défaut : elles se règlent
            // après sa création.
            phases: [],
            archive: false,
            souhaitsOuverts: false,
            adressesOrganigramme: 'AUCUNE',
            modules: [],
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
            adressesOrganigramme: activite.adressesOrganigramme,
            modules: activite.modules,
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
    const groupes = groupesSaisis(v.groupes)
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
        message.success(t`Activité créée.`)
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
            adressesOrganigramme: v.adressesOrganigramme,
            modules: v.modules,
            formulaire: {
              introduction: v.introduction ?? '',
              question: v.question ?? '',
              paliers: v.paliers,
            },
            formulaireOuvert: v.formulaireOuvert,
          },
        })
        message.success(t`Activité enregistrée.`)
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
      <Titre
        sousTitre={t`Un événement, une section ou une instance : chaque activité a ses périodes, ses périmètres, ses fiches et ses tâches types.`}
      >
        <Trans>Activités</Trans>
      </Titre>
      {gereOrganisation && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ marginBottom: 16 }}
          onClick={() => ouvrir('nouvelle')}
        >
          <Trans>Nouvelle activité</Trans>
        </Button>
      )}
      <Tableau<Activite>
        id="activites"
        rowKey="id"
        loading={loading && !data}
        dataSource={data?.activites ?? []}
        pagination={false}
        ouvrir={ouvrir}
        peutOuvrir={a => a.estAdministree}
        libelleOuvrir={a => {
          const nom = a.nom
          return t`Modifier ${nom}`
        }}
        colonnes={[
          {
            key: 'nom',
            title: t`Nom`,
            dataIndex: 'nom',
            tri: a => a.nom,
            recherche: a => a.nom,
            render: (nom: string, a) => (
              <>
                {nom}
                {a.id === affichee.id && (
                  <Tag style={{ marginInlineStart: 8 }}>
                    <Trans>Affichée</Trans>
                  </Tag>
                )}
              </>
            ),
          },
          {
            key: 'slug',
            title: t`Identifiant`,
            dataIndex: 'slug',
            tri: a => a.slug,
          },
          {
            key: 'nature',
            title: t`Nature`,
            dataIndex: 'nature',
            render: (n: NatureActivite) => {
              const nature = NATURES.find(x => x.value === n)
              const libelle = nature ? t(nature.label) : n
              const mot = formesPeriode(n).nom
              return t`${libelle} (${mot})`
            },
            filtre: {
              options: NATURES.map(n => ({ text: t(n.label), value: n.value })),
              valeurs: a => a.nature,
            },
          },
          {
            key: 'groupes',
            title: t`Groupes`,
            render: (_, a) => a.groupes.map(g => g.libellePluriel).join(', '),
          },
          {
            key: 'phases',
            title: t`Phases`,
            render: (_, a) => a.phases.map(p => p.libelle).join(', '),
          },
          {
            key: 'etat',
            title: t({
              message: 'État',
              comment: 'Colonne : état d’une activité',
            }),
            dataIndex: 'archive',
            render: (archive: boolean) =>
              archive ? (
                <Tag>
                  {t({ message: 'Archivée', comment: 'Statut d’une activité' })}
                </Tag>
              ) : (
                <Tag color="green">
                  {t({ message: 'Ouverte', comment: 'Statut d’une activité' })}
                </Tag>
              ),
            filtre: {
              options: [
                {
                  text: t({
                    message: 'Ouverte',
                    comment: 'Statut d’une activité',
                  }),
                  value: 'ouverte',
                },
                {
                  text: t({
                    message: 'Archivée',
                    comment: 'Statut d’une activité',
                  }),
                  value: 'archivee',
                },
              ],
              valeurs: a => (a.archive ? 'archivee' : 'ouverte'),
            },
          },
        ]}
      />

      {importables.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Panneau titre={t`Importer le contenu d’une activité`}>
            <p className="rt-texte-secondaire">
              <Trans>
                L’import ne lit que le dossier de l’activité choisie : ses
                périmètres, ses fiches et ses tâches types. Il ignore l’identité
                de l’organisation et les autres activités.
              </Trans>
            </p>
            {importables.length > 1 && (
              <label className="rt-import-champ" style={{ marginBottom: 16 }}>
                <span className="rt-libelle">{t`Activité`}</span>
                <Select
                  aria-label={t`Activité à importer`}
                  value={aImporter}
                  onChange={setActiviteImportee}
                  options={importables.map(a => ({
                    value: a.id,
                    label: a.nom,
                  }))}
                  style={{ maxWidth: 360 }}
                />
              </label>
            )}
            <DepotContenu key={aImporter} activiteId={aImporter} />
          </Panneau>
        </div>
      )}

      <Modal
        open={enEdition !== null}
        title={
          enEdition === 'nouvelle'
            ? t`Nouvelle activité`
            : t`Modifier l’activité`
        }
        okText={t`Enregistrer`}
        cancelText={t`Annuler`}
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
                label={t`Nom`}
                name="nom"
                rules={[{ required: true, message: t`Saisissez un nom.` }]}
              >
                <Input placeholder={t`Section natation`} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item label={t`Sigle (facultatif)`} name="sigle">
                <Input placeholder={t`Natation`} maxLength={20} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item
                label={t`Identifiant`}
                name="slug"
                extra={t`Il apparaît dans l’adresse des pages et ne change plus.`}
                rules={[
                  { required: true, message: t`Saisissez un identifiant.` },
                  {
                    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: t`Minuscules, chiffres et tirets seulement.`,
                  },
                ]}
              >
                <Input
                  placeholder={t`section-natation`}
                  disabled={enEdition !== 'nouvelle'}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item label={t`Ordre`} name="ordre">
                <InputNumber min={0} max={999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <ChampNature />
          <ChampGroupes />
          {enEdition !== 'nouvelle' && (
            <Form.Item
              label={t`Phases`}
              extra={t`Une tâche se range par son échéance dans la première phase dont la borne n’est pas dépassée. La borne compte les jours depuis le premier jour de la période : J-120 pour 120 jours avant, J+30 pour 30 jours après. La dernière phase reçoit tout ce qui suit.`}
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
                              { required: true, message: t`Clé requise.` },
                              {
                                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                                message: t`Minuscules, chiffres, tirets.`,
                              },
                            ]}
                          >
                            <Input
                              placeholder={t`clé`}
                              aria-label={t`Clé de la phase`}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={12} sm={8}>
                          <Form.Item
                            name={[champ.name, 'libelle']}
                            rules={[
                              { required: true, message: t`Libellé requis.` },
                            ]}
                          >
                            <Input
                              placeholder={t({
                                message: 'Préparation',
                                comment: 'Exemple de nom de phase',
                              })}
                              maxLength={60}
                              aria-label={t`Libellé de la phase`}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={10} sm={7}>
                          {rang === champs.length - 1 ? (
                            <Form.Item>
                              <Input
                                disabled
                                placeholder={t`sans borne`}
                                aria-label={t`Dernier jour de la phase : aucun, la dernière phase reçoit tout ce qui suit`}
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
                                { required: true, message: t`Borne requise.` },
                                {
                                  pattern: BORNE,
                                  message: t`Forme J-120 ou J+30.`,
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
                                            t`La borne doit dépasser la précédente.`
                                          )
                                        )
                                  },
                                }),
                              ]}
                            >
                              <Input
                                placeholder="J-120"
                                aria-label={t`Dernier jour de la phase`}
                              />
                            </Form.Item>
                          )}
                        </Col>
                        <Col xs={2} sm={2}>
                          <Button
                            icon={<DeleteOutlined />}
                            aria-label={t`Retirer la phase`}
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
                      <Trans>Ajouter une phase</Trans>
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
          )}
          <Divider titlePlacement="start" plain>
            <Trans>Identité propre (facultatif)</Trans>
          </Divider>
          <p className="rt-texte-secondaire">
            <Trans>
              Un champ vide reprend la valeur de l’organisation. Le contact
              reste une adresse de rôle de l’organisation.
            </Trans>
          </p>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={t`Contact de l’activité`}
                name="contactRecrutement"
                extra={
                  <>
                    {t`Cette adresse reçoit les réponses aux mails de l’activité.`}{' '}
                    <ReprendreMonAdresse
                      onReprendre={adresse =>
                        form.setFieldsValue({ contactRecrutement: adresse })
                      }
                    />
                  </>
                }
              >
                <Input type="email" placeholder={t`Celui de l’organisation`} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={t`Page de l’équipe`} name="pageEquipe">
                <Input type="url" placeholder="https://" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t`Logo PNG`} name="logoPng">
            <ChampImage format="PNG" libelle={t`Logo de l’activité`} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label={t`Couleur primaire`} name="primaire">
                <ChampCouleur heritee={organisation.theme.couleurs.primaire} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={t`Couleur d’accent`} name="accent">
                <ChampCouleur heritee={organisation.theme.couleurs.accent} />
              </Form.Item>
            </Col>
          </Row>
          {enEdition !== null && enEdition !== 'nouvelle' && (
            <ChampModules autorises={enEdition.modulesAutorises} />
          )}
          {enEdition !== 'nouvelle' && (
            <Form.Item
              label={t`Ouverte aux souhaits`}
              name="souhaitsOuverts"
              valuePropName="checked"
              extra={t`Les personnes de l’équipe de l’activité formulent elles-mêmes leurs souhaits dans « Tous les périmètres ». Sinon, seuls les admins de l’activité notent les souhaits. Le réglage ne montre pas l’activité aux membres hors de son équipe.`}
            >
              <Switch />
            </Form.Item>
          )}
          {enEdition !== 'nouvelle' && (
            <Form.Item
              className="rt-choix"
              label={t`Adresses dans l’organigramme`}
              name="adressesOrganigramme"
              extra={t`Une adresse s’affiche seulement si la personne l’accepte dans ses préférences. Seules les personnes de l’activité la lisent.`}
            >
              <Radio.Group>
                <Radio value="AUCUNE">
                  <span className="rt-choix-titre">
                    {t({
                      message: 'Aucune',
                      comment: 'Adresses de l’organigramme : aucune adresse',
                    })}
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>
                      L’organigramme montre les noms et le contact de
                      l’activité.
                    </Trans>
                  </span>
                </Radio>
                <Radio value="CONTACTS">
                  <span className="rt-choix-titre">
                    <Trans>Admins et contacts principaux</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>Les personnes à solliciter en premier.</Trans>
                  </span>
                </Radio>
                <Radio value="REFERENTS">
                  <span className="rt-choix-titre">
                    <Trans>Toute l’équipe des périmètres</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>
                      Les admins, les contacts principaux, les référentes et les
                      référents.
                    </Trans>
                  </span>
                </Radio>
              </Radio.Group>
            </Form.Item>
          )}
          {enEdition !== null && enEdition !== 'nouvelle' && (
            <>
              <Divider titlePlacement="start" plain>
                <Trans>Formulaire public</Trans>
              </Divider>
              <p className="rt-texte-secondaire">
                <Trans>
                  Une personne extérieure remplit ce formulaire pour rejoindre
                  l’équipe. Sa demande arrive dans l’onglet « Demandes » de
                  l’écran « Personnes ». Aucun compte n’existe avant votre
                  décision.
                </Trans>
              </p>
              <Form.Item
                label={t`Formulaire ouvert`}
                name="formulaireOuvert"
                valuePropName="checked"
                extra={
                  <>
                    <Trans>Adresse à partager :</Trans>{' '}
                    <Typography.Text copyable>
                      {`${window.location.origin}/rejoindre/${organisation.slug}/${enEdition.slug}`}
                    </Typography.Text>
                  </>
                }
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label={t`Introduction`}
                name="introduction"
                extra={t`Ce texte ouvre le formulaire. Il est public : n’y écrivez aucune coordonnée personnelle.`}
              >
                <Input.TextArea rows={3} maxLength={600} showCount />
              </Form.Item>
              <Form.Item
                label={t`Question complémentaire`}
                name="question"
                extra={t`Le libellé d’une question propre à votre organisation, par exemple « Votre club ». Un champ vide ne pose aucune question.`}
              >
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item
                label={t`Paliers de disponibilité`}
                name="paliers"
                extra={t`Saisissez un palier, puis validez avec Entrée. Le formulaire en propose huit au plus.`}
              >
                <Select
                  mode="tags"
                  maxCount={8}
                  open={false}
                  suffixIcon={null}
                  placeholder={t`Quelques heures pendant l’événement`}
                />
              </Form.Item>
            </>
          )}
          {enEdition !== 'nouvelle' && gereOrganisation && (
            <Form.Item
              label={t({
                message: 'Archivée',
                comment: 'Statut d’une activité',
              })}
              name="archive"
              valuePropName="checked"
              extra={t`Une activité archivée disparaît du sélecteur et reste consultable.`}
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
