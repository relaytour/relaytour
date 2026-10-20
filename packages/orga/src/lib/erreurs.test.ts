import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { dateCourte, estRefus, jourDeLInstant, messageErreur } from './erreurs'

function erreurGraphQL(message: string, code: string) {
  return new CombinedGraphQLErrors({
    errors: [{ message, extensions: { code } }],
  })
}

describe('messageErreur', () => {
  it('affiche le motif d’une limite atteinte, avec le contact de l’hébergeur', () => {
    const message =
      'Votre organisation a atteint sa limite d’activités. Contactez votre hébergeur : https://hebergeur.exemple.org.'
    expect(messageErreur(erreurGraphQL(message, 'LIMITE_ATTEINTE'))).toBe(
      message
    )
  })

  it('affiche le motif d’un refus en lecture seule', () => {
    const message =
      'Cette organisation est en lecture seule : vous pouvez consulter et exporter ses données, pas les modifier.'
    expect(messageErreur(erreurGraphQL(message, 'LECTURE_SEULE'))).toBe(message)
  })

  it('affiche le message d’une saisie invalide et d’un conflit de version', () => {
    expect(
      messageErreur(erreurGraphQL('Le nom est obligatoire.', 'SAISIE_INVALIDE'))
    ).toBe('Le nom est obligatoire.')
    expect(
      messageErreur(erreurGraphQL('Version dépassée.', 'CONFLIT_VERSION'))
    ).toBe('Version dépassée.')
  })

  it('remplace un refus d’accès par un message fixe', () => {
    expect(messageErreur(erreurGraphQL('détail interne', 'FORBIDDEN'))).toBe(
      'Vous n’avez pas accès à cette action.'
    )
  })

  it('ne montre jamais le message d’une erreur interne ou inconnue', () => {
    const generique = 'L’opération a échoué. Réessayez dans un instant.'
    expect(
      messageErreur(erreurGraphQL('détail interne', 'INTERNAL_SERVER_ERROR'))
    ).toBe(generique)
    expect(messageErreur(new Error('réseau'))).toBe(generique)
    expect(messageErreur(undefined)).toBe(generique)
  })
})

describe('dateCourte', () => {
  it('formate une date sans heure telle qu’elle est écrite', () => {
    expect(dateCourte('2026-10-04')).toBe('4 octobre 2026')
  })

  it('garde le jour écrit, même à minuit UTC', () => {
    expect(dateCourte('2027-06-05T00:00:00.000Z')).toBe('5 juin 2027')
  })
})

describe('jourDeLInstant', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // 22 h 30 UTC le 4 octobre correspond à 0 h 30 le 5 octobre à Paris (UTC+2).
  const instant = '2026-10-04T22:30:00.000Z'

  it('donne le jour de l’instant dans le fuseau indiqué', () => {
    expect(jourDeLInstant(instant, 'Europe/Paris')).toBe('5 octobre 2026')
    expect(jourDeLInstant(instant, 'UTC')).toBe('4 octobre 2026')
    expect(jourDeLInstant(instant, 'America/Montreal')).toBe('4 octobre 2026')
  })

  it('suit l’heure d’hiver', () => {
    // 23 h 30 UTC le 31 décembre correspond à 0 h 30 le 1er janvier à Paris (UTC+1).
    expect(jourDeLInstant('2026-12-31T23:30:00.000Z', 'Europe/Paris')).toBe(
      '1 janvier 2027'
    )
    expect(jourDeLInstant('2026-12-31T22:30:00.000Z', 'Europe/Paris')).toBe(
      '31 décembre 2026'
    )
  })

  it('prend le fuseau du navigateur par défaut', () => {
    vi.stubEnv('TZ', 'Europe/Paris')
    expect(jourDeLInstant(instant)).toBe('5 octobre 2026')
    vi.stubEnv('TZ', 'UTC')
    expect(jourDeLInstant(instant)).toBe('4 octobre 2026')
  })
})

describe('estRefus', () => {
  it('reconnaît un refus d’accès, pas une panne ni une saisie refusée', () => {
    expect(estRefus(erreurGraphQL('Accès refusé.', 'FORBIDDEN'))).toBe(true)
    expect(estRefus(erreurGraphQL('Erreur.', 'INTERNAL_SERVER_ERROR'))).toBe(
      false
    )
    expect(estRefus(erreurGraphQL('Trop long.', 'SAISIE_INVALIDE'))).toBe(false)
    expect(estRefus(new Error('Réseau indisponible'))).toBe(false)
  })
})
