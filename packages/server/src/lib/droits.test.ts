import { describe, expect, it } from 'vitest'

import type {
  AppContext,
  OrganisationActive,
  PersonneConnectee,
} from '../context.ts'

import {
  accesAuPerimetre,
  aujourdhui,
  estEnRetard,
  peutConsulterPerimetre,
  peutLirePerimetre,
  perimetresLisibles,
} from './droits.ts'

// Le faux contexte connaît deux périmètres même sans session : chaque règle doit
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
  active: OrganisationActive | null = organisation,
  visibles: string[] = []
): AppContext => ({
  ip: undefined,
  administration: false,
  personne,
  organisation: active,
  perimetresAffectes: () => Promise.resolve(new Set(['natation'])),
  perimetresConnus: () => Promise.resolve(new Set(['natation', 'basket'])),
  activitesAdministrees: () => Promise.resolve(new Set<string>()),
  activitesVisibles: () => Promise.resolve(new Set(visibles)),
  activitesDecouvertes: () => Promise.resolve(new Set<string>()),
  exigerActiviteDecouverte: () => Promise.reject(new Error('non utilisé')),
  estAdminDe: () => Promise.resolve(personne?.estAdmin ?? false),
  exigerAdminDe: () => Promise.reject(new Error('Non utilisé.')),
  exigerActivite: () => Promise.reject(new Error('Non utilisé.')),
  exigerEdition: () => Promise.reject(new Error('Non utilisé.')),
})
const personne = (estAdmin: boolean): PersonneConnectee => ({
  id: 'u1',
  nom: 'Chloé',
  email: 'chloe@exemple.fr',
  estAdmin,
})

describe('aujourdhui', () => {
  it('passe au lendemain à minuit heure de Paris, pas à minuit UTC', () => {
    // 23 h 30 UTC le 26 août 2027 = 1 h 30 à Paris le 27 août.
    expect(aujourdhui(new Date('2027-08-26T23:30:00Z'))).toBe('2027-08-27')
  })

  it('suit le fuseau de l’organisation', () => {
    // 23 h 30 UTC le 26 août 2027 = 19 h 30 à Montréal, encore le 26 août.
    expect(
      aujourdhui(new Date('2027-08-26T23:30:00Z'), 'America/Montreal')
    ).toBe('2027-08-26')
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

describe('peutConsulterPerimetre', () => {
  const escalade = { id: 'escalade', organisationId: 'o1', activiteId: 'a1' }

  it('refuse sans session, même dans une activité visible', async () => {
    const ctx = contexte(null, organisation, ['a1'])
    expect(await peutConsulterPerimetre(ctx, escalade)).toBe(false)
    expect(await accesAuPerimetre(ctx, escalade)).toBe('AUCUN')
  })

  it('refuse sans organisation active', async () => {
    const ctx = contexte(personne(false), null, ['a1'])
    expect(await peutConsulterPerimetre(ctx, escalade)).toBe(false)
  })

  it('refuse le périmètre d’une autre organisation', async () => {
    const ctx = contexte(personne(false), organisation, ['a1'])
    const ailleurs = { ...escalade, organisationId: 'o2' }
    expect(await peutConsulterPerimetre(ctx, ailleurs)).toBe(false)
    expect(await accesAuPerimetre(ctx, ailleurs)).toBe('AUCUN')
  })

  it('refuse le périmètre d’une activité que la personne ne voit pas', async () => {
    const ctx = contexte(personne(false), organisation, ['a2'])
    expect(await peutConsulterPerimetre(ctx, escalade)).toBe(false)
    expect(await accesAuPerimetre(ctx, escalade)).toBe('AUCUN')
  })

  it('ouvre en consultation un périmètre sans affectation d’une activité visible', async () => {
    const ctx = contexte(personne(false), organisation, ['a1'])
    expect(await peutConsulterPerimetre(ctx, escalade)).toBe(true)
    expect(await accesAuPerimetre(ctx, escalade)).toBe('CONSULTATION')
    // La consultation n'élargit pas la lecture : les fiches restent fermées.
    expect(await peutLirePerimetre(ctx, 'escalade')).toBe(false)
  })

  it('donne l’accès complet à un périmètre connu et à un admin de l’activité', async () => {
    const referente = contexte(personne(false), organisation, ['a1'])
    expect(
      await accesAuPerimetre(referente, { ...escalade, id: 'basket' })
    ).toBe('COMPLET')
    const admin = contexte(personne(true), organisation, ['a1'])
    expect(await accesAuPerimetre(admin, escalade)).toBe('COMPLET')
  })
})
