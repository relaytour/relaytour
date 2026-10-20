// Retouches du Markdown écrit par l'éditeur visuel, pour garder la forme d'une
// fiche. Module sans dépendance, testé à part.

/**
 * La ligne qui sépare l'en-tête d'un tableau garde la forme que la fiche utilise
 * déjà : `|---|` si la fiche l'écrit ainsi, sinon `| --- |`, comme la barre de
 * mise en forme et le guide. L'éditeur, lui, écrit `| - |`. Une cellule vide
 * garde aussi ses deux espaces quand la fiche l'écrit ainsi.
 */
export function retoucher(markdown: string, modele = ''): string {
  const compact = /^\|(?::?-+:?\|)+[ \t]*$/m.test(modele)
  const videLarge = /^\|.*\| {2}\|/m.test(modele)
  return markdown
    .replace(/^\|(?: :?-:? \|)+$/gm, ligne =>
      compact
        ? ligne.replace(/ (:?)-(:?) /g, '$1---$2')
        : ligne.replace(/(:?)-(:?)/g, '$1---$2')
    )
    .replace(/^\|.*\|$/gm, ligne =>
      videLarge ? ligne.replace(/\| (?=\|)/g, '|  ') : ligne
    )
}
