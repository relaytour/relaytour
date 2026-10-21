import { DeleteOutlined, FolderOutlined, LinkOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Empty, Modal, Popconfirm, Skeleton, Tag } from 'antd'
import { useState } from 'react'

import type { RessourcesFicheQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import {
  DELIER_RESSOURCE,
  DOSSIERS_LIES,
  ICONES_APERCU,
  LIER_RESSOURCE,
  RESSOURCES_FICHE,
} from '../lib/espace-fichiers'
import ExplorateurDossier, { type DossierAffiche } from './ExplorateurDossier'
import Liseuse, { type DocumentOuvert } from './Liseuse'
import { Panneau } from './Panneau'

type Ressource = NonNullable<
  RessourcesFicheQuery['fiche']
>['ressources'][number]

/**
 * Choix d'une ressource à lier : d'abord un dossier lié du périmètre de la fiche
 * ou de toute l'activité, puis un fichier ou un dossier dans ce dossier.
 */
function LierRessource({
  ficheId,
  perimetreId,
  ouvert,
  onFermer,
}: {
  ficheId: string
  perimetreId: string | null
  ouvert: boolean
  onFermer: () => void
}) {
  const { activite } = useActivite()
  const { message } = App.useApp()
  const [dossier, setDossier] = useState<DossierAffiche | null>(null)
  const dossiers = useQuery(DOSSIERS_LIES, {
    variables: { activiteId: activite.id, perimetreId },
    skip: !ouvert,
  })
  const [lier, { loading: enCours }] = useMutation(LIER_RESSOURCE, {
    refetchQueries: ['RessourcesFiche'],
  })

  // Une fiche commune n'admet que les dossiers de toute l'activité.
  const compatibles = (dossiers.data?.dossiersLies ?? []).filter(
    d => d.perimetre === null || d.perimetre?.id === perimetreId
  )

  const fermer = () => {
    setDossier(null)
    onFermer()
  }

  const choisir = async (chemin: string[], nom: string) => {
    if (dossier === null || enCours) return
    try {
      await lier({
        variables: { ficheId, dossierLieId: dossier.id, chemin },
      })
      message.success(`« ${nom} » est lié à la fiche.`)
      fermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouvert}
      onCancel={fermer}
      title="Lier une ressource"
      footer={null}
      width={640}
      destroyOnHidden
    >
      {dossier === null ? (
        dossiers.loading && !dossiers.data ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : compatibles.length === 0 ? (
          <Empty description="Aucun dossier de l’espace de fichiers n’est lié à ce périmètre ni à toute l’activité." />
        ) : (
          <>
            <p className="rt-texte-secondaire">
              Choisissez un dossier lié. Les lecteurs de la fiche lisent ses
              documents.
            </p>
            <ul className="rt-explorateur">
              {compatibles.map(d => (
                <li key={d.id}>
                  <button type="button" onClick={() => setDossier(d)}>
                    <FolderOutlined
                      aria-hidden
                      className="rt-explorateur-icone"
                    />
                    <span className="rt-explorateur-nom">
                      {d.nom}
                      <span className="rt-explorateur-detail">
                        {d.perimetre ? d.perimetre.nom : 'Toute l’activité'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        <>
          <p className="rt-texte-secondaire">
            Choisissez un fichier, ou liez un dossier entier.
          </p>
          <ExplorateurDossier
            dossier={dossier}
            sansCadre
            onRetour={() => setDossier(null)}
            onChoisir={(chemin, nom) => void choisir(chemin, nom)}
          />
        </>
      )}
    </Modal>
  )
}

/**
 * Les ressources de l'espace de fichiers liées à une fiche (ADR 0038), sous son
 * texte. Un fichier s'ouvre dans la liseuse, un dossier dans l'explorateur. Une
 * personne qui rédige la fiche lie et retire les ressources.
 */
export default function RessourcesFiche({
  slug,
  ficheId,
  perimetreId,
  peutModifier,
}: {
  slug: string
  ficheId: string
  perimetreId: string | null
  peutModifier: boolean
}) {
  const { message } = App.useApp()
  const { activite } = useActivite()
  const { data, loading } = useQuery(RESSOURCES_FICHE, {
    variables: { slug },
  })
  // Sans dossier lié utilisable, une personne qui rédige ne voit pas le bloc :
  // l'organisation n'utilise peut-être pas d'espace de fichiers.
  const dossiers = useQuery(DOSSIERS_LIES, {
    variables: { activiteId: activite.id, perimetreId },
    skip: !peutModifier,
  })
  const [delier] = useMutation(DELIER_RESSOURCE, {
    refetchQueries: ['RessourcesFiche'],
  })
  const [choix, setChoix] = useState(false)
  const [document, setDocument] = useState<DocumentOuvert | null>(null)
  const [dossierOuvert, setDossierOuvert] = useState<Ressource | null>(null)

  const ressources = data?.fiche?.ressources ?? []
  const lienPossible = (dossiers.data?.dossiersLies ?? []).some(
    d => d.perimetre === null || d.perimetre?.id === perimetreId
  )
  if (ressources.length === 0 && !(peutModifier && lienPossible)) return null

  const ouvrir = (r: Ressource) => {
    if (r.type === 'DOSSIER') {
      setDossierOuvert(r)
      return
    }
    setDocument({
      dossierId: r.dossierLie.id,
      chemin: r.chemin,
      nom: r.nom,
      apercu: r.apercu,
      lienWeb: r.lienWeb ?? null,
      fournisseur: r.dossierLie.fournisseur,
    })
  }

  return (
    <Panneau
      titre="Ressources liées"
      extra={
        peutModifier && (
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={() => setChoix(true)}
          >
            Lier une ressource
          </Button>
        )
      }
    >
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : ressources.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Aucun document de l’espace de fichiers n’est lié à cette fiche."
        />
      ) : (
        <ul className="rt-explorateur">
          {ressources.map(r => {
            const Icone =
              r.type === 'DOSSIER' ? FolderOutlined : ICONES_APERCU[r.apercu]
            return (
              <li key={r.id} className="rt-explorateur-element">
                <button type="button" onClick={() => ouvrir(r)}>
                  <Icone aria-hidden className="rt-explorateur-icone" />
                  <span className="rt-explorateur-nom">
                    {r.nom}
                    <span className="rt-explorateur-detail">
                      {r.chemin.length === 0
                        ? 'Dossier lié'
                        : [r.dossierLie.nom, ...r.chemin.slice(0, -1)].join(
                            ' / '
                          )}
                    </span>
                  </span>
                  {r.existe === false && <Tag color="warning">Introuvable</Tag>}
                  {!r.dossierLie.disponible && (
                    <Tag color="warning">Indisponible</Tag>
                  )}
                </button>
                {peutModifier && (
                  <Popconfirm
                    title="Retirer cette ressource ?"
                    description="Le document reste dans l’espace de fichiers. La fiche ne le cite plus."
                    okText="Retirer"
                    cancelText="Annuler"
                    onConfirm={() =>
                      delier({ variables: { id: r.id } }).catch((e: unknown) =>
                        message.error(messageErreur(e))
                      )
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      aria-label={`Retirer ${r.nom}`}
                    />
                  </Popconfirm>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Liseuse document={document} onFermer={() => setDocument(null)} />
      <Modal
        open={dossierOuvert !== null}
        onCancel={() => setDossierOuvert(null)}
        title={dossierOuvert?.nom}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {dossierOuvert && (
          <ExplorateurDossier
            dossier={dossierOuvert.dossierLie}
            cheminInitial={dossierOuvert.chemin}
            sansCadre
          />
        )}
      </Modal>
      {peutModifier && (
        <LierRessource
          ficheId={ficheId}
          perimetreId={perimetreId}
          ouvert={choix}
          onFermer={() => setChoix(false)}
        />
      )}
    </Panneau>
  )
}
