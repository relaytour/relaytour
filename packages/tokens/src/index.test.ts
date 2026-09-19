import { describe, expect, it } from 'vitest'

import {
  contraste,
  contrastePercu,
  texteSurCouleur,
  fusionnerTheme,
  themeAlternatif,
  themeParDefaut,
  THEMES,
  variablesCss,
  verifierAccessibilite,
} from './index.ts'

describe('contraste', () => {
  it('vaut 21 entre le noir et le blanc, 1 entre deux couleurs identiques', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contraste('#1E5A63', '#1E5A63')).toBe(1)
  })
})

describe('thèmes livrés', () => {
  it.each(Object.entries(THEMES))(
    'le thème %s tient le niveau AA sur le blanc et sur le sol',
    (_nom, theme) => {
      expect(verifierAccessibilite(theme)).toEqual([])
    }
  )

  it('signale une couleur trop claire', () => {
    const theme = fusionnerTheme({ couleurs: { primaire: '#9FBE9A' } })
    const manquements = verifierAccessibilite(theme)
    expect(manquements.map(m => m.couleur)).toContain('primaire')
  })

  it('le thème alternatif ne change que la primaire et l’accent', () => {
    const { primaire, primaireClair, accent, accentClair, ...reste } =
      themeAlternatif.couleurs
    const base = themeParDefaut.couleurs
    expect(reste).toEqual({
      encre: base.encre,
      succes: base.succes,
      succesClair: base.succesClair,
      alerte: base.alerte,
      alerteClair: base.alerteClair,
      erreur: base.erreur,
      erreurClair: base.erreurClair,
      sol1: base.sol1,
      sol2: base.sol2,
      sol3: base.sol3,
    })
    expect([primaire, primaireClair, accent, accentClair]).not.toEqual([
      base.primaire,
      base.primaireClair,
      base.accent,
      base.accentClair,
    ])
  })
})

describe('fusionnerTheme', () => {
  it('complète un thème partiel avec le thème par défaut', () => {
    const theme = fusionnerTheme({
      couleurs: { primaire: '#2F6B4F' },
      polices: { titre: "'Bebas Neue', sans-serif" },
    })
    expect(theme.couleurs.primaire).toBe('#2F6B4F')
    expect(theme.couleurs.accent).toBe(themeParDefaut.couleurs.accent)
    expect(theme.polices.titre).toBe("'Bebas Neue', sans-serif")
    expect(theme.polices.texte).toBe(themeParDefaut.polices.texte)
    expect(theme.typographie).toEqual(themeParDefaut.typographie)
  })
})

describe('variablesCss', () => {
  it('expose chaque couleur, ses composantes rgb et la typographie', () => {
    const variables = variablesCss(themeParDefaut)
    expect(variables['--rt-primaire']).toBe('#1E5A63')
    expect(variables['--rt-primaire-rgb']).toBe('30, 90, 99')
    expect(variables['--rt-encre-rgb']).toBe('27, 39, 48')
    expect(variables['--rt-titre-graisse']).toBe('600')
    expect(Object.keys(variables).every(k => k.startsWith('--rt-'))).toBe(true)
  })
})

describe('texteSurCouleur', () => {
  it.each([
    ['#02ADB8', '#FFFFFF'], // turquoise : le blanc se lit mieux, WCAG 2 disait noir
    ['#F32988', '#FFFFFF'], // rose vif
    ['#FC685F', '#FFFFFF'], // corail
    ['#2F6B4F', '#FFFFFF'], // marine
    ['#FBBB50', '#111111'], // jaune
    ['#8FC9B7', '#111111'], // menthe
    ['#FB8B36', '#111111'], // orange clair
  ])('choisit le texte le plus lisible sur %s', (fond, attendu) => {
    expect(texteSurCouleur(fond)).toBe(attendu)
  })

  it('mesure le contraste perçu comme APCA 0.0.98G', () => {
    expect(contrastePercu('#111111', '#FFFFFF')).toBeCloseTo(104.9, 0)
    expect(contrastePercu('#FFFFFF', '#000000')).toBeCloseTo(107.9, 0)
  })
})
