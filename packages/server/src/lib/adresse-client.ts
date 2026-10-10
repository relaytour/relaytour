import { isIP } from 'node:net'

import { adresseLocaleOuPrivee } from './requete-locale.ts'

/**
 * En-tête que le proxy pose avec l'adresse du client. Caddy y écrit `{client_ip}`,
 * qu'il calcule en tenant compte de ses `trusted_proxies` : avec un intermédiaire
 * devant lui (CDN, répartiteur), l'adresse reste celle du client, là où
 * `X-Forwarded-For` ne porte qu'une chaîne dont Express retient le dernier saut.
 */
export const ENTETE_IP_CLIENT = 'x-relaytour-ip'

/**
 * L'adresse du client d'une requête : celle que le proxy déclare dans l'en-tête
 * dédié, quand la connexion vient d'une adresse locale ou privée (le proxy est sur
 * la machine ou sur le réseau), sinon celle qu'Express a résolue. Un client qui
 * joint l'API sans proxy ne peut donc pas se déclarer une autre adresse.
 */
export function adresseClient(requete: {
  get(nom: string): string | undefined
  ip?: string
  socket?: { remoteAddress?: string }
}): string {
  const declaree = requete.get(ENTETE_IP_CLIENT)?.trim()
  if (
    declaree !== undefined &&
    declaree !== '' &&
    isIP(declaree) !== 0 &&
    adresseLocaleOuPrivee(requete.socket?.remoteAddress)
  ) {
    return declaree
  }
  return requete.ip ?? requete.socket?.remoteAddress ?? ''
}
