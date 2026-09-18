import { describe, expect, it } from 'vitest'

import { avecDelai } from './delai.ts'

describe('avecDelai', () => {
  it('renvoie la valeur d’une promesse rapide', async () => {
    await expect(avecDelai(Promise.resolve(42), 50, 'essai')).resolves.toBe(42)
  })

  it('rejette une promesse qui ne se règle jamais', async () => {
    await expect(
      avecDelai(new Promise(() => undefined), 20, 'file')
    ).rejects.toThrow('file : pas de réponse en 20 ms')
  })
})
