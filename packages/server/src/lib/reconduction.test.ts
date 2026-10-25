import { describe, expect, it } from 'vitest'

import { decaler, ecartEnJours } from './reconduction.ts'

const jour = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null

describe('écart entre deux périodes', () => {
  it('compte des jours entiers, années bissextiles comprises', () => {
    expect(ecartEnJours(new Date('2026-06-13'), new Date('2027-06-12'))).toBe(
      364
    )
    expect(ecartEnJours(new Date('2027-03-01'), new Date('2028-03-01'))).toBe(
      366
    )
    expect(ecartEnJours(new Date('2027-06-12'), new Date('2026-06-13'))).toBe(
      -364
    )
  })

  it('ignore l’heure d’une date', () => {
    expect(
      ecartEnJours(
        new Date('2026-06-13T23:30:00Z'),
        new Date('2026-06-14T00:15:00Z')
      )
    ).toBe(1)
  })
})

describe('échéance décalée', () => {
  it('garde l’écart avec le premier jour', () => {
    expect(jour(decaler(new Date('2026-05-14'), 364))).toBe('2027-05-13')
    expect(jour(decaler(new Date('2028-02-28T10:00:00Z'), 1))).toBe(
      '2028-02-29'
    )
  })

  it('laisse une tâche sans échéance sans échéance', () => {
    expect(decaler(null, 364)).toBeNull()
  })
})
