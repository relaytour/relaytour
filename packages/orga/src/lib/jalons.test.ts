import { describe, expect, it } from 'vitest'

import { libelleJalon } from './jalons'

const resume = (valeurs: Partial<Parameters<typeof libelleJalon>[0]>) => ({
  total: 0,
  ouvertes: 0,
  faites: 0,
  abandonnees: 0,
  enRetard: 0,
  assigneesAMoi: 0,
  ...valeurs,
})

describe('libelleJalon', () => {
  it('compte les tâches ouvertes sur les tâches gardées', () => {
    expect(
      libelleJalon(
        resume({
          total: 9,
          ouvertes: 3,
          faites: 5,
          abandonnees: 1,
          enRetard: 1,
          assigneesAMoi: 2,
        })
      )
    ).toEqual({
      titre: 'Jalon : 3 tâches ouvertes sur 8',
      details: ['1 en retard', 'dont 2 vous sont assignées', '1 abandonnée'],
    })
  })

  it('dit quand toutes les tâches liées sont faites', () => {
    expect(libelleJalon(resume({ total: 2, faites: 2 })).titre).toBe(
      'Jalon : toutes les tâches liées sont faites'
    )
  })

  it('dit quand le jalon ne lie aucune tâche', () => {
    expect(libelleJalon(resume({ total: 1, abandonnees: 1 })).titre).toBe(
      'Jalon : aucune tâche liée'
    )
  })
})
