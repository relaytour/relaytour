import { afterEach, describe, expect, it, vi } from 'vitest'

import { appareil, lienGuideInstallation } from './installation'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

describe('appareil', () => {
  it('reconnaît un iPhone et un téléphone Android', () => {
    expect(appareil(IPHONE, 5)).toBe('iphone')
    expect(appareil(ANDROID, 5)).toBe('android')
  })

  it('distingue un iPad d’un Mac par l’écran tactile', () => {
    expect(appareil(IPAD, 5)).toBe('iphone')
    expect(appareil(IPAD, 0)).toBe('ordinateur')
  })

  it('range le reste parmi les ordinateurs', () => {
    expect(appareil(WINDOWS, 0)).toBe('ordinateur')
  })
})

describe('lienGuideInstallation', () => {
  it('place le guide à côté de la liste des modes d’emploi', () => {
    const attendu = 'https://relaytour.org/modes-d-emploi/installer.html'
    for (const base of [
      'https://relaytour.org/modes-d-emploi/',
      'https://relaytour.org/modes-d-emploi',
      'https://relaytour.org/modes-d-emploi/index.html',
      'https://relaytour.org/modes-d-emploi/?a=1#b',
    ])
      expect(lienGuideInstallation(base)).toBe(attendu)
  })
})

describe('invite d’installation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  /** Charge le module avec une fenêtre factice, et rend ses écouteurs. */
  async function charger() {
    const ecouteurs = new Map<string, (evenement: unknown) => void>()
    vi.stubGlobal('window', {
      addEventListener: (type: string, f: (evenement: unknown) => void) =>
        ecouteurs.set(type, f),
    })
    vi.resetModules()
    const module = await import('./installation')
    return { module, ecouteurs }
  }

  const invite = (issue: 'accepted' | 'dismissed') => ({
    preventDefault: vi.fn(),
    prompt: vi.fn(() => Promise.resolve({ outcome: issue })),
  })

  it('retient l’invite du navigateur et prévient les abonnés', async () => {
    const { module, ecouteurs } = await charger()
    const prevenir = vi.fn()
    const retirer = module.abonnerInvite(prevenir)
    expect(module.inviteDisponible()).toBe(false)
    const evenement = invite('accepted')
    ecouteurs.get('beforeinstallprompt')!(evenement)
    expect(evenement.preventDefault).toHaveBeenCalled()
    expect(module.inviteDisponible()).toBe(true)
    expect(prevenir).toHaveBeenCalledTimes(1)
    retirer()
    ecouteurs.get('appinstalled')!({})
    expect(module.inviteDisponible()).toBe(false)
    expect(prevenir).toHaveBeenCalledTimes(1)
  })

  it('rend vrai quand la personne accepte, et ne sert qu’une fois', async () => {
    const { module, ecouteurs } = await charger()
    const evenement = invite('accepted')
    ecouteurs.get('beforeinstallprompt')!(evenement)
    expect(await module.installer()).toBe(true)
    expect(evenement.prompt).toHaveBeenCalledTimes(1)
    expect(module.inviteDisponible()).toBe(false)
    expect(await module.installer()).toBe(false)
  })

  it('rend faux quand la personne refuse', async () => {
    const { module, ecouteurs } = await charger()
    ecouteurs.get('beforeinstallprompt')!(invite('dismissed'))
    expect(await module.installer()).toBe(false)
    expect(module.inviteDisponible()).toBe(false)
  })
})
