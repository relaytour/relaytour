import { beforeEach, describe, expect, it, vi } from 'vitest'

// Un Redis en mémoire, réduit aux commandes que la limite emploie : INCR, TTL et
// EXPIRE dans le script, GET pour la lecture.
const cles = new Map<string, { valeur: number; ttl: number }>()
const connection = {
  eval: vi.fn((_script: string, _n: number, cle: string, ttl: number) => {
    const entree = cles.get(cle) ?? { valeur: 0, ttl: -1 }
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

const { limiterParCle, noterRefus, tropDeRefus } = await import('./limite.ts')

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

describe('tropDeRefus et noterRefus', () => {
  it('ne bloque qu’à partir du nombre de refus demandé', async () => {
    expect(await tropDeRefus('jeton:ip', 2)).toBe(false)
    await noterRefus('jeton:ip', 900)
    expect(await tropDeRefus('jeton:ip', 2)).toBe(false)
    await noterRefus('jeton:ip', 900)
    expect(await tropDeRefus('jeton:ip', 2)).toBe(true)
    expect(cles.get('limite:jeton:ip')?.ttl).toBe(900)
  })

  it('ne bloque pas sans Redis', async () => {
    connection.get.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await tropDeRefus('jeton:ip', 1)).toBe(false)
  })
})
