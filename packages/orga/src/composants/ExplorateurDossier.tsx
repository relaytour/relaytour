import {
  ArrowLeftOutlined,
  FolderOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, Breadcrumb, Button, Empty, Skeleton } from 'antd'
import { useState } from 'react'

import type { ContenuDossierLieQuery } from '../gql/graphql'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import {
  CONTENU_DOSSIER,
  ICONES_APERCU,
  tailleLisible,
} from '../lib/espace-fichiers'
import Liseuse, { type DocumentOuvert } from './Liseuse'

type Element = ContenuDossierLieQuery['contenuDossierLie']['elements'][number]

export interface DossierAffiche {
  id: string
  nom: string
  disponible: boolean
  fournisseur: string
}

/**
 * Parcourt un dossier lié de l'espace de fichiers (ADR 0038) : ses sous-dossiers
 * et ses fichiers, qui s'ouvrent dans la liseuse. Avec `onChoisir`, l'explorateur
 * sert à choisir une ressource à lier : chaque élément et le dossier affiché
 * portent un bouton « Lier ».
 */
export default function ExplorateurDossier({
  dossier,
  onRetour,
  cheminInitial = [],
  ressourceId = null,
  onChoisir,
  sansCadre = false,
}: {
  dossier: DossierAffiche
  onRetour?: () => void
  cheminInitial?: string[]
  /**
   * Un document lié ouvert aux lecteurs de sa fiche (ADR 0043) : l'explorateur
   * part de son chemin et ne remonte pas au-dessus.
   */
  ressourceId?: string | null
  onChoisir?: (chemin: string[], nom: string) => void
  /** Sans le panneau de verre, dans une fenêtre par exemple. */
  sansCadre?: boolean
}) {
  const { t } = useLingui()
  const [chemin, setChemin] = useState<string[]>(cheminInitial)
  const [ouvert, setOuvert] = useState<DocumentOuvert | null>(null)
  const { data, loading, error } = useQuery(CONTENU_DOSSIER, {
    variables: { id: dossier.id, chemin, ressource: ressourceId },
    skip: !dossier.disponible,
    fetchPolicy: 'cache-and-network',
  })

  const ouvrir = (e: Element) => {
    if (e.dossier) {
      setChemin([...chemin, e.nom])
      return
    }
    if (onChoisir) {
      onChoisir([...chemin, e.nom], e.nom)
      return
    }
    setOuvert({
      dossierId: dossier.id,
      ressourceId,
      chemin: [...chemin, e.nom],
      nom: e.nom,
      apercu: e.apercu,
      lienWeb: e.lienWeb ?? null,
      fournisseur: dossier.fournisseur,
    })
  }

  const elements = data?.contenuDossierLie.elements ?? []
  const incomplet = data?.contenuDossierLie.complet === false
  const nomCourant = chemin[chemin.length - 1] ?? dossier.nom

  return (
    <div className={sansCadre ? undefined : 'rt-verre rt-panneau'}>
      <div className="rt-explorateur-entete">
        {onRetour && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onRetour}
            aria-label={t`Revenir aux dossiers`}
          />
        )}
        <Breadcrumb
          items={[dossier.nom, ...chemin].map((nom, i) => ({
            key: `${i}-${nom}`,
            // Un document ouvert ne se parcourt pas au-dessus de son chemin.
            title:
              i === chemin.length ||
              (ressourceId !== null && i < cheminInitial.length) ? (
                nom
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
        {onChoisir && dossier.disponible && (
          <Button
            size="small"
            icon={<LinkOutlined />}
            style={{ marginInlineStart: 'auto' }}
            onClick={() => onChoisir(chemin, nomCourant)}
          >
            <Trans>Lier ce dossier</Trans>
          </Button>
        )}
      </div>

      {!dossier.disponible ? (
        <Alert
          type="warning"
          showIcon
          message={t`Le fournisseur cloud n’est pas connecté. Un admin de l’organisation doit le connecter de nouveau.`}
        />
      ) : error ? (
        <Alert type="error" showIcon message={messageErreur(error)} />
      ) : loading && !data ? (
        <Skeleton active />
      ) : elements.length === 0 ? (
        <Empty description={t`Ce dossier est vide.`} />
      ) : (
        <ul className="rt-explorateur">
          {elements.map(e => {
            const Icone = e.dossier ? FolderOutlined : ICONES_APERCU[e.apercu]
            const nomElement = e.nom
            return (
              <li key={e.elementId} className="rt-explorateur-element">
                <button type="button" onClick={() => ouvrir(e)}>
                  <Icone aria-hidden className="rt-explorateur-icone" />
                  <span className="rt-explorateur-nom">{e.nom}</span>
                  <span className="rt-date">
                    {[
                      e.dossier ? null : tailleLisible(e.taille),
                      e.modifieLe ? jourDeLInstant(e.modifieLe) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                {onChoisir && e.dossier && (
                  <Button
                    size="small"
                    type="text"
                    icon={<LinkOutlined />}
                    aria-label={t`Lier le dossier ${nomElement}`}
                    onClick={() => onChoisir([...chemin, e.nom], e.nom)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {incomplet && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message={t`Ce dossier compte trop d’éléments pour les afficher tous ici. Ouvrez-le chez le fournisseur cloud pour voir la suite.`}
        />
      )}

      <Liseuse document={ouvert} onFermer={() => setOuvert(null)} />
    </div>
  )
}
