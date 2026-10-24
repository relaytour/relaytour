import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { langueActive } from './langue'

/**
 * Codes dont le serveur compose un message destiné à la personne (ADR 0008). Le
 * message d'une limite atteinte dit qui contacter : l'hébergeur s'il est connu,
 * sinon un admin de l'organisation. Celui de la lecture seule rappelle ce qui reste
 * possible : consulter et exporter.
 */
const CODES_AU_MESSAGE_LISIBLE = new Set([
  'SAISIE_INVALIDE',
  'CONFLIT_VERSION',
  'LIMITE_ATTEINTE',
  'LECTURE_SEULE',
])

/** Message lisible pour une erreur GraphQL ou réseau. */
export function messageErreur(erreur: unknown): string {
  if (CombinedGraphQLErrors.is(erreur)) {
    const premiere = erreur.errors[0]
    const code = premiere?.extensions?.code
    if (
      premiere !== undefined &&
      typeof code === 'string' &&
      CODES_AU_MESSAGE_LISIBLE.has(code)
    )
      return premiere.message
    if (premiere?.extensions?.code === 'FORBIDDEN') {
      return 'Vous n’avez pas accès à cette action.'
    }
  }
  return 'L’opération a échoué. Réessayez dans un instant.'
}

/** Vrai si le serveur refuse l'accès (`FORBIDDEN`), et non pour une panne. */
export function estRefus(erreur: unknown): boolean {
  return (
    CombinedGraphQLErrors.is(erreur) &&
    erreur.errors.some(e => e.extensions?.code === 'FORBIDDEN')
  )
}

/**
 * Formate une date sans heure « AAAA-MM-JJ » en français, sans décalage de fuseau
 * (échéance d'une tâche, début et fin d'une période). Un instant passe par
 * `jourDeLInstant`.
 */
export function dateCourte(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number)
  return new Date(annee ?? 0, (mois ?? 1) - 1, jour ?? 1).toLocaleDateString(
    langueActive(),
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }
  )
}

/**
 * Formate en français le jour d'un instant (`DateTime`, en UTC), dans le fuseau
 * du navigateur. Le jour UTC d'un instant situé juste après minuit en France est
 * la veille. `fuseau` remplace le fuseau du navigateur dans les tests.
 */
export function jourDeLInstant(iso: string, fuseau?: string): string {
  return new Date(iso).toLocaleDateString(langueActive(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: fuseau,
  })
}
