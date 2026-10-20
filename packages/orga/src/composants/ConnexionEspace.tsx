import { CloudOutlined, KeyOutlined, LinkOutlined } from '@ant-design/icons'
import { useMutation } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Input,
  Modal,
  Popconfirm,
  Skeleton,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { useState } from 'react'

import type { EspaceFichiersQuery, FournisseurFichiers } from '../gql/graphql'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import {
  COMMENCER_CONNEXION,
  CONNECTER_COMPTE_SERVICE,
  DECONNECTER,
  NOMS_FOURNISSEURS,
} from '../lib/espace-fichiers'
import { Panneau } from './Panneau'

// Connexion de l'espace de fichiers (ADR 0038) : par le compte d'un admin
// (SharePoint, Google Drive), ou par un compte de service Google dont
// l'organisation dépose la clé.

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

export default function ConnexionEspace({
  espace,
  chargement,
}: {
  espace: Espace | undefined
  chargement: boolean
}) {
  const { message } = App.useApp()
  const [compteService, setCompteService] = useState(false)
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
          onClick={() => void connecter(p.fournisseur)}
        >
          {principal
            ? `Connecter ${nom(p.fournisseur)}`
            : `Reconnecter ${nom(p.fournisseur)}`}
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
    </Panneau>
  )
}
