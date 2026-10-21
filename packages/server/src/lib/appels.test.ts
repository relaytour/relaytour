import { describe, expect, it } from 'vitest'

import {
  adequation,
  besoinValide,
  couverture,
  datesAppelValides,
  etatAppel,
  etatPlace,
  joursDesPlages,
  fusionnerPlages,
  gereLAppel,
  PLAGES_MAX,
  plagesValides,
  voitLAppel,
} from './appels.ts'

const PARIS = 'Europe/Paris'
// Le 5 juin 2027, Paris est en UTC+2.
const h = (heure: string, jour = '2027-06-05') =>
  new Date(`${jour}T${heure}:00+02:00`)
const plage = (debut: string, fin: string) => ({ debut: h(debut), fin: h(fin) })

describe('besoinValide', () => {
  it('garde un entier de 1 à 200, et lit zéro comme aucun besoin', () => {
    expect(besoinValide(6)).toBe(6)
    expect(besoinValide(0)).toBeNull()
    expect(besoinValide(null)).toBeNull()
    expect(besoinValide(undefined)).toBeNull()
  })

  it('refuse un nombre négatif, décimal ou trop grand', () => {
    for (const n of [-1, 2.5, 201]) {
      expect(() => besoinValide(n)).toThrow(/nombre entier de 0 à 200/)
    }
  })
})

describe('etatAppel', () => {
  const appel = {
    portee: 'PERIODE',
    sequenceId: null,
    ouvertLe: h('08:00'),
    fermeLe: h('20:00'),
    fermeManuellementLe: null,
  }

  it('suit ses dates', () => {
    expect(etatAppel(appel, h('07:59'))).toBe('A_VENIR')
    expect(etatAppel(appel, h('08:00'))).toBe('OUVERT')
    expect(etatAppel(appel, h('20:00'))).toBe('FERME')
  })

  it('se ferme à la main, ou quand sa séquence a disparu', () => {
    expect(
      etatAppel({ ...appel, fermeManuellementLe: h('09:00') }, h('10:00'))
    ).toBe('FERME')
    expect(etatAppel({ ...appel, portee: 'SEQUENCE' }, h('10:00'))).toBe(
      'FERME'
    )
  })
})

describe('datesAppelValides', () => {
  it('accepte une fermeture jusqu’à la fin du dernier jour de la période', () => {
    expect(() =>
      datesAppelValides(
        h('08:00'),
        h('23:59', '2027-06-06'),
        '2027-06-06',
        PARIS
      )
    ).not.toThrow()
  })

  it('refuse une fermeture avant l’ouverture, ou après la période', () => {
    expect(() =>
      datesAppelValides(h('08:00'), h('08:00'), '2027-06-06', PARIS)
    ).toThrow(/suit son ouverture/)
    expect(() =>
      datesAppelValides(
        h('08:00'),
        h('00:01', '2027-06-07'),
        '2027-06-06',
        PARIS
      )
    ).toThrow(/fin du dernier jour/)
  })
})

describe('plages', () => {
  const jours = joursDesPlages(
    { debut: '2027-06-05', fin: '2027-06-06' },
    [],
    PARIS
  )

  it('réunit les plages qui se chevauchent ou se touchent', () => {
    expect(
      fusionnerPlages([
        plage('14:00', '16:00'),
        plage('09:00', '12:00'),
        plage('12:00', '13:00'),
        plage('11:00', '11:30'),
      ])
    ).toEqual([plage('09:00', '13:00'), plage('14:00', '16:00')])
  })

  it('lit des plages saisies dans le fuseau de l’organisation', () => {
    expect(
      plagesValides(
        [
          { jour: '2027-06-05', heureDebut: '14:00', heureFin: '18:00' },
          { jour: '2027-06-05', heureDebut: '08:00', heureFin: '12:00' },
          {
            jour: '2027-06-05',
            jourFin: '2027-06-06',
            heureDebut: '22:00',
            heureFin: '01:00',
          },
        ],
        jours,
        PARIS
      )
    ).toEqual([
      plage('08:00', '12:00'),
      plage('14:00', '18:00'),
      { debut: h('22:00'), fin: h('01:00', '2027-06-06') },
    ])
  })

  it('refuse une plage inversée, trop longue, hors des jours permis, ou trop nombreuse', () => {
    const une = (jour: string, heureDebut: string, heureFin: string) => [
      { jour, heureDebut, heureFin },
    ]
    expect(() =>
      plagesValides(une('2027-06-05', '12:00', '09:00'), jours, PARIS)
    ).toThrow(/suit son début/)
    expect(() =>
      plagesValides(
        [
          {
            jour: '2027-06-05',
            jourFin: '2027-06-06',
            heureDebut: '08:00',
            heureFin: '09:00',
          },
        ],
        jours,
        PARIS
      )
    ).toThrow(/24 heures/)
    expect(() =>
      plagesValides(une('2027-06-04', '08:00', '09:00'), jours, PARIS)
    ).toThrow(/jours de la période/)
    expect(() =>
      plagesValides(
        Array.from({ length: PLAGES_MAX + 1 }, () => ({
          jour: '2027-06-05',
          heureDebut: '08:00',
          heureFin: '09:00',
        })),
        jours,
        PARIS
      )
    ).toThrow(/20 plages/)
  })

  it('ajoute les jours des séquences du programme, sans les jours entre deux', () => {
    expect(
      joursDesPlages(
        { debut: '2027-06-05', fin: '2027-06-06' },
        [
          { debut: h('16:00', '2027-06-04'), fin: h('18:00', '2027-06-04') },
          // Le démontage, une semaine plus tard, passe minuit.
          { debut: h('23:00', '2027-06-13'), fin: h('01:00', '2027-06-14') },
        ],
        PARIS
      )
    ).toEqual([
      '2027-06-04',
      '2027-06-05',
      '2027-06-06',
      '2027-06-13',
      '2027-06-14',
    ])
  })
})

