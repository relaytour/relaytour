import {
  CloudOutlined,
  DeleteOutlined,
  FolderOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Descriptions,
  Empty,
  Form,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import EtiquettePerimetre from '../../composants/EtiquettePerimetre'
import { Panneau } from '../../composants/Panneau'
import Titre from '../../composants/Titre'
import { useActivite } from '../../lib/activite'
import { jourDeLInstant, messageErreur } from '../../lib/erreurs'
import {
  COMMENCER_CONNEXION,
  DECONNECTER,
  DELIER_DOSSIER,
  DOSSIERS_LIES,
  EMPLACEMENTS,
  ESPACE_FICHIERS,
  LIER_DOSSIER,
  NOMS_FOURNISSEURS,
  PARCOURIR,
  PERIMETRES_A_LIER,
} from '../../lib/espace-fichiers'

// Espace de fichiers de l'organisation (ADR 0038) : un admin de l'organisation
// le connecte, puis lie ses dossiers aux périmètres de l'activité affichée.

const ISSUES: Record<
  string,
  { type: 'success' | 'warning' | 'error'; texte: string }
> = {
  reussie: { type: 'success', texte: 'L’espace de fichiers est connecté.' },
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

const TOUTE_L_ACTIVITE = ''

/** Choix d'un dossier de l'espace connecté et du périmètre qui le lira. */
function LierDossier({
  ouvert,
  onFermer,
}: {
  ouvert: boolean
  onFermer: () => void
}) {
  const { activite } = useActivite()
  const { message } = App.useApp()
  const [perimetre, setPerimetre] = useState<string>(TOUTE_L_ACTIVITE)
  const [emplacement, setEmplacement] = useState<string | null>(null)
  const [chemin, setChemin] = useState<string[]>([])
  const emplacements = useQuery(EMPLACEMENTS, { skip: !ouvert })
  const perimetres = useQuery(PERIMETRES_A_LIER, {
    variables: { activiteId: activite.id },
    skip: !ouvert,
  })
  const dossiers = useQuery(PARCOURIR, {
    variables: { emplacement: emplacement ?? '', chemin },
    skip: !ouvert || emplacement === null,
  })
  const [lier, { loading: enCours }] = useMutation(LIER_DOSSIER, {
    refetchQueries: ['DossiersLies'],
  })

  const choisirEmplacement = (id: string) => {
    setEmplacement(id)
    setChemin([])
  }

  const valider = async () => {
    if (emplacement === null || chemin.length === 0) return
    try {
      await lier({
        variables: {
          activiteId: activite.id,
          perimetreId: perimetre === TOUTE_L_ACTIVITE ? null : perimetre,
          emplacement,
          chemin,
        },
      })
      message.success('Le dossier est lié.')
      setChemin([])
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const nomEmplacement =
    emplacements.data?.emplacementsFichiers.find(e => e.id === emplacement)
      ?.nom ?? ''

  return (
    <Modal
      open={ouvert}
      onCancel={onFermer}
      title="Lier un dossier"
      okText="Lier ce dossier"
      okButtonProps={{
        disabled: emplacement === null || chemin.length === 0,
        loading: enCours,
      }}
      onOk={() => void valider()}
      destroyOnHidden
      width={640}
    >
      <Form layout="vertical" component="div">
        <Form.Item
          label="Lu par"
          extra="Un dossier lié à un périmètre se lit comme ses fiches : par les personnes qui y ont été affectées et par les admins de l’activité. Un dossier lié à toute l’activité se lit comme les fiches communes."
        >
          <Select
            value={perimetre}
            onChange={setPerimetre}
            loading={perimetres.loading}
            options={[
              { value: TOUTE_L_ACTIVITE, label: 'Toute l’activité' },
              ...(perimetres.data?.perimetres ?? []).map(p => ({
                value: p.id,
                label: p.nom,
              })),
            ]}
          />
        </Form.Item>
        <Form.Item label="Bibliothèque de documents">
          <Select
            value={emplacement}
            onChange={choisirEmplacement}
            loading={emplacements.loading}
            placeholder="Choisissez une bibliothèque"
            showSearch
            optionFilterProp="label"
            options={(emplacements.data?.emplacementsFichiers ?? []).map(e => ({
              value: e.id,
              label: e.site === null ? e.nom : `${e.site} · ${e.nom}`,
            }))}
          />
        </Form.Item>
        {emplacements.error && (
          <Alert
            type="error"
            showIcon
            message={messageErreur(emplacements.error)}
          />
        )}
        {emplacement !== null && (
          <div className="rt-verre rt-panneau">
            <Breadcrumb
              items={[nomEmplacement, ...chemin].map((nom, i) => ({
                key: `${i}-${nom}`,
                title:
                  i === chemin.length ? (
                    <strong>{nom}</strong>
                  ) : (
                    <a
                      href="#"
                      onClick={evenement => {
                        evenement.preventDefault()
                        setChemin(chemin.slice(0, i))
                      }}
                    >
                      {nom}
                    </a>
                  ),
              }))}
            />
            {dossiers.error ? (
              <Alert
                type="error"
                showIcon
                message={messageErreur(dossiers.error)}
              />
            ) : dossiers.loading && !dossiers.data ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (dossiers.data?.parcourirEspaceFichiers.elements ?? [])
                .length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Aucun sous-dossier."
              />
            ) : (
              <ul className="rt-explorateur">
                {dossiers.data?.parcourirEspaceFichiers.elements.map(d => (
                  <li key={d.elementId}>
                    <button
                      type="button"
                      onClick={() => setChemin([...chemin, d.nom])}
                    >
                      <FolderOutlined
                        aria-hidden
                        className="rt-explorateur-icone"
                      />
                      <span className="rt-explorateur-nom">{d.nom}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {dossiers.data?.parcourirEspaceFichiers.complet === false && (
              <Alert
                type="info"
                showIcon
                message="Ce dossier compte trop de sous-dossiers pour les afficher tous. Rangez le dossier à lier plus haut dans la bibliothèque."
              />
            )}
            <p className="rt-texte-secondaire" style={{ marginBottom: 0 }}>
              {chemin.length === 0
                ? 'Ouvrez le dossier à lier. Une bibliothèque entière ne se lie pas.'
                : `Le dossier « ${chemin[chemin.length - 1]} » sera lié.`}
            </p>
          </div>
        )}
      </Form>
    </Modal>
  )
}

export default function EspaceFichiers() {
  const { activite } = useActivite()
  const { message } = App.useApp()
  const [parametres, setParametres] = useSearchParams()
  const [choix, setChoix] = useState(false)
  const { data, loading } = useQuery(ESPACE_FICHIERS)
  const liens = useQuery(DOSSIERS_LIES, {
    variables: { activiteId: activite.id },
  })
  const [commencer, { loading: redirection }] = useMutation(COMMENCER_CONNEXION)
  const [deconnecter] = useMutation(DECONNECTER, {
    refetchQueries: ['EspaceFichiers', 'DossiersLies'],
  })
  const [delier] = useMutation(DELIER_DOSSIER, {
    refetchQueries: ['DossiersLies'],
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
  const fournisseur = espace?.fournisseursDisponibles[0] ?? null
  const nom = (f: string) => NOMS_FOURNISSEURS[f] ?? f

  const connecter = async () => {
    if (fournisseur === null) return
    try {
      const r = await commencer({ variables: { fournisseur } })
      const adresse = r.data?.commencerConnexionEspaceFichiers
      if (adresse) window.location.assign(adresse)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre sousTitre="Les membres lisent les documents de l’association depuis Relaytour, sans compte chez le fournisseur. Relaytour ne copie aucun document.">
        Espace de fichiers
      </Titre>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Panneau titre="Connexion" icone={<CloudOutlined />}>
          {loading && !data ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : fournisseur === null && connexion === null ? (
            <Alert
              type="info"
              showIcon
              message="L’hébergeur de cette installation n’a ouvert aucun espace de fichiers."
            />
          ) : connexion === null ? (
            <>
              <p>
                Un admin de l’organisation se connecte avec son compte{' '}
                {nom(fournisseur!)}. Relaytour lit ensuite les dossiers avec les
                droits de ce compte, et seulement les dossiers que vous liez à
                une activité.
              </p>
              <Button
                type="primary"
                icon={<LinkOutlined />}
                loading={redirection}
                onClick={() => void connecter()}
              >
                Connecter {nom(fournisseur!)}
              </Button>
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
                    label: 'Compte',
                    children: connexion.compte,
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
              <div className="rt-puces" style={{ marginTop: 16 }}>
                {fournisseur !== null && (
                  <Button
                    loading={redirection}
                    onClick={() => void connecter()}
                  >
                    Reconnecter
                  </Button>
                )}
                <Popconfirm
                  title="Déconnecter l’espace de fichiers ?"
                  description="Les dossiers liés restent, mais les membres ne lisent plus leurs documents jusqu’à une nouvelle connexion."
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
        </Panneau>

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
                  <FolderOutlined
                    aria-hidden
                    className="rt-explorateur-icone"
                  />
                  <span className="rt-explorateur-nom">{d.nom}</span>
                  <span>
                    {d.perimetre ? (
                      <EtiquettePerimetre
                        nom={d.perimetre.nom}
                        couleur={d.perimetre.couleur}
                        point
                      />
                    ) : (
                      'Toute l’activité'
                    )}
                  </span>
                  {!d.disponible && <Tag color="warning">Indisponible</Tag>}
                  <Popconfirm
                    title="Retirer ce dossier ?"
                    description="Le dossier reste dans l’espace de fichiers. Les membres ne le lisent plus dans Relaytour."
                    okText="Retirer"
                    cancelText="Annuler"
                    onConfirm={() =>
                      delier({ variables: { id: d.id } }).catch((e: unknown) =>
                        message.error(messageErreur(e))
                      )
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

      <LierDossier ouvert={choix} onFermer={() => setChoix(false)} />
    </>
  )
}
