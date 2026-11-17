import { MockAgent } from 'undici'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolutionPublique } from '../espace-fichiers/reseau.ts'

import { lireDocumentCimd, TAILLE_CIMD_MAX } from './clients.ts'

// Lecture d'un document CIMD (ADR 0067) par le vrai `fetch`, avec un agent de test
// à la place d'Internet. Chaque borne se prouve par le refus : adresse non
// publique, redirection, lenteur, taille.

const ORIGINE = 'https://editeur.exemple'
const ADRESSE = `${ORIGINE}/client.json`

const document = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    client_id: ADRESSE,
    client_name: 'Agenda partagé',
    redirect_uris: ['https://editeur.exemple/retour'],
    ...extra,
  })

let agent: MockAgent

beforeEach(() => {
  agent = new MockAgent()
  agent.disableNetConnect()
})

afterEach(async () => {
  await agent.close()
})

const intercepter = () => agent.get(ORIGINE).intercept({ path: '/client.json' })

describe('lecture d’un document CIMD', () => {
  it('lit un document valable et suit Cache-Control', async () => {
    intercepter().reply(200, document(), {
      headers: { 'cache-control': 'max-age=600' },
    })
    const r = await lireDocumentCimd(ADRESSE, { agent })
    expect(r).toEqual({
      issue: 'ok',
      description: {
        nom: 'Agenda partagé',
        redirectUris: ['https://editeur.exemple/retour'],
      },
      cacheS: 600,
    })
  })

  it('refuse une adresse IP ou localhost avant toute connexion', async () => {
    for (const adresse of [
      'https://127.0.0.1:9999/client.json',
      'https://10.0.0.5/client.json',
      'https://[::1]/client.json',
      'https://localhost/client.json',
    ]) {
      // L'agent refuse toute connexion : un appel réseau rendrait « injoignable ».
      expect(await lireDocumentCimd(adresse, { agent }), adresse).toEqual({
        issue: 'invalide',
      })
    }
  })

  it('ne suit pas une redirection', async () => {
    intercepter().reply(302, '', {
      headers: { location: 'https://169.254.169.254/latest/meta-data' },
    })
    expect(await lireDocumentCimd(ADRESSE, { agent })).toEqual({
      issue: 'injoignable',
    })
  })

  it('abandonne une réponse trop lente', async () => {
    intercepter().reply(200, document()).delay(500)
    expect(await lireDocumentCimd(ADRESSE, { agent, delaiMs: 50 })).toEqual({
      issue: 'injoignable',
    })
  })

  it('refuse un document de plus de 16 Ko', async () => {
    intercepter().reply(
      200,
      document({ remplissage: 'x'.repeat(TAILLE_CIMD_MAX) })
    )
    expect(await lireDocumentCimd(ADRESSE, { agent })).toEqual({
      issue: 'invalide',
    })
  })

  it('refuse un document dont client_id diffère de l’adresse lue', async () => {
    intercepter().reply(
      200,
      document({ client_id: 'https://autre.exemple/client.json' })
    )
    expect(await lireDocumentCimd(ADRESSE, { agent })).toEqual({
      issue: 'invalide',
    })
  })
})

describe('résolution publique de l’agent', () => {
  it('refuse un nom qui mène à une adresse de boucle locale', async () => {
    const erreur = await new Promise<Error | null>(resoudre => {
      resolutionPublique('localhost', {}, e => resoudre(e))
    })
    expect(erreur?.message).toContain('n’a pas une adresse publique')
  })
})
