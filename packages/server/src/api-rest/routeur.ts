import express, { type Request, type Response } from 'express'
import {
  execute,
  getNamedType,
  GraphQLError,
  isListType,
  getNullableType,
  typeFromAST,
  type GraphQLInputType,
  type GraphQLSchema,
} from 'graphql'

import type { AppContext } from '../context.ts'
import { formaterErreur } from '../lib/erreurs.ts'
import { i18n } from '../lib/langue.ts'

import { contratOpenApi, analyser, parametresDuChemin } from './openapi.ts'
import { OPERATIONS_REST, type OperationRest } from './operations.ts'

// API REST v1 (ADR 0064).
//
// Chaque route exécute son document GraphQL sur le schéma de l'API, avec le
// contexte du jeton d'accès. Une session de l'espace organisateur n'ouvre pas ces
// routes : un cookie n'y est jamais lu, et la route n'a pas besoin de protection
// contre les requêtes d'une autre origine. Le contrat se lit sans jeton.

/** Le statut HTTP d'un code d'erreur de l'API. */
export function statutDuCode(code: unknown): number {
  switch (code) {
    case 'JETON_REQUIS':
    case 'JETON_INVALIDE':
      return 401
    case 'FORBIDDEN':
    case 'PORTEE_INSUFFISANTE':
    case 'API_INACTIVE':
    case 'LECTURE_SEULE':
    case 'MODULE_INACTIF':
      return 403
    case 'SAISIE_INVALIDE':
    case 'BAD_USER_INPUT':
    case 'GRAPHQL_VALIDATION_FAILED':
    case 'BAD_REQUEST':
      return 400
    case 'CONFLIT_VERSION':
    case 'CONFIRMATION_REQUISE':
      return 409
    case 'LIMITE_ATTEINTE':
    case 'REQUETE_TROP_PROFONDE':
    case 'REQUETE_TROP_LARGE':
    case 'REQUETE_TROP_COMPLEXE':
      return 422
    case 'LIMITE_DE_DEBIT':
      return 429
    default:
      return 500
  }
}

interface ErreurRest {
  code: string
  message: string
  [cle: string]: unknown
}

function repondreErreurs(res: Response, erreurs: readonly ErreurRest[]) {
  const statut = statutDuCode(erreurs[0]?.code)
  if (statut === 401)
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"')
  if (statut === 429) res.set('Retry-After', '60')
  res.status(statut).json({ erreurs })
}

/** Une erreur GraphQL, au format REST, avec le masquage des erreurs internes. */
function versRest(erreur: GraphQLError): ErreurRest {
  // Une erreur sans chemin vient des variables : une saisie invalide.
  if (erreur.path === undefined && erreur.extensions.code === undefined) {
    return { code: 'SAISIE_INVALIDE', message: erreur.message }
  }
  const formatee = formaterErreur(erreur.toJSON(), erreur)
  const { code, ...details } = formatee.extensions ?? {}
  return {
    ...details,
    code: typeof code === 'string' ? code : 'INTERNAL_SERVER_ERROR',
    message: formatee.message,
  }
}

/** Une valeur lue dans l'adresse, convertie selon le type de sa variable. */
function depuisLAdresse(valeur: unknown, type: GraphQLInputType): unknown {
  if (typeof valeur !== 'string') return valeur
  if (isListType(getNullableType(type))) return valeur.split(',')
  switch (getNamedType(type).name) {
    case 'Int':
    case 'Float':
      return /^-?\d+(\.\d+)?$/.test(valeur) ? Number(valeur) : valeur
    case 'Boolean':
      return valeur === 'true' ? true : valeur === 'false' ? false : valeur
    default:
      return valeur
  }
}

