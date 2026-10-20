import { describe, expect, it } from 'vitest'

import {
  bornesDesPhases,
  decalerJour,
  ecartEnJours,
  jourISO,
  joursDeDateCle,
} from './agenda.ts'
import { PHASES_PAR_DEFAUT } from './phases.ts'

const PERIODE = { debut: '2027-06-05', fin: '2027-06-06' }

describe('jours', () => {
  it('lit un jour stocké à minuit UTC', () => {
    expect(jourISO(new Date('2027-06-05T00:00:00.000Z'))).toBe('2027-06-05')
  })

  it('décale un jour sans subir les changements d’heure', () => {
    expect(decalerJour('2027-03-27', 1)).toBe('2027-03-28')
    expect(decalerJour('2027-03-28', 1)).toBe('2027-03-29')
    expect(decalerJour('2027-10-31', -1)).toBe('2027-10-30')
    expect(decalerJour('2027-06-05', -120)).toBe('2027-02-05')
  })

  it('compte les jours entre deux dates', () => {
    expect(ecartEnJours('2027-06-05', '2027-06-05')).toBe(0)
    expect(ecartEnJours('2027-02-28', '2027-03-01')).toBe(1)
    expect(ecartEnJours('2028-02-28', '2028-03-01')).toBe(2)
  })
})

describe('bornesDesPhases', () => {
  it('place les phases par défaut entre l’ouverture et la fin de la période', () => {
    expect(
      bornesDesPhases(PHASES_PAR_DEFAUT, {
        ...PERIODE,
        ouverture: '2026-10-01',
      })
    ).toEqual([
      {
        cle: 'lancement',
        libelle: 'Lancement',
        du: '2026-10-01',
        au: '2027-02-05',
      },
      {
        cle: 'preparation',
        libelle: 'Préparation',
        du: '2027-02-06',
        au: '2027-05-06',
      },
      {
        cle: 'derniers-reglages',
        libelle: 'Derniers réglages',
        du: '2027-05-07',
        au: '2027-06-04',
      },
      {
        cle: 'deroulement-et-bilan',
        libelle: 'Déroulement et bilan',
        du: '2027-06-05',
        au: '2027-06-06',
      },
    ])
  })

  it('réduit la première phase à sa borne quand la période ouvre plus tard', () => {
    const [premiere, seconde] = bornesDesPhases(PHASES_PAR_DEFAUT, {
      ...PERIODE,
      ouverture: '2027-04-01',
    })
    expect(premiere).toMatchObject({ du: '2027-02-05', au: '2027-02-05' })
    expect(seconde).toMatchObject({ du: '2027-02-06' })
  })

  it('donne un jour à une dernière phase qui commence après la période', () => {
    const phases = [
      { cle: 'avant', libelle: 'Avant', jusquA: 'J+30' },
      { cle: 'apres', libelle: 'Après' },
    ]
    expect(
      bornesDesPhases(phases, { ...PERIODE, ouverture: '2027-01-01' })[1]
    ).toMatchObject({ du: '2027-07-06', au: '2027-07-06' })
  })

  it('couvre toute la période avec une seule phase', () => {
    expect(
      bornesDesPhases([{ cle: 'tout', libelle: 'Tout' }], {
        ...PERIODE,
        ouverture: '2027-01-01',
      })
    ).toEqual([
      { cle: 'tout', libelle: 'Tout', du: '2027-01-01', au: '2027-06-06' },
    ])
  })
})

describe('joursDeDateCle', () => {
  it('accepte un jour seul, et oublie un dernier jour égal au premier', () => {
    expect(joursDeDateCle('2027-03-01', null, PERIODE)).toEqual({
      jour: '2027-03-01',
      jourFin: null,
    })
    expect(
      joursDeDateCle('2027-03-01', '2027-03-01', PERIODE).jourFin
    ).toBeNull()
  })

  it('accepte une suite de jours', () => {
    expect(joursDeDateCle('2027-03-01', '2027-03-03', PERIODE).jourFin).toBe(
      '2027-03-03'
    )
  })

  it('refuse un dernier jour avant le premier', () => {
    expect(() => joursDeDateCle('2027-03-03', '2027-03-01', PERIODE)).toThrow(
      'Le dernier jour suit le premier.'
    )
  })

  it('refuse une date clé trop longue ou trop éloignée de la période', () => {
    expect(() => joursDeDateCle('2027-01-01', '2028-01-03', PERIODE)).toThrow(
      /366 jours au plus/
    )
    expect(() => joursDeDateCle('2030-01-01', null, PERIODE)).toThrow(
      /deux ans/
    )
    expect(() => joursDeDateCle('2025-01-01', null, PERIODE)).toThrow(
      /deux ans/
    )
  })

  it('compte le premier et le dernier jour dans la durée', () => {
    // Du 1er janvier 2027 au 1er janvier 2028 : 366 journées.
    expect(joursDeDateCle('2027-01-01', '2028-01-01', PERIODE).jourFin).toBe(
      '2028-01-01'
    )
    expect(() => joursDeDateCle('2027-01-01', '2028-01-02', PERIODE)).toThrow(
      /366 jours au plus/
    )
  })

  it('refuse un dernier jour au-delà des deux ans', () => {
    // Le 5 juin 2029 est le dernier jour permis : la date clé n'en sort pas.
    expect(joursDeDateCle('2029-06-05', null, PERIODE).jour).toBe('2029-06-05')
    expect(() => joursDeDateCle('2029-06-05', '2029-07-05', PERIODE)).toThrow(
      /deux ans/
    )
  })
})
