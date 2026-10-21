import { describe, expect, it } from 'vitest'

import { jaugePublique, REFERENCE, referencePublique } from './candidatures.ts'

describe('referencePublique', () => {
  it('rend 16 caractères stables, propres à l’appel et à la séquence', () => {
    const ref = referencePublique('a'.repeat(64), 'sequence-1')
    expect(ref).toMatch(REFERENCE)
    expect(referencePublique('a'.repeat(64), 'sequence-1')).toBe(ref)
    expect(referencePublique('b'.repeat(64), 'sequence-1')).not.toBe(ref)
    expect(referencePublique('a'.repeat(64), 'sequence-2')).not.toBe(ref)
    expect(ref).not.toContain('sequence')
  })
})

describe('jaugePublique', () => {
  it('compte les places recherchées, et dit quand le besoin est atteint', () => {
    expect(jaugePublique(3, 1)).toEqual({
      placesRecherchees: 2,
      complete: false,
    })
    expect(jaugePublique(3, 3)).toEqual({
      placesRecherchees: 0,
      complete: true,
    })
    expect(jaugePublique(3, 5)).toEqual({
      placesRecherchees: 0,
      complete: true,
    })
  })
})
