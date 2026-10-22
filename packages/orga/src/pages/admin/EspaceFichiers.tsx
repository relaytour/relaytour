import {
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Tabs,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import ChoixLecteurs from '../../composants/ChoixLecteurs'
import ConnexionEspace from '../../composants/ConnexionEspace'
import EtiquettesLecteurs from '../../composants/EtiquettesLecteurs'
import ImportFiches from '../../composants/ImportFiches'
import { Panneau } from '../../composants/Panneau'
import ParcoursEspace, {
  type PositionChoisie,
} from '../../composants/ParcoursEspace'
import Titre from '../../composants/Titre'
import ComptesFournisseur from '../../composants/ComptesFournisseur'
import VerificationAcces from '../../composants/VerificationAcces'
import type {
  AttendusDossier,
  DossiersLiesQuery,
  EspaceFichiersQuery,
} from '../../gql/graphql'
import { useActivite } from '../../lib/activite'
import { jourDeLInstant, messageErreur } from '../../lib/erreurs'
import {
  CHOISIR_DOSSIER_EXPORT,
  ACTIVATION_ACCES,
  AVEC_ANNUAIRE,
  COMMENCER_CONNEXION,
  DELIER_DOSSIER,
  DOSSIERS_LIES,
  EFFETS_LECTEURS,
  ESPACE_FICHIERS,
  EXPORTER_FICHES_MAINTENANT,
  LIER_DOSSIER,
  lecteursValides,
  MODIFIER_DOSSIER_LIE,
  REGLER_PORTEE,
  RETIRER_DOSSIER_EXPORT,
  TOUTE_L_ACTIVITE,
  versSaisie,
  type Lecteurs,
} from '../../lib/espace-fichiers'
import { useMentions } from '../../lib/useMentions'

// Fournisseur cloud de l'organisation (ADR 0038, 0043) : un admin de
// l'organisation le connecte, lie ses dossiers à l'activité affichée avec leurs
// lecteurs, et choisit le dossier où Relaytour exporte les fiches.

type Connexion = NonNullable<EspaceFichiersQuery['espaceFichiers']['connexion']>

const ISSUES: Record<
  string,
  { type: 'success' | 'warning' | 'error'; texte: string }
> = {
  reussie: { type: 'success', texte: 'Le fournisseur cloud est connecté.' },
  refusee: {
    type: 'warning',
    texte: 'La connexion a été annulée chez le fournisseur.',
  },
  echec: {
    type: 'error',
    texte:
      'La connexion a échoué. Recommencez depuis cette page, avec un compte admin de l’organisation.',
  },
}

const AUCUNE: PositionChoisie = { emplacement: null, chemin: [] }

/** « 1 fiche écrite », « 3 fiches écrites ». */
const accorder = (n: number, singulier: string, pluriel: string) =>
  `${n} ${n > 1 ? pluriel : singulier}`

type DossierLie = DossiersLiesQuery['dossiersLies'][number]

const lecteursDe = (d: DossierLie): Lecteurs => ({
  touteActivite: d.touteActivite,
  perimetres: d.perimetres.map(p => p.id),
  groupes: d.groupes,
})

/**
 * Lien d'un dossier (ADR 0043). Sans `dossier`, la fenêtre fait choisir un dossier
 * du fournisseur et ses lecteurs. Avec `dossier`, elle modifie ses lecteurs et son
 * nom, et annonce d'abord les documents liés que la modification masquerait.
 */
function LierDossier({
  ouvert,
  dossier,
  verification,
  onFermer,
}: {
  ouvert: boolean
  dossier: DossierLie | null
  /** Vrai quand la connexion vérifie les accès : les personnes attendues se règlent. */
  verification: boolean
  onFermer: () => void
}) {
  const { activite } = useActivite()
  const { message } = App.useApp()
  const mentions = useMentions()
  // La fenêtre se monte à chaque ouverture : elle part des lecteurs du dossier,
  // ou de toute l'activité.
  const [lecteurs, setLecteurs] = useState<Lecteurs>(() =>
    dossier === null ? TOUTE_L_ACTIVITE : lecteursDe(dossier)
  )
  const [nom, setNom] = useState(dossier?.nom ?? '')
  const [attendus, setAttendus] = useState<AttendusDossier>(
    dossier?.attendus ?? 'MEMBRES'
  )
  const [position, setPosition] = useState<PositionChoisie>(AUCUNE)
  const modification = dossier !== null

  const valides = lecteursValides(lecteurs)
  const effets = useQuery(EFFETS_LECTEURS, {
    variables: { id: dossier?.id ?? '', lecteurs: versSaisie(lecteurs) },
    skip: !ouvert || dossier === null || !valides,
  })
  const [lier, { loading: liaison }] = useMutation(LIER_DOSSIER, {
    refetchQueries: ['DossiersLies'],
  })
  const [modifier, { loading: enregistrement }] = useMutation(
    MODIFIER_DOSSIER_LIE,
    { refetchQueries: ['DossiersLies', 'RessourcesFiche'] }
  )

  const pret = modification
    ? valides && nom.trim().length > 0
    : valides && position.emplacement !== null && position.chemin.length > 0

  const valider = async () => {
    if (!pret) return
    try {
      if (dossier !== null) {
        await modifier({
          variables: {
            id: dossier.id,
            lecteurs: versSaisie(lecteurs),
            nom: nom.trim() === dossier.nom ? null : nom.trim(),
            attendus: verification ? attendus : null,
          },
        })
        message.success('Le dossier lié est modifié.')
      } else if (position.emplacement !== null) {
        await lier({
          variables: {
            activiteId: activite.id,
            lecteurs: versSaisie(lecteurs),
            emplacement: position.emplacement,
            chemin: position.chemin,
          },
        })
        message.success('Le dossier est lié.')
      }
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const masques = effets.data?.effetsLecteursDossier
  return (
    <Modal
      open={ouvert}
      onCancel={onFermer}
      title={
        dossier === null ? 'Lier un dossier' : `Modifier « ${dossier.nom} »`
      }
      okText={modification ? 'Enregistrer' : 'Lier ce dossier'}
      okButtonProps={{ disabled: !pret, loading: liaison || enregistrement }}
      onOk={() => void valider()}
      destroyOnHidden
      width={640}
    >
      <Form layout="vertical" component="div">
        {modification && (
          <Form.Item
            label="Nom affiché"
            extra="Relaytour affiche ce nom quand le fournisseur ne répond pas. Le dossier garde son nom chez le fournisseur."
          >
            <Input
              value={nom}
              maxLength={255}
              onChange={e => setNom(e.target.value)}
            />
          </Form.Item>
        )}
        <Form.Item
          label="Lu par"
          extra="Les personnes affectées aux périmètres choisis lisent le dossier, comme leurs fiches, ainsi que les admins de l’activité. Un groupe vaut aussi pour les périmètres qui le rejoindront. Toute l’activité se lit comme les fiches communes."
          validateStatus={valides ? undefined : 'error'}
          help={
            valides
              ? undefined
              : 'Choisissez toute l’activité, ou au moins un périmètre ou un groupe.'
          }
        >
          <ChoixLecteurs
            valeur={lecteurs}
            onChange={setLecteurs}
            mentions={mentions}
            toutPossible
            archives={dossier?.perimetres.filter(p => p.archive) ?? []}
            placeholder="Choisissez les lecteurs"
            ariaLabel="Lu par"
          />
        </Form.Item>
        {modification && verification && (
          <Form.Item
            label="Attendus chez le fournisseur"
            extra="La vérification des accès compare ces personnes aux droits du dossier chez le fournisseur."
          >
            <Select
              value={attendus}
              onChange={setAttendus}
              options={[
                {
                  value: 'MEMBRES',
                  label: 'Tous les membres des périmètres lecteurs',
                },
                {
                  value: 'CONTACTS_PRINCIPAUX',
                  label: 'Les contacts principaux seulement',
                },
              ]}
            />
          </Form.Item>
        )}
        {masques !== undefined && masques.documentsMasques > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={`${accorder(masques.documentsMasques, 'document lié ne sera plus lisible depuis sa fiche', 'documents liés ne seront plus lisibles depuis leur fiche')}.`}
            description={`${masques.fiches.length > 1 ? 'Fiches concernées' : 'Fiche concernée'} : ${masques.fiches.map(f => `« ${f.titre} »`).join(', ')}. Une fiche masque ces documents tant que le dossier ne sert pas son périmètre.`}
          />
        )}
        {!modification && (
          <ParcoursEspace
            actif={ouvert}
            valeur={position}
            onChange={setPosition}
            aide={chemin =>
              chemin.length === 0
                ? 'Ouvrez le dossier à lier. Une bibliothèque entière ne se lie pas.'
                : `Le dossier « ${chemin[chemin.length - 1]} » sera lié.`
            }
          />
        )}
      </Form>
    </Modal>
  )
}

/** Choix du dossier où Relaytour crée le dossier d'export des fiches. */
function ChoisirDossierExport({
  ouvert,
  onFermer,
}: {
  ouvert: boolean
  onFermer: () => void
}) {
  const { message } = App.useApp()
  const [position, setPosition] = useState<PositionChoisie>(AUCUNE)
  const [choisir, { loading: enCours }] = useMutation(CHOISIR_DOSSIER_EXPORT, {
    refetchQueries: ['EspaceFichiers'],
  })

  const valider = async () => {
    if (position.emplacement === null) return
    try {
      await choisir({
        variables: {
          emplacement: position.emplacement,
          chemin: position.chemin,
        },
      })
      message.success('Le dossier d’export est créé. Le premier export part.')
      setPosition(AUCUNE)
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouvert}
      onCancel={onFermer}
      title="Choisir le dossier d’export"
      okText="Créer le dossier d’export ici"
      okButtonProps={{
        disabled: position.emplacement === null,
        loading: enCours,
      }}
      onOk={() => void valider()}
      destroyOnHidden
      width={640}
    >
      <p className="rt-texte-secondaire">
        Relaytour crée un dossier « Fiches Relaytour » dans le dossier choisi,
        et y écrit les fiches de toutes les activités. Ce dossier ne doit pas se
        trouver dans un dossier lié : les membres y liraient les fiches de tous
        les périmètres.
      </p>
      <Form layout="vertical" component="div">
        <ParcoursEspace
          actif={ouvert}
          valeur={position}
          onChange={setPosition}
          aide={chemin =>
            chemin.length === 0
              ? 'Le dossier « Fiches Relaytour » sera créé à la racine de la bibliothèque.'
              : `Le dossier « Fiches Relaytour » sera créé dans « ${chemin[chemin.length - 1]} ».`
          }
        />
      </Form>
    </Modal>
  )
}

/** L'export des fiches : le dossier, le dernier résultat et les actions. */
function ExportFiches({ connexion }: { connexion: Connexion }) {
  const { message } = App.useApp()
  const [choix, setChoix] = useState(false)
  const [exporter, { loading: enCours }] = useMutation(
    EXPORTER_FICHES_MAINTENANT
  )
  const [retirer] = useMutation(RETIRER_DOSSIER_EXPORT, {
    refetchQueries: ['EspaceFichiers'],
  })
  const rapport = connexion.exportRapport
  const active = connexion.etat === 'ACTIVE'

  const lancer = async () => {
    try {
      await exporter()
      message.success(
        'L’export part. Son résultat s’affiche ici dans quelques instants.'
      )
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Panneau titre="Export des fiches" icone={<CloudUploadOutlined />}>
      <p className="rt-texte-secondaire">
        Relaytour écrit les fiches en Markdown dans un dossier du fournisseur
        cloud, après chaque modification et chaque nuit. Les fiches se modifient
        toujours dans Relaytour : une modification faite dans ce dossier est
        remplacée à l’export suivant.
      </p>
      {connexion.exportDossier === null ? (
        <Button
          icon={<FolderOutlined />}
          disabled={!active}
          onClick={() => setChoix(true)}
        >
          Choisir le dossier d’export
        </Button>
      ) : (
        <>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'dossier',
                label: 'Dossier',
                children: connexion.exportDossier,
              },
              {
                key: 'dernier',
                label: 'Dernier export',
                children: rapport
                  ? `${jourDeLInstant(rapport.exporteLe)} : ${accorder(rapport.ecrites, 'fiche écrite', 'fiches écrites')}, ${accorder(rapport.inchangees, 'inchangée', 'inchangées')}, ${accorder(rapport.supprimees, 'retirée', 'retirées')}`
                  : 'En attente',
              },
            ]}
          />
          {rapport?.erreur && (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 12 }}
              message={rapport.erreur}
            />
          )}
          {rapport && rapport.refusees.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="Ces fiches ne sont pas exportées."
              description={
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {rapport.refusees.map(r => (
                    <li key={r.fiche}>
                      {r.fiche} : {r.raison}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
          {rapport && rapport.modifieesALaMain.length > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 12 }}
              message="Ces fiches avaient été modifiées chez le fournisseur cloud. Relaytour les a réécrites."
              description={rapport.modifieesALaMain.join(', ')}
            />
          )}
          <div className="rt-puces" style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={enCours}
              disabled={!active}
              onClick={() => void lancer()}
            >
              Exporter maintenant
            </Button>
            <Button disabled={!active} onClick={() => setChoix(true)}>
              Changer de dossier
            </Button>
            <Popconfirm
              title="Arrêter l’export des fiches ?"
              description="Les fichiers déjà écrits restent chez le fournisseur cloud."
              okText="Arrêter"
              cancelText="Annuler"
              onConfirm={() =>
                retirer().catch((e: unknown) => message.error(messageErreur(e)))
              }
            >
              <Button danger>Arrêter l’export</Button>
            </Popconfirm>
          </div>
        </>
      )}
      <ChoisirDossierExport ouvert={choix} onFermer={() => setChoix(false)} />
    </Panneau>
  )
}

