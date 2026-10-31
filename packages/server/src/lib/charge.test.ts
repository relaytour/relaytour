import { describe, expect, it } from 'vitest'

import {
  calculerCharges,
  phaseDeLEcheance,
  type TacheDeCharge,
} from './charge.ts'
import { PHASES_PAR_DEFAUT } from './phases.ts'

const base = {
  places: [],
  affectations: [],
  aujourdhui: '2027-06-10',
  maintenant: new Date('2027-06-10T10:00:00Z'),
  debutEdition: new Date('2027-08-27'),
  phases: PHASES_PAR_DEFAUT,
}

const tache = (
  echeance: string | null,
  assignes: string[],
  statut: TacheDeCharge['statut'] = 'A_FAIRE',
  credites: string[] = []
): TacheDeCharge => ({
  statut,
  echeance: echeance ? new Date(echeance) : null,
  assignes,
  credites,
})

describe('calculerCharges', () => {
  it('range les tâches ouvertes par échéance, avec la limite des 7 jours', () => {
    const [alice] = calculerCharges({
      ...base,
      taches: [
        tache('2027-06-09', ['a']),
        tache('2027-06-10', ['a']),
        tache('2027-06-17', ['a']),
        tache('2027-06-18', ['a']),
        tache(null, ['a']),
      ],
    })
    expect(alice!.maintenant).toEqual({
      total: 5,
      enRetard: 1,
      proches: 2,
      plusTard: 1,
      sansEcheance: 1,
      partagees: 0,
    })
  })

  it('compte une tâche à plusieurs pour chaque personne, comme partagée', () => {
    const charges = calculerCharges({
      ...base,
      taches: [tache('2027-07-01', ['a', 'b'])],
    })
    for (const c of charges) {
      expect(c.maintenant).toMatchObject({ total: 1, partagees: 1 })
    }
  })

  it('compte toute l’édition par statut, sans les tâches terminées dans « maintenant »', () => {
    const [b] = calculerCharges({
      ...base,
      taches: [
        tache('2027-07-01', ['b'], 'EN_COURS'),
        tache('2027-07-01', ['b'], 'FAITE', ['b', 'c']),
        tache('2027-07-01', ['b'], 'ABANDONNEE'),
      ],
    })
    expect(b!.userId).toBe('b')
    expect(b!.edition).toMatchObject({
      total: 3,
      enCours: 1,
      faites: 1,
      abandonnees: 1,
    })
    expect(b!.maintenant.total).toBe(1)
    expect(b!.realisees).toBe(1)
  })

  it('crédite une tâche faite à chaque personne réalisatrice, même non assignée', () => {
    const charges = calculerCharges({
      ...base,
      taches: [tache('2027-07-01', ['a'], 'FAITE', ['a', 'c'])],
    })
    expect(charges.find(c => c.userId === 'c')?.realisees).toBe(1)
    expect(charges.find(c => c.userId === 'a')?.realisees).toBe(1)
  })

  it('range les tâches assignées par phase, les tâches sans échéance à part', () => {
    const [a] = calculerCharges({
      ...base,
      taches: [
        tache('2027-03-01', ['a']), // J-179 : lancement
        tache('2027-08-26', ['a']), // J-1 : derniers réglages
        tache(null, ['a']),
      ],
    })
    const totaux = Object.fromEntries(
      a!.edition.parPhase.map(p => [p.cle ?? 'sans', p.total])
    )
    expect(totaux).toMatchObject({
      [PHASES_PAR_DEFAUT[0]!.cle]: 1,
      [PHASES_PAR_DEFAUT[2]!.cle]: 1,
      sans: 1,
    })
  })

  it('compte les places à venir et la prochaine', () => {
    const [c] = calculerCharges({
      ...base,
      taches: [],
      places: [
        {
          userId: 'c',
          debut: new Date('2027-06-01T08:00:00Z'),
          fin: new Date('2027-06-01T10:00:00Z'),
        },
        {
          userId: 'c',
          debut: new Date('2027-08-28T08:00:00Z'),
          fin: new Date('2027-08-28T10:00:00Z'),
        },
        {
          userId: 'c',
          debut: new Date('2027-08-27T08:00:00Z'),
          fin: new Date('2027-08-27T10:00:00Z'),
        },
      ],
    })
    expect(c!.places).toEqual({
      total: 3,
      aVenir: 2,
      prochaine: new Date('2027-08-27T08:00:00Z'),
    })
  })

  it('liste une personne affectée sans tâche ni place, et trie par charge', () => {
    const charges = calculerCharges({
      ...base,
      taches: [tache(null, ['b'])],
      affectations: [
        { userId: 'a', perimetreId: 'p1', contactPrincipal: true },
        { userId: 'b', perimetreId: 'p1', contactPrincipal: false },
      ],
    })
    expect(charges.map(c => c.userId)).toEqual(['b', 'a'])
    expect(charges[1]!.affectations).toHaveLength(1)
  })
})

describe('phaseDeLEcheance', () => {
  it('suit la borne de chaque phase et retombe sur la dernière', () => {
    const premiere = PHASES_PAR_DEFAUT[0]!
    const derniere = PHASES_PAR_DEFAUT.at(-1)!
    expect(
      phaseDeLEcheance('2026-01-01', '2027-08-27', PHASES_PAR_DEFAUT)?.cle
    ).toBe(premiere.cle)
    expect(
      phaseDeLEcheance('2027-09-30', '2027-08-27', PHASES_PAR_DEFAUT)?.cle
    ).toBe(derniere.cle)
  })
})
