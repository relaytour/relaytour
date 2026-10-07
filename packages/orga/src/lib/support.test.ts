import { describe, expect, it } from 'vitest'

import { lienSupport, ouvreUnOnglet } from './support'

describe('lienSupport', () => {
  it('ajoute un objet qui nomme l’organisation et la version', () => {
    expect(
      lienSupport('mailto:support@exemple.org', 'Rencontres', '0.11.0')
    ).toBe(
      'mailto:support@exemple.org?subject=Support%20Rencontres%20(Relaytour%200.11.0)'
    )
    expect(
      lienSupport('mailto:support@exemple.org', 'Rencontres', undefined)
    ).toBe(
      'mailto:support@exemple.org?subject=Support%20Rencontres%20(Relaytour)'
    )
  })

  it('garde un lien qui porte déjà ses paramètres, et une page https', () => {
    const avecObjet = 'mailto:aide@hebergeur.exemple.org?subject=Aide'
    expect(lienSupport(avecObjet, 'Rencontres', '0.11.0')).toBe(avecObjet)
    const page = 'https://hebergeur.exemple.org/aide'
    expect(lienSupport(page, 'Rencontres', '0.11.0')).toBe(page)
  })
})

describe('ouvreUnOnglet', () => {
  it('ouvre un onglet pour une page, pas pour un mailto:', () => {
    expect(ouvreUnOnglet('https://hebergeur.exemple.org/aide')).toBe(true)
    expect(ouvreUnOnglet('mailto:support@exemple.org')).toBe(false)
  })
})
