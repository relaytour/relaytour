import { describe, expect, it } from 'vitest'

import {
  classerPriorites,
  estRetenue,
  horizon,
  noter,
  PRIORITES_PAR_PERIMETRE,
  type TacheAClasser,
} from './priorites.ts'

// Priorités d'une période (ADR 0059).

const AUJOURDHUI = '2026-11-04'

function tache(donnees: Partial<TacheAClasser> = {}): TacheAClasser {
  return {
    id: 't',
    perimetreId: 'p',
    statut: 'A_FAIRE',
    echeance: null,
    assignes: 1,
    declinaisonsActives: 0,
    declinaisonsEnAttente: 0,
    echeancesDeclinaisons: [],
    reunionsAVenir: 0,
    ajustement: null,
    ...donnees,
  }
}

const codes = (t: TacheAClasser, h = horizon(AUJOURDHUI, null)) =>
  noter(t, h).raisons.map(r => [r.code, r.points])

describe('horizon', () => {
  it('dure 14 jours sans prochain point', () => {
    expect(horizon(AUJOURDHUI, null).fin).toBe('2026-11-18')
  })

  it('s’arrête au prochain point entre 14 et 30 jours', () => {
    expect(horizon(AUJOURDHUI, '2026-11-25').fin).toBe('2026-11-25')
  })

  it('dure au moins 14 jours quand le point est proche', () => {
    expect(horizon(AUJOURDHUI, '2026-11-09').fin).toBe('2026-11-18')
  })

  it('dure au plus 30 jours quand le point est lointain', () => {
    expect(horizon(AUJOURDHUI, '2027-01-15').fin).toBe('2026-12-04')
  })
})

describe('score', () => {
  it('compte un retard récent', () => {
    expect(codes(tache({ echeance: '2026-10-30' }))).toEqual([['RETARD', 45]])
  })

  it('compte moins un retard ancien, à revoir', () => {
    const notee = noter(
      tache({ echeance: '2026-10-15' }),
      horizon(AUJOURDHUI, null)
    )
    expect(notee.raisons).toEqual([
      { code: 'RETARD_A_REVOIR', points: 30, jours: 20 },
    ])
  })

  it('compte une échéance proche et le point qui la suit', () => {
    const h = horizon(AUJOURDHUI, '2026-11-09')
    expect(codes(tache({ echeance: '2026-11-08' }), h)).toEqual([
      ['ECHEANCE_PROCHE', 35],
      ['AVANT_LE_POINT', 15],
    ])
    // Après le point, l'échéance proche compte seule.
    expect(codes(tache({ echeance: '2026-11-10' }), h)).toEqual([
      ['ECHEANCE_PROCHE', 35],
    ])
  })

  it('compte les 7 jours comme point quand aucun point n’est prévu', () => {
    expect(codes(tache({ echeance: '2026-11-11' }))).toEqual([
      ['ECHEANCE_PROCHE', 35],
      ['AVANT_LE_POINT', 15],
    ])
  })

  it('décroît avec l’échéance', () => {
    expect(codes(tache({ echeance: '2026-11-15' }))).toEqual([
      ['ECHEANCE_PROCHE', 25],
    ])
    expect(codes(tache({ echeance: '2026-11-30' }))).toEqual([
      ['ECHEANCE_PROCHE', 12],
    ])
    expect(codes(tache({ echeance: '2026-12-30' }))).toEqual([])
  })

  it('compte les liens, les personnes et le statut', () => {
    expect(
      codes(
        tache({
          statut: 'EN_COURS',
          assignes: 0,
          reunionsAVenir: 1,
          declinaisonsActives: 4,
          declinaisonsEnAttente: 1,
        })
      )
    ).toEqual([
      ['REUNION_A_VENIR', 10],
      ['DECLINAISONS', 15],
      ['ACCORD_ATTENDU', 5],
      ['A_PRENDRE', 8],
      ['EN_COURS', 3],
    ])
  })

  it('prend l’échéance la plus proche des déclinaisons d’une tâche partagée', () => {
    const notee = noter(
      tache({
        echeance: '2026-12-20',
        declinaisonsActives: 1,
        echeancesDeclinaisons: ['2026-11-06'],
      }),
      horizon(AUJOURDHUI, null)
    )
    expect(notee.echeanceRetenue).toBe('2026-11-06')
    expect(notee.score).toBe(35 + 15 + 5)
  })

  it('applique un ajustement en cours, et l’oublie une fois passé', () => {
    const h = horizon(AUJOURDHUI, null)
    const haute = { niveau: 'HAUTE' as const, jusquAu: '2026-11-18' }
    expect(noter(tache({ ajustement: haute }), h).score).toBe(20)
    const passe = { niveau: 'HAUTE' as const, jusquAu: '2026-11-03' }
    expect(noter(tache({ ajustement: passe }), h).score).toBe(0)
  })

  it('ne descend pas sous zéro', () => {
    const basse = { niveau: 'BASSE' as const, jusquAu: '2026-11-18' }
    expect(
      noter(tache({ ajustement: basse }), horizon(AUJOURDHUI, null)).score
    ).toBe(0)
  })
})

