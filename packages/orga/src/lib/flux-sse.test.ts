import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Ecoute } from './flux'
import { ETABLI_APRES_MS, ouvrirLeFluxSse } from './flux-sse'

/** Laisse les promesses en attente se régler. */
const vider = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve()
}

/** Une écoute qui note ce que le flux lui dit. */
function ecoute() {
  const recu: string[] = []
  const e: Ecoute = {
    ouvert: () => recu.push('ouvert'),
    signal: entite => recu.push(`signal ${entite}`),
    fin: cause => recu.push(`fin ${cause}`),
  }
  return { recu, e }
}

/** Un serveur simulé : une réponse SSE dont le test écrit et ferme le corps. */
function serveur(statut = 200) {
  const encodeur = new TextEncoder()
  let corps!: ReadableStreamDefaultController<Uint8Array>
  const flux = new ReadableStream<Uint8Array>({
    start(controleur) {
      corps = controleur
    },
  })
  const requetes: { accept: string | null; organisation: string | null }[] = []
  const fetchFn = ((_url: RequestInfo | URL, init?: RequestInit) => {
    const entetes = new Headers(init?.headers)
    requetes.push({
      accept: entetes.get('accept'),
      organisation: entetes.get('x-relaytour-organisation'),
    })
    return Promise.resolve(
      new Response(statut === 200 ? flux : null, {
        status: statut,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      })
    )
  }) as typeof fetch
  return {
    fetchFn,
    requetes,
    ecrire: async (texte: string) => {
      corps.enqueue(encodeur.encode(texte))
      await vider()
    },
    fermer: async () => {
      corps.close()
      await vider()
    },
  }
}

const SIGNAL = (entite: string) =>
  `event: next\ndata: {"data":{"changements":{"entite":"${entite}"}}}\n\n`
const REFUS = (code: string) =>
  `event: next\ndata: {"errors":[{"message":"Refus","extensions":{"code":"${code}"}}]}\n\nevent: complete\ndata:\n\n`

describe('ouvrirLeFluxSse', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('tient le flux pour établi deux secondes après la réponse du serveur', async () => {
    const { recu, e } = ecoute()
    const { fetchFn, requetes, ecrire, fermer } = serveur()
    ouvrirLeFluxSse(e, { fetchFn })
    await vider()
    expect(requetes).toEqual([
      { accept: 'text/event-stream', organisation: null },
    ])
    await vi.advanceTimersByTimeAsync(ETABLI_APRES_MS - 1)
    expect(recu).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(recu).toEqual(['ouvert'])

    await ecrire(':\n\n' + SIGNAL('TACHE') + SIGNAL('NOTIFICATION'))
    expect(recu).toEqual(['ouvert', 'signal TACHE', 'signal NOTIFICATION'])
    // Le serveur ferme le flux après sa durée.
    await ecrire('event: complete\ndata:\n\n')
    await fermer()
    expect(recu.at(-1)).toBe('fin terminee')
  })

  it('ne tient pas pour ouvert un flux que rien n’a accepté', async () => {
    const { recu, e } = ecoute()
    // Un proxy garde la requête en attente : aucune réponse n'arrive.
    const enAttente = (() =>
      new Promise<Response>(() => undefined)) as typeof fetch
    ouvrirLeFluxSse(e, { fetchFn: enAttente })
    await vi.advanceTimersByTimeAsync(ETABLI_APRES_MS * 10)
    expect(recu).toEqual([])
  })

  it('dit pourquoi le serveur a refusé le flux, sans le tenir pour ouvert', async () => {
    for (const [code, fin] of [
      ['FORBIDDEN', 'fin refus'],
      ['TROP_DE_FLUX', 'fin trop'],
      ['FLUX_INDISPONIBLE', 'fin panne'],
    ] as const) {
      const { recu, e } = ecoute()
      const { fetchFn, ecrire, fermer } = serveur()
      ouvrirLeFluxSse(e, { fetchFn })
      await vider()
      await ecrire(REFUS(code))
      await fermer()
      await vi.advanceTimersByTimeAsync(ETABLI_APRES_MS)
      expect(recu, code).toEqual([fin])
    }
  })

  it('compte une réponse en erreur et une coupure comme des pannes', async () => {
    const enErreur = ecoute()
    ouvrirLeFluxSse(enErreur.e, { fetchFn: serveur(502).fetchFn })
    await vider()
    expect(enErreur.recu).toEqual(['fin panne'])

    const coupe = ecoute()
    const reseau = (() =>
      Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch
    ouvrirLeFluxSse(coupe.e, { fetchFn: reseau })
    await vider()
    expect(coupe.recu).toEqual(['fin panne'])
  })

  it('ne dit plus rien après sa fermeture par l’appelant', async () => {
    const { recu, e } = ecoute()
    const { fetchFn, ecrire } = serveur()
    const fermer = ouvrirLeFluxSse(e, { fetchFn })
    await vider()
    fermer()
    await ecrire(SIGNAL('TACHE')).catch(() => undefined)
    await vi.advanceTimersByTimeAsync(ETABLI_APRES_MS)
    expect(recu).toEqual([])
  })
})
