import {
  getNamedType,
  getNullableType,
  isEnumType,
  isListType,
  isNonNullType,
  isObjectType,
  Kind,
  parse,
  typeFromAST,
  type DocumentNode,
  type FieldNode,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLOutputType,
  type GraphQLInputType,
  type GraphQLSchema,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql'

import { OPERATIONS_REST, type OperationRest } from './operations.ts'

/**
 * La version du contrat : celle de l'API REST v1, pas celle de l'installation. Le
 * contrat se lit sans jeton : il ne dit pas quelle version du logiciel tourne.
 */
export const VERSION_CONTRAT_API = '1.0.0'

// Contrat OpenAPI de l'API REST v1 (ADR 0064).
//
// Le contrat se calcule à partir des documents GraphQL des routes : une réponse
// décrit les champs que le document sélectionne, pas le type GraphQL entier. Le
// fichier `packages/server/openapi.json` en est la copie commitée, vérifiée en CI.

type Schema = Record<string, unknown>

/** Le document d'une route, analysé une fois. */
export interface OperationAnalysee extends OperationRest {
  analyse: DocumentNode
  definition: OperationDefinitionNode
  /** Le nom du champ racine, dont la valeur forme la réponse. */
  champ: string
}

export function analyser(operation: OperationRest): OperationAnalysee {
  const analyse = parse(operation.document)
  const definition = analyse.definitions[0]
  if (
    analyse.definitions.length !== 1 ||
    definition?.kind !== Kind.OPERATION_DEFINITION
  ) {
    throw new Error(`${operation.nom} : une seule opération par route.`)
  }
  const racine = definition.selectionSet.selections
  if (racine.length !== 1 || racine[0]?.kind !== Kind.FIELD) {
    throw new Error(`${operation.nom} : un seul champ racine par route.`)
  }
  return { ...operation, analyse, definition, champ: racine[0].name.value }
}

/** Les paramètres de chemin d'une route Express : `/taches/:id` rend `id`. */
export function parametresDuChemin(chemin: string): string[] {
  return [...chemin.matchAll(/:([A-Za-z]+)/g)].map(m => m[1]!)
}

function scalaire(type: GraphQLNamedType): Schema {
  switch (type.name) {
    case 'Int':
      return { type: 'integer' }
    case 'Float':
      return { type: 'number' }
    case 'Boolean':
      return { type: 'boolean' }
    case 'Date':
      return { type: 'string', format: 'date' }
    case 'DateTime':
      return { type: 'string', format: 'date-time' }
    case 'JSONObject':
      return { type: 'object' }
    default:
      return { type: 'string' }
  }
}

function feuille(type: GraphQLNamedType): Schema {
  if (isEnumType(type)) {
    return { type: 'string', enum: type.getValues().map(v => v.name) }
  }
  return scalaire(type)
}

/** Le schéma JSON d'une entrée : scalaire, énumération ou liste de ceux-ci. */
function schemaEntree(type: GraphQLInputType): Schema {
  const sansNull = getNullableType(type)
  const base = isListType(sansNull)
    ? { type: 'array', items: schemaEntree(sansNull.ofType) }
    : feuille(getNamedType(sansNull))
  return isNonNullType(type) ? base : { ...base, nullable: true }
}

/** Le schéma JSON d'une sortie, réduit aux champs que la sélection demande. */
function schemaSortie(
  type: GraphQLOutputType,
  selection: SelectionSetNode | undefined
): Schema {
  const sansNull = getNullableType(type)
  let base: Schema
  if (isListType(sansNull)) {
    base = { type: 'array', items: schemaSortie(sansNull.ofType, selection) }
  } else {
    const nomme = getNamedType(sansNull)
    base =
      isObjectType(nomme) && selection !== undefined
        ? objet(nomme, selection)
        : feuille(nomme)
  }
  return isNonNullType(type) ? base : { ...base, nullable: true }
}

function objet(type: GraphQLObjectType, selection: SelectionSetNode): Schema {
  const champs = type.getFields()
  const properties: Record<string, Schema> = {}
  const required: string[] = []
  for (const s of selection.selections) {
    if (s.kind !== Kind.FIELD) continue
    const nom = s.name.value
    const champ = champs[nom]
    if (champ === undefined)
      throw new Error(`Champ inconnu : ${type.name}.${nom}`)
    properties[nom] = {
      ...schemaSortie(champ.type, s.selectionSet),
      ...(champ.description ? { description: champ.description } : {}),
    }
    if (isNonNullType(champ.type)) required.push(nom)
  }
  return { type: 'object', properties, required }
}

const ERREUR_REF = { $ref: '#/components/schemas/Erreurs' }

const reponseErreur = (description: string) => ({
  description,
  content: { 'application/json': { schema: ERREUR_REF } },
})

/** Les réponses d'erreur communes à toutes les routes. */
const ERREURS = {
  '400': reponseErreur(
    'Saisie invalide (`SAISIE_INVALIDE`, `BAD_USER_INPUT`).'
  ),
  '401': reponseErreur(
    'Jeton absent ou invalide (`JETON_REQUIS`, `JETON_INVALIDE`).'
  ),
  '403': reponseErreur(
    'Accès refusé, portée insuffisante, API fermée, organisation en lecture seule ou module inactif.'
  ),
  '409': reponseErreur(
    'Conflit de version, ou confirmation requise (`CONFLIT_VERSION`, `CONFIRMATION_REQUISE`).'
  ),
  '422': reponseErreur(
    'Limite de l’organisation atteinte, ou requête trop lourde.'
  ),
  '429': reponseErreur('Limite de débit du jeton (`LIMITE_DE_DEBIT`).'),
}

function cheminOpenApi(chemin: string): string {
  return `/api/v1${chemin.replace(/:([A-Za-z]+)/g, '{$1}')}`
}

function operationOpenApi(schema: GraphQLSchema, op: OperationAnalysee) {
  const dansLeChemin = new Set(parametresDuChemin(op.chemin))
  const parameters: Schema[] = []
  const corps: Record<string, Schema> = {}
  const corpsRequis: string[] = []
  for (const v of op.definition.variableDefinitions ?? []) {
    const nom = v.variable.name.value
    const type = typeFromAST(schema, v.type) as GraphQLInputType | undefined
    if (type === undefined)
      throw new Error(`${op.nom} : type inconnu pour $${nom}.`)
    const requis = isNonNullType(type)
    if (dansLeChemin.has(nom)) {
      parameters.push({
        in: 'path',
        name: nom,
        required: true,
        schema: schemaEntree(type),
      })
    } else if (op.methode === 'GET') {
      parameters.push({
        in: 'query',
        name: nom,
        required: requis,
        schema: schemaEntree(type),
      })
    } else {
      corps[nom] = schemaEntree(type)
      if (requis) corpsRequis.push(nom)
    }
  }
  const racine =
    op.methode === 'GET' ? schema.getQueryType() : schema.getMutationType()
  const champ = racine?.getFields()[op.champ]
  if (champ === undefined) throw new Error(`${op.nom} : champ racine inconnu.`)
  const selection = (op.definition.selectionSet.selections[0] as FieldNode)
    .selectionSet
  return {
    operationId: op.nom,
    summary: op.resume,
    tags: [op.groupe],
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(op.methode === 'GET'
      ? {}
      : {
          requestBody: {
            required: corpsRequis.length > 0,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: corps,
                  required: corpsRequis,
                },
              },
            },
          },
        }),
    responses: {
      [String(op.statut ?? 200)]: {
        description: 'Réponse réussie.',
        content: {
          'application/json': { schema: schemaSortie(champ.type, selection) },
        },
      },
      ...ERREURS,
    },
  }
}

