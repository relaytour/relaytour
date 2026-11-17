import { describe, expect, it } from 'vitest'

import { suiteSure } from './suite-connexion'

describe('page à rouvrir après la connexion', () => {
  it('n’accepte qu’un chemin de cette origine', () => {
    expect(suiteSure('/autoriser/abc')).toBe(true)
    expect(suiteSure('//pirate.exemple/x')).toBe(false)
    expect(suiteSure('/\\pirate.exemple')).toBe(false)
    expect(suiteSure('https://pirate.exemple/')).toBe(false)
    expect(suiteSure('autoriser/abc')).toBe(false)
    expect(suiteSure('/a\nb')).toBe(false)
  })
})
