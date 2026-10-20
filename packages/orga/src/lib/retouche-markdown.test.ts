import { describe, expect, it } from 'vitest'

import { retoucher } from './retouche-markdown'

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
