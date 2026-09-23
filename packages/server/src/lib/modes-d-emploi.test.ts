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

  it('ajoute la barre finale quand la base n’en a pas', () => {
    expect(
      lienModeDEmploi('https://hebergeur.exemple.org/aide', 'referent')
    ).toBe('https://hebergeur.exemple.org/aide/referent.html')
  })
})
