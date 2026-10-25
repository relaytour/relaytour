import { describe, expect, it } from 'vitest'

import {
  adresseDesabonnement,
  jetonDesabonnement,
  lireJetonDesabonnement,
} from './desabonnement.ts'

const SECRET = 'secret-de-test-local-0123456789abcdef'
const DESABONNEMENT = {
  sorte: 'tache-modifiee',
  userId: 'cmuser0000000000000000001',
  organisationId: 'cmorga000000000000000001',
} as const

describe('jeton de désabonnement', () => {
  it('se relit avec le même secret', () => {
    const jeton = jetonDesabonnement(SECRET, DESABONNEMENT)
    expect(lireJetonDesabonnement(SECRET, jeton)).toEqual(DESABONNEMENT)
  })

  it('ne vaut rien avec un autre secret', () => {
    const jeton = jetonDesabonnement(SECRET, DESABONNEMENT)
    expect(lireJetonDesabonnement(`${SECRET}-autre`, jeton)).toBeNull()
  })

  it('refuse une charge modifiée sous la même signature', () => {
    const jeton = jetonDesabonnement(SECRET, DESABONNEMENT)
    const [, signature] = jeton.split('.')
    const autre = Buffer.from(
      `tache-modifiee cmuser0000000000000000002 ${DESABONNEMENT.organisationId}`
    ).toString('base64url')
    expect(lireJetonDesabonnement(SECRET, `${autre}.${signature}`)).toBeNull()
  })

  it('refuse une sorte de mail qui ne se désactive pas, même signée', () => {
    const jeton = jetonDesabonnement(SECRET, {
      ...DESABONNEMENT,
      sorte: 'code-connexion' as 'resume',
    })
    expect(lireJetonDesabonnement(SECRET, jeton)).toBeNull()
  })

  it('refuse un jeton mal formé', () => {
    expect(lireJetonDesabonnement(SECRET, '')).toBeNull()
    expect(lireJetonDesabonnement(SECRET, 'abc')).toBeNull()
    expect(lireJetonDesabonnement(SECRET, 'abc.def')).toBeNull()
    expect(lireJetonDesabonnement(SECRET, '../../etc.passwd')).toBeNull()
  })

  it('compose une adresse sous /medias/, relayée vers l’API', () => {
    expect(adresseDesabonnement('https://orga.exemple.org/', 'j.s')).toBe(
      'https://orga.exemple.org/medias/desabonnement/j.s'
    )
  })
})
