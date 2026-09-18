import { describe, expect, it } from 'vitest'

import { validerDates, validerEdition } from './editions.ts'

const saisie = {
  annee: 2027,
  nom: '  Rencontres 2027 ',
  debut: new Date('2027-06-05'),
  fin: new Date('2027-06-06'),
}

describe('validerEdition', () => {
  it('normalise le nom et garde les autres valeurs', () => {
    expect(validerEdition(saisie)).toEqual({ ...saisie, nom: 'Rencontres 2027' })
  })

  it('refuse une année hors de la plage', () => {
    expect(() => validerEdition({ ...saisie, annee: 2019 })).toThrow(/2020/)
    expect(() => validerEdition({ ...saisie, annee: 2101 })).toThrow(/2100/)
    expect(() => validerEdition({ ...saisie, annee: 2027.5 })).toThrow(/2020/)
  })

  it('refuse un nom vide', () => {
    expect(() => validerEdition({ ...saisie, nom: '  ' })).toThrow(/obligatoire/)
  })

  it('refuse une fin avant le début', () => {
    expect(() =>
      validerEdition({ ...saisie, fin: new Date('2027-06-04') })
    ).toThrow(/date de fin/)
  })
})

describe('validerDates', () => {
  it('refuse une date illisible', () => {
    expect(() => validerDates(new Date('n-importe-quoi'), saisie.fin)).toThrow(
      /AAAA-MM-JJ/
    )
  })
})
