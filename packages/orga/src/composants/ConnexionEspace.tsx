import {
  CloudOutlined,
  ExportOutlined,
  KeyOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useApolloClient, useMutation } from '@apollo/client/react'
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
import { useCallback, useEffect, useState } from 'react'

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
  const { message } = App.useApp()
  const [cle, setCle] = useState('')
  const [connecter, { loading }] = useMutation(CONNECTER_COMPTE_SERVICE, {
    refetchQueries: ['EspaceFichiers', 'DossiersLies'],
  })

  const valider = async () => {
    try {
      await connecter({ variables: { cle } })
      message.success('Google Drive est connecté par le compte de service.')
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
      title="Connecter Google Drive par un compte de service"
      okText="Connecter"
      okButtonProps={{ disabled: cle.trim() === '', loading }}
      onOk={() => void valider()}
      destroyOnHidden
      width={640}
    >
      <ol className="rt-etapes-installation">
        <li>
          Dans la console Google Cloud de l’association, créez un projet et
          activez l’API Google Drive.
        </li>
        <li>
          Créez un compte de service, puis une clé au format JSON pour ce
          compte.
        </li>
        <li>Déposez ce fichier ici, ou collez son contenu.</li>
        <li>
          Partagez avec l’adresse du compte de service les dossiers que les
          membres liront. Pour l’export des fiches, ajoutez-le comme
          gestionnaire de contenu d’un Drive partagé.
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
        <Button icon={<KeyOutlined />}>Choisir le fichier de la clé</Button>
      </Upload>
      <Input.TextArea
        aria-label="Clé JSON du compte de service"
        style={{ marginTop: 12, fontFamily: 'var(--rt-mono)', fontSize: 12 }}
        rows={6}
        value={cle}
        onChange={e => setCle(e.target.value)}
        placeholder='{ "type": "service_account", … }'
      />
      <p className="rt-texte-secondaire" style={{ marginTop: 8 }}>
        Relaytour garde cette clé chiffrée et ne l’affiche plus jamais.
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

  const fermer = () => {
    setDemande(null)
    onFermer()
  }

  useEffect(() => {
    if (demande === null) return
    let actif = true
    const minuterie = window.setInterval(() => {
      if (Date.now() - demande.debut > DEMANDE_NEXTCLOUD_MS) {
        setDemande(null)
        message.warning('La demande a expiré. Recommencez la connexion.')
        return
      }
      terminer({ variables: { etat: demande.etat } })
        .then(async r => {
          if (!actif || r.data?.terminerConnexionNextcloud !== true) return
          setDemande(null)
          setAdresse('')
          onFermer()
          message.success('Nextcloud est connecté.')
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
  }, [demande, terminer, client, message, onFermer])

  const ouvrir = async () => {
    // L'onglet s'ouvre pendant le clic : un onglet ouvert après une requête
    // serait bloqué par le navigateur.
    const onglet = window.open('about:blank', '_blank')
    try {
      const r = await commencer({ variables: { adresse } })
      const debut = r.data?.commencerConnexionNextcloud
      if (!debut) throw new Error('Nextcloud ne répond pas.')
      if (onglet !== null) {
        onglet.opener = null
        onglet.location.href = debut.connexion
      }
      setDemande({ ...debut, debut: Date.now() })
    } catch (e) {
      onglet?.close()
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouvert}
      onCancel={fermer}
      title="Connecter Nextcloud"
      footer={
        demande === null ? (
          <Button
            type="primary"
            icon={<ExportOutlined />}
            loading={loading}
            disabled={adresse.trim() === ''}
            onClick={() => void ouvrir()}
          >
            Ouvrir Nextcloud
          </Button>
        ) : (
          <Button onClick={fermer}>Annuler</Button>
        )
      }
      destroyOnHidden
      width={560}
    >
      {demande === null ? (
        <>
          <p>
            Saisissez l’adresse du Nextcloud de l’association. Un nouvel onglet
            s’ouvre : connectez-vous avec votre compte, puis accordez l’accès à
            Relaytour. Nextcloud crée alors un mot de passe d’application, que
            vous pouvez révoquer dans ses paramètres de sécurité.
          </p>
          <Input
            aria-label="Adresse du Nextcloud"
            placeholder="https://cloud.exemple.org"
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
            En attente de votre accord dans Nextcloud.{' '}
            <a href={demande.connexion} target="_blank" rel="noreferrer">
              Rouvrir la page de Nextcloud
            </a>
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

  const connecter = async (fournisseur: FournisseurFichiers) => {
    try {
      const r = await commencer({ variables: { fournisseur } })
      const adresse = r.data?.commencerConnexionEspaceFichiers
      if (adresse) window.location.assign(adresse)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const boutons = (principal: boolean) =>
    possibles.map(p =>
      p.methode === 'COMPTE' ? (
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
            ? `Reconnecter ${nom(p.fournisseur)}`
            : `Connecter ${nom(p.fournisseur)}`}
        </Button>
      ) : (
        <Button
          key={`${p.fournisseur}-service`}
          icon={<KeyOutlined />}
          onClick={() => setCompteService(true)}
        >
          Compte de service Google
        </Button>
      )
    )

  return (
    <Panneau titre="Connexion" icone={<CloudOutlined />}>
      {chargement && espace === undefined ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : possibles.length === 0 && connexion === null ? (
        <Alert
          type="info"
          showIcon
          message="L’hébergeur de cette installation n’a ouvert aucun espace de fichiers."
        />
      ) : connexion === null ? (
        <>
          <p>
            Un admin de l’organisation se connecte avec son compte. Relaytour
            lit ensuite les dossiers avec les droits de ce compte, et seulement
            les dossiers que vous liez à une activité. Avec Google Drive, un
            compte de service ne lit que les dossiers que l’association partage
            avec lui.
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
              message={`${nom(connexion.fournisseur)} a retiré l’accès. Reconnectez l’espace de fichiers pour que les membres retrouvent leurs documents.`}
            />
          )}
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'fournisseur',
                label: 'Fournisseur',
                children: nom(connexion.fournisseur),
              },
              {
                key: 'compte',
                label:
                  connexion.methode === 'COMPTE_SERVICE'
                    ? 'Compte de service'
                    : 'Compte',
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
                label: 'État',
                children:
                  connexion.etat === 'ACTIVE' ? (
                    <Tag color="success">Connecté</Tag>
                  ) : (
                    <Tag color="warning">À reconnecter</Tag>
                  ),
              },
              {
                key: 'date',
                label: 'Connecté le',
                children: `${jourDeLInstant(connexion.connecteeLe)}${connexion.connecteePar ? ` par ${connexion.connecteePar}` : ''}`,
              },
            ]}
          />
          {connexion.methode === 'COMPTE_SERVICE' && (
            <p className="rt-texte-secondaire" style={{ marginTop: 8 }}>
              Partagez avec cette adresse les dossiers que les membres liront.
              Pour l’export des fiches, ajoutez-la comme gestionnaire de contenu
              d’un Drive partagé.
            </p>
          )}
          <div className="rt-puces" style={{ marginTop: 16 }}>
            {boutons(false)}
            <Popconfirm
              title="Déconnecter l’espace de fichiers ?"
              description="Les dossiers liés restent, mais les membres ne lisent plus leurs documents jusqu’à une nouvelle connexion. L’export des fiches s’arrête."
              okText="Déconnecter"
              cancelText="Annuler"
              onConfirm={() =>
                deconnecter().catch((e: unknown) =>
                  message.error(messageErreur(e))
                )
              }
            >
              <Button danger>Déconnecter</Button>
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
