import { describe, expect, it } from 'vitest'

import { estLienLitteral, retoucher } from './retouche-markdown'

const ECRIT = ['| Poste | Accueil |', '| - | - |', '| Buvette | |'].join('\n')

describe('retoucher', () => {
  it('écrit le séparateur avec trois tirets et des espaces par défaut', () => {
    expect(retoucher(ECRIT)).toBe(
      ['| Poste | Accueil |', '| --- | --- |', '| Buvette | |'].join('\n')
    )
  })

  it('garde le séparateur compact d’une fiche qui l’écrit ainsi', () => {
    const modele = ['| A | B |', '|---|---|', '| 1 | 2 |'].join('\n')
    expect(retoucher(ECRIT, modele).split('\n')[1]).toBe('|---|---|')
  })

  it('garde l’alignement des colonnes', () => {
    expect(retoucher('| A | B |\n| :-: | -: |')).toBe(
      '| A | B |\n| :---: | ---: |'
    )
  })

  it('garde deux espaces dans une cellule vide quand la fiche l’écrit ainsi', () => {
    const modele = '| Buvette |  |'
    expect(retoucher(ECRIT, modele).split('\n')[2]).toBe('| Buvette |  |')
  })

  it('ne touche pas une ligne de texte', () => {
    expect(retoucher('Une - liste | de mots')).toBe('Une - liste | de mots')
  })
})

describe('retoucher dans un bloc de code', () => {
  it('ne touche pas un tableau écrit dans un bloc de code', () => {
    const code = ['```', '| A | B |', '| - | - |', '| x | |', '```'].join('\n')
    expect(
      retoucher(`${ECRIT}\n\n${code}`, '| Buvette |  |').split('\n\n')[1]
    ).toBe(code)
  })
})

describe('estLienLitteral', () => {
  it('reconnaît une adresse web, une adresse www et une adresse de mail', () => {
    expect(
      estLienLitteral('https://exemple.org', 'https://exemple.org', null)
    ).toBe(true)
    expect(
      estLienLitteral('http://www.exemple.org', 'www.exemple.org', null)
    ).toBe(true)
    expect(
      estLienLitteral('mailto:contact@exemple.org', 'contact@exemple.org', null)
    ).toBe(true)
  })

  it('garde les crochets d’un lien relatif ou titré', () => {
    expect(estLienLitteral('annexe.pdf', 'annexe.pdf', null)).toBe(false)
    expect(
      estLienLitteral('https://exemple.org', 'https://exemple.org', 'Titre')
    ).toBe(false)
  })
})
