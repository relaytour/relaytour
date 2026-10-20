import { describe, expect, it } from 'vitest'

import { courrielValide, telephoneValide } from './benevoles.ts'

describe('coordonnées d’une fiche bénévole', () => {
  it('garde une adresse plausible, en minuscules, ou rien', () => {
    expect(courrielValide(' Lea@Exemple.org ')).toBe('lea@exemple.org')
    expect(courrielValide('')).toBeNull()
    expect(courrielValide(null)).toBeNull()
    expect(() => courrielValide('lea@exemple')).toThrow()
  })

  it('garde un téléphone de chiffres et de signes usuels, ou rien', () => {
    expect(telephoneValide('+33 6 12 34 56 78')).toBe('+33 6 12 34 56 78')
    expect(telephoneValide('06.12.34.56.78')).toBe('06.12.34.56.78')
    expect(telephoneValide('  ')).toBeNull()
    expect(() => telephoneValide('appeler le soir')).toThrow()
    // 41 caractères dépassent la colonne ; des signes sans chiffre ne sont pas un
    // numéro.
    expect(() => telephoneValide(`+${'1'.repeat(40)}`)).toThrow()
    expect(telephoneValide(`+${'1'.repeat(39)}`)).toBe(`+${'1'.repeat(39)}`)
    expect(() => telephoneValide('......')).toThrow()
    expect(() => telephoneValide('()()()')).toThrow()
  })
})
