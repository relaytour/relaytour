import { createHash } from 'node:crypto'

// Images d'une organisation ou d'une activité (ADR 0009) : logo et favicon. Ce
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
    for (const { motif, raison } of SVG_INTERDITS) {
      if (motif.test(texte)) {
        throw new Error(`Le fichier SVG contient ${raison} : il est refusé.`)
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
