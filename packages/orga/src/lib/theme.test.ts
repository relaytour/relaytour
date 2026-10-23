import { describe, expect, it } from 'vitest'

import { themeActivite } from './theme'

describe('themeActivite', () => {
  const actuel = {
    couleurs: {
      primaire: '#2E5B3B',
      accent: '#6B2D8E',
      accentTexte: '#4A1F63',
    },
  }

  it('garde l’accent de texte quand l’accent ne change pas, quelle que soit la casse', () => {
    expect(themeActivite(actuel, '#2e5b3b', '#6b2d8e')?.couleurs).toEqual({
      primaire: '#2e5b3b',
      accent: '#6b2d8e',
      accentTexte: '#4A1F63',
    })
  })

  it('retire l’accent de texte quand l’accent change', () => {
    expect(themeActivite(actuel, '#2E5B3B', '#136D6C')?.couleurs).toEqual({
      primaire: '#2E5B3B',
      accent: '#136D6C',
    })
  })

  it('retire l’accent et son accent de texte quand l’accent est vidé', () => {
    expect(themeActivite(actuel, '#2E5B3B', null)?.couleurs).toEqual({
      primaire: '#2E5B3B',
    })
  })

  it('ne rend aucun thème sans couleur ni autre champ', () => {
    expect(themeActivite(null, null, null)).toBeNull()
  })
})
