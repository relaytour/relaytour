import { describe, expect, it } from 'vitest'

import {
  avertissements,
  axeDuJour,
  enManque,
  intervallesDuJour,
  position,
} from './repartition'

const h = (heure: number) => heure * 60

describe('axe et position', () => {
  it('arrondit l’axe aux heures pleines, et garde 8 h à 20 h sans intervalle', () => {
    expect(axeDuJour([{ debut: h(8.5), fin: h(11.25) }])).toEqual({
      debut: h(8),
      fin: h(12),
    })
    expect(axeDuJour([])).toEqual({ debut: h(8), fin: h(20) })
  })

  it('place un intervalle en pourcentages, coupé aux bornes de l’axe', () => {
    const axe = { debut: h(8), fin: h(12) }
    expect(position({ debut: h(9), fin: h(10) }, axe)).toEqual({
      gauche: 25,
      largeur: 25,
    })
    expect(position({ debut: h(7), fin: h(9) }, axe)).toEqual({
      gauche: 0,
      largeur: 25,
    })
  })

  it('coupe une plage de nuit à minuit', () => {
    expect(
      intervallesDuJour(
        [
          {
            jour: '2027-04-10',
            jourFin: '2027-04-11',
            heureDebut: '22:00',
            heureFin: '02:00',
          },
        ],
        '2027-04-11'
      )
    ).toEqual([{ debut: 0, fin: h(2) }])
  })
})

describe('avertissements', () => {
  const sequence = { debut: h(10), fin: h(12) }

  it('ne dit rien quand une plage couvre la séquence', () => {
    expect(
      avertissements({
        sequence,
        plages: [{ debut: h(9), fin: h(13) }],
        places: [],
        besoin: 3,
        renforts: 1,
      })
    ).toEqual([])
  })

  it('signale une plage partielle, une place à la même heure et un besoin atteint', () => {
    expect(
      avertissements({
        sequence,
        plages: [{ debut: h(11), fin: h(13) }],
        places: [{ debut: h(11), fin: h(14) }],
        besoin: 2,
        renforts: 2,
      })
    ).toEqual(['PLAGE_PARTIELLE', 'CHEVAUCHEMENT', 'BESOIN_ATTEINT'])
  })

  it('signale une personne sans plage sur l’horaire', () => {
    expect(
      avertissements({
        sequence,
        plages: [],
        places: [],
        besoin: null,
        renforts: 0,
      })
    ).toEqual(['HORS_PLAGES'])
  })
})

describe('enManque', () => {
  it('compte les places à confirmer dans les renforts', () => {
    expect(enManque({ besoin: 3, confirmees: 1, aConfirmer: 1 })).toBe(true)
    expect(enManque({ besoin: 2, confirmees: 1, aConfirmer: 1 })).toBe(false)
  })
})
