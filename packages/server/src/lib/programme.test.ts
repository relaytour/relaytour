import { describe, expect, it } from 'vitest'

import { placesDatees } from './programme.ts'

const MAINTENANT = new Date('2027-04-01T10:00:00Z')
const HIER = new Date('2027-03-31T10:00:00Z')

describe('placesDatees', () => {
  it('confirme une place nouvelle saisie par l’équipe', () => {
    expect(
      placesDatees(
        [{ userId: 'u1', benevoleId: null, role: 'RENFORT' }],
        [],
        MAINTENANT
      )
    ).toEqual([
      {
        userId: 'u1',
        benevoleId: null,
        role: 'RENFORT',
        confirmeeLe: MAINTENANT,
      },
    ])
  })

  it('garde la date d’une place tenue, et une place à confirmer le reste', () => {
    const places = placesDatees(
      [
        { userId: null, benevoleId: 'b1', role: 'RESPONSABLE' },
        { userId: null, benevoleId: 'b2', role: 'RENFORT' },
        { userId: 'b1', benevoleId: null, role: 'RENFORT' },
      ],
      [
        { userId: null, benevoleId: 'b1', confirmeeLe: HIER },
        { userId: null, benevoleId: 'b2', confirmeeLe: null },
      ],
      MAINTENANT
    )
    expect(places.map(p => p.confirmeeLe)).toEqual([HIER, null, MAINTENANT])
  })

  it('garde la date de création d’une place tenue', () => {
    const [place] = placesDatees(
      [{ userId: null, benevoleId: 'b1', role: 'RENFORT' }],
      [{ userId: null, benevoleId: 'b1', confirmeeLe: null, createdAt: HIER }],
      MAINTENANT
    )
    expect(place).toMatchObject({ confirmeeLe: null, createdAt: HIER })
  })

  it('laisse à confirmer la place nouvelle d’une fiche joignable', () => {
    const places = placesDatees(
      [
        { userId: null, benevoleId: 'joignable', role: 'RENFORT' },
        { userId: null, benevoleId: 'sans-mail', role: 'RENFORT' },
        { userId: 'membre', benevoleId: null, role: 'RENFORT' },
      ],
      [],
      MAINTENANT,
      new Set(['joignable'])
    )
    expect(places.map(p => p.confirmeeLe)).toEqual([
      null,
      MAINTENANT,
      MAINTENANT,
    ])
  })
})
