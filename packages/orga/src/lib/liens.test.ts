import { describe, expect, it } from 'vitest'

import { decouperLiens } from './liens'

const ORIGINE = 'https://orga.exemple.org'
const liens = (texte: string) =>
  decouperLiens(texte, ORIGINE).filter(s => s.href !== undefined)

describe('decouperLiens', () => {
  it('rend un texte sans adresse tel quel', () => {
    expect(decouperLiens('Bassin réservé.\nÀ confirmer.', ORIGINE)).toEqual([
      { texte: 'Bassin réservé.\nÀ confirmer.' },
    ])
    expect(decouperLiens('', ORIGINE)).toEqual([])
  })

  it('ouvre une adresse externe ailleurs', () => {
    expect(
      decouperLiens(
        'Devis : https://piscine.exemple.fr/devis?id=3 reçu',
        ORIGINE
      )
    ).toEqual([
      { texte: 'Devis : ' },
      {
        texte: 'https://piscine.exemple.fr/devis?id=3',
        href: 'https://piscine.exemple.fr/devis?id=3',
        interne: null,
      },
      { texte: ' reçu' },
    ])
  })

  it('reconnaît une adresse de l’espace organisateur', () => {
    expect(
      liens(`Voir ${ORIGINE}/rencontres/fiches/accueil?edition=e1#materiel`)
    ).toEqual([
      {
        texte: `${ORIGINE}/rencontres/fiches/accueil?edition=e1#materiel`,
        href: `${ORIGINE}/rencontres/fiches/accueil?edition=e1#materiel`,
        interne: '/rencontres/fiches/accueil?edition=e1#materiel',
      },
    ])
  })

  it('traite une autre origine, un autre port ou un chemin du serveur comme externe', () => {
    for (const adresse of [
      'https://orga.exemple.org.pirate.test/rencontres',
      'https://orga.exemple.org:8443/rencontres',
      'http://orga.exemple.org/rencontres',
      `${ORIGINE}/medias/logo.png`,
      `${ORIGINE}/graphql`,
    ]) {
      expect(liens(adresse)[0]?.interne).toBeNull()
    }
  })

  it('laisse la ponctuation de la phrase hors de l’adresse', () => {
    expect(
      liens('Lisez https://exemple.org/a, puis (https://exemple.org/b).')
    ).toEqual([
      {
        texte: 'https://exemple.org/a',
        href: 'https://exemple.org/a',
        interne: null,
      },
      {
        texte: 'https://exemple.org/b',
        href: 'https://exemple.org/b',
        interne: null,
      },
    ])
    expect(
      liens('https://fr.wikipedia.org/wiki/Relais_(sport)')[0]?.texte
    ).toBe('https://fr.wikipedia.org/wiki/Relais_(sport)')
  })

  it('ne rend cliquable que http et https', () => {
    expect(
      liens(
        'javascript:alert(1) mailto:a@exemple.org ftp://exemple.org www.exemple.org'
      )
    ).toEqual([])
    expect(liens('http://')).toEqual([])
  })

  it('garde tout le texte, dans l’ordre', () => {
    const texte = 'a https://exemple.org/x. b\nhttps://exemple.org/y c'
    expect(
      decouperLiens(texte, ORIGINE)
        .map(s => s.texte)
        .join('')
    ).toBe(texte)
  })
})
