/** Les initiales d'un nom : la première lettre des deux premiers mots. */
export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  return mots
    .slice(0, 2)
    .map(mot => mot.charAt(0).toLocaleUpperCase('fr'))
    .join('')
}

/** Le prénom affiché dans un message d'accueil : le premier mot du nom. */
export function prenom(nom: string | undefined): string {
  return nom?.trim().split(/\s+/)[0] ?? ''
}
