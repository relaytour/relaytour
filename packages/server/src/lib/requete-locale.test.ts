import { describe, expect, it } from 'vitest'

import { adresseLocaleOuPrivee, requeteLocale } from './requete-locale.ts'

const requete = (valeurs: Record<string, string>, remoteAddress?: string) => ({
  get: (nom: string) => valeurs[nom.toLowerCase()],
  ...(remoteAddress === undefined ? {} : { socket: { remoteAddress } }),
})

describe('requeteLocale', () => {
  it('reconnaît une requête sans en-tête de proxy', () => {
    expect(requeteLocale(requete({}))).toBe(true)
    expect(requeteLocale(requete({}, '127.0.0.1'))).toBe(true)
    expect(requeteLocale(requete({}, '::ffff:172.18.0.1'))).toBe(true)
    expect(requeteLocale(requete({}, '::1'))).toBe(true)
  })

  it('refuse une requête relayée par le proxy', () => {
    expect(
      requeteLocale(requete({ 'x-forwarded-for': '203.0.113.7' }, '127.0.0.1'))
    ).toBe(false)
    expect(requeteLocale(requete({ forwarded: 'for=203.0.113.7' }))).toBe(false)
  })

  it('refuse une connexion depuis une adresse publique, même sans en-tête', () => {
    expect(requeteLocale(requete({}, '203.0.113.7'))).toBe(false)
    expect(requeteLocale(requete({}, '2001:db8::1'))).toBe(false)
    expect(requeteLocale(requete({}, ''))).toBe(false)
  })
})

describe('adresseLocaleOuPrivee', () => {
  it('distingue les adresses locales et privées des adresses publiques', () => {
    for (const a of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.9',
      '172.31.255.1',
      'fd12::1',
      'fc00::1',
    ])
      expect(adresseLocaleOuPrivee(a)).toBe(true)
    for (const a of [
      '198.51.100.1',
      '203.0.113.9',
      '2a00::1',
      'poste',
      undefined,
    ])
      expect(adresseLocaleOuPrivee(a)).toBe(false)
  })
})
