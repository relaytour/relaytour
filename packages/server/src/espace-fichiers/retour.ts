// Adresse de retour et état d'une connexion OAuth de l'espace de fichiers
// (ADR 0038, 0051). Ce module ne lit ni l'environnement ni la base : les
// tests unitaires l'importent seul.

/** Chemin des routes de l'espace, sous /medias/ que le proxy relaie déjà vers l'API. */
export const PREFIXE_ROUTES = '/medias/espace-fichiers'

/**
 * Adresse de retour d'un fournisseur : l'adresse commune de l'exploitant quand
 * plusieurs installations partagent ses applications (ADR 0051), sinon celle de
 * l'installation. La même adresse sert à l'autorisation et à l'échange du code.
 */
export function adresseRetour(
  env: { ORIGINE_ORGA?: string; ESPACE_FICHIERS_RETOUR?: string },
  segment: 'sharepoint' | 'google' | 'dropbox'
): string {
  return env.ESPACE_FICHIERS_RETOUR === undefined
    ? `${env.ORIGINE_ORGA}${PREFIXE_ROUTES}/retour/${segment}`
    : `${env.ESPACE_FICHIERS_RETOUR}/${segment}`
}

const ALEA_ETAT = /^[A-Za-z0-9_-]{43}$/

/**
 * L'étiquette que l'installation place devant ses états. Elle ne sert qu'avec
 * l'adresse de retour commune : son relais la lit pour rendre le retour à
 * l'installation (ADR 0051).
 */
export function etiquetteRetour(env: {
  ESPACE_FICHIERS_RETOUR?: string
  ESPACE_FICHIERS_RETOUR_ETIQUETTE?: string
}): string | undefined {
  return env.ESPACE_FICHIERS_RETOUR === undefined
    ? undefined
    : env.ESPACE_FICHIERS_RETOUR_ETIQUETTE
}

/** L'état d'une connexion : l'aléa seul, ou précédé de l'étiquette et d'un point. */
export function composerEtat(
  alea: string,
  etiquette: string | undefined
): string {
  return etiquette === undefined ? alea : `${etiquette}.${alea}`
}

/** Vrai pour un état de la forme que cette installation émet. */
export function etatBienForme(
  etat: string,
  etiquette: string | undefined
): boolean {
  if (etiquette === undefined) return ALEA_ETAT.test(etat)
  const prefixe = `${etiquette}.`
  return etat.startsWith(prefixe) && ALEA_ETAT.test(etat.slice(prefixe.length))
}
