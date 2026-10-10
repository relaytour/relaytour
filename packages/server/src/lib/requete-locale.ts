import { isIP } from 'node:net'

// Une requête locale n'est pas passée par le proxy (ADR 0013). Caddy, devant l'API,
// ajoute toujours X-Forwarded-For à une requête qu'il relaie, et un client ne peut pas
// retirer cet en-tête à travers lui. Une requête sans cet en-tête vient donc de la
// machine elle-même, par le port publié sur 127.0.0.1 ou depuis le conteneur.
//
// L'adresse de la connexion complète ce critère : elle est locale ou privée (la
// boucle locale, le réseau du conteneur, un réseau privé). Une connexion depuis une
// adresse publique n'est jamais locale, même sans en-tête de proxy : un port publié
// par erreur sur toutes les interfaces n'ouvre pas le jeton.

const PRIVEES_V4 = [
  [/^127\./, true],
  [/^10\./, true],
  [/^192\.168\./, true],
  [/^172\.(1[6-9]|2\d|3[01])\./, true],
] as const

/** Vrai pour une adresse de boucle locale ou d'un réseau privé (RFC 1918, ULA). */
export function adresseLocaleOuPrivee(adresse: string | undefined): boolean {
  if (adresse === undefined) return false
  const v4 = adresse.replace(/^::ffff:/i, '')
  if (isIP(v4) === 4) return PRIVEES_V4.some(([motif]) => motif.test(v4))
  if (isIP(adresse) === 6) {
    const basse = adresse.toLowerCase()
    return basse === '::1' || /^f[cd][0-9a-f]{2}:/.test(basse)
  }
  return false
}

export function requeteLocale(requete: {
  get(nom: string): string | undefined
  socket?: { remoteAddress?: string }
}): boolean {
  const relayee =
    requete.get('x-forwarded-for') ?? requete.get('forwarded') ?? ''
  if (relayee.trim() !== '') return false
  // Sans information de connexion (tests, appel interne), le seul critère est l'en-tête.
  if (requete.socket === undefined) return true
  return adresseLocaleOuPrivee(requete.socket.remoteAddress)
}
