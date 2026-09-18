import { describe, expect, it } from 'vitest'

import {
  identifiantsSouhaites,
  perimetresSouhaitesValides,
  SOUHAITS_MAX,
} from './souhaits.ts'

describe('identifiantsSouhaites', () => {
  it('retire les doublons en gardant l’ordre', () => {
    expect(identifiantsSouhaites(['b', 'a', 'b', 'a'])).toEqual(['b', 'a'])
  })

  it(`accepte ${SOUHAITS_MAX} périmètres et refuse un de plus`, () => {
    const ids = Array.from({ length: SOUHAITS_MAX + 1 }, (_, i) => `p${i}`)
    expect(identifiantsSouhaites(ids.slice(0, SOUHAITS_MAX))).toHaveLength(
      SOUHAITS_MAX
    )
    expect(() => identifiantsSouhaites(ids)).toThrow(/au plus/)
  })

  it('compte les périmètres après le retrait des doublons', () => {
    const ids = Array.from({ length: SOUHAITS_MAX * 2 }, () => 'p1')
    expect(identifiantsSouhaites(ids)).toEqual(['p1'])
  })
})

describe('perimetresSouhaitesValides', () => {
  it('renvoie une liste vide sans lire la base', async () => {
    // La configuration des tests unitaires pointe vers une base injoignable.
    await expect(perimetresSouhaitesValides([])).resolves.toEqual([])
  })
})
