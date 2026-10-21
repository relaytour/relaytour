import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { parse } from 'yaml'

import { normaliserContenu } from '../lib/contenu.ts'
import { TITRE_MAX } from '../lib/saisie.ts'

// Conversion des fichiers de l'espace de fichiers en fiches (ADR 0038). Un
// fichier Markdown ou texte s'importe tel quel ; un document Word se convertit
// en Markdown. La conversion perd une partie de la mise en forme : les images,
// les couleurs, les colonnes. L'export écrit ensuite toujours du Markdown.

export type FormatImport = 'MARKDOWN' | 'TEXTE' | 'WORD'

/** Le format d'import d'un fichier d'après son nom, ou null s'il ne s'importe pas. */
export function formatImport(nom: string): FormatImport | null {
  const extension = nom.slice(nom.lastIndexOf('.') + 1).toLowerCase()
  if (nom.lastIndexOf('.') <= 0) return null
  if (extension === 'md' || extension === 'markdown') return 'MARKDOWN'
  if (extension === 'txt') return 'TEXTE'
  if (extension === 'docx') return 'WORD'
  return null
}

/** « Réserver la piscine.docx » → « reserver-la-piscine ». */
export function slugDepuisNom(nom: string): string {
  return nom
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

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

export interface FicheLue {
  slug: string
  titre: string
  contenu: string
}

/**
 * Une fiche à partir du texte d'un fichier. L'en-tête YAML (`slug`, `titre`) est
 * facultatif. Sans lui, le titre vient du premier titre de niveau 1, qui quitte
 * alors le contenu, sinon du nom du fichier ; le slug vient du nom du fichier.
 */
export function lireFiche(nomFichier: string, texte: string): FicheLue {
  let corps = texte.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  let entete: { slug?: unknown; titre?: unknown } = {}
  const bloc = /^---\n([\s\S]*?)\n---\n?/.exec(corps)
  if (bloc !== null) {
    try {
      const lu: unknown = parse(bloc[1]!)
      if (lu !== null && typeof lu === 'object') entete = lu
    } catch {
      // Un en-tête illisible reste dans le contenu.
    }
    if (Object.keys(entete).length > 0) corps = corps.slice(bloc[0].length)
  }
  let titre = typeof entete.titre === 'string' ? entete.titre.trim() : ''
  if (titre === '') {
    const premier = /^\s*#\s+(.+?)\s*#*\s*$/m.exec(corps)
    if (premier !== null && corps.slice(0, premier.index).trim() === '') {
      titre = premier[1]!.trim()
      corps = corps.slice(premier.index + premier[0].length)
    }
  }
  if (titre === '') titre = nomFichier.replace(/\.[^.]+$/, '').trim()
  const slug =
    typeof entete.slug === 'string' && entete.slug.trim() !== ''
      ? entete.slug.trim()
      : slugDepuisNom(nomFichier)
  return {
    slug,
    titre: titre.slice(0, TITRE_MAX),
    contenu: normaliserContenu(corps),
  }
}