/** Le contrat OpenAPI 3.0 de l'API REST v1. */
export function contratOpenApi(
  schema: GraphQLSchema,
  version: string,
  operations: readonly OperationRest[] = OPERATIONS_REST
) {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const op of operations.map(analyser)) {
    const chemin = cheminOpenApi(op.chemin)
    paths[chemin] = {
      ...paths[chemin],
      [op.methode.toLowerCase()]: operationOpenApi(schema, op),
    }
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'Relaytour',
      version,
      description:
        'API REST v1 de Relaytour (ADR 0064). Chaque requête porte un jeton d’accès dans l’en-tête « Authorization: Bearer ». Le jeton agit au nom d’une personne, dans une seule organisation, avec ses droits. L’API GraphQL `/graphql` accepte le même jeton et ouvre toutes les opérations.',
      license: { name: 'AGPL-3.0-only' },
    },
    servers: [{ url: '/' }],
    security: [{ jeton: [] }],
    tags: [
      { name: 'compte', description: 'La personne et son jeton.' },
      {
        name: 'activites',
        description: 'Activités, périodes, périmètres et équipe.',
      },
      { name: 'taches', description: 'Tâches, priorités et commentaires.' },
      { name: 'fiches', description: 'Fiches méthode.' },
    ],
    paths,
    components: {
      securitySchemes: {
        jeton: {
          type: 'http',
          scheme: 'bearer',
          description: 'Un jeton d’accès `rt_…`.',
        },
      },
      schemas: {
        Erreurs: {
          type: 'object',
          required: ['erreurs'],
          properties: {
            erreurs: {
              type: 'array',
              items: {
                type: 'object',
                required: ['code', 'message'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  reference: {
                    type: 'string',
                    description:
                      'Référence d’une erreur interne, à citer au support.',
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}
