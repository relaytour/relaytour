import { describe, expect, it } from 'vitest'

import { lienModeDEmploi, listeDesModesDEmploi } from './modes-d-emploi.ts'

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

describe('listeDesModesDEmploi', () => {
  const site = { MODES_D_EMPLOI_URL: 'https://relaytour.org/modes-d-emploi/' }
  const hebergeur = { MODES_D_EMPLOI_URL: 'https://aide.exemple.org/guides/' }

  it('garde la liste déclarée en français', () => {
    expect(listeDesModesDEmploi(site, 'fr')).toBe(site.MODES_D_EMPLOI_URL)
    expect(listeDesModesDEmploi(hebergeur, 'fr')).toBe(
      hebergeur.MODES_D_EMPLOI_URL
    )
  })

  it('lie la version anglaise du site de Relaytour', () => {
    expect(listeDesModesDEmploi(site, 'en')).toBe(
      'https://relaytour.org/en/modes-d-emploi/'
    )
  })

  it('suit la liste anglaise d’un hébergeur, sinon sa liste française', () => {
    expect(
      listeDesModesDEmploi(
        { ...hebergeur, MODES_D_EMPLOI_URL_EN: 'https://aide.exemple.org/en/' },
        'en'
      )
    ).toBe('https://aide.exemple.org/en/')
    expect(listeDesModesDEmploi(hebergeur, 'en')).toBe(
      hebergeur.MODES_D_EMPLOI_URL
    )
  })
})
