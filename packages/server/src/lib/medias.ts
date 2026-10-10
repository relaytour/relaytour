import { createHash } from 'node:crypto'

// Images d'une organisation ou d'une activité (ADR 0009) : logo, favicon et
// icône d'application (ADR 0023). Ce
// module est pur ; il n'importe ni Prisma ni l'environnement, pour servir aussi
// à la validation d'un dossier de contenu sans base.

export type TypeMedia = 'image/png' | 'image/svg+xml'

/** Tailles maximales : une image d'identité reste légère, et tient dans un mail. */
export const OCTETS_MAX: Record<TypeMedia, number> = {
  'image/png': 512 * 1024,
  'image/svg+xml': 128 * 1024,
}

export const EXTENSIONS: Record<TypeMedia, 'png' | 'svg'> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
}

const SIGNATURE_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

// Un SVG servi par Relaytour ne porte ni script, ni gestionnaire d'événement, ni
// ressource externe, ni contenu HTML. La route qui le sert ajoute une politique de
// sécurité qui bloque tout script : ce contrôle refuse en amont ce qui n'a pas sa
// place dans un logo.
const SVG_INTERDITS: { motif: RegExp; raison: string }[] = [
  { motif: /<script[\s>/]/i, raison: 'un script' },
  { motif: /<foreignObject[\s>/]/i, raison: 'un contenu HTML' },
  { motif: /\son[a-z]+\s*=/i, raison: 'un gestionnaire d’événement' },
  { motif: /javascript:/i, raison: 'un lien javascript' },
  { motif: /<!ENTITY/i, raison: 'une entité XML' },
  {
    motif: /(?:href|src)\s*=\s*["'](?!#|data:image\/(?:png|jpeg|webp);)/i,
    raison: 'une ressource externe',
  },
  { motif: /url\(\s*["']?(?!#)/i, raison: 'une ressource externe' },
  { motif: /@import/i, raison: 'une ressource externe' },
]

/**
 * Le texte d'un SVG dont les entités numériques et les entités XML de base sont
 * décodées, jusqu'à stabilité : « &amp;#58; » donne « &#58; » puis « : ».
 */
function decoderEntites(texte: string): string {
  let courant = texte
  for (let passe = 0; passe < 5; passe++) {
    const suivant = decoderUnePasse(courant)
    if (suivant === courant) break
    courant = suivant
  }
  return courant
}

function decoderUnePasse(texte: string): string {
  const base: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  }
  return texte.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entite, corps: string) => {
      if (corps[0] !== '#') return base[corps.toLowerCase()] ?? entite
      const code =
        corps[1] === 'x' || corps[1] === 'X'
          ? parseInt(corps.slice(2), 16)
          : parseInt(corps.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : entite
    }
  )
}

export interface MediaValide {
  type: TypeMedia
  empreinte: string
  octets: number
  donnees: Buffer
}

/** L'empreinte d'un fichier : SHA-256 en hexadécimal. */
export function empreinteMedia(donnees: Buffer): string {
  return createHash('sha256').update(donnees).digest('hex')
}

/**
 * Vérifie une image et renvoie ses caractéristiques. Le type se déduit du contenu,
 * jamais du nom de fichier. Lève une erreur au message lisible par un admin.
 */
export function verifierMedia(
  donnees: Buffer,
  attendu?: 'png' | 'svg'
): MediaValide {
  let type: TypeMedia
  if (donnees.subarray(0, 8).equals(SIGNATURE_PNG)) {
    type = 'image/png'
  } else {
    const texte = donnees.toString('utf8')
    if (
      !/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(texte)
    ) {
      throw new Error('L’image doit être un fichier PNG ou SVG.')
    }
    // Les motifs s'appliquent au texte brut et au texte dont les entités numériques
    // sont décodées : « javascript&#58; » dans une valeur d'attribut vaut « javascript: ».
    for (const forme of [texte, decoderEntites(texte)]) {
      for (const { motif, raison } of SVG_INTERDITS) {
        if (motif.test(forme)) {
          throw new Error(`Le fichier SVG contient ${raison} : il est refusé.`)
        }
      }
    }
    type = 'image/svg+xml'
  }
  if (attendu !== undefined && EXTENSIONS[type] !== attendu) {
    throw new Error(
      attendu === 'png'
        ? 'Cette image doit être au format PNG : les mails n’affichent pas le SVG.'
        : 'Cette image doit être au format SVG.'
    )
  }
  const max = OCTETS_MAX[type]
  if (donnees.length > max) {
    throw new Error(
      `L’image dépasse ${Math.round(max / 1024)} Ko : réduisez sa taille.`
    )
  }
  if (donnees.length === 0) throw new Error('L’image est vide.')
  return {
    type,
    empreinte: empreinteMedia(donnees),
    octets: donnees.length,
    donnees,
  }
}

/** Côté de l'icône d'application, en pixels (ADR 0023). */
export const COTE_ICONE_APPLICATION = 512

/** Les dimensions d'un PNG, lues dans son en-tête IHDR, ou null s'il est tronqué. */
export function dimensionsPng(
  donnees: Buffer
): { largeur: number; hauteur: number } | null {
  if (
    donnees.length < 24 ||
    !donnees.subarray(0, 8).equals(SIGNATURE_PNG) ||
    donnees.toString('latin1', 12, 16) !== 'IHDR'
  )
    return null
  return {
    largeur: donnees.readUInt32BE(16),
    hauteur: donnees.readUInt32BE(20),
  }
}

/**
 * Vérifie une icône d'application : un PNG carré de 512 pixels de côté. Le
 * serveur ne redimensionne aucune image (ADR 0023).
 */
export function verifierIconeApplication(donnees: Buffer): void {
  const d = dimensionsPng(donnees)
  if (
    d === null ||
    d.largeur !== COTE_ICONE_APPLICATION ||
    d.hauteur !== COTE_ICONE_APPLICATION
  ) {
    throw new Error(
      `L’icône d’application doit être un PNG carré de ${COTE_ICONE_APPLICATION} pixels de côté.`
    )
  }
}
