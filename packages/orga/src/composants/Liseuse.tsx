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
  /** Un document lié ouvert aux lecteurs de sa fiche (ADR 0043). */
  ressourceId?: string | null
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

/** Densité de pixels d'un canevas, et nombre de pixels d'une page, au plus. */
const DENSITE_MAX = 2
const PIXELS_MAX = 4_000_000
/** Une page se rend quand elle approche de la zone visible, à cette distance. */
const MARGE_RENDU = '800px 0px'

/** Le texte d'une page, pour les lecteurs d'écran. */
function texteDeLaPage(contenu: {
  items: readonly ({ str: string; hasEOL: boolean } | object)[]
}): string {
  return contenu.items
    .map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
    .join('')
    .trim()
}

/**
 * Prépare la lecture d'un PDF : une case par page, à la proportion de la page,
 * avec son texte pour les lecteurs d'écran. Une page ne se rend dans un canevas
 * que lorsqu'elle approche de la zone visible, et son canevas se libère quand
 * elle s'en éloigne : un long document ne retient pas tous ses pixels. Renvoie
 * le nombre de pages et de quoi tout libérer.
 */
async function ouvrirPdf(
  donnees: ArrayBuffer,
  conteneur: HTMLElement,
  annule: () => boolean
): Promise<{ total: number; fermer: () => void }> {
  const [pdfjs, { default: adresseWorker }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = adresseWorker
  const chargement = pdfjs.getDocument({
    data: new Uint8Array(donnees),
    enableXfa: false,
  })
  const fermerDocument = () => void chargement.destroy()
  const pdf = await chargement.promise
  if (annule()) {
    fermerDocument()
    return { total: 0, fermer: () => undefined }
  }
  const largeur = Math.max(conteneur.clientWidth, 280)
  const densite = Math.min(window.devicePixelRatio || 1, DENSITE_MAX)
  const total = Math.min(pdf.numPages, PAGES_MAX)
  const rendus = new Map<Element, { annuler: () => void }>()

  const rendre = async (cadre: HTMLElement, numero: number) => {
    const page = await pdf.getPage(numero)
    const naturelle = page.getViewport({ scale: 1 })
    let echelle = (largeur / naturelle.width) * densite
    const pixels = naturelle.width * naturelle.height * echelle * echelle
    if (pixels > PIXELS_MAX) echelle *= Math.sqrt(PIXELS_MAX / pixels)
    const vue = page.getViewport({ scale: echelle })
    const canevas = document.createElement('canvas')
    canevas.width = Math.floor(vue.width)
    canevas.height = Math.floor(vue.height)
    canevas.setAttribute('aria-hidden', 'true')
    const tache = page.render({ canvas: canevas, viewport: vue })
    rendus.set(cadre, { annuler: () => tache.cancel() })
    try {
      await tache.promise
      if (rendus.has(cadre)) cadre.replaceChildren(canevas)
    } catch {
      // Rendu annulé : la page s'est éloignée avant la fin.
    }
  }

  const observateur = new IntersectionObserver(
    entrees => {
      for (const entree of entrees) {
        const cadre = entree.target as HTMLElement
        if (entree.isIntersecting && !rendus.has(cadre)) {
          void rendre(cadre, Number(cadre.dataset.page))
        } else if (!entree.isIntersecting && rendus.has(cadre)) {
          rendus.get(cadre)?.annuler()
          rendus.delete(cadre)
          cadre.replaceChildren()
        }
      }
    },
    { root: conteneur.parentElement, rootMargin: MARGE_RENDU }
  )

  for (let numero = 1; numero <= total; numero++) {
    if (annule()) break
    const page = await pdf.getPage(numero)
    const naturelle = page.getViewport({ scale: 1 })
    const section = document.createElement('section')
    section.className = 'rt-liseuse-page'
    section.setAttribute('aria-label', `Page ${numero}`)
    const cadre = document.createElement('div')
    cadre.className = 'rt-liseuse-cadre'
    cadre.dataset.page = String(numero)
    cadre.style.aspectRatio = `${naturelle.width} / ${naturelle.height}`
    const texte = document.createElement('div')
    texte.className = 'rt-sr'
    texte.textContent = texteDeLaPage(await page.getTextContent())
    section.append(cadre, texte)
    conteneur.append(section)
    observateur.observe(cadre)
  }

  return {
    total: pdf.numPages,
    fermer: () => {
      observateur.disconnect()
      for (const rendu of rendus.values()) rendu.annuler()
      rendus.clear()
      fermerDocument()
    },
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
    let fermerPdf: (() => void) | null = null
    void (async () => {
      try {
        const blob = await lireFichier(
          doc.dossierId,
          doc.chemin,
          false,
          controleur.signal,
          doc.ressourceId ?? null
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
          const pdf = await ouvrirPdf(
            await blob.arrayBuffer(),
            conteneur,
            () => controleur.signal.aborted
          )
          fermerPdf = pdf.fermer
          if (controleur.signal.aborted) pdf.fermer()
          else setPagesTotales(pdf.total)
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
      fermerPdf?.()
      conteneur?.replaceChildren()
    }
  }, [doc, affiche])

  return (
    <>
      {erreur && <Alert type="error" showIcon message={erreur} />}
      {!affiche && (
        <Empty description="La liseuse n’affiche pas ce format. Téléchargez le document, ou ouvrez-le chez le fournisseur cloud." />
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
    telechargerFichier(
      doc.dossierId,
      doc.chemin,
      doc.ressourceId ?? null
    ).catch((e: unknown) => message.error(messageErreur(e)))
  }

  const nomFournisseur =
    doc === null
      ? ''
      : (NOMS_FOURNISSEURS[doc.fournisseur] ?? 'le fournisseur cloud')

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
