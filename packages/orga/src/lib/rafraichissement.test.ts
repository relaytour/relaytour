import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Observable } from 'rxjs'
import { describe, expect, it } from 'vitest'

import AvisRelecture from '../composants/AvisRelecture'

import {
  ECART_MIN_MS,
  peutRafraichir,
  relireLesRequetes,
  REQUETES_RAFRAICHIES,
  VUES_TACHES,
} from './rafraichissement'

const attendre = (ms: number) => new Promise(ok => setTimeout(ok, ms))

/** L'avis de la coquille, tel qu'il s'affiche. */
const avis = () => renderToString(createElement(AvisRelecture))

/**
 * Un client dont le serveur répond une version qui avance à chaque lecture. `panne`
 * simule une coupure du réseau, `erreur` une erreur GraphQL portant ce code, et
 * `sansSession` une session qui a pris fin.
 */
function banc() {
  const etat = {
    panne: false,
    erreur: null as string | null,
    sansSession: false,
    lectures: [] as string[],
  }
  let version = 0
  const lien = new ApolloLink(
    operation =>
      new Observable(observateur => {
        const minuteur = setTimeout(() => {
          etat.lectures.push(operation.operationName ?? '')
          if (etat.panne) return observateur.error(new Error('Réseau coupé.'))
          if (etat.erreur !== null) {
            observateur.next({
              data: null,
              errors: [
                { message: 'Erreur', extensions: { code: etat.erreur } },
              ],
            })
            return observateur.complete()
          }
          version += 1
          // La requête de session répond `moi`, null quand la session a pris fin.
          const moi = etat.sansSession
            ? null
            : { __typename: 'Personne', id: 'moi' }
          observateur.next({
            data:
              operation.operationName === 'MenuPerimetres'
                ? { moi }
                : { version },
          })
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

  it('laisse l’écran tel quel pendant une panne du serveur', async () => {
    const { client, etat, observer } = banc()
    const { etats, requete } = await observer('PagePerimetre')
    etat.erreur = 'INTERNAL_SERVER_ERROR'
    await relireLesRequetes(client)
    await attendre(10)
    expect(etats).toEqual([])
    expect(requete.getCurrentResult().error).toBeUndefined()
    expect(avis()).toBe('')
  })
})

describe('refus du serveur pendant une relecture', () => {
  it('affiche l’avis de la coquille, sans retirer le contenu de l’écran', async () => {
    const { client, etat, observer } = banc()
    const { requete } = await observer('MesTaches')
    expect(avis()).toBe('')

    etat.erreur = 'FORBIDDEN'
    await relireLesRequetes(client)
    await attendre(10)
    expect(avis()).toContain(
      'Vos accès ont changé, ou votre session a pris fin.'
    )
    expect(avis()).toContain('Recharger la page')
    // L'écran garde ses données, et sa requête ne reçoit aucune erreur.
    const courant = requete.getCurrentResult()
    expect(courant.data).toEqual({ version: 1 })
    expect(courant.error).toBeUndefined()
  })

  it('affiche l’avis quand la session a pris fin, sans vider la session du cache', async () => {
    const { client, etat } = banc()
    // Le nom s'insère dans le texte : codegen ne lit pas ce document, qui porte le
    // nom d'une opération de l'application.
    const nom = 'MenuPerimetres'
    const MENU = gql(`query ${nom} { moi { id } }`)
    const requete = client.watchQuery<{ moi: { id: string } | null }>({
      query: MENU,
    })
    requete.subscribe(() => undefined)
    await attendre(30)
    // Une relecture sans refus retire l'avis du test précédent.
    await relireLesRequetes(client)
    expect(avis()).toBe('')

    etat.sansSession = true
    await relireLesRequetes(client)
    await attendre(10)
    expect(avis()).toContain('votre session a pris fin')
    // La garde de session lit `moi` dans le cache : il n'est pas devenu null.
    expect(requete.getCurrentResult().data?.moi?.id).toBe('moi')
    const enCache = client.readQuery<{ moi: { id: string } | null }>({
      query: MENU,
    })
    expect(enCache?.moi?.id).toBe('moi')
  })

  it('garde l’avis pendant une panne, et le retire après une relecture sans refus', async () => {
    const { client, etat, observer } = banc()
    await observer('MesTaches')
    expect(avis()).not.toBe('')

    etat.panne = true
    await relireLesRequetes(client)
    expect(avis()).not.toBe('')

    etat.panne = false
    await relireLesRequetes(client)
    expect(avis()).toBe('')
  })
})
