import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client'
import { Observable } from 'rxjs'
import { describe, expect, it } from 'vitest'

import { OPTIONS_PAR_DEFAUT } from './apollo'
import { signalerLocalement } from './rafraichissement'

const attendre = (ms: number) => new Promise(ok => setTimeout(ok, ms))

const PAGE = gql('query PagePerimetre { version }')

/** Un client réglé comme l'espace organisateur, dont le serveur avance à chaque lecture. */
function banc() {
  let version = 0
  const lien = new ApolloLink(
    () =>
      new Observable(observateur => {
        const minuteur = setTimeout(() => {
          version += 1
          observateur.next({ data: { version } })
          observateur.complete()
        }, 5)
        return () => clearTimeout(minuteur)
      })
  )
  const client = new ApolloClient({
    link: lien,
    cache: new InMemoryCache(),
    defaultOptions: OPTIONS_PAR_DEFAUT,
  })
  /** Ouvre l'écran, note chaque version affichée, puis le ferme. */
  const ouvrir = async () => {
    const vues: (number | undefined)[] = []
    const abonnement = client
      .watchQuery<{ version: number }>({ query: PAGE })
      .subscribe(r => vues.push(r.data?.version))
    await attendre(30)
    abonnement.unsubscribe()
    return vues
  }
  return { ouvrir }
}

describe('client de l’espace organisateur', () => {
  it('affiche le cache d’un écran rouvert, puis la réponse du serveur', async () => {
    const { ouvrir } = banc()
    expect((await ouvrir()).at(-1)).toBe(1)
    // Le serveur a changé pendant que l'écran était fermé : un signal du flux ne
    // l'a pas relu. L'écran rouvert montre l'ancienne version, puis la nouvelle.
    const vues = await ouvrir()
    expect(vues).toContain(1)
    expect(vues.at(-1)).toBe(2)
  })
})

describe('signalerLocalement', () => {
  it('ne lève pas hors de la coquille, où aucun flux n’est monté', () => {
    // Les écrans connectés vivent dans la coquille, qui monte le flux : hors
    // d'elle, il n'y a aucun écran à relire.
    expect(() => signalerLocalement('EQUIPE', 'TACHE')).not.toThrow()
  })
})
