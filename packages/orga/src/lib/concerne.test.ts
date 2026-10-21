import { describe, expect, it } from 'vitest'

import {
  aProposer,
  largeDiffusion,
  mentionEnCours,
  perimetresConcernes,
  suggestions,
} from './concerne'
import type { Mentions } from './mentions'

const perimetre = (id: string, nom: string, groupe: string) => ({
  id,
  slug: id,
  nom,
  couleur: null,
  groupe,
})

const NATATION = perimetre('natation', 'Natation', 'sport')
const VOLLEY = perimetre('volley', 'Volley', 'sport')
const LIEUX = perimetre('lieux', 'Lieux', 'pole')
const ACCUEIL = perimetre('accueil', 'Accueil', 'pole')

const MENTIONS: Mentions = {
  perimetres: new Map([NATATION, VOLLEY, LIEUX, ACCUEIL].map(p => [p.slug, p])),
  groupes: new Map([
    ['sport', { libelle: 'Sports', perimetres: [NATATION, VOLLEY] }],
    ['pole', { libelle: 'Pôles', perimetres: [LIEUX, ACCUEIL] }],
  ]),
}

describe('perimetresConcernes', () => {
  it('réunit la liste et les groupes, sans le périmètre de la fiche', () => {
    expect([
      ...perimetresConcernes(
        { perimetres: ['natation'], groupes: ['pole'] },
        MENTIONS,
        'lieux'
      ),
    ]).toEqual(['natation', 'accueil'])
  })
})

describe('largeDiffusion', () => {
  it('demande au moins quatre périmètres et plus de la moitié', () => {
    expect(largeDiffusion(3, 4)).toBe(false)
    expect(largeDiffusion(4, 6)).toBe(true)
    expect(largeDiffusion(4, 8)).toBe(false)
    expect(largeDiffusion(5, 8)).toBe(true)
  })
})

describe('aProposer', () => {
  it('propose les mentions absentes de la liste, jamais le périmètre de la fiche', () => {
    expect(
      aProposer(
        'Voir @natation, @lieux et @groupe:sport.',
        MENTIONS,
        { perimetres: [], groupes: [] },
        'lieux'
      )
    ).toEqual({ perimetres: ['natation'], groupes: ['sport'] })
  })

  it('ne propose rien de déjà présent', () => {
    expect(
      aProposer(
        '@natation @groupe:sport',
        MENTIONS,
        { perimetres: ['natation'], groupes: ['sport'] },
        'lieux'
      )
    ).toEqual({ perimetres: [], groupes: [] })
  })
})

describe('mentionEnCours', () => {
  it('lit le début d’une mention avant le curseur', () => {
    expect(mentionEnCours('Voir @nat')).toEqual({ debut: 5, requete: 'nat' })
    expect(mentionEnCours('@')).toEqual({ debut: 0, requete: '' })
    expect(mentionEnCours('Voir @groupe:sp')).toEqual({
      debut: 5,
      requete: 'groupe:sp',
    })
  })

  it('ignore une adresse et un texte sans mention', () => {
    expect(mentionEnCours('contact@exe')).toBeNull()
    expect(mentionEnCours('Voir @natation ')).toBeNull()
  })
})

describe('suggestions', () => {
  it('propose les périmètres puis les groupes qui répondent', () => {
    expect(suggestions('', MENTIONS).map(s => s.texte)).toEqual([
      '@natation',
      '@volley',
      '@lieux',
      '@accueil',
      '@groupe:sport',
      '@groupe:pole',
    ])
    expect(suggestions('po', MENTIONS).map(s => s.texte)).toEqual([
      '@groupe:pole',
    ])
    expect(suggestions('groupe:s', MENTIONS).map(s => s.texte)).toEqual([
      '@groupe:sport',
    ])
  })

  it('cherche aussi dans le nom, sans tenir compte des accents', () => {
    expect(suggestions('acc', MENTIONS).map(s => s.libelle)).toEqual([
      'Accueil',
    ])
  })
})
