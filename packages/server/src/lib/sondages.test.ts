import { describe, expect, it } from 'vitest'

import { CRENEAUX_MAX, creneauxValides } from './sondages.ts'

const PERIODE = { debut: '2027-06-05', fin: '2027-06-06' }

describe('creneauxValides', () => {
  it('range les créneaux par jour puis par heure, sans doublon', () => {
    expect(
      creneauxValides(
        [
          { jour: '2027-03-02', heureDebut: '18:00', heureFin: '19:00' },
          { jour: '2027-03-01' },
          { jour: '2027-03-02', heureDebut: '09:00', heureFin: '10:00' },
          { jour: '2027-03-01', heureDebut: '', heureFin: '' },
        ],
        PERIODE
      )
    ).toEqual([
      {
        id: null,
        jour: '2027-03-01',
        heureDebut: null,
        heureFin: null,
        ordre: 0,
      },
      {
        id: null,
        jour: '2027-03-02',
        heureDebut: '09:00',
        heureFin: '10:00',
        ordre: 1,
      },
      {
        id: null,
        jour: '2027-03-02',
        heureDebut: '18:00',
        heureFin: '19:00',
        ordre: 2,
      },
    ])
  })

  it('refuse un horaire incomplet, inversé ou mal formé', () => {
    for (const creneau of [
      { jour: '2027-03-01', heureDebut: '18:00' },
      { jour: '2027-03-01', heureDebut: '19:00', heureFin: '18:00' },
      { jour: '2027-03-01', heureDebut: '7h', heureFin: '8h' },
    ]) {
      expect(() => creneauxValides([creneau], PERIODE)).toThrow()
    }
  })

  it('refuse un sondage vide, trop long ou trop éloigné de la période', () => {
    expect(() => creneauxValides([], PERIODE)).toThrow(/au moins un créneau/)
    const trop = Array.from({ length: CRENEAUX_MAX + 1 }, (_, i) => ({
      jour: `2027-03-${String(i + 1).padStart(2, '0')}`,
    }))
    expect(() => creneauxValides(trop, PERIODE)).toThrow(/20 créneaux/)
    expect(() => creneauxValides([{ jour: '2030-01-01' }], PERIODE)).toThrow(
      /deux ans/
    )
  })
})
