import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { chiffrer, dechiffrer, lireCle } from './chiffrement.ts'

const CLE = randomBytes(32)

describe('chiffrement', () => {
  it('rend le texte chiffré', () => {
    const chiffre = chiffrer('jeton de rafraîchissement', CLE)
    expect(chiffre).not.toContain('jeton')
    expect(dechiffrer(chiffre, CLE)).toBe('jeton de rafraîchissement')
  })

  it('produit un texte différent à chaque chiffrement', () => {
    expect(chiffrer('même texte', CLE)).not.toBe(chiffrer('même texte', CLE))
  })

  it('refuse une autre clé et un texte modifié', () => {
    const chiffre = chiffrer('secret', CLE)
    expect(() => dechiffrer(chiffre, randomBytes(32))).toThrow()
    const parties = chiffre.split('.')
    parties[3] = Buffer.from('autre').toString('base64url')
    expect(() => dechiffrer(parties.join('.'), CLE)).toThrow()
    expect(() => dechiffrer('v2.a.b.c', CLE)).toThrow()
  })

  it('ne lit qu’une clé de 32 octets', () => {
    expect(lireCle(CLE.toString('base64'))?.equals(CLE)).toBe(true)
    expect(lireCle(randomBytes(16).toString('base64'))).toBeNull()
    expect(lireCle(undefined)).toBeNull()
  })
})
