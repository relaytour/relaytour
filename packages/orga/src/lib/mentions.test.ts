import { describe, expect, it } from 'vitest'

import { decouper, mentionnes, type Mentions } from './mentions'

const perimetre = (slug: string, groupe: string) => ({
  id: slug,
  slug,
  nom: slug,
  couleur: null,
  groupe,
})

const MENTIONS: Mentions = {
  perimetres: new Map([
    ['logistique', perimetre('logistique', 'pole')],
    ['natation', perimetre('natation', 'sport')],
  ]),
  groupes: new Map([
    [
      'sport',
      { libelle: 'Sports', perimetres: [perimetre('natation', 'sport')] },
    ],
  ]),
}

describe('decouper', () => {
  it('reconnaît un périmètre et un groupe', () => {
    expect(decouper('Voir @logistique et @groupe:sport.', MENTIONS)).toEqual([
      { type: 'texte', valeur: 'Voir ' },
      { type: 'perimetre', valeur: '@logistique', cle: 'logistique' },
      { type: 'texte', valeur: ' et ' },
      { type: 'groupe', valeur: '@groupe:sport', cle: 'sport' },
      { type: 'texte', valeur: '.' },
    ])
  })

  it('laisse une mention inconnue en texte', () => {
    expect(decouper('Voir @escrime', MENTIONS)).toEqual([
      { type: 'texte', valeur: 'Voir @escrime' },
    ])
    expect(decouper('@groupe:commission', MENTIONS)).toEqual([
      { type: 'texte', valeur: '@groupe:commission' },
    ])
  })

  it('ne lit pas une adresse comme une mention', () => {
    expect(decouper('logistique@exemple.org', MENTIONS)).toEqual([
      { type: 'texte', valeur: 'logistique@exemple.org' },
    ])
  })

  it('reconnaît une mention en début de texte ou entre parenthèses', () => {
    expect(decouper('(@natation)', MENTIONS).map(s => s.type)).toEqual([
      'texte',
      'perimetre',
      'texte',
    ])
    expect(decouper('@natation', MENTIONS)[0]?.type).toBe('perimetre')
  })
})

describe('mentionnes', () => {
  it('liste les périmètres et les groupes sans doublon', () => {
    expect(
      mentionnes('@natation, @natation et @groupe:sport', MENTIONS)
    ).toEqual({ perimetres: ['natation'], groupes: ['sport'] })
  })
})
