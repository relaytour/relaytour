import { describe, expect, it, vi } from 'vitest'

vi.mock('../jobs/queues.ts', () => ({ connection: {} }))

const { attenteJusquAuLendemain, cleDuJour, rendreEnvoi, reserverEnvoi } =
  await import('./plafond-courriel.ts')

const midi = new Date('2026-10-11T12:00:00.000Z')

describe('cleDuJour', () => {
  it('nomme le compteur par le jour UTC', () => {
    expect(cleDuJour(midi)).toBe('courriel-quotidien:2026-10-11')
    expect(cleDuJour(new Date('2026-10-11T23:59:59.999Z'))).toBe(
      'courriel-quotidien:2026-10-11'
    )
    expect(cleDuJour(new Date('2026-10-12T00:00:00.000Z'))).toBe(
      'courriel-quotidien:2026-10-12'
    )
  })
})

describe('attenteJusquAuLendemain', () => {
  it('compte jusqu’au début du jour UTC suivant', () => {
    expect(attenteJusquAuLendemain(midi)).toBe(12 * 3600 * 1000)
    expect(attenteJusquAuLendemain(new Date('2026-10-11T23:59:59.000Z'))).toBe(
      1000
    )
  })

  it('passe la fin du mois et de l’année', () => {
    expect(attenteJusquAuLendemain(new Date('2026-12-31T23:00:00.000Z'))).toBe(
      3600 * 1000
    )
  })
})

describe('reserverEnvoi', () => {
  it('ne compte rien sans plafond', async () => {
    const limiter = vi.fn()
    expect(await reserverEnvoi('invitation', undefined, midi, limiter)).toBe(
      'libre'
    )
    expect(limiter).not.toHaveBeenCalled()
  })

  it('compte un code de connexion et le laisse partir au-delà du plafond', async () => {
    const limiter = vi.fn(() => Promise.resolve(false))
    expect(await reserverEnvoi('code-connexion', 1, midi, limiter)).toBe(
      'libre'
    )
    // Le code prend sa place dans le compteur : le total reste sous le quota du
    // fournisseur, et les autres mails atteignent le plafond plus tôt.
    expect(limiter).toHaveBeenCalledWith(
      'courriel-quotidien:2026-10-11',
      1,
      2 * 24 * 3600,
      { libelle: 'le plafond quotidien des mails' }
    )
  })

  it('réserve un envoi sous le plafond, dans le compteur du jour', async () => {
    const limiter = vi.fn(() => Promise.resolve(true))
    expect(await reserverEnvoi('invitation', 200, midi, limiter)).toBe('libre')
    // Le journal d'une panne de Redis nomme le plafond, pas la limite par adresse.
    expect(limiter).toHaveBeenCalledWith(
      'courriel-quotidien:2026-10-11',
      200,
      2 * 24 * 3600,
      { libelle: 'le plafond quotidien des mails' }
    )
  })

  it('refuse l’envoi quand le plafond est dépassé', async () => {
    const limiter = vi.fn(() => Promise.resolve(false))
    expect(await reserverEnvoi('rappel', 200, midi, limiter)).toBe('atteint')
  })
})

describe('rendreEnvoi', () => {
  it('rend la place d’un envoi qui n’est pas parti', async () => {
    const rendre = vi.fn(() => Promise.resolve())
    await rendreEnvoi(200, midi, rendre)
    expect(rendre).toHaveBeenCalledWith('courriel-quotidien:2026-10-11')
  })

  it('rend la place au jour de la réservation, même après minuit', async () => {
    const rendre = vi.fn(() => Promise.resolve())
    const reserveLe = new Date('2026-10-11T23:59:59.500Z')
    await rendreEnvoi(200, reserveLe, rendre)
    expect(rendre).toHaveBeenCalledWith('courriel-quotidien:2026-10-11')
  })

  it('ne rend rien sans plafond', async () => {
    const rendre = vi.fn(() => Promise.resolve())
    await rendreEnvoi(undefined, midi, rendre)
    expect(rendre).not.toHaveBeenCalled()
  })
})
