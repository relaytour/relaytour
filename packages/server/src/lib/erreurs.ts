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

/** Mesure d'une requête GraphQL, telle que le plugin de complexité la calcule. */
export interface MesureRequete {
  depth: number
  breadth: number
  complexity: number
  maxDepth?: number
  maxBreadth?: number
  maxComplexity?: number
}

/**
 * Refus d'une requête trop profonde, trop large ou trop coûteuse.
 * Le serveur la rejette avant d'exécuter le moindre résolveur.
 */
export function requeteTropLourde(
  nature: 'Depth' | 'Breadth' | 'Complexity',
  mesure: MesureRequete
): GraphQLError {
  const details = {
    Depth: {
      code: 'REQUETE_TROP_PROFONDE',
      message: `La requête est trop profonde (${mesure.depth} niveaux, maximum ${mesure.maxDepth}).`,
    },
    Breadth: {
      code: 'REQUETE_TROP_LARGE',
      message: `La requête sélectionne trop de champs (${mesure.breadth}, maximum ${mesure.maxBreadth}).`,
    },
    Complexity: {
      code: 'REQUETE_TROP_COMPLEXE',
      message: `La requête est trop coûteuse (complexité ${mesure.complexity}, maximum ${mesure.maxComplexity}).`,
    },
  }[nature]
  return new GraphQLError(details.message, {
    extensions: {
      code: details.code,
      profondeur: mesure.depth,
      largeur: mesure.breadth,
      complexite: mesure.complexity,
    },
  })
}
