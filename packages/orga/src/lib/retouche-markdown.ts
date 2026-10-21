// Retouches du Markdown écrit par l'éditeur visuel, pour garder la forme d'une
// fiche. Module sans dépendance, testé à part.

/** Une ligne qui ouvre ou ferme un bloc de code. */
const CLOTURE = /^ {0,3}(`{3,}|~{3,})/

/**
 * La ligne qui sépare l'en-tête d'un tableau garde la forme que la fiche utilise
 * déjà : `|---|` si la fiche l'écrit ainsi, sinon `| --- |`, comme la barre de
 * mise en forme et le guide. L'éditeur, lui, écrit `| - |`. Une cellule vide
 * garde aussi ses deux espaces quand la fiche l'écrit ainsi. Un bloc de code
 * reste intact.
 */
export function retoucher(markdown: string, modele = ''): string {
  const compact = /^\|(?::?-+:?\|)+[ \t]*$/m.test(modele)
  const videLarge = /^\|.*\| {2}\|/m.test(modele)
  let cloture: string | null = null
  return markdown
    .split('\n')
    .map(ligne => {
      const marque = CLOTURE.exec(ligne)?.[1]
      if (marque !== undefined) {
        if (cloture === null) cloture = marque
        else if (marque[0] === cloture[0] && marque.length >= cloture.length)
          cloture = null
        return ligne
      }
      if (cloture !== null || !/^\|.*\|$/.test(ligne)) return ligne
      if (/^\|(?: :?-:? \|)+$/.test(ligne))
        return compact
          ? ligne.replace(/ (:?)-(:?) /g, '$1---$2')
          : ligne.replace(/(:?)-(:?)/g, '$1---$2')
      return videLarge ? ligne.replace(/\| (?=\|)/g, '|  ') : ligne
    })
    .join('\n')
}

/**
 * Un lien que GFM reconnaît sans crochets : une adresse web écrite telle quelle
 * (`https://…`, `www.…`) ou une adresse de mail. L'éditeur visuel le réécrit tel
 * quel. Un lien relatif comme `[annexe.pdf](annexe.pdf)` garde ses crochets.
 */
export function estLienLitteral(
  url: string,
  texte: string,
  titre: string | null | undefined
): boolean {
  if (titre) return false
  if (url === texte) return /^https?:\/\/\S+$/i.test(texte)
  if (url === `http://${texte}`) return /^www\.\S+$/i.test(texte)
  if (url === `mailto:${texte}`)
    return /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(texte)
  return false
}
