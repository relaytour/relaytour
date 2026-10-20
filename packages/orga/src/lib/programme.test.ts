import { describe, expect, it } from 'vitest'

import {
  grilleDuJour,
  heureCourte,
  joursDuProgramme,
  minutes,
} from './programme'

const seq = (
  id: string,
  lieuId: string | null,
  heureDebut: string,
  heureFin: string,
  jour = '2027-06-05',
  jourFin = jour
) => ({ id, lieuId, heureDebut, heureFin, jour, jourFin })

describe('heures', () => {
  it('convertit et écrit une heure', () => {
    expect(minutes('09:30')).toBe(570)
    expect(heureCourte(540)).toBe('9 h')
    expect(heureCourte(570)).toBe('9 h 30')
  })
})

describe('grilleDuJour', () => {
  it('place les séquences par lieu et par tranche de 30 minutes', () => {
    const grille = grilleDuJour(
      [
        seq('a', 'bassin', '09:00', '10:30'),
        seq('b', 'terrain', '10:00', '12:00'),
      ],
      ['bassin', 'terrain'],
      '2027-06-05'
    )
    expect(grille.debut).toBe(9 * 60)
    expect(grille.tranches).toBe(6)
    expect(grille.colonnes).toEqual([
      { lieuId: 'bassin', couloirs: 1, premiere: 1 },
      { lieuId: 'terrain', couloirs: 1, premiere: 2 },
    ])
    expect(
      grille.placements.map(p => [
        p.sequence.id,
        p.colonne,
        p.ligneDebut,
        p.ligneFin,
      ])
    ).toEqual([
      ['a', 1, 1, 4],
      ['b', 2, 3, 7],
    ])
  })

  it('ouvre un couloir pour deux séquences qui se chevauchent dans un lieu', () => {
    const grille = grilleDuJour(
      [
        seq('a', 'bassin', '09:00', '11:00'),
        seq('b', 'bassin', '10:00', '12:00'),
        seq('c', 'bassin', '11:00', '12:00'),
      ],
      ['bassin'],
      '2027-06-05'
    )
    expect(grille.colonnes).toEqual([
      { lieuId: 'bassin', couloirs: 2, premiere: 1 },
    ])
    expect(grille.placements.map(p => [p.sequence.id, p.colonne])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 1],
    ])
  })

  it('ajoute une colonne sans lieu, et arrête à minuit une séquence de nuit', () => {
    const grille = grilleDuJour(
      [
        seq('a', null, '22:00', '02:00', '2027-06-05', '2027-06-06'),
        seq('b', 'bassin', '21:00', '22:00'),
      ],
      ['bassin', 'terrain'],
      '2027-06-05'
    )
    expect(grille.colonnes.map(c => c.lieuId)).toEqual([
      'bassin',
      'terrain',
      null,
    ])
    const nuit = grille.placements.find(p => p.sequence.id === 'a')!
    expect([nuit.colonne, nuit.ligneDebut, nuit.ligneFin]).toEqual([3, 3, 7])
  })

  it('montre une séquence de nuit sur son jour de fin, de minuit à sa fin', () => {
    const grille = grilleDuJour(
      [seq('a', null, '22:00', '02:00', '2027-06-05', '2027-06-06')],
      [],
      '2027-06-06'
    )
    const nuit = grille.placements[0]!
    expect(grille.debut).toBe(0)
    expect([nuit.ligneDebut, nuit.ligneFin]).toEqual([1, 5])
  })

  it('garde des lignes entières pour un horaire hors des demi-heures', () => {
    const grille = grilleDuJour(
      [
        seq('a', 'bassin', '09:15', '10:00'),
        seq('b', 'bassin', '10:00', '10:40'),
      ],
      ['bassin'],
      '2027-06-05'
    )
    for (const p of grille.placements) {
      expect(Number.isInteger(p.ligneDebut)).toBe(true)
      expect(Number.isInteger(p.ligneFin)).toBe(true)
    }
    const premiere = grille.placements.find(p => p.sequence.id === 'a')!
    // 09:15 s'affiche dès 09:00 : la première tranche de la grille.
    expect([premiere.ligneDebut, premiere.ligneFin]).toEqual([1, 3])
    // Les deux séquences ne se chevauchent pas à l'affichage : un seul couloir.
    expect(grille.colonnes[0]!.couloirs).toBe(1)
  })

  it('liste les jours du programme, avec le jour de fin d’une séquence de nuit', () => {
    expect(
      joursDuProgramme([
        seq('a', null, '09:00', '10:00', '2027-06-06'),
        seq('b', null, '09:00', '10:00'),
        seq('c', null, '22:00', '01:00', '2027-06-07', '2027-06-08'),
        // Une séquence qui finit à minuit pile n'ajoute pas de jour.
        seq('d', null, '22:00', '00:00', '2027-06-09', '2027-06-10'),
      ])
    ).toEqual([
      '2027-06-05',
      '2027-06-06',
      '2027-06-07',
      '2027-06-08',
      '2027-06-09',
    ])
  })
})
