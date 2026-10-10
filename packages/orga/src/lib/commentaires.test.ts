import { describe, expect, it } from 'vitest'

import {
  composerFil,
  instantDuFil,
  texteEvenement,
  type Commentaire,
  type Evenement,
} from './commentaires'

const alice = { id: 'a', nom: 'Alice Morel' }
const bruno = { id: 'b', nom: 'Bruno Petit' }

const evenement = (e: Partial<Evenement>): Evenement => ({
  id: 'e',
  type: 'CREEE',
  le: '2026-10-10T08:00:00.000Z',
  statut: null,
  acteur: alice,
  personne: null,
  ...e,
})

const commentaire = (c: Partial<Commentaire>): Commentaire => ({
  id: 'c',
  texte: 'Bassin réservé.',
  creeLe: '2026-10-10T09:00:00.000Z',
  modifieLe: null,
  peutModifier: false,
  peutSupprimer: false,
  auteur: alice,
  ...c,
})

describe('composerFil', () => {
  const fil = {
    evenements: [
      evenement({ id: 'e1', le: '2026-10-10T08:00:00.000Z' }),
      evenement({ id: 'e2', type: 'MODIFIEE', le: '2026-10-10T10:00:00.000Z' }),
    ],
    commentaires: [
      commentaire({ id: 'c1', creeLe: '2026-10-10T08:00:00.000Z' }),
      commentaire({ id: 'c2', creeLe: '2026-10-10T11:00:00.000Z' }),
    ],
  }
  const cles = (avec?: boolean) =>
    composerFil(fil, avec).map(e =>
      e.sorte === 'commentaire' ? e.commentaire.id : e.evenement.id
    )

  it('range les commentaires et les événements du plus ancien au plus récent', () => {
    // À la même date, l'événement précède le commentaire.
    expect(cles()).toEqual(['e1', 'c1', 'e2', 'c2'])
  })

  it('ne garde que les commentaires à la demande', () => {
    expect(cles(false)).toEqual(['c1', 'c2'])
  })
})

describe('texteEvenement', () => {
  it('nomme l’auteur, ou s’adresse à la personne qui lit', () => {
    expect(texteEvenement(evenement({}), 'b')).toBe(
      'Alice Morel a créé la tâche.'
    )
    expect(texteEvenement(evenement({}), 'a')).toBe('Vous avez créé la tâche.')
    expect(texteEvenement(evenement({ type: 'MODIFIEE' }), 'a')).toBe(
      'Vous avez modifié la tâche.'
    )
  })

  it('distingue une prise en charge d’une assignation par une autre personne', () => {
    const prise = evenement({ type: 'ASSIGNEE', personne: alice })
    expect(texteEvenement(prise, 'b')).toBe('Alice Morel s’occupe de la tâche.')
    expect(texteEvenement(prise, 'a')).toBe('Vous vous occupez de la tâche.')
    const assignee = evenement({ type: 'ASSIGNEE', personne: bruno })
    expect(texteEvenement(assignee, 'z')).toBe(
      'Alice Morel a assigné la tâche à Bruno Petit.'
    )
    expect(texteEvenement(assignee, 'a')).toBe(
      'Vous avez assigné la tâche à Bruno Petit.'
    )
    expect(texteEvenement(assignee, 'b')).toBe(
      'Alice Morel vous a assigné la tâche.'
    )
  })

  it('décrit un retrait', () => {
    const retrait = evenement({ type: 'RETIREE', personne: bruno })
    expect(texteEvenement(retrait, 'z')).toBe(
      'Alice Morel a retiré Bruno Petit de la tâche.'
    )
    expect(texteEvenement(retrait, 'b')).toBe(
      'Alice Morel vous a retiré·e de la tâche.'
    )
    expect(
      texteEvenement(evenement({ type: 'RETIREE', personne: alice }), 'z')
    ).toBe('Alice Morel ne s’occupe plus de la tâche.')
  })

  it('ne nomme personne pour un passage à « faite » anonyme', () => {
    const faite = evenement({ type: 'STATUT', statut: 'FAITE', acteur: null })
    expect(texteEvenement(faite, 'b')).toBe('La tâche est faite.')
    expect(
      texteEvenement(evenement({ type: 'STATUT', statut: 'FAITE' }), 'a')
    ).toBe('Vous avez marqué la tâche comme faite.')
    expect(
      texteEvenement(evenement({ type: 'STATUT', statut: 'EN_COURS' }), 'b')
    ).toBe('Alice Morel a commencé la tâche.')
  })
})

describe('instantDuFil', () => {
  it('donne le jour et l’heure dans le fuseau demandé', () => {
    expect(instantDuFil('2026-10-10T22:30:00.000Z', 'Europe/Paris')).toBe(
      '11 octobre 2026 à 00:30'
    )
  })
})
