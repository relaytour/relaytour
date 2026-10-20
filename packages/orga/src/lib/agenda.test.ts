import { describe, expect, it } from 'vitest'

import {
  couvre,
  decalerJour,
  decalerMois,
  grilleDuMois,
  grouperParMoisAgenda,
  jourLocal,
  libelleJours,
  quantieme,
  toucheLeMois,
} from './agenda'

describe('jours et mois', () => {
  it('décale un jour et un mois sans subir les changements d’heure', () => {
    expect(decalerJour('2027-03-28', 1)).toBe('2027-03-29')
    expect(decalerJour('2027-03-01', -1)).toBe('2027-02-28')
    expect(decalerMois('2027-01', -1)).toBe('2026-12')
    expect(decalerMois('2027-12', 1)).toBe('2028-01')
  })

  it('lit le jour d’un instant dans un fuseau', () => {
    const instant = new Date('2027-03-27T23:30:00.000Z')
    expect(jourLocal(instant, 'Europe/Paris')).toBe('2027-03-28')
    expect(jourLocal(instant, 'UTC')).toBe('2027-03-27')
  })

  it('écrit un jour et une suite de jours en clair', () => {
    expect(libelleJours('2027-03-01')).toBe('lun. 1 mars')
    expect(libelleJours('2027-03-01', '2027-03-01')).toBe('lun. 1 mars')
    expect(libelleJours('2027-03-01', '2027-03-03')).toBe('1 mars → 3 mars')
    expect(quantieme('2027-03-09')).toBe('9')
  })
})

describe('grilleDuMois', () => {
  it('commence un lundi et finit un dimanche', () => {
    const grille = grilleDuMois('2027-03')
    expect(grille).toHaveLength(5)
    expect(grille[0]?.[0]).toEqual({ jour: '2027-03-01', dansLeMois: true })
    expect(grille[4]?.[6]).toEqual({ jour: '2027-04-04', dansLeMois: false })
  })

  it('complète la première semaine avec le mois précédent', () => {
    const grille = grilleDuMois('2027-08')
    expect(grille[0]?.[0]).toEqual({ jour: '2027-07-26', dansLeMois: false })
    expect(grille[0]?.[6]).toEqual({ jour: '2027-08-01', dansLeMois: true })
    expect(grille).toHaveLength(6)
  })

  it('tient février en quatre semaines quand il commence un lundi', () => {
    expect(grilleDuMois('2027-02')).toHaveLength(4)
  })
})

describe('éléments d’un jour et d’un mois', () => {
  const suite = { jour: '2027-02-27', jourFin: '2027-03-02' }

  it('couvre chaque jour de la suite', () => {
    expect(couvre(suite, '2027-02-27')).toBe(true)
    expect(couvre(suite, '2027-03-02')).toBe(true)
    expect(couvre(suite, '2027-03-03')).toBe(false)
    expect(couvre({ jour: '2027-03-01' }, '2027-03-01')).toBe(true)
  })

  it('touche chaque mois de la suite', () => {
    expect(toucheLeMois(suite, '2027-02')).toBe(true)
    expect(toucheLeMois(suite, '2027-03')).toBe(true)
    expect(toucheLeMois(suite, '2027-04')).toBe(false)
  })

  it('range par mois du premier jour, à partir du jour choisi', () => {
    const elements = [
      { cle: 'a', jour: '2027-01-10' },
      { cle: 'b', jour: '2027-02-27', jourFin: '2027-03-02' },
      { cle: 'c', jour: '2027-03-05' },
    ]
    expect(
      grouperParMoisAgenda(elements, '2027-03-01').map(g => [
        g.mois,
        g.elements.map(e => e.cle),
      ])
    ).toEqual([
      ['2027-02', ['b']],
      ['2027-03', ['c']],
    ])
  })
})
