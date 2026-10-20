import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Chiffrement d'un secret gardé en base (ADR 0038) : le jeton de rafraîchissement
// d'un espace de fichiers. AES-256-GCM, avec un vecteur neuf à chaque chiffrement.
// Le texte chiffré porte sa version : « v1.<vecteur>.<étiquette>.<données> », en
// base64 adapté aux adresses.

const ALGORITHME = 'aes-256-gcm'
const VERSION = 'v1'

/** Lit une clé de 32 octets écrite en base64. Renvoie null pour toute autre valeur. */
export function lireCle(texte: string | undefined): Buffer | null {
  if (texte === undefined) return null
  const cle = Buffer.from(texte, 'base64')
  return cle.length === 32 ? cle : null
}

export function chiffrer(texte: string, cle: Buffer): string {
  const vecteur = randomBytes(12)
  const chiffreur = createCipheriv(ALGORITHME, cle, vecteur)
  const donnees = Buffer.concat([
    chiffreur.update(texte, 'utf8'),
    chiffreur.final(),
  ])
  return [
    VERSION,
    vecteur.toString('base64url'),
    chiffreur.getAuthTag().toString('base64url'),
    donnees.toString('base64url'),
  ].join('.')
}

/** Déchiffre un texte produit par `chiffrer`. Lève si la clé ou le texte ne conviennent pas. */
export function dechiffrer(chiffre: string, cle: Buffer): string {
  const [version, vecteur, etiquette, donnees] = chiffre.split('.')
  if (
    version !== VERSION ||
    vecteur === undefined ||
    etiquette === undefined ||
    donnees === undefined
  ) {
    throw new Error('Secret chiffré illisible.')
  }
  const dechiffreur = createDecipheriv(
    ALGORITHME,
    cle,
    Buffer.from(vecteur, 'base64url')
  )
  dechiffreur.setAuthTag(Buffer.from(etiquette, 'base64url'))
  return Buffer.concat([
    dechiffreur.update(Buffer.from(donnees, 'base64url')),
    dechiffreur.final(),
  ]).toString('utf8')
}
