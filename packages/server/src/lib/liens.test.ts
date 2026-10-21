import { describe, expect, it } from 'vitest'

import { empreinte, jetonDerive, nouveauSel } from './liens.ts'

const SECRET = 'un-secret-de-test-de-trente-deux-caracteres'

describe('liens qui se recopient', () => {
  it('recalcule le même jeton pour le même sel', () => {
    const sel = nouveauSel()
    const jeton = jetonDerive(SECRET, 'espace', sel)
    expect(jeton).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(jetonDerive(SECRET, 'espace', sel)).toBe(jeton)
  })

  it('change de jeton avec le sel, l’usage ou le secret', () => {
    const sel = nouveauSel()
    const jeton = jetonDerive(SECRET, 'espace', sel)
    expect(jetonDerive(SECRET, 'espace', nouveauSel())).not.toBe(jeton)
    expect(jetonDerive(SECRET, 'appel', sel)).not.toBe(jeton)
    expect(jetonDerive(`${SECRET}-autre`, 'espace', sel)).not.toBe(jeton)
  })

  it('garde une empreinte sans le jeton', () => {
    const jeton = jetonDerive(SECRET, 'appel', nouveauSel())
    expect(empreinte(jeton)).toMatch(/^[0-9a-f]{64}$/)
    expect(empreinte(jeton)).not.toContain(jeton)
  })
})
