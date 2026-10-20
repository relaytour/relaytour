import { describe, expect, it } from 'vitest'

import {
  heureLocale,
  horaireEnClair,
  instantDepuisHeureLocale,
} from './heures.ts'

const PARIS = 'Europe/Paris'

describe('instantDepuisHeureLocale', () => {
  it('convertit une heure d’hiver et une heure d’été', () => {
    expect(
      instantDepuisHeureLocale('2027-01-15', '18:30', PARIS).toISOString()
    ).toBe('2027-01-15T17:30:00.000Z')
    expect(
      instantDepuisHeureLocale('2027-06-15', '18:30', PARIS).toISOString()
    ).toBe('2027-06-15T16:30:00.000Z')
  })

  it('passe le changement d’heure de mars', () => {
    expect(
      instantDepuisHeureLocale('2027-03-28', '01:30', PARIS).toISOString()
    ).toBe('2027-03-28T00:30:00.000Z')
    expect(
      instantDepuisHeureLocale('2027-03-28', '03:30', PARIS).toISOString()
    ).toBe('2027-03-28T01:30:00.000Z')
    // 02:30 n'existe pas ce jour-là : l'heure avance d'une heure.
    expect(
      heureLocale(instantDepuisHeureLocale('2027-03-28', '02:30', PARIS), PARIS)
    ).toEqual({
      jour: '2027-03-28',
      heure: '03:30',
    })
  })

  it('passe le changement d’heure d’octobre', () => {
    // 02:30 existe deux fois : la première, en heure d'été.
    expect(
      instantDepuisHeureLocale('2027-10-31', '02:30', PARIS).toISOString()
    ).toBe('2027-10-31T00:30:00.000Z')
    expect(
      instantDepuisHeureLocale('2027-10-31', '03:30', PARIS).toISOString()
    ).toBe('2027-10-31T02:30:00.000Z')
  })

  it('suit un autre fuseau', () => {
    expect(
      instantDepuisHeureLocale(
        '2027-01-15',
        '09:00',
        'America/Martinique'
      ).toISOString()
    ).toBe('2027-01-15T13:00:00.000Z')
  })

  it('refuse une heure ou un jour mal formés', () => {
    expect(() =>
      instantDepuisHeureLocale('2027-01-15', '24:00', PARIS)
    ).toThrow(/HH:MM/)
    expect(() =>
      instantDepuisHeureLocale('15/01/2027', '10:00', PARIS)
    ).toThrow(/AAAA-MM-JJ/)
  })
})

describe('heureLocale', () => {
  it('lit le jour et l’heure dans le fuseau, même la veille en UTC', () => {
    expect(heureLocale(new Date('2027-06-14T22:30:00.000Z'), PARIS)).toEqual({
      jour: '2027-06-15',
      heure: '00:30',
    })
  })
})

describe('horaireEnClair', () => {
  it('écrit le jour et les heures dans le fuseau', () => {
    expect(
      horaireEnClair(
        new Date('2027-03-01T17:30:00.000Z'),
        new Date('2027-03-01T19:00:00.000Z'),
        PARIS
      )
    ).toBe('lundi 1 mars 2027, de 18 h 30 à 20 h')
  })

  it('écrit les deux jours d’une réunion de plusieurs jours', () => {
    expect(
      horaireEnClair(
        new Date('2027-03-06T08:00:00.000Z'),
        new Date('2027-03-07T16:00:00.000Z'),
        PARIS
      )
    ).toBe('du samedi 6 mars 2027 à 9 h au dimanche 7 mars 2027 à 17 h')
  })
})
