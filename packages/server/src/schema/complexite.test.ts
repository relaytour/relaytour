import { ApolloServer } from '@apollo/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'

import { schema } from './index.ts'

// Le schéma comporte des cycles (Perimetre.taches → Tache.perimetre). Une personne
// connectée ne doit pas pouvoir saturer le serveur avec une requête imbriquée.
// Ce test n'ouvre aucune connexion : le refus intervient avant tout résolveur.

const contexteConnecte: AppContext = {
  ip: '127.0.0.1',
  personne: { id: 'p1', nom: 'Test', email: 'test@exemple.fr', estAdmin: false },
  perimetresAffectes: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  perimetresConnus: () => {
    throw new Error('Un résolveur a été appelé.')
  },
}

/** `perimetre { taches { perimetre { … } } }` sur `niveaux` niveaux de sélection. */
function requeteImbriquee(niveaux: number): string {
  // Sous la racine, le premier niveau est toujours `taches` ; on construit de l'intérieur.
  const enveloppes = niveaux - 2
  let selection = 'id'
  for (let i = 0; i < enveloppes; i += 1) {
    const rang = enveloppes - 1 - i
    selection =
      rang % 2 === 0
        ? `taches(editionId: "e1") { ${selection} }`
        : `perimetre { ${selection} }`
  }
  return `{ perimetre(slug: "x") { ${selection} } }`
}

const apollo = new ApolloServer<AppContext>({ schema })

beforeAll(() => apollo.start())
afterAll(() => apollo.stop())

async function executer(query: string) {
  const reponse = await apollo.executeOperation(
    { query },
    { contextValue: contexteConnecte }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

describe('limites de complexité des requêtes', () => {
  it('refuse une requête de profondeur 12 avant toute exécution', async () => {
    const resultat = await executer(requeteImbriquee(12))
    expect(resultat.data).toEqual({ perimetre: null })
    expect(resultat.errors).toHaveLength(1)
    const erreur = resultat.errors?.[0]
    expect(erreur?.extensions?.code).toBe('REQUETE_TROP_PROFONDE')
    expect(erreur?.extensions?.profondeur).toBe(12)
    expect(erreur?.message).toBe(
      'La requête est trop profonde (12 niveaux, maximum 8).'
    )
  })

  it('refuse une requête qui sélectionne plus de 100 champs', async () => {
    const champs = Array.from(
      { length: 101 },
      (_, i) => `c${i}: baremeScore { tacheRealisee }`
    )
    const resultat = await executer(`{ ${champs.join(' ')} }`)
    expect(resultat.errors?.[0]?.extensions?.code).toBe('REQUETE_TROP_LARGE')
  })

  it('refuse une requête trop coûteuse même sous la profondeur maximale', async () => {
    // Profondeur 8 (la limite), mais chaque niveau de liste multiplie le coût par 10 : 2 222 > 2 000.
    const resultat = await executer(requeteImbriquee(8))
    expect(resultat.errors?.[0]?.extensions?.code).toBe('REQUETE_TROP_COMPLEXE')
  })

  it('laisse passer une requête simple jusqu’au résolveur', async () => {
    const resultat = await executer('{ baremeScore { tacheRealisee } }')
    expect(resultat.errors).toBeUndefined()
    const bareme = resultat.data?.baremeScore as { tacheRealisee: number }
    expect(typeof bareme.tacheRealisee).toBe('number')
  })
})
