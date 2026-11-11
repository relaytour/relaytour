import { describe, expect, it } from 'vitest'

import { cheminTache, ETAT_OUVERTE_ICI, ouverteIci } from './fenetre-tache'

describe('fenêtre d’une tâche', () => {
  it('compose le lien court d’une tâche', () => {
    expect(cheminTache('abc')).toBe('/taches/abc')
  })

  it('reconnaît une fenêtre ouverte depuis l’écran', () => {
    expect(ouverteIci(ETAT_OUVERTE_ICI)).toBe(true)
    // Une arrivée par le lien court ou une ligne des priorités n'a pas cet état.
    expect(ouverteIci(null)).toBe(false)
    expect(ouverteIci(undefined)).toBe(false)
    expect(ouverteIci({ autre: true })).toBe(false)
  })
})