describe('adequation', () => {
  const sequence = plage('10:00', '12:00')

  it('classe des plages selon la séquence', () => {
    expect(adequation([plage('09:00', '13:00')], sequence)).toBe('TOTALE')
    // Deux plages qui se touchent couvrent la séquence ensemble.
    expect(
      adequation([plage('09:00', '11:00'), plage('11:00', '12:00')], sequence)
    ).toBe('TOTALE')
    expect(adequation([plage('11:00', '14:00')], sequence)).toBe('PARTIELLE')
    expect(adequation([plage('12:00', '14:00')], sequence)).toBe('AUCUNE')
    expect(adequation([], sequence)).toBe('AUCUNE')
  })
})

describe('etatPlace', () => {
  const sequence = h('10:00', '2027-06-20')
  const creee = new Date('2027-06-01T08:00:00Z')

  it('signale une place à confirmer après sept jours', () => {
    const place = { confirmeeLe: null, createdAt: creee }
    expect(
      etatPlace(place, sequence, new Date('2027-06-07T08:00:00Z'), PARIS)
    ).toBe('A_CONFIRMER')
    expect(
      etatPlace(place, sequence, new Date('2027-06-08T08:00:00Z'), PARIS)
    ).toBe('NON_CONFIRMEE')
  })

  it('signale dès la veille d’une séquence proche', () => {
    const place = { confirmeeLe: null, createdAt: h('08:00', '2027-06-17') }
    expect(etatPlace(place, sequence, h('23:59', '2027-06-18'), PARIS)).toBe(
      'A_CONFIRMER'
    )
    expect(etatPlace(place, sequence, h('00:00', '2027-06-19'), PARIS)).toBe(
      'NON_CONFIRMEE'
    )
  })

  it('ne signale jamais une place confirmée', () => {
    expect(
      etatPlace(
        { confirmeeLe: creee, createdAt: creee },
        sequence,
        h('09:00', '2027-06-20'),
        PARIS
      )
    ).toBe('CONFIRMEE')
  })
})

describe('couverture', () => {
  it('additionne besoins et places, et compte les personnes libres', () => {
    const tranches = couverture(
      [
        {
          ...plage('09:00', '10:00'),
          besoin: 4,
          confirmees: 1,
          aConfirmer: 1,
        },
        {
          ...plage('09:30', '10:30'),
          besoin: 2,
          confirmees: 2,
          aConfirmer: 0,
        },
        // Une séquence sans besoin ne compte pas.
        {
          ...plage('08:00', '12:00'),
          besoin: null,
          confirmees: 3,
          aConfirmer: 0,
        },
      ],
      [
        { plages: [plage('09:00', '11:00')], places: [] },
        // Libre de 9 h à 9 h 30, puis placée.
        {
          plages: [plage('09:00', '11:00')],
          places: [plage('09:30', '10:30')],
        },
        // Sa plage ne couvre aucune tranche entière.
        { plages: [plage('09:15', '09:45')], places: [] },
      ]
    )
    expect(
      tranches.map(t => [
        t.debut.toISOString(),
        t.besoin,
        t.confirmees,
        t.aConfirmer,
        t.disponibles,
      ])
    ).toEqual([
      [h('09:00').toISOString(), 4, 1, 1, 2],
      [h('09:30').toISOString(), 6, 3, 1, 1],
      [h('10:00').toISOString(), 2, 2, 0, 1],
    ])
  })

  it('ne rend rien sans séquence qui cherche des bénévoles', () => {
    expect(couverture([], [])).toEqual([])
  })
})

describe('droits sur un appel', () => {
  const periode = { portee: 'PERIODE', perimetreId: null }
  const natation = { portee: 'PERIMETRE', perimetreId: 'natation' }

  it('réserve un appel de période aux admins', () => {
    expect(gereLAppel('TOUS', periode)).toBe(true)
    expect(gereLAppel(new Set(['natation']), periode)).toBe(false)
    expect(gereLAppel(new Set(['natation']), natation)).toBe(true)
    expect(gereLAppel(new Set(['football']), natation)).toBe(false)
  })

  it('montre un appel de période à toute personne qui écrit dans l’activité', () => {
    expect(voitLAppel(new Set(['football']), periode)).toBe(true)
    expect(voitLAppel(new Set(), periode)).toBe(false)
    expect(voitLAppel(new Set(['football']), natation)).toBe(false)
    expect(voitLAppel('TOUS', natation)).toBe(true)
  })
})
