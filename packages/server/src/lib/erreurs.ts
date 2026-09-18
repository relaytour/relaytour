import { GraphQLError } from 'graphql'

/** Erreur de saisie lisible par l'interface. */
export function erreurSaisie(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'SAISIE_INVALIDE' } })
}

/** Refus d'accès. Le message ne dit pas si la ressource existe. */
export function accesRefuse(): GraphQLError {
  return new GraphQLError('Accès refusé.', {
    extensions: { code: 'FORBIDDEN' },
  })
}
