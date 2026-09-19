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
  })

  it('reste muet en production sans SMTP', () => {
    const env = resoudreEnv({
      ...BASE,
      APP_ENV: 'prod',
      CORS_ORIGIN: 'https://orga.exemple.org',
      ORIGINE_ORGA: 'https://orga.exemple.org',
    })
    expect(env.COURRIEL).toBeNull()
  })

  it('préfère le SMTP renseigné au Mailpit du poste local', () => {
    const env = resoudreEnv({
      ...BASE,
      APP_ENV: 'local',
      COURRIEL_SMTP_HOTE: 'smtp.exemple.org',
      COURRIEL_SMTP_PORT: '1025',
      COURRIEL_SMTP_UTILISATEUR: 'u',
      COURRIEL_SMTP_MOT_DE_PASSE: 'p',
    })
    expect(env.COURRIEL).toEqual({
      hote: 'smtp.exemple.org',
      port: 1025,
      secure: false,
      utilisateur: 'u',
      motDePasse: 'p',
    })
  })

  it('refuse un SMTP renseigné à moitié', () => {
    expect(() =>
      resoudreEnv({ ...BASE, COURRIEL_SMTP_HOTE: 'smtp.exemple.org' })
    ).toThrow(/se renseignent ensemble/)
  })

  it('refuse une valeur d’APP_ENV inconnue', () => {
    expect(() => resoudreEnv({ ...BASE, APP_ENV: 'essai' })).toThrow()
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
        APP_ENV: 'prod',
        CORS_ORIGIN: 'https://orga.exemple.org',
        ORIGINE_ORGA: 'https://orga.exemple.org',
        BETTER_AUTH_SECRET: 'secret-du-poste-local-a-remplacer-0123',
      })
    ).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('exige ORIGINE_ORGA hors du poste local', () => {
    expect(() =>
      resoudreEnv({
        ...BASE,
        APP_ENV: 'prod',
        CORS_ORIGIN: 'https://orga.exemple.org',
      })
    ).toThrow(/ORIGINE_ORGA/)
  })

  it('retombe sur le poste local sans ORIGINE_ORGA', () => {
    expect(resoudreEnv({ ...BASE }).ORIGINE_ORGA).toBe('http://localhost:5305')
  })

  it('déduit secure du port 465', () => {
    const env = resoudreEnv({
      ...BASE,
      APP_ENV: 'prod',
      CORS_ORIGIN: 'https://orga.exemple.org',
      ORIGINE_ORGA: 'https://orga.exemple.org',
      COURRIEL_SMTP_HOTE: 'ssl0.ovh.net',
      COURRIEL_SMTP_UTILISATEUR: 'u',
      COURRIEL_SMTP_MOT_DE_PASSE: 'p',
    })
    expect(env.COURRIEL?.secure).toBe(true)
  })
})
