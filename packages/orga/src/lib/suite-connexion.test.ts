import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { memoriserSuite, reprendreSuite, suiteSure } from './suite-connexion'

describe('page à rouvrir après la connexion', () => {
  it('n’accepte qu’un chemin de cette origine', () => {
    expect(suiteSure('/autoriser/abc')).toBe(true)
    expect(suiteSure('//pirate.exemple/x')).toBe(false)
    expect(suiteSure('/\\pirate.exemple')).toBe(false)
    expect(suiteSure('https://pirate.exemple/')).toBe(false)
    expect(suiteSure('autoriser/abc')).toBe(false)
    expect(suiteSure('/a\nb')).toBe(false)
  })

  describe('mémoire du navigateur', () => {
    beforeEach(() => {
      const valeurs = new Map<string, string>()
      vi.stubGlobal('window', {
        localStorage: {
          getItem: (cle: string) => valeurs.get(cle) ?? null,
          setItem: (cle: string, valeur: string) => valeurs.set(cle, valeur),
          removeItem: (cle: string) => valeurs.delete(cle),
        },
      })
    })
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('rend la page une seule fois', () => {
      memoriserSuite('/autoriser/abc', 1_000)
      expect(reprendreSuite(2_000)).toBe('/autoriser/abc')
      expect(reprendreSuite(2_000)).toBeNull()
    })

    it('oublie la page après 15 minutes', () => {
      memoriserSuite('/autoriser/abc', 0)
      expect(reprendreSuite(15 * 60 * 1000 + 1)).toBeNull()
    })

    it('ne garde pas un chemin d’une autre origine', () => {
      memoriserSuite('//pirate.exemple/x', 0)
      expect(reprendreSuite(1)).toBeNull()
    })
  })
})
