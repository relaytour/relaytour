import { readFileSync } from 'node:fs'

import { complexityFromQuery } from '@pothos/plugin-complexity'
import {
  getNamedType,
  getNullableType,
  isEnumType,
  isListType,
  typeFromAST,
  validate,
  type GraphQLInputType,
} from 'graphql'
import { describe, expect, it } from 'vitest'

import { schema } from '../schema/index.ts'

import { analyser, contratOpenApi, parametresDuChemin } from './openapi.ts'
import { OPERATIONS_REST } from './operations.ts'
import { statutDuCode } from './routeur.ts'

// API REST v1 (ADR 0064) : chaque route porte un document valide, léger et
// cohérent avec son chemin, et le contrat commité suit le code.

const analysees = OPERATIONS_REST.map(analyser)

/** Une valeur valide pour le type d'une variable, pour mesurer la complexité. */
function valeurFactice(type: GraphQLInputType): unknown {
  const sansNull = getNullableType(type)
  if (isListType(sansNull)) return [valeurFactice(sansNull.ofType)]
  const nomme = getNamedType(sansNull)
  if (isEnumType(nomme)) return nomme.getValues()[0]!.name
  switch (nomme.name) {
    case 'Int':
      return 1
    case 'Boolean':
      return true
    case 'Date':
      return '2027-06-05'
    default:
      return 'x'
  }
}

describe('routes de l’API REST', () => {
  it.each(analysees.map(o => [o.nom, o] as const))(
    '%s porte un document valide pour le schéma',
    (_nom, op) => {
      expect(validate(schema, op.analyse)).toEqual([])
      expect(op.definition.operation).toBe(
        op.methode === 'GET' ? 'query' : 'mutation'
      )
    }
  )

  it.each(analysees.map(o => [o.nom, o] as const))(
    '%s reçoit chaque paramètre de chemin comme variable obligatoire',
    (_nom, op) => {
      const variables = new Map(
        (op.definition.variableDefinitions ?? []).map(v => [
          v.variable.name.value,
          v.type.kind,
        ])
      )
      for (const nom of parametresDuChemin(op.chemin)) {
        expect(variables.get(nom)).toBe('NonNullType')
      }
    }
  )

  it.each(analysees.map(o => [o.nom, o] as const))(
    '%s passe les limites de complexité du serveur',
    (_nom, op) => {
      const variables = Object.fromEntries(
        (op.definition.variableDefinitions ?? []).map(v => [
          v.variable.name.value,
          valeurFactice(typeFromAST(schema, v.type) as GraphQLInputType),
        ])
      )
      const { complexity, breadth, depth } = complexityFromQuery(op.analyse, {
        schema,
        variables,
      })
      expect(complexity).toBeLessThanOrEqual(2_000)
      expect(breadth).toBeLessThanOrEqual(100)
      expect(depth).toBeLessThanOrEqual(8)
    }
  )

  it('n’a pas deux routes sur le même chemin et la même méthode', () => {
    const cles = OPERATIONS_REST.map(o => `${o.methode} ${o.chemin}`)
    expect(new Set(cles).size).toBe(cles.length)
    const noms = OPERATIONS_REST.map(o => o.nom)
    expect(new Set(noms).size).toBe(noms.length)
  })

  it('n’expose aucun abonnement', () => {
    for (const op of analysees) {
      expect(op.definition.operation).not.toBe('subscription')
    }
  })
})

describe('contrat OpenAPI', () => {
  const contrat = contratOpenApi(schema, '0.0.0-contrat')

  it('décrit chaque route, avec le jeton comme sécurité', () => {
    const decrites = Object.entries(contrat.paths).flatMap(([chemin, ops]) =>
      Object.keys(ops).map(m => `${m.toUpperCase()} ${chemin}`)
    )
    expect(decrites).toHaveLength(OPERATIONS_REST.length)
    expect(contrat.security).toEqual([{ jeton: [] }])
  })

  it('réduit une réponse aux champs sélectionnés', () => {
    const tache = contrat.paths['/api/v1/taches/{id}']?.get as {
      responses: Record<
        string,
        { content: Record<string, { schema: { properties: object } }> }
      >
    }
    const champs = Object.keys(
      tache.responses['200']!.content['application/json']!.schema.properties
    )
    expect(champs).toContain('titre')
    // Un champ que le document ne demande pas n'apparaît pas.
    expect(champs).not.toContain('historiqueJalon')
  })

  it('suit le fichier commité', () => {
    const commite = readFileSync(
      new URL('../../openapi.json', import.meta.url),
      'utf8'
    )
    expect(JSON.parse(commite)).toEqual(JSON.parse(JSON.stringify(contrat)))
  })
})

describe('statut HTTP des erreurs', () => {
  it.each([
    ['JETON_REQUIS', 401],
    ['JETON_INVALIDE', 401],
    ['FORBIDDEN', 403],
    ['PORTEE_INSUFFISANTE', 403],
    ['API_INACTIVE', 403],
    ['LECTURE_SEULE', 403],
    ['MODULE_INACTIF', 403],
    ['SAISIE_INVALIDE', 400],
    ['BAD_USER_INPUT', 400],
    ['CONFLIT_VERSION', 409],
    ['CONFIRMATION_REQUISE', 409],
    ['LIMITE_ATTEINTE', 422],
    ['REQUETE_TROP_COMPLEXE', 422],
    ['LIMITE_DE_DEBIT', 429],
    ['INTERNAL_SERVER_ERROR', 500],
  ])('%s rend %i', (code, statut) => {
    expect(statutDuCode(code)).toBe(statut)
  })
})
