import { randomUUID } from 'node:crypto'

import { GraphQLError, type GraphQLFormattedError } from 'graphql'

import { journal } from './journal.ts'

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

/**
 * Refus d'écraser un changement fait par une autre personne depuis la lecture. Les
 * détails disent l'état actuel : l'interface propose de recharger ou d'écraser.
 */
export function conflitDeVersion(
  message: string,
  details: Record<string, string | number | null>
): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'CONFLIT_VERSION', ...details },
  })
}

/** Refus d'une écriture dans une organisation en lecture seule (ADR 0008). */
export function organisationEnLectureSeule(): GraphQLError {
  return new GraphQLError(
    'Cette organisation est en lecture seule : vous pouvez consulter et exporter ses données, pas les modifier.',
    { extensions: { code: 'LECTURE_SEULE' } }
  )
}

/**
 * Refus d'une création au-delà d'une limite fixée par l'administration de
 * l'installation (ADR 0008). Le message renvoie vers l'hébergeur s'il est connu.
 */
export function limiteAtteinte(
  message: string,
  contactHebergeur: string | undefined
): GraphQLError {
  const suite = contactHebergeur
    ? ` Contactez votre hébergeur : ${contactHebergeur}.`
    : ' Contactez un admin de votre organisation.'
  return new GraphQLError(message + suite, {
    extensions: { code: 'LIMITE_ATTEINTE' },
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

// Codes d'erreur qui sortent du serveur tels quels : ceux de ce fichier, et ceux
// qu'Apollo pose sur une requête mal formée. Toute autre erreur (Prisma, exécution)
// est remplacée par un message générique, pour ne pas révéler le schéma de la base
// ni le détail d'une requête.
const CODES_CONNUS = new Set([
  'SAISIE_INVALIDE',
  'FORBIDDEN',
  'CONFLIT_VERSION',
  'CONFIRMATION_REQUISE',
  'LECTURE_SEULE',
  'LIMITE_ATTEINTE',
  'ABONNEMENT_ATTENDU',
  'TROP_DE_FLUX',
  'FLUX_INDISPONIBLE',
  'REQUETE_TROP_PROFONDE',
  'REQUETE_TROP_LARGE',
  'REQUETE_TROP_COMPLEXE',
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED',
  'BAD_USER_INPUT',
  'BAD_REQUEST',
  'PERSISTED_QUERY_NOT_FOUND',
  'PERSISTED_QUERY_NOT_SUPPORTED',
  'OPERATION_RESOLUTION_FAILURE',
])

/**
 * `formatError` d'Apollo : une erreur à code connu passe, une autre est masquée.
 * Le journal garde le message et la pile sous une référence que la réponse porte,
 * pour retrouver l'erreur à partir du retour d'une personne.
 */
export function formaterErreur(
  formatee: GraphQLFormattedError,
  erreur: unknown
): GraphQLFormattedError {
  const code = formatee.extensions?.code
  if (typeof code === 'string' && CODES_CONNUS.has(code)) return formatee
  const reference = randomUUID().slice(0, 8)
  const origine =
    erreur instanceof GraphQLError ? (erreur.originalError ?? erreur) : erreur
  journal.error(
    {
      evenement: 'erreur-interne',
      reference,
      code: code ?? null,
      chemin: formatee.path ?? null,
      message: origine instanceof Error ? origine.message : String(origine),
      pile: origine instanceof Error ? origine.stack : undefined,
    },
    'Une erreur interne a été masquée dans la réponse.'
  )
  return {
    message: `Le serveur a rencontré une erreur (référence ${reference}). Réessayez, puis contactez un admin si elle persiste.`,
    ...(formatee.path === undefined ? {} : { path: formatee.path }),
    ...(formatee.locations === undefined
      ? {}
      : { locations: formatee.locations }),
    extensions: { code: 'INTERNAL_SERVER_ERROR', reference },
  }
}
