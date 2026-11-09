import { describe, expect, it } from 'vitest'

import { statutDuRefus } from '../contexte-jeton.ts'

import {
  apercuJeton,
  apiOuverte,
  causeFermeture,
  DUREE_MAX_JOURS,
  empreinteJetonAcces,
  estUnJetonAcces,
  etatApi,
  finDuJeton,
  lireActivitesDuJeton,
  nouveauJetonAcces,
  type ReglageApi,
} from './jetons-acces.ts'

// Jetons d'accès (ADR 0064) : forme, empreinte et état du module.

describe('forme d’un jeton d’accès', () => {
  it('a le préfixe rt_ suivi de 43 caractères base64url', () => {
    const jeton = nouveauJetonAcces()
    expect(jeton).toMatch(/^rt_[A-Za-z0-9_-]{43}$/)
    expect(jeton).toHaveLength(46)
    expect(estUnJetonAcces(jeton)).toBe(true)
  })

  it('change à chaque création', () => {
    expect(nouveauJetonAcces()).not.toBe(nouveauJetonAcces())
  })

  it('refuse une chaîne tronquée, sans préfixe ou trop longue', () => {
    const jeton = nouveauJetonAcces()
    expect(estUnJetonAcces(jeton.slice(0, -1))).toBe(false)
    expect(estUnJetonAcces(jeton.slice(3))).toBe(false)
    expect(estUnJetonAcces(`${jeton}a`)).toBe(false)
    expect(estUnJetonAcces(`rt_${'!'.repeat(43)}`)).toBe(false)
    expect(estUnJetonAcces('')).toBe(false)
  })

  it('a une empreinte stable, qui porte sur le jeton entier', () => {
    const jeton = nouveauJetonAcces()
    expect(empreinteJetonAcces(jeton)).toMatch(/^[0-9a-f]{64}$/)
    expect(empreinteJetonAcces(jeton)).toBe(empreinteJetonAcces(jeton))
    expect(empreinteJetonAcces(jeton)).not.toBe(
      empreinteJetonAcces(jeton.slice(3))
    )
  })

  it('montre les huit caractères qui suivent le préfixe', () => {
    expect(apercuJeton(`rt_abcdefgh${'x'.repeat(35)}`)).toBe('abcdefgh')
  })
})

describe('état du module « API »', () => {
  const base: ReglageApi = {
    apiActivee: false,
    apiAutorisee: true,
    apiImposee: false,
    apiSuspendueLe: null,
  }

  it('est inactif par défaut', () => {
    expect(etatApi(base)).toBe('INACTIVE')
    expect(apiOuverte(base)).toBe(false)
  })

  it('suit chaque combinaison des réglages', () => {
    const suspendue = new Date()
    for (const apiActivee of [false, true]) {
      for (const apiAutorisee of [false, true]) {
        for (const apiImposee of [false, true]) {
          for (const apiSuspendueLe of [null, suspendue]) {
            const r = { apiActivee, apiAutorisee, apiImposee, apiSuspendueLe }
            const attendu =
              apiSuspendueLe !== null
                ? 'SUSPENDUE'
                : !apiAutorisee
                  ? 'INTERDITE'
                  : apiImposee
                    ? 'IMPOSEE'
                    : apiActivee
                      ? 'ACTIVE'
                      : 'INACTIVE'
            expect(etatApi(r)).toBe(attendu)
            expect(apiOuverte(r)).toBe(
              attendu === 'ACTIVE' || attendu === 'IMPOSEE'
            )
          }
        }
      }
    }
  })

  it('nomme la cause d’une fermeture', () => {
    expect(causeFermeture('SUSPENDUE')).toBe('suspendue')
    expect(causeFermeture('INTERDITE')).toBe('hebergeur')
    expect(causeFermeture('INACTIVE')).toBe('organisation')
  })
})

describe('bornes d’un jeton', () => {
  const maintenant = new Date('2027-01-10T12:00:00Z')

  it('vaut un an par défaut', () => {
    expect(finDuJeton(null, maintenant).getTime()).toBe(
      maintenant.getTime() + DUREE_MAX_JOURS * 86_400_000
    )
  })

  it('refuse une date passée et une date au-delà d’un an', () => {
    expect(() =>
      finDuJeton(new Date('2027-01-09T00:00:00Z'), maintenant)
    ).toThrow()
    expect(() =>
      finDuJeton(new Date('2028-02-01T00:00:00Z'), maintenant)
    ).toThrow()
  })

  it('garde une date dans l’année', () => {
    const fin = new Date('2027-06-01T00:00:00Z')
    expect(finDuJeton(fin, maintenant)).toEqual(fin)
  })

  it('lit la liste des activités, nulle sans restriction', () => {
    expect(lireActivitesDuJeton(null)).toBeNull()
    expect(lireActivitesDuJeton('a1')).toBeNull()
    expect(lireActivitesDuJeton(['a1', 'a2'])).toEqual(new Set(['a1', 'a2']))
  })
})

describe('statut HTTP d’un refus', () => {
  it('rend 401, 403 ou 429', () => {
    expect(statutDuRefus('JETON_INVALIDE')).toBe(401)
    expect(statutDuRefus('API_INACTIVE')).toBe(403)
    expect(statutDuRefus('LIMITE_DE_DEBIT')).toBe(429)
  })
})
