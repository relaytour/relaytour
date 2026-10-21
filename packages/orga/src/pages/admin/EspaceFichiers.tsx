import {
  CloudUploadOutlined,
  DeleteOutlined,
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
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import ConnexionEspace from '../../composants/ConnexionEspace'
import EtiquettePerimetre from '../../composants/EtiquettePerimetre'
import ImportFiches from '../../composants/ImportFiches'
import { Panneau } from '../../composants/Panneau'
import ParcoursEspace, {
  type PositionChoisie,
} from '../../composants/ParcoursEspace'
import Titre from '../../composants/Titre'
import type { EspaceFichiersQuery } from '../../gql/graphql'
import { useActivite } from '../../lib/activite'
import { jourDeLInstant, messageErreur } from '../../lib/erreurs'
import {
  CHOISIR_DOSSIER_EXPORT,
  DELIER_DOSSIER,
  DOSSIERS_LIES,
  ESPACE_FICHIERS,
  EXPORTER_FICHES_MAINTENANT,
  LIER_DOSSIER,
  PERIMETRES_A_LIER,
  RETIRER_DOSSIER_EXPORT,
} from '../../lib/espace-fichiers'

// Espace de fichiers de l'organisation (ADR 0038) : un admin de l'organisation
// le connecte, lie ses dossiers aux périmètres de l'activité affichée, et choisit
// le dossier où Relaytour exporte les fiches.

type Connexion = NonNullable<EspaceFichiersQuery['espaceFichiers']['connexion']>

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
const AUCUNE: PositionChoisie = { emplacement: null, chemin: [] }

/** « 1 fiche écrite », « 3 fiches écrites ». */
const accorder = (n: number, singulier: string, pluriel: string) =>
  `${n} ${n > 1 ? pluriel : singulier}`

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
  const [position, setPosition] = useState<PositionChoisie>(AUCUNE)
  const perimetres = useQuery(PERIMETRES_A_LIER, {
    variables: { activiteId: activite.id },
    skip: !ouvert,
  })
  const [lier, { loading: enCours }] = useMutation(LIER_DOSSIER, {
    refetchQueries: ['DossiersLies'],
  })

  const valider = async () => {
    if (position.emplacement === null || position.chemin.length === 0) return
    try {
      await lier({
        variables: {
          activiteId: activite.id,
          perimetreId: perimetre === TOUTE_L_ACTIVITE ? null : perimetre,
          emplacement: position.emplacement,
          chemin: position.chemin,
        },
      })
      message.success('Le dossier est lié.')
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
      title="Lier un dossier"
      okText="Lier ce dossier"
      okButtonProps={{
        disabled: position.emplacement === null || position.chemin.length === 0,
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
        Relaytour écrit les fiches en Markdown dans un dossier de l’espace de
        fichiers, après chaque modification et chaque nuit. Les fiches se
        modifient toujours dans Relaytour : une modification faite dans ce
        dossier est remplacée à l’export suivant.
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
              message="Ces fiches avaient été modifiées dans l’espace de fichiers. Relaytour les a réécrites."
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
              description="Les fichiers déjà écrits restent dans l’espace de fichiers."
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
  const [choix, setChoix] = useState(false)
  const { data, loading } = useQuery(ESPACE_FICHIERS)
  const liens = useQuery(DOSSIERS_LIES, {
    variables: { activiteId: activite.id },
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
  return (
    <>
      <Titre sousTitre="Les membres lisent les documents de l’association depuis Relaytour, sans compte chez le fournisseur. Relaytour ne copie aucun document.">
        Espace de fichiers
      </Titre>

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
