import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

// Conversion d'un document Word en Markdown (ADR 0038), commune à l'import des
// fiches et au texte d'un document (ADR 0072). Le fichier ne dépend que de ses
// bibliothèques : le fil d'extraction le charge sans le reste du serveur.

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
})
turndown.use(gfm)
// Une image d'un document Word ne passe pas dans la fiche.
turndown.remove(['img', 'style', 'script'])

/** Le Markdown d'un document Word, et ce que la conversion a laissé de côté. */
export async function wordVersMarkdown(
  octets: Buffer
): Promise<{ texte: string; pertes: string[] }> {
  const resultat = await mammoth.convertToHtml(
    { buffer: octets },
    {
      convertImage: mammoth.images.imgElement(() =>
        Promise.resolve({ src: '' })
      ),
      ignoreEmptyParagraphs: true,
    }
  )
  const pertes = /<img\b/i.test(resultat.value) ? ['images'] : []
  return { texte: turndown.turndown(resultat.value), pertes }
}
