import { describe, expect, it } from 'vitest'

import { estUneLangue, resoudreLangue } from './langues.ts'

describe('resoudreLangue', () => {
  it('prend la première langue connue de la liste', () => {
    expect(resoudreLangue([null, 'de-DE', 'en-GB', 'fr'])).toBe('en')
    expect(resoudreLangue(['fr-CA'])).toBe('fr')
  })

  it('lit une valeur d’Accept-Language avec sa pondération', () => {
    expect(resoudreLangue(['en;q=0.8'])).toBe('en')
  })

  it('revient au français sans langue connue', () => {
    expect(resoudreLangue([])).toBe('fr')
    expect(resoudreLangue([undefined, '', 'de'])).toBe('fr')
  })
})

describe('estUneLangue', () => {
  it('refuse une balise régionale et une langue absente', () => {
    expect(estUneLangue('en')).toBe(true)
    expect(estUneLangue('en-GB')).toBe(false)
    expect(estUneLangue('de')).toBe(false)
  })
})
