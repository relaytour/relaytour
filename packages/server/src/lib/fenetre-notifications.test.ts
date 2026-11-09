import { describe, expect, it } from 'vitest'

import {
  FENETRE_NOTIFICATIONS_MS,
  finDeFenetre,
  lignesNettes,
} from './fenetre-notifications.ts'

let n = 0
const ligne = (
  type:
    | 'TACHE_CREEE'
    | 'TACHE_MODIFIEE'
    | 'TACHE_STATUT'
    | 'TACHE_ASSIGNEE'
    | 'TACHE_DESASSIGNEE',
  champs: {
    personneId?: string
    statut?: 'A_FAIRE' | 'EN_COURS' | 'FAITE' | 'ABANDONNEE'
    mailEnAttente?: boolean
  } = {}
) => ({
  id: `n${++n}`,
  userId: 'noa',
  organisationId: 'org',
  type,
  personneId: champs.personneId ?? null,
  acteurId: 'lea',
  statut: champs.statut ?? null,
  mailEnAttente: champs.mailEnAttente ?? false,
  createdAt: new Date(Date.UTC(2027, 0, 1, 10, 0, n)),
})

const etat = (
  champs: Partial<Parameters<typeof lignesNettes>[1]> = {}
): Parameters<typeof lignesNettes>[1] => ({
  assignees: new Set<string>(),
  contenuModifie: false,
  statutModifie: false,
  statutApres: 'A_FAIRE',
  ...champs,
})

describe('fenêtre de regroupement (ADR 0065)', () => {
  it('se termine sur un multiple de dix minutes', () => {
    const fin = finDeFenetre(Date.UTC(2027, 0, 1, 10, 3))
    expect(fin.toISOString()).toBe('2027-01-01T10:10:00.000Z')
    expect(fin.getTime() % FENETRE_NOTIFICATIONS_MS).toBe(0)
    expect(finDeFenetre(Date.UTC(2027, 0, 1, 10, 10)).toISOString()).toBe(
      '2027-01-01T10:20:00.000Z'
    )
  })

  it('un retrait puis un ajout de la même personne ne laissent rien', () => {
    const lignes = [
      ligne('TACHE_DESASSIGNEE', { personneId: 'paul' }),
      ligne('TACHE_ASSIGNEE', { personneId: 'paul' }),
    ]
    expect(
      lignesNettes(lignes, etat({ assignees: new Set(['paul']) }))
    ).toEqual([])
  })

  it('un ajout puis un retrait ne laissent rien', () => {
    const lignes = [
      ligne('TACHE_ASSIGNEE', { personneId: 'paul' }),
      ligne('TACHE_DESASSIGNEE', { personneId: 'paul' }),
    ]
    expect(lignesNettes(lignes, etat())).toEqual([])
  })

  it('A retirée et B ajouté gardent chacun leur ligne', () => {
    const retrait = ligne('TACHE_DESASSIGNEE', { personneId: 'paul' })
    const ajout = ligne('TACHE_ASSIGNEE', { personneId: 'lea' })
    expect(
      lignesNettes([retrait, ajout], etat({ assignees: new Set(['lea']) }))
    ).toEqual([retrait, ajout])
  })

  it('un statut revenu à sa valeur de départ ne laisse rien', () => {
    const lignes = [
      ligne('TACHE_STATUT', { statut: 'EN_COURS' }),
      ligne('TACHE_STATUT', { statut: 'A_FAIRE' }),
    ]
    expect(lignesNettes(lignes, etat())).toEqual([])
  })

  it('un statut changé garde la ligne du statut final', () => {
    const finale = ligne('TACHE_STATUT', { statut: 'FAITE' })
    const lignes = [ligne('TACHE_STATUT', { statut: 'EN_COURS' }), finale]
    expect(
      lignesNettes(
        lignes,
        etat({ statutModifie: true, statutApres: 'FAITE' })
      ).map(l => l.id)
    ).toEqual([finale.id])
  })

  it('plusieurs modifications donnent une ligne, qui garde le mail immédiat', () => {
    const lignes = [
      ligne('TACHE_MODIFIEE', { mailEnAttente: true }),
      ligne('TACHE_MODIFIEE'),
    ]
    const nettes = lignesNettes(lignes, etat({ contenuModifie: true }))
    expect(nettes).toHaveLength(1)
    expect(nettes[0]).toMatchObject({ id: lignes[1]!.id, mailEnAttente: true })
  })

  it('une création reste, une seule fois', () => {
    const creation = ligne('TACHE_CREEE')
    expect(lignesNettes([creation, ligne('TACHE_CREEE')], etat())).toEqual([
      creation,
    ])
  })
})
