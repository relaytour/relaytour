import { describe, expect, it } from 'vitest'

import { courrielTronque, sansAdresses } from './journal.ts'

describe('sansAdresses', () => {
  it('tronque chaque adresse d’un texte libre', () => {
    expect(
      sansAdresses(
        '550 5.1.1 <prenom.nom@exemple.org>: Recipient address rejected, see autre@exemple.fr'
      )
    ).toBe(
      '550 5.1.1 <pr…@exemple.org>: Recipient address rejected, see au…@exemple.fr'
    )
  })

  it('laisse un texte sans adresse tel quel', () => {
    expect(sansAdresses('ECONNREFUSED 127.0.0.1:465')).toBe(
      'ECONNREFUSED 127.0.0.1:465'
    )
    expect(courrielTronque('a@exemple.org')).toBe('a…@exemple.org')
  })
})
