// Liens d'un texte simple (ADR 0029).
//
// Un commentaire est un texte sans mise en forme. Une adresse `http` ou `https` qui
// y figure devient un lien. Une adresse de l'espace organisateur s'ouvre dans le
// même onglet, toute autre adresse dans un nouvel onglet. Le texte ne passe jamais
// par du HTML : ce module ne rend que des segments, que le composant affiche.

export type Segment =
  | { texte: string; href?: undefined }
  | {
      texte: string
      /** L'adresse complète, validée. */
      href: string
      /**
       * Le chemin dans l'espace organisateur quand l'adresse y mène, sinon null.
       * Un lien interne se suit sans recharger l'application.
       */
      interne: string | null
    }

const ADRESSE = /https?:\/\/[^\s<>"']+/gi
// La ponctuation qui suit une adresse dans une phrase n'en fait pas partie.
const FIN_DE_PHRASE = /[.,;:!?»”’…]$/
// Sous l'origine de l'espace organisateur, ces chemins mènent au serveur et non à
// un écran : ils s'ouvrent comme une adresse externe.
const CHEMINS_DU_SERVEUR = ['/api/', '/graphql', '/medias/']

/** Retire la ponctuation finale et une parenthèse fermante sans ouvrante. */
function borner(adresse: string): string {
  let fin = adresse
  for (;;) {
    if (FIN_DE_PHRASE.test(fin)) {
      fin = fin.slice(0, -1)
    } else if (
      /[)\]]$/.test(fin) &&
      (fin.match(/[([]/g)?.length ?? 0) < (fin.match(/[)\]]/g)?.length ?? 0)
    ) {
      fin = fin.slice(0, -1)
    } else {
      return fin
    }
  }
}

function lire(adresse: string): URL | null {
  try {
    const url = new URL(adresse)
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname !== ''
      ? url
      : null
  } catch {
    return null
  }
}

/**
 * Découpe un texte en segments : du texte, et les adresses `http` ou `https` qu'il
 * contient. `origine` est l'origine de l'espace organisateur (`location.origin`).
 */
export function decouperLiens(texte: string, origine: string): Segment[] {
  const segments: Segment[] = []
  let curseur = 0
  const ajouterTexte = (jusqua: number) => {
    if (jusqua > curseur) segments.push({ texte: texte.slice(curseur, jusqua) })
  }
  for (const trouvee of texte.matchAll(ADRESSE)) {
    const adresse = borner(trouvee[0])
    const url = lire(adresse)
    if (url === null) continue
    ajouterTexte(trouvee.index)
    const chemin = `${url.pathname}${url.search}${url.hash}`
    const interne =
      url.origin === origine &&
      !CHEMINS_DU_SERVEUR.some(c => url.pathname.startsWith(c))
        ? chemin
        : null
    segments.push({ texte: adresse, href: url.href, interne })
    curseur = trouvee.index + adresse.length
  }
  ajouterTexte(texte.length)
  return segments
}
