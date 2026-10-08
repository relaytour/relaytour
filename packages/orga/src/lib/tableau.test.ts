import { describe, expect, it } from 'vitest'

import {
  LARGEUR_MAX,
  LARGEUR_MIN,
  LARGEUR_COLONNES_FIGEES,
  bornerLargeur,
  colonnesFigees,
  comparer,
  contient,
  ecrireEpingle,
  ecrireLargeurs,
  lireEpingle,
  lireLargeurs,
} from './tableau'

/** Un stockage en mémoire, avec l'interface de `localStorage`. */
function stockage(initial: Record<string, string> = {}) {
  const valeurs = new Map(Object.entries(initial))
  return {
    valeurs,
    get length() {
      return valeurs.size
    },
    clear: () => valeurs.clear(),
    key: (i: number) => [...valeurs.keys()][i] ?? null,
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void valeurs.set(cle, valeur),
    removeItem: (cle: string) => void valeurs.delete(cle),
  }
}

describe('tri des tableaux', () => {
  it('classe les textes sans tenir compte des accents ni de la casse', () => {
    const noms = ['Zoé', 'élodie', 'Emma', 'adrien']
    expect([...noms].sort(comparer)).toEqual([
      'adrien',
      'élodie',
      'Emma',
      'Zoé',
    ])
  })

  it('classe les nombres contenus dans un texte selon leur valeur', () => {
    expect(['Édition 10', 'Édition 2'].sort(comparer)).toEqual([
      'Édition 2',
      'Édition 10',
    ])
  })

  it('classe les nombres et les booléens selon leur valeur', () => {
    expect([10, 2, 33].sort(comparer)).toEqual([2, 10, 33])
    expect([true, false].sort(comparer)).toEqual([false, true])
  })

  it('place les valeurs vides après les autres', () => {
    expect(['b', null, '', 'a', undefined].sort(comparer).slice(0, 2)).toEqual([
      'a',
      'b',
    ])
    expect(comparer(null, 0)).toBeGreaterThan(0)
  })
})

describe('recherche dans une colonne', () => {
  it('ignore les accents, la casse et les espaces de bord', () => {
    expect(contient('Hélène Durand', ' helene ')).toBe(true)
    expect(contient('Hélène Durand', 'martin')).toBe(false)
  })
})

describe('largeurs des colonnes', () => {
  it('borne une largeur', () => {
    expect(bornerLargeur(3)).toBe(LARGEUR_MIN)
    expect(bornerLargeur(5000)).toBe(LARGEUR_MAX)
    expect(bornerLargeur(180.4)).toBe(180)
  })

  it('relit les largeurs enregistrées pour un tableau', () => {
    const depot = stockage()
    ecrireLargeurs('personnes', { nom: 240 }, depot)
    expect(lireLargeurs('personnes', depot)).toEqual({ nom: 240 })
    expect(lireLargeurs('editions', depot)).toEqual({})
  })

  it('efface l’entrée quand aucune largeur ne reste', () => {
    const depot = stockage()
    ecrireLargeurs('personnes', { nom: 240 }, depot)
    ecrireLargeurs('personnes', {}, depot)
    expect(depot.valeurs.size).toBe(0)
  })

  it('ignore une valeur illisible', () => {
    const cle = 'relaytour.tableau.personnes.largeurs'
    expect(lireLargeurs('personnes', stockage({ [cle]: '{' }))).toEqual({})
    expect(lireLargeurs('personnes', stockage({ [cle]: '[1]' }))).toEqual({})
    expect(
      lireLargeurs('personnes', stockage({ [cle]: '{"nom":"x","mail":9999}' }))
    ).toEqual({ mail: LARGEUR_MAX })
  })
})

describe('colonnes figées', () => {
  it('fige d’office les premières colonnes d’un tableau large', () => {
    expect(colonnesFigees(LARGEUR_COLONNES_FIGEES, false)).toBe(true)
    expect(colonnesFigees(1400, false)).toBe(true)
  })

  it('laisse le choix à la personne dans un tableau étroit', () => {
    expect(colonnesFigees(LARGEUR_COLONNES_FIGEES - 1, false)).toBe(false)
    expect(colonnesFigees(351, true)).toBe(true)
  })

  it('ne fige rien avant la première mesure, sauf choix de la personne', () => {
    expect(colonnesFigees(null, false)).toBe(false)
    expect(colonnesFigees(null, true)).toBe(true)
  })

  it('retient la punaise par tableau', () => {
    const depot = stockage()
    expect(lireEpingle('personnes', depot)).toBe(false)
    ecrireEpingle('personnes', true, depot)
    expect(lireEpingle('personnes', depot)).toBe(true)
    expect(lireEpingle('demandes', depot)).toBe(false)
    ecrireEpingle('personnes', false, depot)
    expect(lireEpingle('personnes', depot)).toBe(false)
    expect(depot.valeurs.size).toBe(0)
  })
})
