// Une requête locale n'est pas passée par le proxy (ADR 0013). Caddy, devant l'API,
// ajoute toujours X-Forwarded-For à une requête qu'il relaie, et un client ne peut pas
// retirer cet en-tête à travers lui. Une requête sans cet en-tête vient donc de la
// machine elle-même, par le port publié sur 127.0.0.1 ou depuis le conteneur.

export function requeteLocale(entetes: {
  get(nom: string): string | undefined
}): boolean {
  const relayee =
    entetes.get('x-forwarded-for') ?? entetes.get('forwarded') ?? ''
  return relayee.trim() === ''
}
