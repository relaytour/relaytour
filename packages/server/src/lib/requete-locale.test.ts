import { describe, expect, it } from 'vitest'

import { requeteLocale } from './requete-locale.ts'

const entetes = (valeurs: Record<string, string>) => ({
  get: (nom: string) => valeurs[nom.toLowerCase()],
})

describe('requeteLocale', () => {
  it('reconnaît une requête sans en-tête de proxy', () => {
    expect(requeteLocale(entetes({}))).toBe(true)
  })

  it('refuse une requête relayée par le proxy', () => {
    expect(requeteLocale(entetes({ 'x-forwarded-for': '203.0.113.7' }))).toBe(
      false
    )
    expect(requeteLocale(entetes({ forwarded: 'for=203.0.113.7' }))).toBe(false)
  })
})
