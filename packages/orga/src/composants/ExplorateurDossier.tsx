import {
  ArrowLeftOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FolderOutlined,
} from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Alert, Breadcrumb, Button, Empty, Skeleton } from 'antd'
import { useState } from 'react'

import type { ContenuDossierLieQuery, FormatApercu } from '../gql/graphql'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import { CONTENU_DOSSIER, tailleLisible } from '../lib/espace-fichiers'
import Liseuse, { type DocumentOuvert } from './Liseuse'

type Element = ContenuDossierLieQuery['contenuDossierLie'][number]

export interface DossierAffiche {
  id: string
  nom: string
  disponible: boolean
  fournisseur: string
}

const ICONES: Record<FormatApercu, typeof FileOutlined> = {
  PDF: FilePdfOutlined,
  PDF_CONVERTI: FileTextOutlined,
  IMAGE: FileImageOutlined,
  TEXTE: FileTextOutlined,
  MARKDOWN: FileTextOutlined,
  AUCUN: FileOutlined,
}

/**
 * Parcourt un dossier lié de l'espace de fichiers (ADR 0038) : ses sous-dossiers
 * et ses fichiers, qui s'ouvrent dans la liseuse.
 */
export default function ExplorateurDossier({
  dossier,
  onRetour,
}: {
  dossier: DossierAffiche
  onRetour: () => void
}) {
  const [chemin, setChemin] = useState<string[]>([])
  const [ouvert, setOuvert] = useState<DocumentOuvert | null>(null)
  const { data, loading, error } = useQuery(CONTENU_DOSSIER, {
    variables: { id: dossier.id, chemin },
    skip: !dossier.disponible,
    fetchPolicy: 'cache-and-network',
  })

  const ouvrir = (e: Element) => {
    if (e.dossier) {
      setChemin([...chemin, e.nom])
      return
    }
    setOuvert({
      dossierId: dossier.id,
      chemin: [...chemin, e.nom],
      nom: e.nom,
      apercu: e.apercu,
      lienWeb: e.lienWeb ?? null,
      fournisseur: dossier.fournisseur,
    })
  }

  const elements = data?.contenuDossierLie ?? []

  return (
    <div className="rt-verre rt-panneau">
      <div className="rt-explorateur-entete">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onRetour}
          aria-label="Revenir aux dossiers"
        />
        <Breadcrumb
          items={[dossier.nom, ...chemin].map((nom, i) => ({
            key: `${i}-${nom}`,
            title:
              i === chemin.length ? (
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
      </div>

      {!dossier.disponible ? (
        <Alert
          type="warning"
          showIcon
          message="L’espace de fichiers n’est pas connecté. Un admin de l’organisation doit le connecter de nouveau."
        />
      ) : error ? (
        <Alert type="error" showIcon message={messageErreur(error)} />
      ) : loading && !data ? (
        <Skeleton active />
      ) : elements.length === 0 ? (
        <Empty description="Ce dossier est vide." />
      ) : (
        <ul className="rt-explorateur">
          {elements.map(e => {
            const Icone = e.dossier ? FolderOutlined : ICONES[e.apercu]
            return (
              <li key={e.elementId}>
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
              </li>
            )
          })}
        </ul>
      )}

      <Liseuse document={ouvert} onFermer={() => setOuvert(null)} />
    </div>
  )
}
