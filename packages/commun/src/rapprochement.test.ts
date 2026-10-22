import { describe, expect, it } from 'vitest'

import {
  cleNom,
  cleTelephone,
  distance,
  indexerFiches,
  nomVide,
  pairesRapprochees,
  rapprocher,
  regrouper,
} from './index.ts'

describe('clés de comparaison', () => {
  it('ramène un téléphone au format international', () => {
    expect(cleTelephone('06 12 34 56 78')).toBe('+33612345678')
    expect(cleTelephone('+33 6 12 34 56 78')).toBe('+33612345678')
    expect(cleTelephone('0033 6 12 34 56 78')).toBe('+33612345678')
    expect(cleTelephone('12 34')).toBeNull()
  })

  it('compare un nom sans accent, sans casse, dans les deux ordres', () => {
    expect(cleNom('Élodie  MARTIN')).toBe(cleNom('martin elodie'))
    expect(cleNom('Jean-Paul Roux')).toBe('jean paul roux')
  })

  it('tient pour vide un numéro de billet ou des chiffres seuls', () => {
    expect(nomVide('#12345')).toBe(true)
    expect(nomVide(' 4521 ')).toBe(true)
    expect(nomVide('')).toBe(true)
    expect(nomVide('Camille 2')).toBe(false)
  })

  it('borne la distance d’édition', () => {
    expect(distance('martin', 'martine')).toBe(1)
    expect(distance('martin', 'bernard')).toBe(3)
  })
})

describe('rapprocher', () => {
  it('donne un niveau fort, moyen ou faible', () => {
    expect(
      rapprocher(
        { nom: 'A', courriel: 'Lou@Exemple.org' },
        { nom: 'B', courriel: 'lou@exemple.org' }
      )
    ).toBe('FORT')
    expect(
      rapprocher(
        { nom: 'A', telephone: '06 12 34 56 78' },
        { nom: 'B', telephone: '+33612345678' }
      )
    ).toBe('MOYEN')
    expect(
      rapprocher({ nom: 'Camille Martin' }, { nom: 'Martin Camile' })
    ).toBe('FAIBLE')
    expect(rapprocher({ nom: 'Lou Roux' }, { nom: 'Léa Roux' })).toBeNull()
  })

  it('ne rapproche pas deux noms d’initiales différentes', () => {
    expect(
      rapprocher({ nom: 'Camille Martin' }, { nom: 'Kamille Martin' })
    ).toBeNull()
  })
})

describe('regrouper', () => {
  it('réunit les lignes d’une même personne, et garde l’ordre', () => {
    const lignes = [
      { nom: 'Camille Martin', courriel: 'camille@exemple.org', poste: 'bar' },
      { nom: 'Lou Roux', courriel: null, poste: 'accueil' },
      { nom: 'martin camille', courriel: null, poste: 'buvette' },
      { nom: 'C. M.', courriel: 'CAMILLE@exemple.org', poste: 'photo' },
    ]
    expect(regrouper(lignes).map(g => g.map(l => l.poste))).toEqual([
      ['bar', 'buvette', 'photo'],
      ['accueil'],
    ])
  })

  it('ne réunit pas deux lignes sans nom ni coordonnée', () => {
    expect(regrouper([{ nom: '#1' }, { nom: '#2' }])).toHaveLength(2)
  })
})

describe('pairesRapprochees', () => {
  it('trouve les paires sans comparer toute la liste, les plus fortes d’abord', () => {
    const paires = pairesRapprochees([
      { nom: 'Camille Martin', telephone: '06 12 34 56 78' },
      { nom: 'Lou Roux', courriel: 'lou@exemple.org' },
      { nom: 'Camille Martine' },
      { nom: 'Louise Roux', courriel: 'LOU@exemple.org' },
    ])
    expect(paires.map(p => [p.a.nom, p.b.nom, p.niveau])).toEqual([
      ['Lou Roux', 'Louise Roux', 'FORT'],
      ['Camille Martin', 'Camille Martine', 'FAIBLE'],
    ])
  })
})

describe('indexerFiches', () => {
  it('trouve la fiche la plus proche d’une personne', () => {
    const chercher = indexerFiches([
      { id: 'a', nom: 'Camille Martin', courriel: 'camille@exemple.org' },
      { id: 'b', nom: 'Lou Roux', telephone: '06 12 34 56 78' },
    ])
    expect(chercher({ nom: 'X', courriel: 'CAMILLE@exemple.org' })).toEqual({
      fiche: expect.objectContaining({ id: 'a' }) as unknown,
      niveau: 'FORT',
    })
    expect(chercher({ nom: 'X', telephone: '+33612345678' })?.fiche.id).toBe(
      'b'
    )
    expect(chercher({ nom: 'Martin Camile' })?.niveau).toBe('FAIBLE')
    expect(chercher({ nom: 'Personne Inconnue' })).toBeNull()
  })
})
