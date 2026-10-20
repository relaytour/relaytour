import { DownloadOutlined, ExportOutlined } from '@ant-design/icons'
import { Alert, App, Button, Empty, Modal, Spin } from 'antd'
import { useEffect, useRef, useState } from 'react'

import type { FormatApercu } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'
import {
  FORMATS_AFFICHES,
  lireFichier,
  NOMS_FOURNISSEURS,
  telechargerFichier,
} from '../lib/espace-fichiers'
import Markdown from './Markdown'

// Liseuse d'un document de l'espace de fichiers (ADR 0038). Elle affiche un PDF,
// une image, un texte ou du Markdown ; un document bureautique arrive déjà
// converti en PDF par le fournisseur. Le reste se télécharge. Le document n'est
// gardé que le temps de la lecture.

export interface DocumentOuvert {
  dossierId: string
  chemin: string[]
  nom: string
  apercu: FormatApercu
  lienWeb: string | null
  fournisseur: string
}

/** Au-delà, la liseuse n'affiche que les premières pages. */
const PAGES_MAX = 40
/** Au-delà, un texte s'affiche tronqué. */
const TEXTE_MAX = 500_000

/** Rend chaque page d'un PDF dans un canevas, à la largeur du conteneur. */
async function rendrePdf(
  donnees: ArrayBuffer,
  conteneur: HTMLElement,
  annule: () => boolean
): Promise<number> {
  const [pdfjs, { default: adresseWorker }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = adresseWorker
  const chargement = pdfjs.getDocument({
    data: new Uint8Array(donnees),
    enableXfa: false,
  })
  const pdf = await chargement.promise
  try {
    const largeur = Math.max(conteneur.clientWidth, 280)
    const densite = window.devicePixelRatio || 1
    const total = Math.min(pdf.numPages, PAGES_MAX)
    for (let numero = 1; numero <= total; numero++) {
      if (annule()) break
      const page = await pdf.getPage(numero)
      const echelle = largeur / page.getViewport({ scale: 1 }).width
      const vue = page.getViewport({ scale: echelle * densite })
      const canevas = document.createElement('canvas')
      canevas.width = Math.floor(vue.width)
      canevas.height = Math.floor(vue.height)
      canevas.className = 'rt-liseuse-page'
      canevas.setAttribute('role', 'img')
      canevas.setAttribute('aria-label', `Page ${numero}`)
      conteneur.append(canevas)
      await page.render({ canvas: canevas, viewport: vue }).promise
    }
    return pdf.numPages
  } finally {
    void chargement.destroy()
  }
}

/** Le contenu de la liseuse, monté à l'ouverture : il lit le document une fois. */
function ContenuLiseuse({ doc }: { doc: DocumentOuvert }) {
  const affiche = FORMATS_AFFICHES.includes(doc.apercu)
  const estPdf = doc.apercu === 'PDF' || doc.apercu === 'PDF_CONVERTI'
  const [chargement, setChargement] = useState(affiche)
  const [erreur, setErreur] = useState<string | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [texte, setTexte] = useState<string | null>(null)
  const [pagesTotales, setPagesTotales] = useState(0)
  const pages = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!affiche) return
    const controleur = new AbortController()
    const conteneur = pages.current
    let adresseImage: string | null = null
    void (async () => {
      try {
        const blob = await lireFichier(
          doc.dossierId,
          doc.chemin,
          false,
          controleur.signal
        )
        if (doc.apercu === 'IMAGE') {
          adresseImage = URL.createObjectURL(blob)
          setImage(adresseImage)
        } else if (doc.apercu === 'TEXTE' || doc.apercu === 'MARKDOWN') {
          const contenu = await blob.text()
          setTexte(
            contenu.length > TEXTE_MAX
              ? `${contenu.slice(0, TEXTE_MAX)}\n\n…`
              : contenu
          )
        } else if (conteneur !== null) {
          setPagesTotales(
            await rendrePdf(
              await blob.arrayBuffer(),
              conteneur,
              () => controleur.signal.aborted
            )
          )
        }
      } catch (e) {
        if (!controleur.signal.aborted) setErreur(messageErreur(e))
      } finally {
        if (!controleur.signal.aborted) setChargement(false)
      }
    })()
    return () => {
      controleur.abort()
      if (adresseImage !== null) URL.revokeObjectURL(adresseImage)
      conteneur?.replaceChildren()
    }
  }, [doc, affiche])

  return (
    <>
      {erreur && <Alert type="error" showIcon message={erreur} />}
      {!affiche && (
        <Empty description="La liseuse n’affiche pas ce format. Téléchargez le document, ou ouvrez-le dans l’espace de fichiers." />
      )}
      {chargement && (
        <div className="rt-liseuse-chargement">
          <Spin />
        </div>
      )}
      <div className="rt-liseuse">
        {image && <img src={image} alt={doc.nom} />}
        {texte !== null &&
          (doc.apercu === 'MARKDOWN' ? (
            <Markdown contenu={texte} />
          ) : (
            <pre className="rt-liseuse-texte">{texte}</pre>
          ))}
        {estPdf && <div ref={pages} className="rt-liseuse-pages" />}
        {pagesTotales > PAGES_MAX && (
          <p className="rt-liseuse-note">
            La liseuse affiche les {PAGES_MAX} premières pages sur{' '}
            {pagesTotales}. Téléchargez le document pour lire la suite.
          </p>
        )}
      </div>
    </>
  )
}

export default function Liseuse({
  document: doc,
  onFermer,
}: {
  document: DocumentOuvert | null
  onFermer: () => void
}) {
  const { message } = App.useApp()

  const telecharger = () => {
    if (doc === null) return
    telechargerFichier(doc.dossierId, doc.chemin).catch((e: unknown) =>
      message.error(messageErreur(e))
    )
  }

  const nomFournisseur =
    doc === null
      ? ''
      : (NOMS_FOURNISSEURS[doc.fournisseur] ?? 'l’espace de fichiers')

  return (
    <Modal
      open={doc !== null}
      onCancel={onFermer}
      title={doc?.nom}
      width={960}
      centered
      destroyOnHidden
      footer={
        <div className="rt-liseuse-actions">
          {doc?.lienWeb && (
            <Button
              icon={<ExportOutlined />}
              href={doc.lienWeb}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir dans {nomFournisseur}
            </Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={telecharger}>
            Télécharger
          </Button>
          <Button type="primary" onClick={onFermer}>
            Fermer
          </Button>
        </div>
      }
    >
      {doc?.lienWeb && (
        <p className="rt-liseuse-note">
          Le lien « Ouvrir dans {nomFournisseur} » fonctionne si votre compte{' '}
          {nomFournisseur} a accès à ce document.
        </p>
      )}
      {doc?.apercu === 'PDF_CONVERTI' && (
        <p className="rt-liseuse-note">
          {nomFournisseur} a converti ce document en PDF pour l’affichage. Sa
          mise en page peut différer de l’original.
        </p>
      )}
      {doc !== null && (
        <ContenuLiseuse
          key={`${doc.dossierId}/${doc.chemin.join('/')}`}
          doc={doc}
        />
      )}
    </Modal>
  )
}
