import {
  CloudOutlined,
  ExportOutlined,
  KeyOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useApolloClient, useMutation } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Input,
  Modal,
  Popconfirm,
  Skeleton,
  Spin,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { EspaceFichiersQuery, FournisseurFichiers } from '../gql/graphql'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import {
  COMMENCER_CONNEXION,
  COMMENCER_NEXTCLOUD,
  CONNECTER_COMPTE_SERVICE,
  DECONNECTER,
  NOMS_FOURNISSEURS,
  TERMINER_NEXTCLOUD,
} from '../lib/espace-fichiers'
import { Panneau } from './Panneau'

// Connexion de l'espace de fichiers (ADR 0038) : par le compte d'un admin
// (SharePoint, Google Drive, Dropbox, Nextcloud), ou par un compte de service
// Google dont l'organisation dépose la clé.

/** Intervalle entre deux questions à Nextcloud, et durée de vie d'une demande. */
const SONDAGE_MS = 3_000
const DEMANDE_NEXTCLOUD_MS = 20 * 60_000

type Espace = EspaceFichiersQuery['espaceFichiers']

const nom = (f: string) => NOMS_FOURNISSEURS[f] ?? f

/** Dépôt de la clé JSON d'un compte de service Google. */
function CompteService({
  ouvert,
  onFermer,
}: {
  ouvert: boolean
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const [cle, setCle] = useState('')
  const [connecter, { loading }] = useMutation(CONNECTER_COMPTE_SERVICE, {
    refetchQueries: ['EspaceFichiers', 'DossiersLies'],
  })

  const valider = async () => {
    try {
      await connecter({ variables: { cle } })
      message.success(t`Google Drive est connecté par le compte de service.`)
      setCle('')
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouvert}
      onCancel={onFermer}
      title={t`Connecter Google Drive par un compte de service`}
      okText={t`Connecter`}
      okButtonProps={{ disabled: cle.trim() === '', loading }}
      onOk={() => void valider()}
      destroyOnHidden
      width={640}
    >
      <ol className="rt-etapes-installation">
        <li>
          <Trans>
            Dans la console Google Cloud de l’association, créez un projet et
            activez l’API Google Drive.
          </Trans>
        </li>
        <li>
          <Trans>
            Créez un compte de service, puis une clé au format JSON pour ce
            compte.
          </Trans>
        </li>
        <li>
          <Trans>Déposez ce fichier ici, ou collez son contenu.</Trans>
        </li>
        <li>
          <Trans>
            Partagez avec l’adresse du compte de service les dossiers que les
            membres liront. Pour l’export des fiches, ajoutez-le comme
            gestionnaire de contenu d’un Drive partagé.
          </Trans>
        </li>
      </ol>
      <Upload
        accept=".json,application/json"
        maxCount={1}
        showUploadList={false}
        beforeUpload={fichier => {
          void fichier.text().then(setCle)
          return false
        }}
      >
        <Button
          icon={<KeyOutlined />}
        >{t`Choisir le fichier de la clé`}</Button>
      </Upload>
      <Input.TextArea
        aria-label={t`Clé JSON du compte de service`}
        style={{ marginTop: 12, fontFamily: 'var(--rt-mono)', fontSize: 12 }}
        rows={6}
        value={cle}
        onChange={e => setCle(e.target.value)}
        // eslint-disable-next-line lingui/no-unlocalized-strings -- Forme d'une clé JSON de compte de service, identique dans toutes les langues.
        placeholder='{ "type": "service_account", … }'
      />
      <p className="rt-texte-secondaire" style={{ marginTop: 8 }}>
        <Trans>
          Relaytour garde cette clé chiffrée et ne l’affiche plus jamais.
        </Trans>
      </p>
    </Modal>
  )
}

/**
 * Connexion à Nextcloud : l'admin saisit l'adresse, accorde l'accès dans un
 * nouvel onglet, puis Relaytour demande à Nextcloud, toutes les trois secondes,
 * si l'accès est accordé.
 */
function ConnexionNextcloud({
  ouvert,
  onFermer,
}: {
  ouvert: boolean
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const client = useApolloClient()
  const [adresse, setAdresse] = useState('')
  const [demande, setDemande] = useState<{
    connexion: string
    etat: string
    debut: number
  } | null>(null)
  const [commencer, { loading }] = useMutation(COMMENCER_NEXTCLOUD)
  const [terminer] = useMutation(TERMINER_NEXTCLOUD)
  // Numéro de la tentative en cours : une fermeture l'invalide, et la réponse
  // tardive d'une tentative invalidée est ignorée.
  const tentative = useRef(0)
  const onglet = useRef<Window | null>(null)
  // Un sondage à la fois : la finalisation côté serveur peut dépasser
  // l'intervalle, et un second sondage trouverait l'état déjà consommé.
  const sondageEnCours = useRef(false)

  const fermer = () => {
    tentative.current += 1
    onglet.current?.close()
    onglet.current = null
    setDemande(null)
    onFermer()
  }

  useEffect(() => {
    if (demande === null || !ouvert) return
    let actif = true
    const minuterie = window.setInterval(() => {
      if (sondageEnCours.current) return
      if (Date.now() - demande.debut > DEMANDE_NEXTCLOUD_MS) {
        setDemande(null)
        message.warning(t`La demande a expiré. Recommencez la connexion.`)
        return
      }
      sondageEnCours.current = true
      terminer({ variables: { etat: demande.etat } })
        .finally(() => {
          sondageEnCours.current = false
        })
        .then(async r => {
          if (!actif || r.data?.terminerConnexionNextcloud !== true) return
          setDemande(null)
          setAdresse('')
          onFermer()
          message.success(t`Nextcloud est connecté.`)
          await client.refetchQueries({
            include: ['EspaceFichiers', 'DossiersLies'],
          })
        })
        .catch((e: unknown) => {
          if (!actif) return
          setDemande(null)
          message.error(messageErreur(e))
        })
    }, SONDAGE_MS)
    return () => {
      actif = false
      window.clearInterval(minuterie)
    }
  }, [demande, ouvert, terminer, client, message, onFermer, t])

  const ouvrir = async () => {
    const numero = ++tentative.current
    // L'onglet s'ouvre pendant le clic : un onglet ouvert après une requête
    // serait bloqué par le navigateur.
    const ouvertIci = window.open('about:blank', '_blank')
    onglet.current = ouvertIci
    try {
      const r = await commencer({ variables: { adresse } })
      if (numero !== tentative.current) return
      const debut = r.data?.commencerConnexionNextcloud
      if (!debut) throw new Error('Nextcloud ne répond pas.')
      if (ouvertIci !== null) {
        ouvertIci.opener = null
        ouvertIci.location.href = debut.connexion
      }
      setDemande({ ...debut, debut: Date.now() })
    } catch (e) {
      if (numero !== tentative.current) return
      ouvertIci?.close()
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouvert}
      onCancel={fermer}
      title={t`Connecter Nextcloud`}
      footer={
        demande === null ? (
          <Button
            type="primary"
            icon={<ExportOutlined />}
            loading={loading}
            disabled={adresse.trim() === ''}
            onClick={() => void ouvrir()}
          >
            {t`Ouvrir Nextcloud`}
          </Button>
        ) : (
          <Button onClick={fermer}>{t`Annuler`}</Button>
        )
      }
      destroyOnHidden
      width={560}
    >
      {demande === null ? (
        <>
          <p>
            <Trans>
              Saisissez l’adresse du Nextcloud de l’association. Un nouvel
              onglet s’ouvre : connectez-vous avec votre compte, puis accordez
              l’accès à Relaytour. Nextcloud crée alors un mot de passe
              d’application, que vous pouvez révoquer dans ses paramètres de
              sécurité.
            </Trans>
          </p>
          <Input
            aria-label={t`Adresse du Nextcloud`}
            placeholder={t`https://cloud.exemple.org`}
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
            onPressEnter={() => {
              if (adresse.trim() !== '') void ouvrir()
            }}
            inputMode="url"
            autoComplete="url"
          />
        </>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Spin size="small" />
          <span>
            <Trans>
              En attente de votre accord dans Nextcloud.{' '}
              <a href={demande.connexion} target="_blank" rel="noreferrer">
                Rouvrir la page de Nextcloud
              </a>
            </Trans>
          </span>
        </div>
      )}
    </Modal>
  )
}

export default function ConnexionEspace({
  espace,
  chargement,
}: {
  espace: Espace | undefined
  chargement: boolean
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const [compteService, setCompteService] = useState(false)
  const [nextcloud, setNextcloud] = useState(false)
  // Stable : la connexion Nextcloud relance son sondage quand elle change.
  const fermerNextcloud = useCallback(() => setNextcloud(false), [])
  const [commencer, { loading: redirection }] = useMutation(COMMENCER_CONNEXION)
  const [deconnecter] = useMutation(DECONNECTER, {
    refetchQueries: ['EspaceFichiers', 'DossiersLies'],
  })

  const connexion = espace?.connexion ?? null
  const possibles = espace?.connexionsPossibles ?? []
  const jourConnexion = connexion ? jourDeLInstant(connexion.connecteeLe) : ''
  const auteurConnexion = connexion?.connecteePar ?? ''
  const nomConnecte = connexion === null ? '' : nom(connexion.fournisseur)

  const connecter = async (fournisseur: FournisseurFichiers) => {
    try {
      // Une reconnexion garde les autorisations accordées (ADR 0044).
      const portee =
        connexion?.fournisseur === fournisseur ? connexion.portee : null
      const r = await commencer({ variables: { fournisseur, portee } })
      const adresse = r.data?.commencerConnexionEspaceFichiers
      if (adresse) window.location.assign(adresse)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const boutons = (principal: boolean) =>
    possibles.map(p => {
      const nomFournisseur = nom(p.fournisseur)
      return p.methode === 'COMPTE' ? (
        <Button
          key={`${p.fournisseur}-compte`}
          type={principal ? 'primary' : 'default'}
          icon={<LinkOutlined />}
          loading={redirection}
          onClick={() =>
            p.fournisseur === 'NEXTCLOUD'
              ? setNextcloud(true)
              : void connecter(p.fournisseur)
          }
        >
          {connexion?.fournisseur === p.fournisseur
            ? t`Reconnecter ${nomFournisseur}`
            : t`Connecter ${nomFournisseur}`}
        </Button>
      ) : (
        <Button
          key={`${p.fournisseur}-service`}
          icon={<KeyOutlined />}
          onClick={() => setCompteService(true)}
        >
          {t`Compte de service Google`}
        </Button>
      )
    })

  return (
    <Panneau titre={t`Connexion`} icone={<CloudOutlined />}>
      {chargement && espace === undefined ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : possibles.length === 0 && connexion === null ? (
        <Alert
          type="info"
          showIcon
          message={t`L’hébergeur de cette installation n’a ouvert aucun fournisseur cloud.`}
        />
      ) : connexion === null ? (
        <>
          <p>
            <Trans>
              Un admin de l’organisation se connecte avec son compte. Relaytour
              lit ensuite les dossiers avec les droits de ce compte, et
              seulement les dossiers que vous liez à une activité. Avec Google
              Drive, un compte de service ne lit que les dossiers que
              l’association partage avec lui.
            </Trans>
          </p>
          <div className="rt-puces">{boutons(true)}</div>
        </>
      ) : (
        <>
          {connexion.etat === 'A_RECONNECTER' && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={t`${nomConnecte} a retiré l’accès. Reconnectez le fournisseur cloud pour que les membres retrouvent leurs documents.`}
            />
          )}
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'fournisseur',
                label: t`Fournisseur`,
                children: nom(connexion.fournisseur),
              },
              {
                key: 'compte',
                label:
                  connexion.methode === 'COMPTE_SERVICE'
                    ? t`Compte de service`
                    : t`Compte`,
                children:
                  connexion.methode === 'COMPTE_SERVICE' ? (
                    <Typography.Text copyable className="rt-mono">
                      {connexion.compte}
                    </Typography.Text>
                  ) : (
                    connexion.compte
                  ),
              },
              {
                key: 'etat',
                label: t`État`,
                children:
                  connexion.etat === 'ACTIVE' ? (
                    <Tag color="success">{t`Connecté`}</Tag>
                  ) : (
                    <Tag color="warning">{t`À reconnecter`}</Tag>
                  ),
              },
              {
                key: 'acces',
                label: t`Vérification des accès`,
                children:
                  connexion.portee === 'FICHIERS'
                    ? t`Non activée`
                    : connexion.portee === 'GESTION'
                      ? t`Activée, avec la gestion des accès`
                      : t`Activée`,
              },
              {
                key: 'date',
                label: t`Connecté le`,
                children: connexion.connecteePar
                  ? t`${jourConnexion} par ${auteurConnexion}`
                  : jourConnexion,
              },
            ]}
          />
          {connexion.methode === 'COMPTE_SERVICE' && (
            <p className="rt-texte-secondaire" style={{ marginTop: 8 }}>
              <Trans>
                Partagez avec cette adresse les dossiers que les membres liront.
                Pour l’export des fiches, ajoutez-la comme gestionnaire de
                contenu d’un Drive partagé.
              </Trans>
            </p>
          )}
          <div className="rt-puces" style={{ marginTop: 16 }}>
            {boutons(false)}
            <Popconfirm
              title={t`Déconnecter le fournisseur cloud ?`}
              description={t`Les dossiers liés restent, mais les membres ne lisent plus leurs documents jusqu’à une nouvelle connexion. L’export des fiches s’arrête.`}
              okText={t`Déconnecter`}
              cancelText={t`Annuler`}
              onConfirm={() =>
                deconnecter().catch((e: unknown) =>
                  message.error(messageErreur(e))
                )
              }
            >
              <Button danger>{t`Déconnecter`}</Button>
            </Popconfirm>
          </div>
        </>
      )}
      <CompteService
        ouvert={compteService}
        onFermer={() => setCompteService(false)}
      />
      <ConnexionNextcloud ouvert={nextcloud} onFermer={fermerNextcloud} />
    </Panneau>
  )
}
