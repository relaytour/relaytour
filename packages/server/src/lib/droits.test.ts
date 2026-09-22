import { describe, expect, it } from 'vitest'

import type {
  AppContext,
  OrganisationActive,
  PersonneConnectee,
} from '../context.ts'

import {
  aujourdhuiParis,
  estEnRetard,
  peutLirePerimetre,
  perimetresLisibles,
} from './droits.ts'

describe('aujourdhuiParis', () => {
  it('passe au lendemain à minuit heure de Paris, pas à minuit UTC', () => {
    // 23 h 30 UTC le 26 août 2027 = 1 h 30 à Paris le 27 août.
    expect(aujourdhuiParis(new Date('2027-08-26T23:30:00Z'))).toBe('2027-08-27')
  })
})

describe('estEnRetard', () => {
  const echeance = new Date('2027-08-10T00:00:00Z')

  it('signale une échéance passée', () => {
    expect(estEnRetard({ echeance, statut: 'A_FAIRE' }, '2027-08-11')).toBe(
      true
    )
  })

  it('ne signale pas le jour même', () => {
    expect(estEnRetard({ echeance, statut: 'EN_COURS' }, '2027-08-10')).toBe(
      false
    )
  })

  it('ignore une tâche faite ou abandonnée', () => {
    expect(estEnRetard({ echeance, statut: 'FAITE' }, '2027-09-01')).toBe(false)
    expect(estEnRetard({ echeance, statut: 'ABANDONNEE' }, '2027-09-01')).toBe(
      false
    )
  })

  it('ignore une tâche sans échéance', () => {
    expect(
      estEnRetard({ echeance: null, statut: 'A_FAIRE' }, '2027-09-01')
    ).toBe(false)
  })
})

describe('perimetresLisibles', () => {
  // Le faux contexte connaît deux périmètres même sans session : la règle doit
  // vérifier la session avant de les consulter.
  const organisation: OrganisationActive = {
    id: 'o1',
    slug: 'rencontres',
    role: 'MEMBRE',
    statut: 'ACTIVE',
    fuseauHoraire: 'Europe/Paris',
  }
  const contexte = (
    personne: PersonneConnectee | null,
    active: OrganisationActive | null = organisation
  ): AppContext => ({
    ip: undefined,
    personne,
    organisation: active,
    perimetresAffectes: () => Promise.resolve(new Set(['natation'])),
    perimetresConnus: () => Promise.resolve(new Set(['natation', 'basket'])),
    exigerActivite: () => Promise.reject(new Error('Non utilisé.')),
    exigerEdition: () => Promise.reject(new Error('Non utilisé.')),
  })
  const personne = (estAdmin: boolean): PersonneConnectee => ({
    id: 'u1',
    nom: 'Chloé',
    email: 'chloe@exemple.fr',
    estAdmin,
  })

  it('ne renvoie aucun périmètre sans session', async () => {
    const ctx = contexte(null)
    expect(await perimetresLisibles(ctx)).toEqual([])
    expect(await peutLirePerimetre(ctx, 'natation')).toBe(false)
  })

  it('renvoie les périmètres connus d’une référente, toutes éditions confondues', async () => {
    const ctx = contexte(personne(false))
    expect(await perimetresLisibles(ctx)).toEqual(['natation', 'basket'])
    expect(await peutLirePerimetre(ctx, 'escalade')).toBe(false)
  })

  it('ne renvoie aucun périmètre sans organisation active', async () => {
    const ctx = contexte(personne(false), null)
    expect(await perimetresLisibles(ctx)).toEqual([])
    expect(await peutLirePerimetre(ctx, 'natation')).toBe(false)
  })
})