describe('tâches retenues', () => {
  const h = horizon(AUJOURDHUI, null)
  const retenue = (t: TacheAClasser) => estRetenue(noter(t, h), h)

  it('retient un retard et une échéance dans l’horizon', () => {
    expect(retenue(tache({ echeance: '2026-09-01' }))).toBe(true)
    expect(retenue(tache({ echeance: '2026-11-18' }))).toBe(true)
    expect(retenue(tache({ echeance: '2026-11-19' }))).toBe(false)
  })

  it('ne retient une tâche sans échéance que par un ajustement', () => {
    expect(retenue(tache())).toBe(false)
    expect(
      retenue(
        tache({ ajustement: { niveau: 'EPINGLEE', jusquAu: '2026-11-18' } })
      )
    ).toBe(true)
    expect(
      retenue(tache({ ajustement: { niveau: 'BASSE', jusquAu: '2026-11-18' } }))
    ).toBe(false)
  })
})

describe('classement', () => {
  const h = horizon(AUJOURDHUI, null)

  it('place les tâches épinglées en tête, puis classe par score et échéance', () => {
    const [p] = classerPriorites(
      [
        tache({ id: 'a', echeance: '2026-11-15' }),
        tache({ id: 'b', echeance: '2026-11-05' }),
        tache({
          id: 'c',
          echeance: '2026-11-17',
          ajustement: { niveau: 'EPINGLEE', jusquAu: '2026-11-18' },
        }),
        tache({ id: 'd', echeance: '2026-11-06' }),
      ],
      ['p'],
      h
    )
    expect(p!.priorites.map(n => n.tache.id)).toEqual(['c', 'b', 'd', 'a'])
  })

  it('plafonne chaque périmètre et compte le reste', () => {
    const taches = Array.from({ length: 8 }, (_, i) =>
      tache({ id: `t${i}`, echeance: '2026-11-10' })
    )
    const [p] = classerPriorites(taches, ['p'], h)
    expect(p!.priorites).toHaveLength(PRIORITES_PAR_PERIMETRE)
    expect(p!.autres).toBe(3)
  })

  it('montre la prochaine tâche d’un périmètre sans priorité', () => {
    const [vide, sans] = classerPriorites(
      [
        tache({ id: 'loin', perimetreId: 'vide', echeance: '2027-02-01' }),
        tache({ id: 'proche', perimetreId: 'vide', echeance: '2026-12-30' }),
        tache({ id: 'libre', perimetreId: 'vide' }),
      ],
      ['vide', 'sans'],
      h
    )
    expect(vide!.priorites).toEqual([])
    expect(vide!.ensuite?.id).toBe('proche')
    expect(sans!.ensuite).toBeNull()
  })

  it('suit l’ordre des périmètres reçus et ignore les autres', () => {
    const resultat = classerPriorites(
      [
        tache({ id: 'x', perimetreId: 'z', echeance: '2026-11-05' }),
        tache({ id: 'y', perimetreId: 'a', echeance: '2026-11-05' }),
        tache({ id: 'w', perimetreId: 'inconnu', echeance: '2026-11-05' }),
      ],
      ['z', 'a'],
      h
    )
    expect(resultat.map(p => p.perimetreId)).toEqual(['z', 'a'])
    expect(resultat.flatMap(p => p.priorites.map(n => n.tache.id))).toEqual([
      'x',
      'y',
    ])
  })
})
