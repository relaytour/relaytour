import { describe, expect, it } from 'vitest'

import { adressePublique } from './reseau.ts'

describe('adressePublique', () => {
  // Le contrôle de publication du dépôt refuse toute IPv4 publique écrite en
  // clair : une adresse publique se vérifie ici en IPv6.
  it('admet une adresse joignable sur Internet', () => {
    for (const a of ['2606:4700:4700::1111', '2001:4860:4860::8888']) {
      expect(adressePublique(a)).toBe(true)
    }
  })

  it('refuse les réseaux privés, locaux et réservés', () => {
    for (const a of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.4',
      '192.168.1.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
      '::',
      'fe80::1',
      'fd12:3456::1',
      '64:ff9b::a00:1',
      'localhost',
      'pas une adresse',
    ]) {
      expect(adressePublique(a)).toBe(false)
    }
  })

  it('juge une adresse IPv4 écrite en IPv6 comme son adresse IPv4', () => {
    expect(adressePublique('::ffff:127.0.0.1')).toBe(false)
    expect(adressePublique('::ffff:10.0.0.1')).toBe(false)
    // Écrite en hexadécimal, elle n'est pas reconnue : elle est refusée.
    expect(adressePublique('::ffff:7f00:1')).toBe(false)
  })
})
