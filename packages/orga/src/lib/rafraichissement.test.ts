import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { Observable } from 'rxjs'
import { describe, expect, it } from 'vitest'

import {
  ECART_MIN_MS,
  peutRafraichir,
  relireLesRequetes,
  REQUETES_RAFRAICHIES,
  VUES_TACHES,
} from './rafraichissement'

const attendre = (ms: number) => new Promise(ok => setTimeout(ok, ms))

/**
 * Un client dont le serveur répond une version qui avance à chaque lecture. `panne`
 * et `refus` simulent une coupure du réseau et un refus du serveur.
 */
function banc() {
  const etat = { panne: false, refus: false, lectures: [] as string[] }
  let version = 0
  const lien = new ApolloLink(
    operation =>
      new Observable(observateur => {
        const minuteur = setTimeout(() => {
          etat.lectures.push(operation.operationName ?? '')
          if (etat.panne) return observateur.error(new Error('Réseau coupé.'))
          if (etat.refus) {
            observateur.next({
              data: null,
              errors: [{ message: 'Refus', extensions: { code: 'FORBIDDEN' } }],
            })
            return observateur.complete()
          }
          version += 1
          observateur.next({ data: { version } })
          observateur.complete()
        }, 5)
        return () => clearTimeout(minuteur)
      })
  )
  const client = new ApolloClient({ link: lien, cache: new InMemoryCache() })
  /** Observe une requête comme le fait un écran, et note chaque état reçu. */
  const observer = async (nom: string) => {
    const etats: { chargement: boolean; version?: number; erreur: boolean }[] =
      []
    const requete = client.watchQuery<{ version: number }>({
      query: gql(`query ${nom} { version }`),
    })
    requete.subscribe(r =>
      etats.push({
        chargement: r.loading,
        version: r.data?.version,
        erreur: r.error !== undefined,
      })
    )
    await attendre(30)
    etats.length = 0
    return { etats, requete }
  }
  return { client, etat, observer }
}

describe('peutRafraichir', () => {
  const pret = {
    maintenant: 100_000,
    dernier: 100_000 - ECART_MIN_MS,
    visible: true,
    enLigne: true,
  }

  it('laisse partir une relecture sur un onglet visible et en ligne', () => {
    expect(peutRafraichir(pret)).toBe(true)
  })

  it('attend sur un onglet caché, hors ligne, ou trop tôt après la précédente', () => {
    expect(peutRafraichir({ ...pret, visible: false })).toBe(false)
    expect(peutRafraichir({ ...pret, enLigne: false })).toBe(false)
    expect(peutRafraichir({ ...pret, dernier: pret.dernier + 1 })).toBe(false)
  })
})

describe('relireLesRequetes', () => {
  it('couvre les vues rafraîchies après une action sur une tâche', () => {
    for (const vue of VUES_TACHES) {
      expect(REQUETES_RAFRAICHIES.has(vue)).toBe(true)
    }
  })

  it('met l’écran à jour sans passer par un état de chargement', async () => {
    const { client, observer } = banc()
    const { etats } = await observer('MesTaches')
    expect(await relireLesRequetes(client)).toBe(1)
    await attendre(10)
    expect(etats).toEqual([{ chargement: false, version: 2, erreur: false }])
  })

  it('ne relit pas une requête hors de la liste', async () => {
    const { client, etat, observer } = banc()
    await observer('Moi')
    await observer('Fiche')
    etat.lectures.length = 0
    expect(await relireLesRequetes(client)).toBe(1)
    expect(etat.lectures).toEqual(['Fiche'])
  })

  it('laisse l’écran tel quel pendant une panne de réseau', async () => {
    const { client, etat, observer } = banc()
    const { etats, requete } = await observer('PagePerimetre')
    etat.panne = true
    await relireLesRequetes(client)
    await attendre(10)
    expect(etats).toEqual([])
    const courant = requete.getCurrentResult()
    expect(courant.data).toEqual({ version: 1 })
    expect(courant.error).toBeUndefined()
  })

  it('montre à l’écran un refus du serveur', async () => {
    const { client, etat, observer } = banc()
    const { requete } = await observer('PagePerimetre')
    etat.refus = true
    await relireLesRequetes(client)
    await attendre(10)
    expect(CombinedGraphQLErrors.is(requete.getCurrentResult().error)).toBe(
      true
    )
  })
})
