import { describe, expect, it } from 'vitest'

import { appliquer, mettreEnForme, type Format } from './mise-en-forme'

/**
 * Écrit la sélection dans le texte : `[` et `]` la bornent, `|` marque un
 * curseur. Les tests lisent ainsi l'état de la zone avant et après.
 */
function lire(marque: string) {
  const curseur = marque.indexOf('|')
  if (curseur !== -1)
    return {
      texte: marque.replace('|', ''),
      debut: curseur,
      fin: curseur,
    }
  const debut = marque.indexOf('[[')
  const fin = marque.indexOf(']]') - 2
  return {
    texte: marque.replace('[[', '').replace(']]', ''),
    debut,
    fin,
  }
}

function formater(format: Format, marque: string) {
  const saisie = lire(marque)
  const r = mettreEnForme(format, saisie)
  const texte = appliquer(saisie.texte, r)
  const [debut, fin] = r.selection
  return debut === fin
    ? texte.slice(0, debut) + '|' + texte.slice(debut)
    : texte.slice(0, debut) +
        '[[' +
        texte.slice(debut, fin) +
        ']]' +
        texte.slice(fin)
}

describe('gras et italique', () => {
  it('entoure la sélection et la garde sélectionnée', () => {
    expect(formater('gras', 'Un [[mot]] ici')).toBe('Un **[[mot]]** ici')
    expect(formater('italique', 'Un [[mot]] ici')).toBe('Un _[[mot]]_ ici')
  })

  it('insère un exemple sélectionné sans sélection', () => {
    expect(formater('gras', 'Avant |')).toBe('Avant **[[texte en gras]]**')
  })

  it('retire la marque déjà présente autour de la sélection', () => {
    expect(formater('gras', 'Un **[[mot]]** ici')).toBe('Un [[mot]] ici')
    expect(formater('gras', 'Un [[**mot**]] ici')).toBe('Un [[mot]] ici')
  })

  it('retire deux marques vides autour du curseur', () => {
    expect(formater('gras', 'Un **|** ici')).toBe('Un | ici')
  })

  it('laisse les espaces du bord hors de la marque', () => {
    expect(formater('gras', 'Un[[ mot ]]ici')).toBe('Un **[[mot]]** ici')
  })

  it('ne confond pas l’italique avec le gras', () => {
    expect(formater('italique', '**[[mot]]**')).toBe('**_[[mot]]_**')
  })
})

describe('titres', () => {
  it('pose un titre de section sur la ligne du curseur', () => {
    expect(formater('titre2', 'Avant\nHor|aires\nAprès')).toBe(
      'Avant\n## Hor|aires\nAprès'
    )
  })

  it('remplace un titre d’un autre niveau', () => {
    expect(formater('titre3', '## Hor|aires')).toBe('### Hor|aires')
  })

  it('retire le titre du même niveau', () => {
    expect(formater('titre2', '## Hor|aires')).toBe('Hor|aires')
  })

  it('place le curseur après la marque sur une ligne vide', () => {
    expect(formater('titre2', 'Avant\n|\nAprès')).toBe('Avant\n## |\nAprès')
  })
})

describe('listes', () => {
  it('transforme chaque ligne sélectionnée en puce', () => {
    expect(formater('puces', '[[Un\nDeux]]')).toBe('[[- Un\n- Deux]]')
  })

  it('numérote les lignes sans compter les lignes vides', () => {
    expect(formater('numeros', '[[Un\n\nDeux]]')).toBe('[[1. Un\n\n2. Deux]]')
  })

  it('remplace une liste par une liste de cases à cocher', () => {
    expect(formater('cases', '[[- Un\n- Deux]]')).toBe(
      '[[- [ ] Un\n- [ ] Deux]]'
    )
  })

  it('retire les puces quand toutes les lignes en portent', () => {
    expect(formater('puces', '[[- Un\n- Deux]]')).toBe('[[Un\nDeux]]')
  })

  it('garde le retrait d’une sous-liste', () => {
    expect(formater('cases', '- Un\n  - De|ux')).toBe('- Un\n  - [ ] De|ux')
  })

  it('ne touche pas la ligne où la sélection s’arrête à son début', () => {
    expect(formater('puces', '[[Un\n]]Deux')).toBe('- [[Un\n]]Deux')
  })

  it('remplace un titre par une puce', () => {
    expect(formater('puces', '## Ti|tre')).toBe('- Ti|tre')
  })
})

describe('lien', () => {
  it('sélectionne l’adresse après un texte choisi', () => {
    expect(formater('lien', 'Voir [[le site]].')).toBe(
      'Voir [le site]([[https://]]).'
    )
  })

  it('reprend une adresse sélectionnée', () => {
    expect(formater('lien', 'Voir [[https://exemple.org]].')).toBe(
      'Voir [[[texte du lien]]](https://exemple.org).'
    )
  })

  it('insère un exemple sans sélection', () => {
    expect(formater('lien', 'Voir |')).toBe(
      'Voir [[[texte du lien]]](https://)'
    )
  })
})

describe('tableau', () => {
  it('ajoute un tableau après la ligne, séparé par une ligne vide', () => {
    expect(formater('tableau', 'Avant|\nAprès')).toBe(
      'Avant\n\n| [[Colonne 1]] | Colonne 2 |\n| --- | --- |\n| Texte | Texte |\n\nAprès'
    )
  })

  it('n’ajoute aucune ligne vide dans un texte vide', () => {
    expect(formater('tableau', '|')).toBe(
      '| [[Colonne 1]] | Colonne 2 |\n| --- | --- |\n| Texte | Texte |'
    )
  })
})
