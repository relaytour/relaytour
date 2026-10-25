import { describe, expect, it } from 'vitest'

import {
  activerLangue,
  comparerTextes,
  formatDate,
  langueActive,
  langueDeLaSession,
  langueDuVisiteur,
  LANGUES_PROPOSEES,
  majusculeInitiale,
} from './langue'

describe('langue active', () => {
  it('démarre en français, la langue source', () => {
    expect(langueActive()).toBe('fr')
    expect(LANGUES_PROPOSEES).toContain('fr')
  })

  it('trie et met en majuscule selon la langue active', () => {
    expect(['Zoé', 'élise', 'Émile'].sort(comparerTextes)).toEqual([
      'élise',
      'Émile',
      'Zoé',
    ])
    expect(majusculeInitiale('équipe')).toBe('Équipe')
  })
})

describe('langue appliquée', () => {
  it('écarte une langue que le logiciel ne propose pas', () => {
    expect(langueDuVisiteur(null, ['de-DE'])).toBe('fr')
    expect(langueDeLaSession('de', null)).toBe('fr')
  })

  it('revient au français sans choix ni langue d’organisation', () => {
    expect(langueDeLaSession(null, null)).toBe('fr')
    expect(langueDuVisiteur(null, [])).toBe('fr')
  })

  it('suit le choix de la personne avant la langue de l’organisation', () => {
    const proposee = LANGUES_PROPOSEES.at(-1)!
    expect(langueDeLaSession(proposee, 'fr')).toBe(proposee)
    expect(langueDeLaSession(null, proposee)).toBe(proposee)
  })
})

describe('activerLangue', () => {
  it('garde la dernière langue demandée quand deux demandes se croisent', async () => {
    // Le catalogue anglais n'est pas encore chargé : il arrive après la demande
    // du français, qui doit l'emporter.
    await Promise.all([activerLangue('en'), activerLangue('fr')])
    expect(langueActive()).toBe('fr')
  })

  it('change les formats de date, puis revient au français', async () => {
    const jour = new Date(Date.UTC(2027, 2, 1))
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      timeZone: 'UTC',
    }
    expect(formatDate(options).format(jour)).toBe('mars')
    await activerLangue('en')
    expect(langueActive()).toBe('en')
    expect(formatDate(options).format(jour)).toBe('March')
    await activerLangue('fr')
    expect(formatDate(options).format(jour)).toBe('mars')
  })
})
