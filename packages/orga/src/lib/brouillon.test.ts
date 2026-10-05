import { describe, expect, it } from 'vitest'

import {
  cleBrouillon,
  ecrireBrouillon,
  effacerBrouillon,
  effacerLesBrouillons,
  lireBrouillon,
} from './brouillon'

/** Un stockage en mémoire, avec l'interface de `localStorage`. */
function stockage(initial: Record<string, string> = {}) {
  const valeurs = new Map(Object.entries(initial))
  return {
    valeurs,
    get length() {
      return valeurs.size
    },
    key: (i: number) => [...valeurs.keys()][i] ?? null,
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void valeurs.set(cle, valeur),
    removeItem: (cle: string) => void valeurs.delete(cle),
  }
}

const brouillon = {
  titre: 'Réserver la piscine',
  contenu: '## Objectif\n\nRéserver tôt.',
  versionDeDepart: 'v1',
  enregistreLe: '2026-10-05T09:00:00.000Z',
}

describe('brouillon de fiche', () => {
  const cle = cleBrouillon({
    organisation: 'rencontres',
    activite: 'tournoi',
    fiche: 'f1',
  })

  it('sépare les organisations, les activités et les fiches', () => {
    expect(cle).toBe('relaytour.brouillon.rencontres.tournoi.f1')
    expect(
      cleBrouillon({ organisation: null, activite: 'tournoi', fiche: 'f1' })
    ).toBe('relaytour.brouillon.unique.tournoi.f1')
  })

  it('relit ce qu’il a écrit, puis l’efface', () => {
    const s = stockage()
    expect(lireBrouillon(cle, s)).toBeNull()
    ecrireBrouillon(cle, brouillon, s)
    expect(lireBrouillon(cle, s)).toEqual(brouillon)
    effacerBrouillon(cle, s)
    expect(lireBrouillon(cle, s)).toBeNull()
  })

  it('ignore une valeur illisible ou incomplète', () => {
    expect(lireBrouillon(cle, stockage({ [cle]: '{' }))).toBeNull()
    expect(
      lireBrouillon(cle, stockage({ [cle]: JSON.stringify({ titre: 'Seul' }) }))
    ).toBeNull()
    expect(lireBrouillon(cle, null)).toBeNull()
  })

  it('ne lève pas quand le stockage refuse l’écriture', () => {
    const plein = {
      ...stockage(),
      setItem: () => {
        throw new Error('Quota dépassé.')
      },
    }
    expect(() => ecrireBrouillon(cle, brouillon, plein)).not.toThrow()
    expect(() => ecrireBrouillon(cle, brouillon, null)).not.toThrow()
  })

  it('efface tous les brouillons à la déconnexion, et rien d’autre', () => {
    const s = stockage({ 'relaytour.organisation': 'rencontres' })
    ecrireBrouillon(cle, brouillon, s)
    ecrireBrouillon(`${cle}-bis`, brouillon, s)
    effacerLesBrouillons(s)
    expect([...s.valeurs.keys()]).toEqual(['relaytour.organisation'])
  })
})
