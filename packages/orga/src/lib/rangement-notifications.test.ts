import { describe, expect, it } from 'vitest'

import {
  grouperParActivite,
  grouperParPerimetre,
  type NotificationRangee,
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
