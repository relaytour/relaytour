import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ATTENTE_TROP_DE_FLUX_MS,
  creerFlux,
  delaiDeReprise,
  REGROUPEMENT_MS,
  requetesPour,
  type Ecoute,
} from './flux'
import { REQUETES_RAFRAICHIES } from './rafraichissement'

/** Un serveur de flux simulé : chaque ouverture note son écoute. */
function banc() {
  const ouvertures: { ecoute: Ecoute; ferme: boolean }[] = []
  const relectures: string[][] = []
  let finDeRelecture: (() => void) | null = null
  const flux = creerFlux({
    ouvrir: ecoute => {
      const ouverture = { ecoute, ferme: false }
      ouvertures.push(ouverture)
      return () => {
        ouverture.ferme = true
      }
    },
    relire: noms => {
      relectures.push(noms)
      return new Promise<void>(ok => {
        finDeRelecture = ok
      })
    },
  })
  return {
    flux,
    ouvertures,
    relectures,
    derniere: () => ouvertures.at(-1)!.ecoute,
    finirLaRelecture: async () => {
      finDeRelecture?.()
      finDeRelecture = null
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

describe('requetesPour', () => {
  it('ne nomme que des requêtes que la relecture connaît', () => {
    const entites = [
      'TACHE',
      'FICHE',
      'PERIMETRE',
      'EQUIPE',
      'DEMANDE',
      'NOTIFICATION',
    ] as const
    for (const nom of requetesPour(entites)) {
      expect(REQUETES_RAFRAICHIES.has(nom), nom).toBe(true)
    }
  })

  it('réunit les requêtes d’un lot sans doublon, et ignore une entité inconnue', () => {
    expect(requetesPour(['NOTIFICATION'])).toEqual([
      'NombreNotificationsNonLues',
      'ListeNotifications',
    ])
    const lot = requetesPour(['PERIMETRE', 'EQUIPE'])
    expect(new Set(lot).size).toBe(lot.length)
    expect(lot).toContain('SouhaitsEnAttente')
    expect(requetesPour(['AUTRE' as never])).toEqual([])
  })
})

describe('delaiDeReprise', () => {
  it('double d’une seconde à trente secondes', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(delaiDeReprise)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000,
    ])
  })
})

describe('creerFlux', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('regroupe les signaux, puis relit les écrans concernés', async () => {
    const { flux, relectures, derniere, finirLaRelecture } = banc()
    flux.demarrer()
    expect(flux.actif()).toBe(false)
    derniere().ouvert()
    expect(flux.actif()).toBe(true)

    derniere().signal('TACHE')
    derniere().signal('NOTIFICATION')
    derniere().signal('TACHE')
    expect(relectures).toEqual([])
    vi.advanceTimersByTime(REGROUPEMENT_MS)
    expect(relectures).toEqual([requetesPour(['TACHE', 'NOTIFICATION'])])

    // Un signal reçu pendant la relecture attend qu'elle se termine.
    derniere().signal('FICHE')
    vi.advanceTimersByTime(REGROUPEMENT_MS)
    expect(relectures).toHaveLength(1)
    await finirLaRelecture()
    vi.advanceTimersByTime(REGROUPEMENT_MS)
    expect(relectures[1]).toEqual(requetesPour(['FICHE']))
  })

  it('rouvre aussitôt un flux que le serveur a fermé après sa durée', () => {
    const { flux, ouvertures, derniere } = banc()
    flux.demarrer()
    derniere().ouvert()
    derniere().fin('terminee')
    expect(flux.actif()).toBe(false)
    vi.advanceTimersByTime(0)
    expect(ouvertures).toHaveLength(2)
  })

  it('attend de plus en plus longtemps après une panne, puis repart d’une seconde', () => {
    const { flux, ouvertures, derniere } = banc()
    flux.demarrer()
    for (const attente of [1_000, 2_000, 4_000]) {
      const avant = ouvertures.length
      derniere().fin('panne')
      vi.advanceTimersByTime(attente - 1)
      expect(ouvertures).toHaveLength(avant)
      vi.advanceTimersByTime(1)
      expect(ouvertures).toHaveLength(avant + 1)
    }
    // Une ouverture réussie remet le compteur à zéro.
    derniere().ouvert()
    derniere().fin('panne')
    vi.advanceTimersByTime(1_000)
    expect(ouvertures).toHaveLength(5)
  })

  it('patiente quand la personne a trop de flux, et s’arrête sur un refus', () => {
    const { flux, ouvertures, derniere } = banc()
    flux.demarrer()
    derniere().fin('trop')
    vi.advanceTimersByTime(ATTENTE_TROP_DE_FLUX_MS - 1)
    expect(ouvertures).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(ouvertures).toHaveLength(2)

    // Session terminée ou accès retirés : le flux ne se rouvre pas de lui-même.
    derniere().fin('refus')
    vi.advanceTimersByTime(ATTENTE_TROP_DE_FLUX_MS * 2)
    expect(ouvertures).toHaveLength(2)
    // Le retour sur l'onglet le relance.
    flux.demarrer()
    expect(ouvertures).toHaveLength(3)
  })

  it('ferme le flux et annule la reprise à l’arrêt', () => {
    const { flux, ouvertures, derniere } = banc()
    flux.demarrer()
    derniere().ouvert()
    flux.arreter()
    expect(ouvertures[0]!.ferme).toBe(true)
    expect(flux.actif()).toBe(false)
    // Une fin tardive du flux fermé ne rouvre rien.
    ouvertures[0]!.ecoute.fin('panne')
    vi.advanceTimersByTime(60_000)
    expect(ouvertures).toHaveLength(1)

    // Une panne, puis un arrêt avant la reprise.
    flux.demarrer()
    derniere().fin('panne')
    flux.arreter()
    vi.advanceTimersByTime(60_000)
    expect(ouvertures).toHaveLength(2)
  })

  it('n’ouvre qu’un flux à la fois', () => {
    const { flux, ouvertures } = banc()
    flux.demarrer()
    flux.demarrer()
    expect(ouvertures).toHaveLength(1)
  })
})
