import { describe, expect, it } from 'vitest'

import {
  couvre,
  couvreAdmin,
  type Destinataire,
  importanceAdmin,
  importanceAssignation,
  importanceChangement,
  importanceCreation,
  importanceDemandeAccord,
} from './importance-notifications.ts'

const personne = (
  userId: string,
  contactPrincipal = false,
  perimetreAUnContact = contactPrincipal
): Destinataire => ({ userId, contactPrincipal, perimetreAUnContact })

describe('importance d’une notification (ADR 0065)', () => {
  it('assignation : la personne concernée, puis les autres assignées, puis le périmètre', () => {
    const importance = importanceAssignation('paul', new Set(['paul', 'lea']))
    expect(importance(personne('paul'))).toBe('MOI')
    expect(importance(personne('lea'))).toBe('SUIVI')
    expect(importance(personne('noa'))).toBe('DETAIL')
  })

  it('modification, commentaire et statut intermédiaire : du détail', () => {
    expect(importanceChangement()).toBe('DETAIL')
    expect(importanceChangement('EN_COURS')).toBe('DETAIL')
    expect(importanceChangement('ABANDONNEE')).toBe('DETAIL')
  })

  it('tâche faite : un suivi', () => {
    expect(importanceChangement('FAITE')).toBe('SUIVI')
  })

  it('tâche créée : un suivi sans personne, du détail avec quelqu’un', () => {
    expect(importanceCreation(false)).toBe('SUIVI')
    expect(importanceCreation(true)).toBe('DETAIL')
  })

  it('déclinaison proposée : les contacts principaux, ou toute l’équipe sans contact', () => {
    expect(importanceDemandeAccord(personne('cp', true))).toBe('MOI')
    expect(importanceDemandeAccord(personne('lea', false, true))).toBe('SUIVI')
    expect(importanceDemandeAccord(personne('lea', false, false))).toBe('MOI')
  })

  it('admin : les actions à mener le concernent, le reste est du détail', () => {
    for (const type of [
      'DEMANDE_RECUE',
      'CANDIDATURE_RECUE',
      'SOUHAIT_FORMULE',
      'ACCES_FOURNISSEUR_A_VALIDER',
      'BENEVOLE_RETIRE',
      'INVITATION_ACCEPTEE',
    ] as const) {
      expect(importanceAdmin(type)).toBe('MOI')
    }
    for (const type of [
      'DEMANDE_ACCEPTEE',
      'DEMANDE_REFUSEE',
      'AFFECTATION_AJOUTEE',
      'AFFECTATION_RETIREE',
      'ADMIN_ACTIVITE_NOMME',
      'ADMIN_ORGANISATION_RETIRE',
      'PERSONNE_ARCHIVEE',
    ] as const) {
      expect(importanceAdmin(type)).toBe('DETAIL')
    }
  })
})

describe('réglages de suivi', () => {
  const reglage = (
    suiviPerimetres: 'MOI' | 'SUIVI' | 'DETAIL',
    detailContactPrincipal = false
  ) => ({ suiviPerimetres, detailContactPrincipal })

  it('ce qui vous concerne part toujours', () => {
    expect(couvre(reglage('MOI'), 'MOI', false)).toBe(true)
  })

  it('« Ce qui vous concerne » ne garde ni le suivi ni le détail', () => {
    expect(couvre(reglage('MOI'), 'SUIVI', false)).toBe(false)
    expect(couvre(reglage('MOI'), 'DETAIL', false)).toBe(false)
  })

  it('« L’essentiel du périmètre » garde le suivi, pas le détail', () => {
    expect(couvre(reglage('SUIVI'), 'SUIVI', false)).toBe(true)
    expect(couvre(reglage('SUIVI'), 'DETAIL', false)).toBe(false)
  })

  it('« Tout le détail » garde tout', () => {
    expect(couvre(reglage('DETAIL'), 'DETAIL', false)).toBe(true)
  })

  it('le détail des périmètres de contact ne vaut que pour ces périmètres', () => {
    expect(couvre(reglage('SUIVI', true), 'DETAIL', true)).toBe(true)
    expect(couvre(reglage('SUIVI', true), 'DETAIL', false)).toBe(false)
    expect(couvre(reglage('MOI', true), 'SUIVI', true)).toBe(true)
  })

  it('le suivi d’admin coupe le détail par défaut', () => {
    expect(couvreAdmin('ACTIONS', 'DEMANDE_RECUE')).toBe(true)
    expect(couvreAdmin('ACTIONS', 'AFFECTATION_AJOUTEE')).toBe(false)
    expect(couvreAdmin('DETAIL', 'AFFECTATION_AJOUTEE')).toBe(true)
  })
})
