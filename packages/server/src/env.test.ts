import { describe, expect, it } from 'vitest'

import { resoudreEnv } from './env.ts'

const BASE = {
  DATABASE_URL: 'mysql://t:t@127.0.0.1:1/t',
  BETTER_AUTH_SECRET: 'secret-de-test-0123456789abcdefghijkl',
}

describe('resoudreEnv', () => {
  it('envoie vers Mailpit en local sans SMTP', () => {
    const env = resoudreEnv({ ...BASE, APP_ENV: 'local' })
    expect(env.COURRIEL).toEqual({
      hote: '127.0.0.1',
      port: 4415,
      secure: false,
    })
    expect(env.COURRIEL_CAPTURE).toBeNull()
  })

  it('reste muet en production sans SMTP', () => {
    const env = resoudreEnv({
      ...BASE,
      APP_ENV: 'prod',
      CORS_ORIGIN: 'https://orga.exemple.org',
    })
    expect(env.COURRIEL).toBeNull()
    expect(env.COURRIEL_CAPTURE).toBeNull()
  })

  it('refuse un SMTP réel en recette sans liste de délivrabilité', () => {
    expect(() =>
      resoudreEnv({
        ...BASE,
        APP_ENV: 'recette',
        CORS_ORIGIN: 'https://orga.recette.exemple.org',
        COURRIEL_SMTP_HOTE: 'ssl0.ovh.net',
        COURRIEL_SMTP_UTILISATEUR: 'u',
        COURRIEL_SMTP_MOT_DE_PASSE: 'p',
      })
    ).toThrow(/COURRIEL_DELIVRABILITE/)
  })

  it('refuse un booléen à la place de la liste de délivrabilité', () => {
    expect(() =>
      resoudreEnv({ ...BASE, COURRIEL_DELIVRABILITE: 'true' })
    ).toThrow(/liste/)
  })

  it('refuse localhost dans CORS_ORIGIN hors du poste local', () => {
    expect(() => resoudreEnv({ ...BASE, APP_ENV: 'prod' })).toThrow(
      /CORS_ORIGIN/
    )
  })

  it('refuse le secret du poste local hors du poste local', () => {
    expect(() =>
      resoudreEnv({
        ...BASE,
        APP_ENV: 'recette',
        CORS_ORIGIN: 'https://orga.recette.exemple.org',
        BETTER_AUTH_SECRET: 'secret-du-poste-local-a-remplacer-0123',
      })
    ).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('déduit secure du port 465', () => {
    const env = resoudreEnv({
      ...BASE,
      APP_ENV: 'prod',
      CORS_ORIGIN: 'https://orga.exemple.org',
      COURRIEL_SMTP_HOTE: 'ssl0.ovh.net',
      COURRIEL_SMTP_UTILISATEUR: 'u',
      COURRIEL_SMTP_MOT_DE_PASSE: 'p',
    })
    expect(env.COURRIEL?.secure).toBe(true)
  })
})
