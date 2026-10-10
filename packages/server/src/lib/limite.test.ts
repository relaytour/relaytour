import { beforeEach, describe, expect, it, vi } from 'vitest'

// Un Redis en mémoire, réduit aux commandes que la limite emploie : INCR, TTL et
// EXPIRE dans le script, GET pour la lecture.
const cles = new Map<string, { valeur: number; ttl: number }>()
const connection = {
  eval: vi.fn((script: string, _n: number, cle: string, ttl?: number) => {
    const entree = cles.get(cle) ?? { valeur: 0, ttl: -1 }
    if (script.includes('DECR')) {
      if (entree.valeur > 0) entree.valeur -= 1
      cles.set(cle, entree)
      return Promise.resolve(entree.valeur)
    }
    entree.valeur += 1
    if (entree.ttl < 0) entree.ttl = Number(ttl)
    cles.set(cle, entree)
    return Promise.resolve(entree.valeur)
  }),
  get: vi.fn((cle: string) =>
    Promise.resolve(cles.get(cle)?.valeur.toString() ?? null)
  ),
}
vi.mock('../jobs/queues.ts', () => ({ connection }))

const { limiterParCle, rendreTentative } = await import('./limite.ts')

beforeEach(() => {
  cles.clear()
  connection.eval.mockClear()
})

describe('limiterParCle', () => {
  it('laisse passer jusqu’à la limite, puis refuse', async () => {
    expect(await limiterParCle('a', 2, 60)).toBe(true)
    expect(await limiterParCle('a', 2, 60)).toBe(true)
    expect(await limiterParCle('a', 2, 60)).toBe(false)
  })

  it('pose la fenêtre dans la même commande que le compteur', async () => {
    await limiterParCle('b', 5, 900)
    expect(cles.get('limite:b')).toEqual({ valeur: 1, ttl: 900 })
    expect(connection.eval).toHaveBeenCalledTimes(1)
  })

  it('redonne une fenêtre à une clé qui l’aurait perdue', async () => {
    cles.set('limite:c', { valeur: 3, ttl: -1 })
    await limiterParCle('c', 5, 60)
    expect(cles.get('limite:c')).toEqual({ valeur: 4, ttl: 60 })
  })

  it('laisse passer sans Redis, sauf demande de refus', async () => {
    connection.eval.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await limiterParCle('d', 1, 60)).toBe(true)
    connection.eval.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await limiterParCle('d', 1, 60, { siIndisponible: 'refuser' })).toBe(
      false
    )
  })
})

describe('rendreTentative', () => {
  it('rend une tentative réservée, sans passer sous zéro', async () => {
    await limiterParCle('jeton:ip', 10, 900)
    await limiterParCle('jeton:ip', 10, 900)
    await rendreTentative('jeton:ip')
    expect(cles.get('limite:jeton:ip')?.valeur).toBe(1)
    await rendreTentative('jeton:ip')
    await rendreTentative('jeton:ip')
    expect(cles.get('limite:jeton:ip')?.valeur).toBe(0)
  })

  it('ne lève pas sans Redis', async () => {
    connection.eval.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await expect(rendreTentative('jeton:ip')).resolves.toBeUndefined()
  })
})
