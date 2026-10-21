import { lookup, type LookupAddress } from 'node:dns'
import { BlockList, isIP, type LookupFunction } from 'node:net'

import { Agent } from 'undici'

// Adresses joignables par un appel vers un hôte que l'organisation désigne
// elle-même, comme son Nextcloud (ADR 0038). Un tel hôte ne doit pas mener le
// serveur vers son propre réseau : la base, Valkey, l'API de métadonnées d'un
// hébergeur. Le contrôle porte sur l'adresse réellement jointe, au moment de la
// connexion : un nom qui change d'adresse entre deux résolutions n'y échappe pas.

const NON_PUBLIQUES = new BlockList()
for (const [reseau, prefixe] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  NON_PUBLIQUES.addSubnet(reseau, prefixe, 'ipv4')
}
for (const [reseau, prefixe] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const) {
  NON_PUBLIQUES.addSubnet(reseau, prefixe, 'ipv6')
}

/** Vrai pour une adresse IP joignable sur Internet, hors réseaux privés et réservés. */
export function adressePublique(adresse: string): boolean {
  const famille = isIP(adresse)
  if (famille === 0) return false
  if (famille === 6) {
    // Une adresse IPv4 écrite en IPv6 (« ::ffff:10.0.0.1 ») se juge en IPv4.
    const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(adresse)?.[1]
    if (v4 !== undefined) return adressePublique(v4)
    if (/^::ffff:/i.test(adresse)) return false
    return !NON_PUBLIQUES.check(adresse, 'ipv6')
  }
  return !NON_PUBLIQUES.check(adresse, 'ipv4')
}

export class AdresseRefusee extends Error {}

/** Résolution qui refuse un nom dont une adresse n'est pas publique. */
export const resolutionPublique: LookupFunction = (hote, options, rappel) => {
  lookup(hote, { ...options, all: true }, (erreur, adresses) => {
    if (erreur !== null) {
      rappel(erreur, '', 0)
      return
    }
    const liste = adresses
    if (liste.length === 0 || liste.some(a => !adressePublique(a.address))) {
      rappel(
        new AdresseRefusee(`L’hôte ${hote} n’a pas une adresse publique.`),
        '',
        0
      )
      return
    }
    if (options.all === true) {
      ;(rappel as unknown as (e: null, a: LookupAddress[]) => void)(null, liste)
      return
    }
    rappel(null, liste[0]!.address, liste[0]!.family)
  })
}

/** Connexions vers les seules adresses publiques. */
export const agentPublic = new Agent({
  connect: { lookup: resolutionPublique },
})

/** Connexions sans contrôle d'adresse, pour un hôte que l'exploitant a nommé. */
export const agentNomme = new Agent()
