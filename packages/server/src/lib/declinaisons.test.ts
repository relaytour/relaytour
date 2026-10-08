import { describe, expect, it } from 'vitest'

import { resumerDeclinaisons } from './declinaisons.ts'

describe('resumerDeclinaisons', () => {
  it('rend des zéros pour une tâche sans déclinaison', () => {
    expect(resumerDeclinaisons([])).toEqual({
      total: 0,
      enAttente: 0,
      refusees: 0,
      acceptees: 0,
      faites: 0,
      abandonnees: 0,
    })
  })

  it('compte par accord, puis par statut parmi les déclinaisons acceptées', () => {
    expect(
      resumerDeclinaisons([
        { accord: 'EN_ATTENTE', statut: 'A_FAIRE' },
        { accord: 'REFUSE', statut: 'A_FAIRE' },
        { accord: 'ACCEPTE', statut: 'A_FAIRE' },
        { accord: 'ACCEPTE', statut: 'EN_COURS' },
        { accord: 'ACCEPTE', statut: 'FAITE' },
        { accord: 'ACCEPTE', statut: 'FAITE' },
        { accord: 'ACCEPTE', statut: 'ABANDONNEE' },
      ])
    ).toEqual({
      total: 7,
      enAttente: 1,
      refusees: 1,
      acceptees: 5,
      faites: 2,
      abandonnees: 1,
    })
  })

  it('ne compte pas le statut d’une déclinaison refusée ou en attente', () => {
    // Une déclinaison ne change pas de statut avant d'être acceptée : le résumé
    // l'ignorerait de toute façon.
    expect(
      resumerDeclinaisons([
        { accord: 'REFUSE', statut: 'FAITE' },
        { accord: 'EN_ATTENTE', statut: 'ABANDONNEE' },
      ])
    ).toMatchObject({ acceptees: 0, faites: 0, abandonnees: 0 })
  })
})
