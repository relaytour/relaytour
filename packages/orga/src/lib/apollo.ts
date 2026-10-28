import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from '@apollo/client'
import { SetContextLink } from '@apollo/client/link/context'

import { activiteAffichee, organisationChoisie } from './selection'

// L'organisation et l'activité choisies partent en en-tête de chaque requête
// (ADR 0008). Le serveur vérifie l'appartenance : un en-tête ne donne aucun droit.
const entetes = new SetContextLink(precedent => {
  const organisation = organisationChoisie()
  const activite = activiteAffichee()
  return {
    headers: {
      ...(precedent.headers as Record<string, string> | undefined),
      ...(organisation === null
        ? {}
        : { 'X-Relaytour-Organisation': organisation }),
      ...(activite === null ? {} : { 'X-Relaytour-Activite': activite }),
    },
  }
})

// Un écran qui s'ouvre affiche le cache, puis le relit auprès du serveur. Un signal
// du flux ne relit que les écrans affichés (lib/rafraichissement.ts) : sans cette
// relecture, un écran rouvert montrerait la réponse d'avant le signal. Après sa
// première réponse, la requête suit le cache, que les relectures mettent à jour.
// Un écran qui relit ainsi garde son contenu pendant le chargement : il teste
// `loading && !data`, jamais `loading` seul.
export const OPTIONS_PAR_DEFAUT: ApolloClient.DefaultOptions = {
  watchQuery: {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  },
}

// L'API est servie sur la même origine que l'interface (proxy Vite ou Caddy).
export const apollo = new ApolloClient({
  link: ApolloLink.from([
    entetes,
    new HttpLink({ uri: '/graphql', credentials: 'same-origin' }),
  ]),
  cache: new InMemoryCache(),
  defaultOptions: OPTIONS_PAR_DEFAUT,
})
