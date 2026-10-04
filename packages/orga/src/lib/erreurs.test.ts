import { afterEach, describe, expect, it, vi } from 'vitest'

import { dateCourte, jourDeLInstant } from './erreurs'

describe('dateCourte', () => {
  it('formate une date sans heure telle qu’elle est écrite', () => {
    expect(dateCourte('2026-10-04')).toBe('4 octobre 2026')
  })

  it('garde le jour écrit, même à minuit UTC', () => {
    expect(dateCourte('2027-06-05T00:00:00.000Z')).toBe('5 juin 2027')
  })
})

describe('jourDeLInstant', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // 22 h 30 UTC le 4 octobre correspond à 0 h 30 le 5 octobre à Paris (UTC+2).
  const instant = '2026-10-04T22:30:00.000Z'

  it('donne le jour de l’instant dans le fuseau indiqué', () => {
    expect(jourDeLInstant(instant, 'Europe/Paris')).toBe('5 octobre 2026')
    expect(jourDeLInstant(instant, 'UTC')).toBe('4 octobre 2026')
    expect(jourDeLInstant(instant, 'America/Montreal')).toBe('4 octobre 2026')
  })

  it('suit l’heure d’hiver', () => {
    // 23 h 30 UTC le 31 décembre correspond à 0 h 30 le 1er janvier à Paris (UTC+1).
    expect(jourDeLInstant('2026-12-31T23:30:00.000Z', 'Europe/Paris')).toBe(
      '1 janvier 2027'
    )
    expect(jourDeLInstant('2026-12-31T22:30:00.000Z', 'Europe/Paris')).toBe(
      '31 décembre 2026'
    )
  })

  it('prend le fuseau du navigateur par défaut', () => {
    vi.stubEnv('TZ', 'Europe/Paris')
    expect(jourDeLInstant(instant)).toBe('5 octobre 2026')
    vi.stubEnv('TZ', 'UTC')
    expect(jourDeLInstant(instant)).toBe('4 octobre 2026')
  })
})
