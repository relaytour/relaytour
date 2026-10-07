// Le bouton « Support » du menu du compte (ADR 0021). Le serveur donne le lien :
// l'adresse de support de l'organisation en mailto:, ou l'action de l'hébergeur.

/**
 * Le lien à ouvrir. Un mailto: sans objet reçoit un objet qui nomme
 * l'organisation et la version, pour situer la demande. Un lien qui porte déjà
 * ses paramètres, ou une page https, reste tel quel.
 */
export function lienSupport(
  support: string,
  organisation: string,
  version: string | undefined
): string {
  if (!support.startsWith('mailto:') || support.includes('?')) return support
  const relaytour = version === undefined ? 'Relaytour' : `Relaytour ${version}`
  const objet = `Support ${organisation} (${relaytour})`
  return `${support}?subject=${encodeURIComponent(objet)}`
}

/** Vrai pour une page web : elle s'ouvre dans un nouvel onglet, un mailto: non. */
export function ouvreUnOnglet(support: string): boolean {
  return support.startsWith('https://')
}
