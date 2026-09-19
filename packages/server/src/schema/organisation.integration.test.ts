import { ApolloServer } from '@apollo/server'
import { themeParDefaut } from '@relaytour/tokens'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { configurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// La configuration publique se lit sans session, et rien de plus (invariant 14).

const apollo = new ApolloServer<AppContext>({ schema })

async function executer(query: string) {
  const reponse = await apollo.executeOperation(
    { query },
    { contextValue: await buildContext('127.0.0.1', null) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

beforeAll(async () => {
  await apollo.start()
})

afterAll(async () => {
  await apollo.stop()
})

describe('organisation', () => {
  it('répond sans session avec le nom et le thème complet', async () => {
    const r = await executer(
      '{ organisation { slug nom sigle theme { couleurs { primaire sol3 } polices { texte } typographie { echelleTitre } } } }'
    )
    expect(r.errors).toBeUndefined()
    const configuration = await configurationOrganisation()
    const organisation = (r.data as { organisation: Record<string, unknown> })
      .organisation
    expect(organisation.nom).toBe(configuration.nom)
    expect(organisation.theme).toEqual({
      couleurs: {
        primaire: themeParDefaut.couleurs.primaire,
        sol3: themeParDefaut.couleurs.sol3,
      },
      polices: { texte: themeParDefaut.polices.texte },
      typographie: { echelleTitre: themeParDefaut.typographie.echelleTitre },
    })
  })

  it('refuse un champ protégé dans la même requête', async () => {
    const r = await executer('{ organisation { nom } personnes { id } }')
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN')
  })

  it.each(['expediteur', 'domainesCourrielAutorises', 'contactRecrutement'])(
    'ne connaît pas le champ privé %s',
    async champ => {
      const r = await executer(`{ organisation { ${champ} } }`)
      expect(r.data).toBeUndefined()
      expect(r.errors?.[0]?.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED')
    }
  )
})
