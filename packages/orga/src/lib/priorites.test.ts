import { describe, expect, it } from 'vitest'

import {
  ecrireFiltre,
  FILTRE_PAR_DEFAUT,
  filtrerPriorites,
  lireFiltre,
} from './priorites'

// Filtre des priorités (ADR 0059) : il ne change ni le score ni l'ordre.

function depot(): Storage {
  const valeurs = new Map<string, string>()
  return {
    getItem: cle => valeurs.get(cle) ?? null,
    setItem: (cle, valeur) => void valeurs.set(cle, valeur),
    removeItem: cle => void valeurs.delete(cle),
    clear: () => valeurs.clear(),
    key: () => null,
    get length() {
      return valeurs.size
    },
  }
}

const perimetres = [
  {
    perimetre: { id: 'natation', groupe: 'sport' },
    priorites: [
      { tache: { id: 'a', assignes: [{}] } },
      { tache: { id: 'b', assignes: [] } },
    ],
  },
  {
    perimetre: { id: 'buvette', groupe: 'pole' },
    priorites: [{ tache: { id: 'c', assignes: [{}] } }],
  },
]

const ids = (
  liste: {
    perimetre: { id: string }
    priorites: { tache: { id: string } }[]
  }[]
) => liste.map(p => [p.perimetre.id, p.priorites.map(x => x.tache.id)])

describe('filtrerPriorites', () => {
  it('montre tout par défaut, dans l’ordre reçu', () => {
    expect(
      ids(filtrerPriorites(perimetres, FILTRE_PAR_DEFAUT, new Set()))
    ).toEqual([
      ['natation', ['a', 'b']],
      ['buvette', ['c']],
    ])
  })

  it('garde les périmètres de la personne', () => {
    const filtre = { ...FILTRE_PAR_DEFAUT, mesPerimetres: true }
    expect(
      ids(filtrerPriorites(perimetres, filtre, new Set(['buvette'])))
    ).toEqual([['buvette', ['c']]])
  })

  it('garde les tâches à prendre et retire les périmètres vides', () => {
    const filtre = { ...FILTRE_PAR_DEFAUT, aPrendre: true }
    expect(ids(filtrerPriorites(perimetres, filtre, new Set()))).toEqual([
      ['natation', ['b']],
    ])
  })

  it('garde un groupe de périmètres', () => {
    const filtre = { ...FILTRE_PAR_DEFAUT, groupe: 'pole' }
    expect(ids(filtrerPriorites(perimetres, filtre, new Set()))).toEqual([
      ['buvette', ['c']],
    ])
  })
})

describe('mémoire du filtre', () => {
  it('relit le filtre enregistré pour une activité', () => {
    const d = depot()
    const filtre = { mesPerimetres: true, aPrendre: false, groupe: 'sport' }
    ecrireFiltre('timm', filtre, d)
    expect(lireFiltre('timm', d)).toEqual(filtre)
    expect(lireFiltre('autre', d)).toEqual(FILTRE_PAR_DEFAUT)
  })

  it('ignore une valeur illisible ou un stockage absent', () => {
    const d = depot()
    d.setItem('relaytour.priorites.timm', '{pas du json')
    expect(lireFiltre('timm', d)).toEqual(FILTRE_PAR_DEFAUT)
    expect(lireFiltre('timm', null)).toEqual(FILTRE_PAR_DEFAUT)
  })
})
