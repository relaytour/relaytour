import { describe, expect, it } from 'vitest'

import {
  libelleDeclinaisons,
  regrouperDeclinaisons,
  type ResumeDeclinaisons,
} from './declinaisons'

const resume = (r: Partial<ResumeDeclinaisons>): ResumeDeclinaisons => ({
  total: 0,
  enAttente: 0,
  refusees: 0,
  acceptees: 0,
  faites: 0,
  abandonnees: 0,
  ...r,
})

describe('libelleDeclinaisons', () => {
  it('accorde le nombre de périmètres', () => {
    expect(libelleDeclinaisons(resume({ total: 1 })).titre).toBe(
      'Déclinée dans 1 périmètre'
    )
    expect(libelleDeclinaisons(resume({ total: 9 })).titre).toBe(
      'Déclinée dans 9 périmètres'
    )
  })

  it('compte les tâches faites parmi celles que les périmètres gardent', () => {
    expect(
      libelleDeclinaisons(resume({ total: 9, acceptees: 9, faites: 6 })).details
    ).toEqual(['6 faites sur 9'])
    expect(
      libelleDeclinaisons(resume({ total: 3, acceptees: 3, faites: 1 })).details
    ).toEqual(['1 faite sur 3'])
    // Une déclinaison abandonnée ne reste pas à faire.
    expect(
      libelleDeclinaisons(
        resume({ total: 4, acceptees: 4, faites: 3, abandonnees: 1 })
      ).details
    ).toEqual(['toutes faites', '1 abandonnée'])
    expect(
      libelleDeclinaisons(resume({ total: 1, acceptees: 1, faites: 1 })).details
    ).toEqual(['faite'])
  })

  it('signale les déclinaisons en attente et refusées', () => {
    expect(
      libelleDeclinaisons(
        resume({ total: 5, acceptees: 2, faites: 0, enAttente: 2, refusees: 1 })
      ).details
    ).toEqual(['0 faite sur 2', '2 en attente d’accord', '1 refusée'])
    expect(
      libelleDeclinaisons(resume({ total: 2, enAttente: 2 })).details
    ).toEqual(['2 en attente d’accord'])
    expect(
      libelleDeclinaisons(resume({ total: 2, refusees: 2 })).details
    ).toEqual(['2 refusées'])
  })
})

describe('regrouperDeclinaisons', () => {
  const tache = (
    id: string,
    origine: string | null,
    echeance: string | null = '2027-01-10'
  ) => ({
    id,
    titre: `Tâche ${id}`,
    echeance,
    origine: origine === null ? null : { id: origine },
  })
  const forme = (taches: ReturnType<typeof tache>[]) =>
    regrouperDeclinaisons(taches).map(l =>
      l.sorte === 'tache' ? l.tache.id : l.taches.map(t => t.id)
    )

  it('réunit les déclinaisons d’une même tâche partagée à la même échéance', () => {
    expect(
      forme([
        tache('a', null),
        tache('b', 'x'),
        tache('c', null),
        tache('d', 'x'),
        tache('e', 'x'),
      ])
    ).toEqual(['a', ['b', 'd', 'e'], 'c'])
  })

  it('garde seule une déclinaison sans autre déclinaison le même jour', () => {
    expect(
      forme([
        tache('a', 'x'),
        tache('b', 'x', '2027-02-01'),
        tache('c', 'y'),
        tache('d', 'x', null),
      ])
    ).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ne mélange pas deux tâches partagées', () => {
    expect(
      forme([
        tache('a', 'x'),
        tache('b', 'y'),
        tache('c', 'x'),
        tache('d', 'y'),
      ])
    ).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ])
  })

  it('réunit aussi des déclinaisons sans échéance', () => {
    expect(forme([tache('a', 'x', null), tache('b', 'x', null)])).toEqual([
      ['a', 'b'],
    ])
  })

  it('nomme le groupe par le titre de sa première déclinaison', () => {
    const [groupe] = regrouperDeclinaisons([tache('a', 'x'), tache('b', 'x')])
    expect(groupe).toMatchObject({ sorte: 'declinaisons', titre: 'Tâche a' })
  })
})