export default function EspaceFichiers() {
  const { activite } = useActivite()
  const { message } = App.useApp()
  const [parametres, setParametres] = useSearchParams()
  const [choixDossier, setChoix] = useState(false)
  const [modifie, setModifie] = useState<DossierLie | null>(null)
  const { data, loading } = useQuery(ESPACE_FICHIERS)
  const liens = useQuery(DOSSIERS_LIES, {
    variables: { activiteId: activite.id },
  })
  const [delier] = useMutation(DELIER_DOSSIER, {
    refetchQueries: ['DossiersLies'],
  })
  const [commencer] = useMutation(COMMENCER_CONNEXION)
  const [reglerPortee] = useMutation(REGLER_PORTEE, {
    refetchQueries: ['EspaceFichiers', 'VerificationAcces'],
  })

  // Retour du fournisseur : le serveur redirige ici avec l'issue de la connexion.
  const issue = parametres.get('connexion')
  useEffect(() => {
    if (issue === null) return
    const avis = ISSUES[issue] ?? ISSUES.echec!
    message.open({ type: avis.type, content: avis.texte })
    setParametres({}, { replace: true })
  }, [issue, message, setParametres])

  const espace = data?.espaceFichiers
  const connexion = espace?.connexion ?? null
  const verification = connexion !== null && connexion.portee !== 'FICHIERS'
  // Une reconnexion demande de nouvelles autorisations ; Google Drive et
  // Nextcloud se règlent sans reconnexion (ADR 0044).
  const activation =
    connexion === null ? undefined : ACTIVATION_ACCES[connexion.fournisseur]
  const activable =
    activation === 'reglage' ||
    (activation === 'reconnexion' && connexion?.methode === 'COMPTE')
  const activer = async (portee: 'ANNUAIRE' | 'GESTION') => {
    if (connexion === null) return
    try {
      if (activation === 'reglage') {
        await reglerPortee({ variables: { portee } })
        message.success(
          portee === 'GESTION'
            ? 'La gestion des accès est activée.'
            : 'La vérification des accès est activée.'
        )
        return
      }
      const r = await commencer({
        variables: { fournisseur: connexion.fournisseur, portee },
      })
      const adresse = r.data?.commencerConnexionEspaceFichiers
      if (adresse) window.location.assign(adresse)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }
  const onglet = parametres.get('onglet') ?? 'connexion'

  const connexionEtDossiers = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ConnexionEspace espace={espace} chargement={loading} />

      {connexion !== null && <ExportFiches connexion={connexion} />}

      {connexion !== null && (
        <ImportFiches actif={connexion.etat === 'ACTIVE'} />
      )}

      <Panneau
        titre={`Dossiers liés de l’activité « ${activite.nom} »`}
        icone={<FolderOutlined />}
        extra={
          <Button
            icon={<LinkOutlined />}
            disabled={connexion?.etat !== 'ACTIVE'}
            onClick={() => setChoix(true)}
          >
            Lier un dossier
          </Button>
        }
      >
        {liens.loading && !liens.data ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (liens.data?.dossiersLies ?? []).length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Aucun dossier n’est lié à cette activité."
          />
        ) : (
          <ul className="rt-explorateur">
            {liens.data?.dossiersLies.map(d => (
              <li key={d.id} className="rt-explorateur-ligne">
                <FolderOutlined aria-hidden className="rt-explorateur-icone" />
                <span className="rt-explorateur-nom">{d.nom}</span>
                <EtiquettesLecteurs
                  touteActivite={d.touteActivite}
                  perimetres={d.perimetres}
                  groupes={d.groupes}
                />
                {!d.disponible && <Tag color="warning">Indisponible</Tag>}
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={`Modifier le dossier ${d.nom}`}
                  onClick={() => setModifie(d)}
                />
                <Popconfirm
                  title="Retirer ce dossier ?"
                  description={
                    d.accesCrees > 0
                      ? `Le dossier reste chez le fournisseur cloud. Relaytour y a créé ${d.accesCrees > 1 ? `${d.accesCrees} accès, qui restent` : 'un accès, qui reste'} sans suivi.`
                      : 'Le dossier reste chez le fournisseur cloud. Les membres ne le lisent plus dans Relaytour.'
                  }
                  okText="Retirer"
                  cancelText="Annuler"
                  onConfirm={() =>
                    delier({
                      variables: { id: d.id, oublierAcces: d.accesCrees > 0 },
                    }).catch((e: unknown) => message.error(messageErreur(e)))
                  }
                >
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    aria-label={`Retirer le dossier ${d.nom}`}
                  />
                </Popconfirm>
              </li>
            ))}
          </ul>
        )}
      </Panneau>
    </div>
  )

  return (
    <>
      <Titre sousTitre="Les membres lisent les documents de l’association depuis Relaytour, sans compte chez le fournisseur. Relaytour ne copie aucun document.">
        Fournisseur cloud
      </Titre>

      {connexion === null ? (
        connexionEtDossiers
      ) : (
        <Tabs
          activeKey={onglet}
          onChange={cle =>
            setParametres(cle === 'connexion' ? {} : { onglet: cle }, {
              replace: true,
            })
          }
          items={[
            {
              key: 'connexion',
              label: 'Connexion et dossiers',
              children: connexionEtDossiers,
            },
            {
              key: 'acces',
              label: 'Vérification des accès',
              children: (
                <VerificationAcces
                  connexion={connexion}
                  onActiver={activable ? () => void activer('ANNUAIRE') : null}
                  onActiverGestion={
                    activable ? () => void activer('GESTION') : null
                  }
                />
              ),
            },
            ...(verification
              ? [
                  {
                    key: 'comptes',
                    label: 'Comptes',
                    children: (
                      <ComptesFournisseur
                        annuaire={AVEC_ANNUAIRE.has(connexion.fournisseur)}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {(choixDossier || modifie !== null) && (
        <LierDossier
          key={modifie?.id ?? 'nouveau'}
          ouvert
          verification={verification}
          dossier={modifie}
          onFermer={() => {
            setChoix(false)
            setModifie(null)
          }}
        />
      )}
    </>
  )
}
