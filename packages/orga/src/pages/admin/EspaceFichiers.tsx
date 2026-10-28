import {
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
  { type: 'success' | 'warning' | 'error'; texte: MessageDescriptor }
> = {
  reussie: { type: 'success', texte: msg`Le fournisseur cloud est connecté.` },
  'sans-annuaire': {
    type: 'warning',
    texte: msg`Le fournisseur cloud est connecté sans la vérification des accès. Le compte utilisé n’a pas obtenu la lecture de l’annuaire.`,
  },
  'sans-gestion': {
    type: 'warning',
    texte: msg`Le fournisseur cloud est connecté avec la vérification des accès, sans leur gestion. Le compte utilisé n’a pas obtenu la modification des groupes.`,
  },
  refusee: {
    type: 'warning',
    texte: msg`La connexion a été annulée chez le fournisseur.`,
  },
  echec: {
    type: 'error',
    texte: msg`La connexion a échoué. Recommencez depuis cette page, avec un compte admin de l’organisation.`,
  },
}

const AUCUNE: PositionChoisie = { emplacement: null, chemin: [] }

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
  const { t } = useLingui()
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
        message.success(t`Le dossier lié est modifié.`)
      } else if (position.emplacement !== null) {
        await lier({
          variables: {
            activiteId: activite.id,
            lecteurs: versSaisie(lecteurs),
            emplacement: position.emplacement,
            chemin: position.chemin,
          },
        })
        message.success(t`Le dossier est lié.`)
      }
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const masques = effets.data?.effetsLecteursDossier
  const nomDossier = dossier?.nom ?? ''
  const nombreMasques = masques?.documentsMasques ?? 0
  const fichesConcernees = (masques?.fiches ?? [])
    .map(f => `« ${f.titre} »`)
    .join(', ')
  return (
    <Modal
      open={ouvert}
      onCancel={onFermer}
      title={
        dossier === null ? t`Lier un dossier` : t`Modifier « ${nomDossier} »`
      }
      okText={modification ? t`Enregistrer` : t`Lier ce dossier`}
      okButtonProps={{ disabled: !pret, loading: liaison || enregistrement }}
      onOk={() => void valider()}
      destroyOnHidden
      width={640}
    >
      <Form layout="vertical" component="div">
        {modification && (
          <Form.Item
            label={t`Nom affiché`}
            extra={t`Relaytour affiche ce nom quand le fournisseur ne répond pas. Le dossier garde son nom chez le fournisseur.`}
          >
            <Input
              value={nom}
              maxLength={255}
              onChange={e => setNom(e.target.value)}
            />
          </Form.Item>
        )}
        <Form.Item
          label={t`Lu par`}
          extra={t`Les personnes affectées aux périmètres choisis lisent le dossier, comme leurs fiches, ainsi que les admins de l’activité. Un groupe vaut aussi pour les périmètres qui le rejoindront. Toute l’activité se lit comme les fiches communes.`}
          validateStatus={valides ? undefined : 'error'}
          help={
            valides
              ? undefined
              : t`Choisissez toute l’activité, ou au moins un périmètre ou un groupe.`
          }
        >
          <ChoixLecteurs
            valeur={lecteurs}
            onChange={setLecteurs}
            mentions={mentions}
            toutPossible
            archives={dossier?.perimetres.filter(p => p.archive) ?? []}
            placeholder={t`Choisissez les lecteurs`}
            ariaLabel={t`Lu par`}
          />
        </Form.Item>
        {modification && verification && (
          <Form.Item
            label={t`Attendus chez le fournisseur`}
            extra={t`La vérification des accès compare ces personnes aux droits du dossier chez le fournisseur.`}
          >
            <Select
              value={attendus}
              onChange={setAttendus}
              options={[
                {
                  value: 'MEMBRES',
                  label: t`Tous les membres des périmètres lecteurs`,
                },
                {
                  value: 'CONTACTS_PRINCIPAUX',
                  label: t`Les contacts principaux seulement`,
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
            title={t`${plural(nombreMasques, { one: '# document lié ne sera plus lisible depuis sa fiche.', other: '# documents liés ne seront plus lisibles depuis leur fiche.' })}`}
            description={
              masques.fiches.length > 1
                ? t`Fiches concernées : ${fichesConcernees}. Une fiche masque ces documents tant que le dossier ne sert pas son périmètre.`
                : t`Fiche concernée : ${fichesConcernees}. Une fiche masque ces documents tant que le dossier ne sert pas son périmètre.`
            }
          />
        )}
        {!modification && (
          <ParcoursEspace
            actif={ouvert}
            valeur={position}
            onChange={setPosition}
            aide={chemin => {
              const dernier = chemin[chemin.length - 1]
              return chemin.length === 0
                ? t`Ouvrez le dossier à lier. Une bibliothèque entière ne se lie pas.`
                : t`Le dossier « ${dernier} » sera lié.`
            }}
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
  const { t } = useLingui()
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
      message.success(t`Le dossier d’export est créé. Le premier export part.`)
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
      title={t`Choisir le dossier d’export`}
      okText={t`Créer le dossier d’export ici`}
      okButtonProps={{
        disabled: position.emplacement === null,
        loading: enCours,
      }}
      onOk={() => void valider()}
      destroyOnHidden
      width={640}
    >
      <p className="rt-texte-secondaire">
        <Trans>
          Relaytour crée un dossier « Fiches Relaytour » dans le dossier choisi,
          et y écrit les fiches de toutes les activités. Ce dossier ne doit pas
          se trouver dans un dossier lié : les membres y liraient les fiches de
          tous les périmètres.
        </Trans>
      </p>
      <Form layout="vertical" component="div">
        <ParcoursEspace
          actif={ouvert}
          valeur={position}
          onChange={setPosition}
          aide={chemin => {
            const dernier = chemin[chemin.length - 1]
            return chemin.length === 0
              ? t`Le dossier « Fiches Relaytour » sera créé à la racine de la bibliothèque.`
              : t`Le dossier « Fiches Relaytour » sera créé dans « ${dernier} ».`
          }}
        />
      </Form>
    </Modal>
  )
}

/** L'export des fiches : le dossier, le dernier résultat et les actions. */
function ExportFiches({ connexion }: { connexion: Connexion }) {
  const { t } = useLingui()
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
  const jourExport = rapport ? jourDeLInstant(rapport.exporteLe) : ''
  const ecrites = rapport?.ecrites ?? 0
  const inchangees = rapport?.inchangees ?? 0
  const retirees = rapport?.supprimees ?? 0
  const fichesEcrites = t`${plural(ecrites, { one: '# fiche écrite', other: '# fiches écrites' })}`
  const fichesInchangees = t`${plural(inchangees, { one: '# inchangée', other: '# inchangées' })}`
  const fichesRetirees = t`${plural(retirees, { one: '# retirée', other: '# retirées' })}`

  const lancer = async () => {
    try {
      await exporter()
      message.success(
        t`L’export part. Son résultat s’affiche ici dans quelques instants.`
      )
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Panneau titre={t`Export des fiches`} icone={<CloudUploadOutlined />}>
      <p className="rt-texte-secondaire">
        <Trans>
          Relaytour écrit les fiches en Markdown dans un dossier du fournisseur
          cloud, après chaque modification et chaque nuit. Les fiches se
          modifient toujours dans Relaytour : une modification faite dans ce
          dossier est remplacée à l’export suivant.
        </Trans>
      </p>
      {connexion.exportDossier === null ? (
        <Button
          icon={<FolderOutlined />}
          disabled={!active}
          onClick={() => setChoix(true)}
        >
          {t`Choisir le dossier d’export`}
        </Button>
      ) : (
        <>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'dossier',
                label: t`Dossier`,
                children: connexion.exportDossier,
              },
              {
                key: 'dernier',
                label: t`Dernier export`,
                children: rapport
                  ? t`${jourExport} : ${fichesEcrites}, ${fichesInchangees}, ${fichesRetirees}`
                  : t`En attente`,
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
              message={t`Ces fiches ne sont pas exportées.`}
              description={
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {rapport.refusees.map(r => {
                    const fiche = r.fiche
                    const raison = r.raison
                    return (
                      <li key={r.fiche}>
                        <Trans>
                          {fiche} : {raison}
                        </Trans>
                      </li>
                    )
                  })}
                </ul>
              }
            />
          )}
          {rapport && rapport.modifieesALaMain.length > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 12 }}
              message={t`Ces fiches avaient été modifiées chez le fournisseur cloud. Relaytour les a réécrites.`}
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
              {t`Exporter maintenant`}
            </Button>
            <Button disabled={!active} onClick={() => setChoix(true)}>
              {t`Changer de dossier`}
            </Button>
            <Popconfirm
              title={t`Arrêter l’export des fiches ?`}
              description={t`Les fichiers déjà écrits restent chez le fournisseur cloud.`}
              okText={t`Arrêter`}
              cancelText={t`Annuler`}
              onConfirm={() =>
                retirer().catch((e: unknown) => message.error(messageErreur(e)))
              }
            >
              <Button danger>{t`Arrêter l’export`}</Button>
            </Popconfirm>
          </div>
        </>
      )}
      <ChoisirDossierExport ouvert={choix} onFermer={() => setChoix(false)} />
    </Panneau>
  )
}

export default function EspaceFichiers() {
  const { t } = useLingui()
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
    message.open({ type: avis.type, content: t(avis.texte) })
    setParametres({}, { replace: true })
  }, [issue, message, setParametres, t])

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
            ? t`La gestion des accès est activée.`
            : t`La vérification des accès est activée.`
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
  const nomActivite = activite.nom

  const connexionEtDossiers = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ConnexionEspace espace={espace} chargement={loading && !data} />

      {connexion !== null && <ExportFiches connexion={connexion} />}

      {connexion !== null && (
        <ImportFiches actif={connexion.etat === 'ACTIVE'} />
      )}

      <Panneau
        titre={t`Dossiers liés de l’activité « ${nomActivite} »`}
        icone={<FolderOutlined />}
        extra={
          <Button
            icon={<LinkOutlined />}
            disabled={connexion?.etat !== 'ACTIVE'}
            onClick={() => setChoix(true)}
          >
            {t`Lier un dossier`}
          </Button>
        }
      >
        {liens.loading && !liens.data ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (liens.data?.dossiersLies ?? []).length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t`Aucun dossier n’est lié à cette activité.`}
          />
        ) : (
          <ul className="rt-explorateur">
            {liens.data?.dossiersLies.map(d => {
              const nomDossierLie = d.nom
              const accesCrees = d.accesCrees
              return (
                <li key={d.id} className="rt-explorateur-ligne">
                  <FolderOutlined
                    aria-hidden
                    className="rt-explorateur-icone"
                  />
                  <span className="rt-explorateur-nom">{d.nom}</span>
                  <EtiquettesLecteurs
                    touteActivite={d.touteActivite}
                    perimetres={d.perimetres}
                    groupes={d.groupes}
                  />
                  {!d.disponible && (
                    <Tag color="warning">{t`Indisponible`}</Tag>
                  )}
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    aria-label={t`Modifier le dossier ${nomDossierLie}`}
                    onClick={() => setModifie(d)}
                  />
                  <Popconfirm
                    title={t`Retirer ce dossier ?`}
                    description={
                      accesCrees > 0
                        ? t`Le dossier reste chez le fournisseur cloud. Relaytour y a créé ${plural(accesCrees, { one: 'un accès, qui reste', other: '# accès, qui restent' })} sans suivi.`
                        : t`Le dossier reste chez le fournisseur cloud. Les membres ne le lisent plus dans Relaytour.`
                    }
                    okText={t`Retirer`}
                    cancelText={t`Annuler`}
                    onConfirm={() =>
                      delier({
                        variables: { id: d.id, oublierAcces: d.accesCrees > 0 },
                      }).catch((e: unknown) => message.error(messageErreur(e)))
                    }
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      aria-label={t`Retirer le dossier ${nomDossierLie}`}
                    />
                  </Popconfirm>
                </li>
              )
            })}
          </ul>
        )}
      </Panneau>
    </div>
  )

  return (
    <>
      <Titre
        sousTitre={t`Les membres lisent les documents de l’association depuis Relaytour, sans compte chez le fournisseur. Relaytour ne copie aucun document.`}
      >
        {t`Fournisseur cloud`}
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
              label: t`Connexion et dossiers`,
              children: connexionEtDossiers,
            },
            {
              key: 'acces',
              label: t`Vérification des accès`,
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
                    label: t`Comptes`,
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
