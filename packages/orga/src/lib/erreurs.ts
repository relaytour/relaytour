import { CombinedGraphQLErrors } from '@apollo/client/errors'

/** Message lisible pour une erreur GraphQL ou réseau. */
export function messageErreur(erreur: unknown): string {
  if (CombinedGraphQLErrors.is(erreur)) {
    const premiere = erreur.errors[0]
    if (premiere?.extensions?.code === 'SAISIE_INVALIDE')
      return premiere.message
    if (premiere?.extensions?.code === 'FORBIDDEN') {
      return 'Vous n’avez pas accès à cette action.'
    }
  }
  return 'L’opération a échoué. Réessayez dans un instant.'
}

/** Formate une date « AAAA-MM-JJ » en français, sans décalage de fuseau. */
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
