import { createClient } from 'graphql-sse'

import type { Ecoute, EntiteChangee, FinDeFlux } from './flux'
import { organisationChoisie } from './selection'

// Ouverture du flux des changements en SSE (ADR 0017), sur l'adresse de l'API. La
// requête porte les cookies de la session et l'organisation choisie, comme les
// requêtes GraphQL (lib/apollo.ts). La reprise après une fin de flux se décide dans
// lib/flux.ts : le client n'en tente aucune lui-même.

const ABONNEMENT = 'subscription Changements { changements { entite } }'

/**
 * Durée après laquelle un flux accepté et resté ouvert est tenu pour établi. Le
 * serveur répond aussi par un flux quand il refuse l'abonnement : il y écrit
 * l'erreur, puis le ferme. Un flux n'est donc établi qu'une fois ce moment passé.
 */
export const ETABLI_APRES_MS = 2_000

/** La cause que dit le code d'une erreur du serveur. */
function causeDe(code: unknown): FinDeFlux {
  if (code === 'FORBIDDEN') return 'refus'
  if (code === 'TROP_DE_FLUX') return 'trop'
  return 'panne'
}

/**
 * Ouvre un flux et renvoie de quoi le fermer. `fetchFn` remplace `fetch` dans les
 * tests.
 */
export function ouvrirLeFluxSse(
  ecoute: Ecoute,
  options: { fetchFn?: typeof fetch } = {}
): () => void {
  let termine = false
  let cause: FinDeFlux | null = null
  let etabli: ReturnType<typeof setTimeout> | null = null
  const client = createClient({
    url: '/graphql',
    singleConnection: false,
    credentials: 'same-origin',
    retryAttempts: 0,
    ...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn }),
    on: {
      // Le délai part de la réponse du serveur, pas de l'envoi de la requête : une
      // requête qu'un proxy laisse en attente n'est pas un flux ouvert.
      connected: () => {
        if (termine) return
        etabli = setTimeout(() => {
          if (!termine) ecoute.ouvert()
        }, ETABLI_APRES_MS)
      },
    },
    headers: (): Record<string, string> => {
      const organisation = organisationChoisie()
      return organisation === null
        ? {}
        : { 'X-Relaytour-Organisation': organisation }
    },
  })
  const finir = (fin: FinDeFlux) => {
    if (termine) return
    termine = true
    if (etabli !== null) clearTimeout(etabli)
    client.dispose()
    ecoute.fin(fin)
  }
  const cesser = client.subscribe<{ changements: { entite: EntiteChangee } }>(
    { query: ABONNEMENT },
    {
      next: resultat => {
        // Un signal déjà en route quand l'appelant ferme le flux ne compte plus.
        if (termine) return
        // Un refus arrive comme un résultat en erreur, juste avant la fin du flux.
        const erreur = resultat.errors?.[0]
        if (erreur !== undefined) {
          cause = causeDe(erreur.extensions?.code)
          return
        }
        const entite = resultat.data?.changements.entite
        if (entite !== undefined) ecoute.signal(entite)
      },
      error: () => finir(cause ?? 'panne'),
      complete: () => finir(cause ?? 'terminee'),
    }
  )
  return () => {
    if (termine) return
    termine = true
    if (etabli !== null) clearTimeout(etabli)
    cesser()
    client.dispose()
  }
}
