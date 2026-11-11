import type { RequestHandler, Request } from 'express'

import { buildContext, type AppContext } from './context.ts'
import { apiInactive, jetonInvalide, limiteDeDebit } from './lib/erreurs.ts'
import { noterAcces, resoudreJetonAcces } from './lib/jetons-acces.ts'
import { journal } from './lib/journal.ts'
import { limiterParCle, rendreTentative } from './lib/limite.ts'

// Contexte d'une requête porteuse d'un jeton d'accès (ADR 0064).
//
// Le jeton désigne la personne et l'organisation : l'en-tête d'organisation de
// l'espace organisateur ne compte pas. Un jeton refusé rend une requête anonyme qui
// porte son refus : les champs protégés répondent ce refus, et la route GraphQL
// répond le statut HTTP correspondant.

/**
 * Jetons refusés depuis une même adresse en un quart d'heure. Au-delà, l'adresse
 * reçoit la limite de débit, même avec un jeton exact. La valeur reste haute : un
 * programme qui relaie plusieurs personnes appelle depuis une seule adresse.
 */
export const REFUS_DE_JETON_ACCES = { max: 60, fenetreSecondes: 15 * 60 }

/** Requêtes permises par jeton et par minute. */
export const DEBIT_JETON_ACCES = { max: 120, fenetreSecondes: 60 }

export async function contexteDeJetonAcces(
  ip: string | undefined,
  jeton: string,
  activiteDemandee: string | null,
  maintenant = new Date()
): Promise<AppContext> {
  const anonyme = (refus: ReturnType<typeof jetonInvalide>) =>
    buildContext(ip, null, null, false, null, { refus })
  // La tentative se réserve avant la recherche, puis se rend si le jeton existe :
  // seuls les refus s'accumulent, comme pour le jeton d'administration.
  const cleRefus = `jeton-acces-refuse:${ip ?? 'inconnue'}`
  const permise = await limiterParCle(
    cleRefus,
    REFUS_DE_JETON_ACCES.max,
    REFUS_DE_JETON_ACCES.fenetreSecondes,
    { libelle: 'la limite des jetons d’accès refusés' }
  )
  if (!permise) return anonyme(limiteDeDebit())
  const resolution = await resoudreJetonAcces(jeton, maintenant)
  if (resolution.issue === 'invalide') {
    // Le journal ne reçoit jamais le jeton (invariant 6).
    journal.warn(
      { evenement: 'jeton-acces-refuse', ip },
      'Un jeton d’accès invalide a été présenté.'
    )
    return anonyme(jetonInvalide())
  }
  await rendreTentative(cleRefus)
  if (resolution.issue === 'api-fermee') {
    return anonyme(apiInactive(resolution.cause, resolution.motif))
  }
  const debitPermis = await limiterParCle(
    `jeton-acces:${resolution.jeton.id}`,
    DEBIT_JETON_ACCES.max,
    DEBIT_JETON_ACCES.fenetreSecondes,
    {
      libelle: 'la limite de débit d’un jeton d’accès',
      // Sans Redis, le débit d'un programme n'aurait plus de borne : le jeton reçoit
      // la limite, et le programme réessaie. L'espace organisateur n'est pas touché.
      siIndisponible: 'refuser',
    }
  )
  if (!debitPermis) return anonyme(limiteDeDebit())
  await noterAcces(resolution.jeton.id, maintenant)
  return buildContext(
    ip,
    resolution.userId,
    resolution.organisationSlug,
    false,
    activiteDemandee,
    { jeton: resolution.jeton }
  )
}

/** Le statut HTTP d'un refus de jeton, pour une réponse sans exécution. */
export function statutDuRefus(code: unknown): 401 | 403 | 429 {
  if (code === 'LIMITE_DE_DEBIT') return 429
  if (code === 'API_INACTIVE') return 403
  return 401
}

/**
 * Le contrôle de la route GraphQL : un jeton d'accès refusé reçoit son statut HTTP
 * avant toute exécution. 401 pour un jeton invalide, avec `WWW-Authenticate`, 403
 * pour une API fermée, 429 pour la limite de débit, avec `Retry-After`. Le contexte
 * d'un jeton accepté se garde dans `calcules`, pour qu'Apollo ne le recalcule pas.
 */
export function creerRefusDeJetonAcces(
  contexte: (req: Request) => Promise<AppContext>,
  calcules: WeakMap<Request, AppContext>
): RequestHandler {
  return (req, res, suite) => {
    const porteur = /^Bearer\s+(rt_\S*)\s*$/i.exec(
      req.get('authorization') ?? ''
    )
    if (porteur === null) {
      suite()
      return
    }
    void contexte(req).then(
      ctx => {
        if (ctx.refus === null) {
          calcules.set(req, ctx)
          suite()
          return
        }
        const statut = statutDuRefus(ctx.refus.extensions.code)
        if (statut === 401) {
          res.set('WWW-Authenticate', 'Bearer error="invalid_token"')
        }
        if (statut === 429) res.set('Retry-After', '60')
        res.status(statut).json({
          errors: [
            { message: ctx.refus.message, extensions: ctx.refus.extensions },
          ],
        })
      },
      (erreur: unknown) => suite(erreur)
    )
  }
}
