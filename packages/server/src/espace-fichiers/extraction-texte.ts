import { parentPort, workerData } from 'node:worker_threads'

import { wordVersMarkdown } from './word.ts'

// Fil d'extraction du texte d'un document (ADR 0072). Le serveur le lance pour
// chaque lecture, avec une mémoire bornée, et l'arrête au-delà de 20 secondes. Le
// fil ne charge que ses bibliothèques : ni la base, ni l'environnement, ni le
// journal. Il rend le texte brut, que le serveur normalise et borne ensuite.

/** Ce que le serveur transmet au fil. */
export interface DemandeExtraction {
  format: 'TEXTE' | 'MARKDOWN' | 'WORD' | 'PDF'
  octets: Uint8Array
  /** Les pages lues d'un PDF, au plus. */
  pagesMax: number
}

/** Ce que le fil rend au serveur. */
export type ReponseExtraction =
  { issue: 'ok'; texte: string; pagesTronquees: boolean } | { issue: 'echec' }

/**
 * Le texte des pages d'un PDF, par `getTextContent` seulement : ni rendu, ni
 * police, ni script. Le module de travail de pdf.js se charge dans ce fil : la
 * bibliothèque n'en lance aucun autre.
 */
async function pdfVersTexte(
  octets: Uint8Array,
  pagesMax: number
): Promise<{ texte: string; pagesTronquees: boolean }> {
  const travail = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  ;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = travail
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const tache = getDocument({
    data: octets,
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
    useWorkerFetch: false,
    // Aucune image ne se décode : ni WebAssembly, ni canevas.
    useWasm: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    stopAtErrors: false,
    verbosity: 0,
  })
  try {
    const document = await tache.promise
    const lues = Math.min(document.numPages, pagesMax)
    const pages: string[] = []
    for (let numero = 1; numero <= lues; numero++) {
      const page = await document.getPage(numero)
      const contenu = await page.getTextContent()
      pages.push(
        contenu.items
          .map(element =>
            'str' in element
              ? `${element.str}${element.hasEOL ? '\n' : ''}`
              : ''
          )
          .join('')
      )
      page.cleanup()
    }
    return {
      texte: pages.join('\n\n'),
      pagesTronquees: document.numPages > pagesMax,
    }
  } finally {
    await tache.destroy()
  }
}

async function extraire(
  demande: DemandeExtraction
): Promise<{ texte: string; pagesTronquees: boolean }> {
  switch (demande.format) {
    case 'TEXTE':
    case 'MARKDOWN':
      // Le décodeur retire la marque d'ordre des octets et remplace une suite
      // invalide, sans lever.
      return {
        texte: new TextDecoder('utf-8').decode(demande.octets),
        pagesTronquees: false,
      }
    case 'WORD':
      return {
        texte: (await wordVersMarkdown(Buffer.from(demande.octets))).texte,
        pagesTronquees: false,
      }
    case 'PDF':
      return pdfVersTexte(demande.octets, demande.pagesMax)
  }
}

if (parentPort !== null) {
  const port = parentPort
  extraire(workerData as DemandeExtraction).then(
    ({ texte, pagesTronquees }) => {
      port.postMessage({
        issue: 'ok',
        texte,
        pagesTronquees,
      } satisfies ReponseExtraction)
    },
    () => {
      // La cause reste dans le fil : elle pourrait citer le contenu du document.
      port.postMessage({ issue: 'echec' } satisfies ReponseExtraction)
    }
  )
}
