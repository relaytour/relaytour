import { describe, expect, it } from 'vitest'

import { lienModeDEmploi } from './modes-d-emploi.ts'

describe('lienModeDEmploi', () => {
  it('lie la page de chaque rôle sous la liste', () => {
    const base = 'https://relaytour.org/modes-d-emploi/'
    expect(lienModeDEmploi(base, 'admin-organisation')).toBe(
      'https://relaytour.org/modes-d-emploi/admin-organisation.html'
    )
    expect(lienModeDEmploi(base, 'admin-activite')).toBe(
      'https://relaytour.org/modes-d-emploi/admin-activite.html'
    )
    expect(lienModeDEmploi(base, 'referent')).toBe(
      'https://relaytour.org/modes-d-emploi/referent.html'
    )
  })

  it('se place à côté d’une liste donnée comme page', () => {
    expect(
      lienModeDEmploi(
        'https://docs.exemple.org/modes-d-emploi/index.html',
        'admin-organisation'
      )
    ).toBe('https://docs.exemple.org/modes-d-emploi/admin-organisation.html')
  })

  it('ignore la requête et l’ancre de la liste', () => {
    expect(
      lienModeDEmploi('https://exemple.org/aide/?langue=fr#roles', 'referent')
    ).toBe('https://exemple.org/aide/referent.html')
  })

  it('ajoute la barre finale quand la base n’en a pas', () => {
    expect(
      lienModeDEmploi('https://hebergeur.exemple.org/aide', 'referent')
    ).toBe('https://hebergeur.exemple.org/aide/referent.html')
  })
})
