import { describe, expect, it } from 'vitest'

import { completerOrdre } from './ordre'

describe('completerOrdre', () => {
  it('garde l’ordre connu quand la liste reçue est triée autrement', () => {
    expect(completerOrdre(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('ajoute les nouveaux identifiants à la fin', () => {
    expect(completerOrdre(['a', 'b'], ['d', 'b', 'c'])).toEqual([
      'a',
      'b',
      'd',
      'c',
    ])
  })

  it('garde un identifiant absent de la liste reçue', () => {
    expect(completerOrdre(['a', 'b'], ['b'])).toEqual(['a', 'b'])
  })
})
