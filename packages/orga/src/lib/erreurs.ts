import { CombinedGraphQLErrors } from '@apollo/client/errors'

/** Message lisible pour une erreur GraphQL ou réseau. */
export function messageErreur(erreur: unknown): string {
  if (CombinedGraphQLErrors.is(erreur)) {
    const premiere = erreur.errors[0]
    if (
      premiere?.extensions?.code === 'SAISIE_INVALIDE' ||
      premiere?.extensions?.code === 'CONFLIT_VERSION'
    )
      return premiere.message
    if (premiere?.extensions?.code === 'FORBIDDEN') {
      return 'Vous n’avez pas accès à cette action.'
    }
  }
  return 'L’opération a échoué. Réessayez dans un instant.'
}

/**
 * Formate une date sans heure « AAAA-MM-JJ » en français, sans décalage de fuseau
 * (échéance d'une tâche, début et fin d'une période). Un instant passe par
 * `jourDeLInstant`.
 */
export function dateCourte(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number)
  return new Date(annee ?? 0, (mois ?? 1) - 1, jour ?? 1).toLocaleDateString(
    'fr-FR',
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
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: fuseau,
  })
}
