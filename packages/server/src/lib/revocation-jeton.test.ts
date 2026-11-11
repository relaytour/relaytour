import { describe, expect, it } from 'vitest'

import {
  adresseRevocation,
  CHEMIN_REVOCATION,
  jetonRevocation,
  lireJetonRevocation,
} from './revocation-jeton.ts'

// Le lien de révocation d'un jeton d'accès (ADR 0064) : signé par le secret du
// serveur, il ne vaut que pour l'identifiant qu'il porte.

const secret = 'secret-de-test-local-0123456789abcdef'
const id = 'cmhq2k3x90000abcdefghijk'

describe('jetonRevocation', () => {
  it('se relit avec le même secret', () => {
    expect(lireJetonRevocation(secret, jetonRevocation(secret, id))).toBe(id)
  })

  it('ne vaut rien avec un autre secret, une signature changée ou une charge changée', () => {
    const jeton = jetonRevocation(secret, id)
    const [charge = '', signature = ''] = jeton.split('.')
    expect(lireJetonRevocation('autre-secret', jeton)).toBeNull()
    expect(
      lireJetonRevocation(
        secret,
        `${charge}.${signature.slice(0, -1)}${signature.at(-1) === 'A' ? 'B' : 'A'}`
      )
    ).toBeNull()
    expect(
      lireJetonRevocation(
        secret,
        `${Buffer.from('autre-id').toString('base64url')}.${signature}`
      )
    ).toBeNull()
    expect(lireJetonRevocation(secret, 'pas-un-jeton')).toBeNull()
    expect(lireJetonRevocation(secret, '')).toBeNull()
  })

  it('refuse une charge qui n’est pas un identifiant', () => {
    const jeton = jetonRevocation(secret, '../x; DROP')
    expect(lireJetonRevocation(secret, jeton)).toBeNull()
  })

  it('compose l’adresse sous /medias/, que le proxy relaie déjà', () => {
    const jeton = jetonRevocation(secret, id)
    expect(adresseRevocation('https://orga.exemple.org/', jeton)).toBe(
      `https://orga.exemple.org${CHEMIN_REVOCATION}/${jeton}`
    )
  })
})
