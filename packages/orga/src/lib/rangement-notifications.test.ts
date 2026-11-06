import { describe, expect, it } from 'vitest'

import {
  grouperParActivite,
  grouperParPerimetre,
  type NotificationRangee,
  placerActiviteCourante,
} from './rangement-notifications'

const rencontres = { id: 'a1', slug: 'rencontres', nom: 'Rencontres' }
const club = { id: 'a2', slug: 'club', nom: 'Club' }
const natation = {
  id: 'p1',
  slug: 'natation',
  nom: 'Natation',
  couleur: '#123456',
}
const basket = { id: 'p2', slug: 'basket', nom: 'Basket' }

const n = (
  id: string,
  activite: NotificationRangee['activite'],
  perimetre: NotificationRangee['perimetre'],
  lue = false
): NotificationRangee => ({ id, lue, activite, perimetre })

describe('grouperParActivite', () => {
  it('range par activité, avec le groupe sans activité en tête et les non lues comptées', () => {
    const groupes = grouperParActivite(
      [
        n('1', rencontres, natation),
        n('2', club, null, true),
        n('3', null, null),
        n('4', rencontres, basket, true),
      ],
      'Organisation'
    )
    expect(
      groupes.map(g => [
        g.titre,
        g.activiteId,
        g.nonLues,
        g.elements.map(e => e.id),
      ])
    ).toEqual([
      ['Organisation', null, 1, ['3']],
      ['Club', 'a2', 0, ['2']],
      ['Rencontres', 'a1', 1, ['1', '4']],
    ])
  })
})

describe('grouperParPerimetre', () => {
  it('range par périmètre, avec « Toute l’activité » en tête', () => {
    const groupes = grouperParPerimetre(
      [
        n('1', rencontres, natation),
        n('2', rencontres, null),
        n('3', rencontres, basket),
      ],
      'Toute l’activité'
    )
    expect(
      groupes.map(g => [g.titre, g.perimetreId, g.activiteId, g.couleur])
    ).toEqual([
      ['Toute l’activité', null, 'a1', null],
      ['Basket', 'p2', 'a1', null],
      ['Natation', 'p1', 'a1', '#123456'],
    ])
  })
})

describe('placerActiviteCourante', () => {
  const notifications = [
    n('1', rencontres, natation),
    n('2', club, null),
    n('3', null, null),
  ]

  it('place l’activité affichée en tête, puis le groupe sans activité', () => {
    const groupes = placerActiviteCourante(
      grouperParActivite(notifications, 'Organisation'),
      club
    )
    expect(groupes.map(g => g.titre)).toEqual([
      'Club',
      'Organisation',
      'Rencontres',
    ])
  })

  it('garde un groupe vide pour l’activité affichée sans notification', () => {
    const groupes = placerActiviteCourante(
      grouperParActivite([n('3', null, null)], 'Organisation'),
      club
    )
    expect(
      groupes.map(g => [g.cle, g.titre, g.nonLues, g.elements.length])
    ).toEqual([
      ['a2', 'Club', 0, 0],
      ['', 'Organisation', 1, 1],
    ])
  })
})
