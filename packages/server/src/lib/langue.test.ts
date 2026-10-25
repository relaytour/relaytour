import { describe, expect, it } from 'vitest'

import {
  avecLangue,
  i18n,
  langueCourante,
  langueDe,
  languesDuNavigateur,
  preciserLangue,
} from './langue.ts'

describe('languesDuNavigateur', () => {
  it('range les langues par préférence et écarte les poids nuls', () => {
    expect(
      languesDuNavigateur('fr-CA;q=0.5, en-GB, de;q=0.8, *;q=0.1')
    ).toEqual(['en-GB', 'de', 'fr-CA'])
    expect(languesDuNavigateur('en;q=0, fr')).toEqual(['fr'])
  })

  it('renvoie une liste vide sans en-tête', () => {
    expect(languesDuNavigateur(undefined)).toEqual([])
    expect(languesDuNavigateur('')).toEqual([])
  })
})

describe('langueDe', () => {
  it('suit le choix de la personne avant la langue de l’organisation', () => {
    expect(langueDe('en', 'fr')).toBe('en')
    expect(langueDe(null, 'en')).toBe('en')
  })

  it('fait passer le navigateur avant l’organisation, sans choix', () => {
    expect(langueDe(null, 'fr', ['en-US'])).toBe('en')
    expect(langueDe(null, 'en', ['de-DE'])).toBe('en')
  })

  it('écarte une langue inconnue et revient au français', () => {
    expect(langueDe('de', null)).toBe('fr')
    expect(langueDe(null, undefined)).toBe('fr')
  })
})

describe('avecLangue', () => {
  it('pose la langue pour la durée de l’appel, appels asynchrones compris', async () => {
    expect(langueCourante()).toBe('fr')
    const lue = await avecLangue('en', async () => {
      await Promise.resolve()
      return langueCourante()
    })
    expect(lue).toBe('en')
    expect(langueCourante()).toBe('fr')
  })

  it('laisse le contexte préciser la langue d’une requête en cours', () => {
    const lue = avecLangue('fr', () => {
      preciserLangue('en')
      return langueCourante()
    })
    expect(lue).toBe('en')
    // Hors d'une requête, préciser la langue ne change rien.
    preciserLangue('en')
    expect(langueCourante()).toBe('fr')
  })

  it('traduit avec ses variables dans la langue de l’appel', () => {
    const texte = (langue: 'fr' | 'en') =>
      avecLangue(langue, () =>
        i18n._('{libelle} est obligatoire.', { libelle: 'Name' })
      )
    expect(texte('fr')).toBe('Name est obligatoire.')
    expect(texte('en')).toBe('Name is required.')
  })

  it('garde le texte français d’un message absent du catalogue', () => {
    const texte = avecLangue('en', () =>
      i18n._('Message absent du catalogue : {valeur}.', { valeur: 42 })
    )
    expect(texte).toBe('Message absent du catalogue : 42.')
  })
})
