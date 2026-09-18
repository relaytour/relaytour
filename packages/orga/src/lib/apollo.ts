import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

// L'API est servie sur la même origine que l'interface (proxy Vite ou Caddy).
export const apollo = new ApolloClient({
  link: new HttpLink({ uri: '/graphql', credentials: 'same-origin' }),
  cache: new InMemoryCache(),
})
