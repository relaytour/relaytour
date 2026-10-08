import { describe, expect, it } from 'vitest'

import { organisationDeLAdresse } from './selection'

describe('organisationDeLAdresse', () => {
  it('lit l’organisation de l’adresse d’ouverture de l’application installée', () => {
    expect(
      organisationDeLAdresse('?organisation=rencontres-de-la-vallee')
    ).toBe('rencontres-de-la-vallee')
    expect(organisationDeLAdresse('?a=1&organisation=timm')).toBe('timm')
  })

  it('ignore une adresse sans organisation ou un slug mal formé', () => {
    for (const recherche of [
      '',
      '?organisation=',
      '?organisation=Rencontres',
      '?organisation=a/b',
      '?organisation=-a',
      '?autre=rencontres',
    ])
      expect(organisationDeLAdresse(recherche)).toBeNull()
  })
})
