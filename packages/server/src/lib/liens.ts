import { createHash, createHmac, randomBytes } from 'node:crypto'

// Liens secrets qui se recopient (ADR 0041) : l'adresse publique d'un appel à
// bénévoles, et le lien de l'espace d'une fiche bénévole.
//
// Le jeton se calcule à partir du secret du serveur et d'un sel aléatoire gardé
// en base. Le serveur garde le sel et l'empreinte SHA-256 du jeton, jamais le
// jeton : une copie de la base ne suffit pas à reconstituer un lien. Le serveur
// recalcule le même lien à volonté, pour un mail ou pour le bouton « Copier ».
// Un nouveau sel révoque l'ancien lien. Changer le secret du serveur change tous
// les liens.
//
// Le secret se lit de façon paresseuse : env.ts valide l'environnement à
// l'import, et le schéma doit pouvoir s'imprimer sans .env (invariant 12).

export type UsageLien = 'appel' | 'espace'

/** Un sel neuf : 32 octets aléatoires en base64url, 43 caractères. */
export function nouveauSel(): string {
  return randomBytes(32).toString('base64url')
}

/** Le jeton d'un objet, 43 caractères base64url. */
export function jetonDerive(
  secret: string,
  usage: UsageLien,
  sel: string
): string {
  return createHmac('sha256', secret)
    .update(`relaytour:${usage}:${sel}`)
    .digest('base64url')
}

/** L'empreinte d'un jeton, telle que la base la garde. */
export function empreinte(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex')
}

/** Le jeton d'un objet, avec le secret du serveur. */
export async function jetonDe(usage: UsageLien, sel: string): Promise<string> {
  const { env } = await import('../env.ts')
  return jetonDerive(env.BETTER_AUTH_SECRET, usage, sel)
}
