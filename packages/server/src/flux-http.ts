import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { getOperationAST, parse } from 'graphql'
import { createHandler } from 'graphql-sse/lib/use/express'

import type { AppContext } from './context.ts'
import { journal } from './lib/journal.ts'
import { schema } from './schema/index.ts'

// Flux SSE des abonnements GraphQL (ADR 0017), servi sur le chemin de l'API : un proxy
// qui relaie /graphql le relaie aussi, sans réglage de plus (ADR 0007).
//
// Seule une requête POST qui demande `text/event-stream` entre ici. Toute autre
// requête continue vers Apollo, qui garde ses protections. Le flux n'exécute que des
// abonnements : une requête ou une mutation présentée ici est refusée.

const REFUS_JSON = { 'content-type': 'application/json; charset=utf-8' }

/**
 * Le gestionnaire du flux. `contexte` construit le contexte d'une requête comme le
 * fait l'API : session, organisation, jeton d'administration.
 */
export function creerGestionnaireFlux(options: {
  contexte: (req: Request) => Promise<AppContext>
}): RequestHandler {
  // La bibliothèque attend un contexte indexable : le contexte de l'API en est un,
  // sans le déclarer.
  const gerer = createHandler<Record<PropertyKey, unknown>>({
    schema,
    context: async req => {
      const contexte = await options.contexte(req.raw)
      // Le flux revalide la session avec les en-têtes de sa requête d'origine.
      const relire = () => options.contexte(req.raw)
      return { ...contexte, relire }
    },
    onSubscribe: (_req, params) => {
      let operation: string | undefined
      try {
        operation = getOperationAST(
          parse(params.query),
          params.operationName
        )?.operation
      } catch {
        // Une requête illisible : la bibliothèque répond l'erreur de syntaxe.
        return
      }
      if (operation === 'subscription') return
      return [
        JSON.stringify({
          errors: [
            {
              message: 'Seuls les abonnements passent par ce flux.',
              extensions: { code: 'ABONNEMENT_ATTENDU' },
            },
          ],
        }),
        { status: 400, statusText: 'Bad Request', headers: REFUS_JSON },
      ]
    },
  })

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' || req.get('accept') !== 'text/event-stream') {
      next()
      return
    }
    // Chaque abonnement a sa propre connexion : le mode « connexion unique » de la
    // bibliothèque, qui réserve un flux par un jeton, reste fermé.
    if (
      req.get('x-graphql-event-stream-token') !== undefined ||
      'token' in req.query
    ) {
      res.status(400).set(REFUS_JSON).end()
      return
    }
    void gerer(req, res).catch((erreur: unknown) => {
      journal.error(
        { evenement: 'flux-en-erreur', message: (erreur as Error).message },
        'Un flux s’est terminé sur une erreur.'
      )
      if (res.headersSent) res.end()
      else res.status(500).end()
    })
  }
}
