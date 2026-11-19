import { describe, expect, it } from 'vitest'

import {
  debutTravail,
  DUREE_CONTENU,
  DUREES_TACHE,
  dureeDuContenu,
  signalEcheance,
} from './periodes-de-travail.ts'

describe('debutTravail', () => {
  it('retire les jours de la durée à l’échéance', () => {
    expect(debutTravail('2027-03-24', 'DEUX_A_TROIS_SEMAINES')).toBe(
      '2027-03-03'
    )
    expect(debutTravail('2027-03-24', 'QUELQUES_JOURS')).toBe('2027-03-17')
    expect(debutTravail('2027-03-01', 'UN_A_DEUX_MOIS')).toBe('2026-12-31')
    expect(debutTravail('2027-06-30', 'DEUX_A_TROIS_MOIS')).toBe('2027-04-01')
  })

  it('lit une échéance au format date et heure', () => {
    expect(
      debutTravail('2027-03-24T00:00:00.000Z', 'DEUX_A_TROIS_SEMAINES')
    ).toBe('2027-03-03')
  })

  it('ne donne rien sans durée ou sans échéance', () => {
    expect(debutTravail(null, 'QUELQUES_JOURS')).toBeNull()
    expect(debutTravail('2027-03-24', null)).toBeNull()
    expect(debutTravail('illisible', 'QUELQUES_JOURS')).toBeNull()
  })
})

describe('dureeDuContenu', () => {
  it('relit chaque valeur du contenu', () => {
    for (const duree of DUREES_TACHE) {
      expect(dureeDuContenu(DUREE_CONTENU[duree])).toBe(duree)
    }
    expect(dureeDuContenu('trois-ans')).toBeNull()
  })
})

describe('signalEcheance', () => {
  const jour = '2027-03-10'

  it('garde le retard pour une échéance dépassée, avec ou sans durée', () => {
    for (const statut of ['A_FAIRE', 'EN_COURS']) {
      expect(signalEcheance({ statut, echeance: '2027-03-09' }, jour)).toBe(
        'retard'
      )
      expect(
        signalEcheance(
          { statut, echeance: '2027-03-09', duree: 'UN_A_DEUX_MOIS' },
          jour
        )
      ).toBe('retard')
    }
  })

  it('signale une tâche à faire dont la période de travail a commencé', () => {
    expect(
      signalEcheance(
        {
          statut: 'A_FAIRE',
          echeance: '2027-03-31',
          duree: 'DEUX_A_TROIS_SEMAINES',
        },
        jour
      )
    ).toBe('aCommencer')
    // Premier jour de la période de travail.
    expect(
      signalEcheance(
        {
          statut: 'A_FAIRE',
          echeance: '2027-03-31',
          duree: 'DEUX_A_TROIS_SEMAINES',
        },
        '2027-03-10'
      )
    ).toBe('aCommencer')
  })

  it('ne signale pas une tâche à faire avant sa période de travail', () => {
    expect(
      signalEcheance(
        {
          statut: 'A_FAIRE',
          echeance: '2027-04-01',
          duree: 'DEUX_A_TROIS_SEMAINES',
        },
        jour
      )
    ).toBe('normale')
  })

  it('ne signale pas une tâche en cours dans sa période de travail', () => {
    expect(
      signalEcheance(
        { statut: 'EN_COURS', echeance: '2027-03-12', duree: 'QUELQUES_JOURS' },
        jour
      )
    ).toBe('normale')
  })

  it('garde l’échéance proche pour une tâche sans durée', () => {
    expect(
      signalEcheance({ statut: 'EN_COURS', echeance: '2027-03-17' }, jour)
    ).toBe('proche')
    expect(
      signalEcheance({ statut: 'A_FAIRE', echeance: '2027-03-18' }, jour)
    ).toBe('normale')
  })

  it('ne signale rien pour une tâche close ou sans échéance', () => {
    expect(
      signalEcheance({ statut: 'FAITE', echeance: '2027-03-01' }, jour)
    ).toBe('normale')
    expect(
      signalEcheance({ statut: 'A_FAIRE', duree: 'QUELQUES_JOURS' }, jour)
    ).toBe('normale')
  })
})
