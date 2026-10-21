// Règles pures de l'espace de fichiers (ADR 0038) : chemins admis, format de la
// liseuse et type servi au navigateur. Aucune dépendance au fournisseur.

export const PROFONDEUR_MAX = 20
const SEGMENT_MAX = 255

/**
 * Vrai pour un chemin de noms qui reste sous sa base : aucun segment vide, « . »
 * ou « .. », aucun séparateur, aucun caractère de contrôle. Le serveur adresse
 * l'élément depuis le dossier lié : un chemin admis ne peut pas en sortir.
 */
export function cheminValide(chemin: readonly string[]): boolean {
  if (chemin.length > PROFONDEUR_MAX) return false
  return chemin.every(
    segment =>
      segment.length > 0 &&
      segment.length <= SEGMENT_MAX &&
      segment !== '.' &&
      segment !== '..' &&
      segment.trim() === segment &&
      !/[/\\:*?"<>|]/.test(segment) &&
      ![...segment].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
}

export type FormatApercu =
  'PDF' | 'IMAGE' | 'TEXTE' | 'MARKDOWN' | 'PDF_CONVERTI' | 'AUCUN'

const IMAGES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

const TEXTES = new Set(['txt', 'csv', 'log'])
const MARKDOWN = new Set(['md', 'markdown'])

function extension(nom: string): string {
  const point = nom.lastIndexOf('.')
  return point <= 0 ? '' : nom.slice(point + 1).toLowerCase()
}

/**
 * Comment la liseuse affiche un fichier. Le format se déduit du nom, jamais du
 * type annoncé par le fournisseur. Le HTML et le SVG ne s'affichent jamais : ils
 * se téléchargent.
 */
export function formatApercu(
  nom: string,
  convertitEnPdf: (nom: string) => boolean,
  natif = false
): FormatApercu {
  // Un document natif du fournisseur n'a que sa conversion : son nom ne dit
  // rien de son contenu, même s'il se termine par « .pdf ».
  if (natif) return convertitEnPdf(nom) ? 'PDF_CONVERTI' : 'AUCUN'
  const ext = extension(nom)
  if (ext === 'pdf') return 'PDF'
  if (ext in IMAGES) return 'IMAGE'
  if (TEXTES.has(ext)) return 'TEXTE'
  if (MARKDOWN.has(ext)) return 'MARKDOWN'
  if (convertitEnPdf(nom)) return 'PDF_CONVERTI'
  return 'AUCUN'
}

/** Formats bureautiques que Microsoft Graph sait rendre en PDF. */
const CONVERTIBLES_MICROSOFT = new Set([
  'doc',
  'docx',
  'odt',
  'rtf',
  'xls',
  'xlsx',
  'ods',
  'ppt',
  'pptx',
  'odp',
])

export function convertibleParMicrosoft(nom: string): boolean {
  return CONVERTIBLES_MICROSOFT.has(extension(nom))
}

/**
 * Le type que la route d'aperçu annonce au navigateur. Il dépend du format admis,
 * jamais du fournisseur : un fichier que la liseuse n'affiche pas part en
 * `application/octet-stream`, en pièce à télécharger.
 */
export function typeServi(nom: string, format: FormatApercu): string {
  switch (format) {
    case 'PDF':
    case 'PDF_CONVERTI':
      return 'application/pdf'
    case 'IMAGE':
      return IMAGES[extension(nom)] ?? 'application/octet-stream'
    case 'TEXTE':
    case 'MARKDOWN':
      return 'text/plain; charset=utf-8'
    case 'AUCUN':
      return 'application/octet-stream'
  }
}

/** En-tête `Content-Disposition` d'un fichier, avec son nom en UTF-8. */
export function disposition(
  nom: string,
  mode: 'inline' | 'attachment'
): string {
  const ascii = nom.replace(/[^\x20-\x7e]|["\\]/g, '_')
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`
}
