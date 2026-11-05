import { describe, expect, it } from 'vitest'

import { filtreProchainPoint, pointEquipeValide } from './reunions.ts'

// Point d'équipe d'une réunion (ADR 0059).

const GLOBALE = { perimetreId: null, cible: null, actuel: null }

describe('pointEquipeValide', () => {
  it('marque à la création une réunion globale qui convoque toute l’équipe', () => {
    expect(pointEquipeValide(undefined, { ...GLOBALE, cible: 'EQUIPE' })).toBe(
      true
    )
  })

  it('ne marque pas à la création une autre réunion globale', () => {
    expect(pointEquipeValide(undefined, { ...GLOBALE, cible: 'CHOIX' })).toBe(
      false
    )
    expect(pointEquipeValide(null, GLOBALE)).toBe(false)
  })

  it('suit la saisie pour une réunion globale', () => {
    expect(pointEquipeValide(false, { ...GLOBALE, cible: 'EQUIPE' })).toBe(
      false
    )
    expect(pointEquipeValide(true, { ...GLOBALE, cible: 'CHOIX' })).toBe(true)
    expect(pointEquipeValide(true, GLOBALE)).toBe(true)
  })

  it('garde la valeur actuelle quand une modification ne la saisit pas', () => {
    expect(
      pointEquipeValide(undefined, { ...GLOBALE, cible: 'EQUIPE', actuel: false })
    ).toBe(false)
    expect(
      pointEquipeValide(null, { ...GLOBALE, cible: 'CHOIX', actuel: true })
    ).toBe(true)
  })

  it('refuse le marqueur sur une réunion de périmètre', () => {
    const perimetre = { perimetreId: 'p', cible: 'EQUIPE', actuel: null } as const
    expect(() => pointEquipeValide(true, perimetre)).toThrow()
    expect(pointEquipeValide(undefined, perimetre)).toBe(false)
    expect(pointEquipeValide(false, perimetre)).toBe(false)
  })
})

describe('filtreProchainPoint', () => {
  it('ne retient que les points d’équipe globaux, prévus et à venir', () => {
    const maintenant = new Date('2026-11-05T10:00:00Z')
    expect(filtreProchainPoint('e', maintenant)).toEqual({
      editionId: 'e',
      perimetreId: null,
      pointEquipe: true,
      statut: 'PREVUE',
      debut: { gt: maintenant },
    })
  })
})
