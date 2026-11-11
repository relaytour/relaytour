import { describe, expect, it } from 'vitest'

import { adresseComplete, titreEtLien } from './partage'

describe('liens de partage', () => {
  it('compose une adresse complète depuis un chemin', () => {
    expect(
      adresseComplete('/rencontres/taches/abc', 'https://orga.exemple.org')
    ).toBe('https://orga.exemple.org/rencontres/taches/abc')
  })

  it('place le titre puis le lien, et échappe le HTML', () => {
    const { texte, html } = titreEtLien(
      'Réserver <la salle> & le car',
      'https://orga.exemple.org/r/taches/1?a=1&b=2'
    )
    expect(texte).toBe(
      'Réserver <la salle> & le car\nhttps://orga.exemple.org/r/taches/1?a=1&b=2'
    )
    expect(html).toBe(
      '<a href="https://orga.exemple.org/r/taches/1?a=1&amp;b=2">Réserver &lt;la salle&gt; &amp; le car</a>'
    )
  })
})
