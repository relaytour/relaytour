import { describe, expect, it } from 'vitest'

import {
  filtrerCharges,
  lireReglagesCharge,
  type LigneDeCharge,
} from './charge'

const ligne = (
  nom: string,
  ouvertes: number,
  aVenir: number,
  perimetres: [string, string][] = []
): LigneDeCharge => ({
  personne: { id: nom, nom },
  affectations: perimetres.map(([p, groupe]) => ({
    perimetre: { nom: p, groupe },
  })),
  maintenant: { total: ouvertes },
  edition: { total: ouvertes * 2 },
  places: { aVenir, total: aVenir },
})

const lignes = [
  ligne('Alex', 3, 0, [['Football', 'sport']]),
  ligne('Léa', 3, 2, [['Logistique', 'pole']]),
  ligne('Inès', 5, 0, [['Volley', 'sport']]),
]

describe('lireReglagesCharge', () => {
  it('écarte une valeur inconnue de l’adresse', () => {
    expect(
      lireReglagesCharge(new URLSearchParams('temps=demain&tri=nom'))
    ).toEqual({ temps: 'maintenant', tri: 'nom', groupe: 'tous', q: '' })
  })
})

describe('filtrerCharges', () => {
  const base = lireReglagesCharge(new URLSearchParams())

  it('trie par tâches, puis par places, puis par nom', () => {
    expect(filtrerCharges(lignes, base).map(l => l.personne.nom)).toEqual([
      'Inès',
      'Léa',
      'Alex',
    ])
  })

  it('garde un groupe et cherche dans les noms et les périmètres, sans accent', () => {
    expect(
      filtrerCharges(lignes, { ...base, groupe: 'sport' }).map(
        l => l.personne.nom
      )
    ).toEqual(['Inès', 'Alex'])
    expect(
      filtrerCharges(lignes, { ...base, q: 'logist' }).map(l => l.personne.nom)
    ).toEqual(['Léa'])
    expect(
      filtrerCharges(lignes, { ...base, q: 'ines' }).map(l => l.personne.nom)
    ).toEqual(['Inès'])
  })
})
