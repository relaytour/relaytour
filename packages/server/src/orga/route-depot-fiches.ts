import express from 'express'
import { z } from 'zod'

import { i18n } from '../lib/langue.ts'

import {
  deposerFiches,
  LIMITES_DEPOT_FICHES,
  perimetreDuDepot,
} from './depot-fiches.ts'
import {
  activiteAdministree,
  dansLaLimite,
  lireCorps,
  refuser,
  routeDeDepot,
  type Contexte,
  type ContexteDepot,
} from './route-depot-contenu.ts'

// Route du dépôt direct de fiches (ADR 0049). Les fichiers arrivent en JSON, leur
// contenu en base64 : un dépôt pèse 20 Mo au plus, soit environ 27 Mo encodés.

export const ROUTE_DEPOT_FICHES = '/medias/fiches/depot'

const MO = 1024 * 1024

const lireJson = express.json({
  limit: Math.ceil((LIMITES_DEPOT_FICHES.total * 4) / 3) + MO,
})

const Corps = z.object({
  fichiers: z
    .array(
      z.object({
        nom: z.string().min(1).max(255),
        // Un fichier de plus de 2 Mo s'écarte dans le rapport, sans refuser les
        // autres : seule la taille totale borne la requête.
        donnees: z.string(),
      })
    )
    // Au-delà de 50 fichiers, le rapport écarte les suivants avec leur raison :
    // seule la taille totale borne la requête.
    .min(1),
})

export function routeDepotFiches(
  app: express.Express,
  contexte: Contexte,
  origines: readonly string[]
): void {
  routeDeDepot(app, ROUTE_DEPOT_FICHES, contexte, origines, deposer)
}

async function deposer(
  req: express.Request,
  res: express.Response,
  ctx: ContexteDepot
): Promise<void> {
  // Un admin de l'activité dépose dans un périmètre ouvert de cette activité, ou
  // dans ses fiches communes. Un périmètre d'une autre activité donne le même
  // refus qu'une activité non administrée.
  const activiteId =
    typeof req.query.activite === 'string' ? req.query.activite : ''
  const activite =
    activiteId === '' ? null : await activiteAdministree(ctx, activiteId)
  const perimetre =
    activite === null
      ? false
      : await perimetreDuDepot(
          activite.id,
          typeof req.query.perimetre === 'string' && req.query.perimetre !== ''
            ? req.query.perimetre
            : null
        )
  if (activite === null || perimetre === false) {
    refuser(res, 403, 'FORBIDDEN', i18n._('Accès refusé.'))
    return
  }
  if (!(await dansLaLimite(res, ctx))) return

  const total = LIMITES_DEPOT_FICHES.total / MO
  const tropLourd = i18n._('Les fichiers déposés dépassent {mo} Mo au total.', {
    mo: total,
  })
  if (!(await lireCorps(req, res, lireJson, tropLourd))) return
  const lu = Corps.safeParse(req.body)
  if (!lu.success) {
    refuser(res, 400, 'SAISIE_INVALIDE', i18n._('La requête est illisible.'))
    return
  }
  const fichiers = lu.data.fichiers.map(f => ({
    nom: f.nom,
    octets: Buffer.from(f.donnees, 'base64'),
  }))
  if (
    fichiers.reduce((n, f) => n + f.octets.length, 0) >
    LIMITES_DEPOT_FICHES.total
  ) {
    refuser(res, 413, 'SAISIE_INVALIDE', tropLourd)
    return
  }
  res.json(
    await deposerFiches(ctx.organisation.id, activite.id, perimetre, fichiers, {
      ecrire: req.query.simulation !== '1',
      auteurId: ctx.personne.id,
    })
  )
}