function variables(
  schema: GraphQLSchema,
  op: ReturnType<typeof analyser>,
  req: Request
): Record<string, unknown> {
  const dansLeChemin = new Set(parametresDuChemin(op.chemin))
  const corps =
    op.methode === 'GET' || typeof req.body !== 'object' || req.body === null
      ? {}
      : (req.body as Record<string, unknown>)
  const valeurs: Record<string, unknown> = {}
  for (const v of op.definition.variableDefinitions ?? []) {
    const nom = v.variable.name.value
    const type = typeFromAST(schema, v.type) as GraphQLInputType
    const brute = dansLeChemin.has(nom)
      ? req.params[nom]
      : op.methode === 'GET'
        ? req.query[nom]
        : corps[nom]
    if (brute === undefined) continue
    valeurs[nom] =
      dansLeChemin.has(nom) || op.methode === 'GET'
        ? depuisLAdresse(brute, type)
        : brute
  }
  return valeurs
}

export interface OptionsApiRest {
  schema: GraphQLSchema
  /** La version servie dans le contrat. */
  version: string
  /**
   * Le contexte d'une requête porteuse d'un jeton d'accès. Il porte `refus` quand
   * le jeton est inutilisable.
   */
  contexte: (req: Request, jeton: string) => Promise<AppContext>
  operations?: readonly OperationRest[]
}

/** Le routeur de l'API REST v1, à monter sous `/api/v1`. */
export function routeurApiRest(options: OptionsApiRest): express.Router {
  const routeur = express.Router()
  const operations = (options.operations ?? OPERATIONS_REST).map(analyser)
  const contrat = contratOpenApi(options.schema, options.version, operations)

  routeur.use((_req, res, suite) => {
    res.set('Cache-Control', 'no-store')
    res.set('X-Robots-Tag', 'noindex')
    suite()
  })

  routeur.get('/openapi.json', (_req, res) => {
    res.json(contrat)
  })

  routeur.use(express.json({ limit: '1mb' }))

  // Tout le reste exige un jeton d'accès. Une session ne compte pas.
  routeur.use((req, res, suite) => {
    const porteur = /^Bearer\s+(rt_\S+)\s*$/i.exec(
      req.get('authorization') ?? ''
    )
    if (porteur === null) {
      repondreErreurs(res, [
        {
          code: 'JETON_REQUIS',
          message: i18n._(
            'Cette route demande un jeton d’accès dans l’en-tête « Authorization: Bearer ».'
          ),
        },
      ])
      return
    }
    options.contexte(req, porteur[1]!).then(
      ctx => {
        if (ctx.refus !== null) {
          repondreErreurs(res, [versRest(ctx.refus)])
          return
        }
        res.locals.contexte = ctx
        suite()
      },
      (erreur: unknown) => suite(erreur)
    )
  })

  for (const op of operations) {
    const methode = op.methode.toLowerCase() as 'get' | 'post' | 'patch'
    routeur[methode](op.chemin, (req, res, suite) => {
      const contextValue = res.locals.contexte as AppContext
      Promise.resolve(
        execute({
          schema: options.schema,
          document: op.analyse,
          contextValue,
          variableValues: variables(options.schema, op, req),
        })
      ).then(resultat => {
        if (resultat.errors !== undefined && resultat.errors.length > 0) {
          repondreErreurs(res, resultat.errors.map(versRest))
          return
        }
        res.status(op.statut ?? 200).json(resultat.data?.[op.champ] ?? null)
      }, suite)
    })
  }

  routeur.use((_req, res) => {
    res.status(404).json({
      erreurs: [
        {
          code: 'ROUTE_INCONNUE',
          message: i18n._('Cette route n’existe pas dans l’API REST v1.'),
        },
      ],
    })
  })

  // Un corps JSON illisible : une saisie invalide, pas une erreur interne.
  routeur.use(
    (
      erreur: unknown,
      _req: Request,
      res: Response,
      suite: express.NextFunction
    ) => {
      if (
        erreur instanceof SyntaxError ||
        (erreur as { type?: string }).type === 'entity.too.large'
      ) {
        repondreErreurs(res, [
          {
            code: 'SAISIE_INVALIDE',
            message: i18n._(
              'Le corps de la requête doit être un objet JSON de 1 Mo au plus.'
            ),
          },
        ])
        return
      }
      suite(erreur)
    }
  )

  return routeur
}
