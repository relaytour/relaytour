import { env } from '../env.ts'

import { applicationsOuvertes } from './refus.ts'

// Métadonnées du serveur d'autorisation (RFC 8414) et de la ressource (RFC 9728),
// ADR 0067. L'émetteur et la ressource valent l'origine de l'espace organisateur :
// le relais de l'exploitant y transmet /oauth/* et /.well-known/oauth-* vers l'API.

export const CHEMIN_AUTORISER = '/oauth/autoriser'
export const CHEMIN_JETON = '/oauth/jeton'
export const CHEMIN_REVOCATION_OAUTH = '/oauth/revocation'
export const CHEMIN_ENREGISTREMENT = '/oauth/enregistrement'
export const CHEMIN_METADONNEES_SERVEUR =
  '/.well-known/oauth-authorization-server'
export const CHEMIN_METADONNEES_RESSOURCE =
  '/.well-known/oauth-protected-resource'

/** Le chemin de l'écran de consentement dans l'espace organisateur. */
export const CHEMIN_CONSENTEMENT = '/autoriser'

// `documents` demande la lecture du texte des documents (ADR 0072). La personne la
// coche ou non sur l'écran de consentement.
export const PORTEES = ['lecture', 'ecriture', 'documents'] as const

/** L'émetteur des jetons, et l'identifiant de la ressource qu'ils ouvrent. */
export const emetteur = (): string => env.ORIGINE_ORGA

/** Vrai pour le paramètre `resource` attendu (RFC 8707), barre finale admise. */
export function ressourceValide(resource: string | undefined): boolean {
  return resource !== undefined && resource.replace(/\/$/, '') === emetteur()
}

export function metadonneesServeur() {
  const o = emetteur()
  return {
    issuer: o,
    authorization_endpoint: `${o}${CHEMIN_AUTORISER}`,
    token_endpoint: `${o}${CHEMIN_JETON}`,
    revocation_endpoint: `${o}${CHEMIN_REVOCATION_OAUTH}`,
    ...(env.APPLICATIONS_ENREGISTREMENT_DYNAMIQUE
      ? { registration_endpoint: `${o}${CHEMIN_ENREGISTREMENT}` }
      : {}),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...PORTEES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  }
}

export function metadonneesRessource() {
  const o = emetteur()
  return {
    resource: o,
    authorization_servers: [o],
    scopes_supported: [...PORTEES],
    bearer_methods_supported: ['header'],
  }
}

/**
 * L'en-tête `WWW-Authenticate` d'un refus : il désigne les métadonnées de la
 * ressource quand l'installation sert les applications tierces. Une application
 * qui ne connaît que l'adresse de l'installation trouve ainsi le reste.
 */
export function enteteDefiPorteur(erreur: 'invalid_token' | null): string {
  const parties = [
    ...(erreur === null ? [] : [`error="${erreur}"`]),
    ...(applicationsOuvertes()
      ? [`resource_metadata="${emetteur()}${CHEMIN_METADONNEES_RESSOURCE}"`]
      : []),
  ]
  return parties.length === 0 ? 'Bearer' : `Bearer ${parties.join(', ')}`
}

/** L'adresse de retour avec ses paramètres, et `iss` (RFC 9207). */
export function adresseDeRetour(
  redirectUri: string,
  parametres: Record<string, string | null>
): string {
  const u = new URL(redirectUri)
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur !== null) u.searchParams.set(cle, valeur)
  }
  u.searchParams.set('iss', emetteur())
  return u.href
}
