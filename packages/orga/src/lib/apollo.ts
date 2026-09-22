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

// L'API est servie sur la même origine que l'interface (proxy Vite ou Caddy).
export const apollo = new ApolloClient({
  link: ApolloLink.from([
    entetes,
    new HttpLink({ uri: '/graphql', credentials: 'same-origin' }),
  ]),
  cache: new InMemoryCache(),
})
