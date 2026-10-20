import { FournisseurIndisponible } from './types.ts'

// Appels sortants vers un fournisseur d'espace de fichiers (ADR 0038). Le serveur
// n'appelle que les hôtes du fournisseur, en https, avec un délai borné. Il suit
// lui-même une redirection, et seulement vers un hôte admis : un fournisseur qui
// renverrait ailleurs ne ferait pas appeler une adresse de son choix.

export interface HotesAdmis {
  exacts: readonly string[]
  /** Suffixes d'hôte, point compris : « .sharepoint.com ». */
  suffixes: readonly string[]
}

export function hoteAdmis(adresse: string, hotes: HotesAdmis): boolean {
  let url: URL
  try {
    url = new URL(adresse)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.port !== '')
    return false
  const hote = url.hostname.toLowerCase()
  return (
    hotes.exacts.includes(hote) ||
    hotes.suffixes.some(s => hote.endsWith(s) && hote.length > s.length)
  )
}

const REDIRECTIONS_MAX = 3

/**
 * `fetch` vers un hôte admis. Une redirection se suit vers un hôte admis, sans
 * l'en-tête d'autorisation : une adresse de téléchargement porte sa propre
 * signature. Le délai couvre toute la réponse, corps compris.
 */
export async function appelSortant(
  adresse: string,
  init: RequestInit & { delaiMs: number },
  hotes: HotesAdmis
): Promise<Response> {
  const { delaiMs, ...options } = init
  const signal = AbortSignal.timeout(delaiMs)
  let courante = adresse
  let entetes = options.headers
  for (let saut = 0; saut <= REDIRECTIONS_MAX; saut++) {
    if (!hoteAdmis(courante, hotes)) {
      throw new FournisseurIndisponible(
        'Le fournisseur renvoie vers un hôte non admis.'
      )
    }
    let reponse: Response
    try {
      reponse = await fetch(courante, {
        ...options,
        headers: entetes,
        redirect: 'manual',
        signal,
      })
    } catch (erreur) {
      throw new FournisseurIndisponible(
        `Le fournisseur ne répond pas : ${(erreur as Error).message}`
      )
    }
    const suite = reponse.headers.get('location')
    if (reponse.status >= 300 && reponse.status < 400 && suite !== null) {
      await reponse.body?.cancel()
      courante = new URL(suite, courante).toString()
      entetes = undefined
      continue
    }
    return reponse
  }
  throw new FournisseurIndisponible('Le fournisseur redirige trop de fois.')
}
