import { describe, expect, it } from 'vitest'

import { classeDate, etatEcheance } from './taches'

// Signal d'une échéance dans l'espace organisateur (ADR 0068). La règle commune
// est testée dans `@relaytour/commun` ; ce test couvre sa traduction locale.

const MIDI = new Date(2027, 2, 10, 12)

describe('etatEcheance', () => {
  it('reprend le retard calculé par le serveur', () => {
    expect(
      etatEcheance(
        { statut: 'EN_COURS', echeance: '2027-03-20', enRetard: true },
        MIDI
      )
    ).toBe('retard')
  })

  it('signale une tâche à faire dont la période de travail a commencé', () => {
    expect(
      etatEcheance(
        {
          statut: 'A_FAIRE',
          echeance: '2027-03-25',
          duree: 'DEUX_A_TROIS_SEMAINES',
          enRetard: false,
        },
        MIDI
      )
    ).toBe('aCommencer')
  })

  it('ne signale pas une tâche en cours dans sa période de travail', () => {
    expect(
      etatEcheance(
        {
          statut: 'EN_COURS',
          echeance: '2027-03-12',
          duree: 'QUELQUES_JOURS',
          enRetard: false,
        },
        MIDI
      )
    ).toBe('normale')
  })

  it('garde l’échéance proche pour une tâche sans durée', () => {
    expect(
      etatEcheance(
        { statut: 'A_FAIRE', echeance: '2027-03-15', enRetard: false },
        MIDI
      )
    ).toBe('proche')
  })

  it('ne devance pas le serveur quand le poste a un jour d’avance', () => {
    // L'échéance est passée pour le poste, pas encore pour l'organisation.
    expect(
      etatEcheance(
        {
          statut: 'EN_COURS',
          echeance: '2027-03-09',
          duree: 'QUELQUES_JOURS',
          enRetard: false,
        },
        MIDI
      )
    ).toBe('proche')
  })
})

describe('classeDate', () => {
  it('donne la couleur de chaque signal', () => {
    expect(classeDate('retard')).toBe('rt-date rt-date-retard')
    expect(classeDate('aCommencer')).toBe('rt-date rt-date-proche')
    expect(classeDate('proche')).toBe('rt-date rt-date-proche')
    expect(classeDate('normale')).toBe('rt-date')
  })
})
