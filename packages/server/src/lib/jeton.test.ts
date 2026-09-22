import { describe, expect, it } from 'vitest'

import { jetonValide } from './jeton.ts'

const ATTENDU = 'a'.repeat(48)

describe('jetonValide', () => {
  it('accepte le jeton attendu', () => {
    expect(jetonValide(ATTENDU, ATTENDU)).toBe(true)
  })

  it('refuse un autre jeton, plus court ou plus long', () => {
    expect(jetonValide('b'.repeat(48), ATTENDU)).toBe(false)
    expect(jetonValide('a'.repeat(47), ATTENDU)).toBe(false)
    expect(jetonValide('a'.repeat(49), ATTENDU)).toBe(false)
  })

  it('refuse tout jeton quand aucun n’est configuré', () => {
    expect(jetonValide(ATTENDU, undefined)).toBe(false)
    expect(jetonValide('', '')).toBe(false)
  })
})
