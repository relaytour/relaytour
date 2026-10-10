import { describe, expect, it } from 'vitest'

import { adresseClient, ENTETE_IP_CLIENT } from './adresse-client.ts'

const requete = (
  entetes: Record<string, string>,
  ip: string,
  remoteAddress = ip
) => ({
  get: (nom: string) => entetes[nom.toLowerCase()],
  ip,
  socket: { remoteAddress },
})

describe('adresseClient', () => {
  it('lit l’adresse déclarée par un proxy local', () => {
    expect(
      adresseClient(requete({ [ENTETE_IP_CLIENT]: '203.0.113.7' }, '127.0.0.1'))
    ).toBe('203.0.113.7')
    expect(
      adresseClient(
        requete({ [ENTETE_IP_CLIENT]: '2001:db8::7' }, '::ffff:172.18.0.1')
      )
    ).toBe('2001:db8::7')
  })

  it('ignore l’en-tête d’un client qui joint l’API sans proxy', () => {
    expect(
      adresseClient(requete({ [ENTETE_IP_CLIENT]: '10.0.0.1' }, '203.0.113.9'))
    ).toBe('203.0.113.9')
  })

  it('ignore une valeur qui n’est pas une adresse', () => {
    expect(
      adresseClient(requete({ [ENTETE_IP_CLIENT]: 'client' }, '127.0.0.1'))
    ).toBe('127.0.0.1')
    expect(adresseClient(requete({}, '127.0.0.1'))).toBe('127.0.0.1')
  })
})
