import { describe, expect, it } from 'vitest'

import { etatDuVolet, hautDuVolet } from './volets'

describe('etatDuVolet', () => {
  it('suit la largeur de l’écran sans choix de la personne', () => {
    expect(etatDuVolet(null, true)).toBe('deplie')
    expect(etatDuVolet(null, false)).toBe('rail')
  })

  it('laisse le choix de la personne l’emporter', () => {
    expect(etatDuVolet('rail', true)).toBe('rail')
    expect(etatDuVolet('deplie', false)).toBe('deplie')
  })
})

describe('hautDuVolet', () => {
  const ecran = { ecran: 800, sous: 96, marge: 16 }

  it('garde sous la barre haute un volet qui tient dans l’écran', () => {
    const mesures = { ...ecran, hauteur: 400 }
    expect(hautDuVolet(96, 300, mesures)).toBe(96)
    expect(hautDuVolet(-50, -300, mesures)).toBe(96)
  })

  it('fait suivre le défilement à un volet plus haut que l’écran', () => {
    const mesures = { ...ecran, hauteur: 1200 }
    // En descendant, le volet remonte avec la page jusqu'à montrer son bas.
    expect(hautDuVolet(96, 100, mesures)).toBe(-4)
    expect(hautDuVolet(-4, 1000, mesures)).toBe(800 - 1200 - 16)
    // En remontant, il redescend jusqu'à montrer son haut sous la barre.
    expect(hautDuVolet(-416, -200, mesures)).toBe(-216)
    expect(hautDuVolet(-216, -1000, mesures)).toBe(96)
  })

  it('reste dans ses bornes après un redimensionnement', () => {
    expect(hautDuVolet(-416, 0, { ...ecran, hauteur: 900 })).toBe(-116)
    expect(hautDuVolet(-416, 0, { ...ecran, hauteur: 300 })).toBe(96)
  })
})
