/** Texte comparable pour une recherche : sans accents et en minuscules. */
export function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
