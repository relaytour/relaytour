import { describe, expect, it } from 'vitest'

import { organisationDeLAdresse, organisationRetenue } from './selection'

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

describe('organisationRetenue', () => {
  it('préfère l’adresse, puis le choix de l’onglet, puis celui du navigateur', () => {
    expect(
      organisationRetenue({ adresse: 'b', onglet: 'a', navigateur: 'c' })
    ).toBe('b')
    // Un onglet rechargé garde son organisation, même si un autre onglet a changé
    // le dernier choix du navigateur.
    expect(
      organisationRetenue({ adresse: null, onglet: 'a', navigateur: 'b' })
    ).toBe('a')
    expect(
      organisationRetenue({ adresse: null, onglet: null, navigateur: 'b' })
    ).toBe('b')
    expect(
      organisationRetenue({ adresse: null, onglet: null, navigateur: null })
    ).toBeNull()
  })
})
