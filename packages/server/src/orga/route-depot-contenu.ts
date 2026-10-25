import { prisma } from '@relaytour/database'
import express from 'express'
import { GraphQLError } from 'graphql'

import type {
  AppContext,
  OrganisationActive,
  PersonneConnectee,
} from '../context.ts'
import { journal } from '../lib/journal.ts'
import {
  avecLangue,
  i18n,
  langueDe,
  languesDuNavigateur,
} from '../lib/langue.ts'
import { limiterParCle } from '../lib/limite.ts'

import { deposerContenu, ErreurDepot, LIMITES_DEPOT } from './depot-contenu.ts'

// Routes de dépôt de l'espace organisateur (ADR 0049). Une requête GraphQL est
// bornée à 1 Mo : une archive ou des fichiers arrivent donc par leur propre route,
// sous /medias/ que le proxy de l'installation relaie déjà vers l'API. Les droits
// se vérifient avant la lecture du corps : une personne sans droit n'envoie jamais
// 20 Mo au serveur.

export const ROUTE_DEPOT_CONTENU = '/medias/contenu/depot'

/** Dépôts permis par personne : un import réel suit en général une simulation. */
const DEPOTS = { max: 60, fenetreSecondes: 15 * 60 }

export type Contexte = (req: express.Request) => Promise<AppContext>

/** Le contexte d'une demande de dépôt acceptée : une personne dans son organisation. */
export type ContexteDepot = AppContext & {
  personne: PersonneConnectee
  organisation: OrganisationActive
}

export function refuser(
  res: express.Response,
  statut: number,
  code: string,
  message: string,
  erreurs: string[] = []
): void {
  res.status(statut).json({ code, message, erreurs })
}

/**
 * Enregistre une route de dépôt. La demande s'exécute dans la langue de la
 * personne ; l'origine, la session, la lecture seule et la limite de débit se
 * contrôlent avant `traiter`. Une ErreurDepot ou une GraphQLError devient un refus
 * lisible ; toute autre erreur, une erreur interne journalisée.
 */
export function routeDeDepot(
  app: express.Express,
  chemin: string,
  contexte: Contexte,
  origines: readonly string[],
  traiter: (
    req: express.Request,
    res: express.Response,
    ctx: ContexteDepot
  ) => Promise<void>
): void {
  app.post(chemin, (req, res) => {
    res.set('Cache-Control', 'no-store')
    const navigateur = languesDuNavigateur(req.get('accept-language'))
    void avecLangue(langueDe(null, null, navigateur), async () => {
      const ctx = await autoriser(req, res, contexte, origines)
      if (ctx === null) return
      try {
        await traiter(req, res, ctx)
      } catch (erreur) {
        if (erreur instanceof ErreurDepot) {
          refuser(res, 422, erreur.code, erreur.message, erreur.erreurs)
          return
        }
        if (erreur instanceof GraphQLError) {
          refuser(res, 422, 'SAISIE_INVALIDE', erreur.message)
          return
        }
        throw erreur
      }
    }).catch((erreur: unknown) => {
      journal.error(
        {
          evenement: 'depot-echoue',
          route: chemin,
          message: (erreur as Error).message,
        },
        'Un dépôt depuis l’espace organisateur a échoué.'
      )
      if (!res.headersSent) {
        refuser(res, 500, 'INTERNAL_SERVER_ERROR', i18n._('Erreur interne.'))
      }
    })
  })
}

async function autoriser(
  req: express.Request,
  res: express.Response,
  contexte: Contexte,
  origines: readonly string[]
): Promise<ContexteDepot | null> {
  // Le dépôt part de l'espace organisateur seulement : une autre origine ne peut
  // pas se servir de la session de la personne.
  const origine = req.get('origin')
  if (origine === undefined || !origines.includes(origine)) {
    refuser(res, 403, 'FORBIDDEN', i18n._('Accès refusé.'))
    return null
  }
  const ctx = await contexte(req)
  if (ctx.personne === null || ctx.organisation === null) {
    refuser(res, 401, 'UNAUTHENTICATED', i18n._('Accès refusé.'))
    return null
  }
  if (ctx.organisation.statut === 'LECTURE_SEULE') {
    refuser(
      res,
      403,
      'LECTURE_SEULE',
      i18n._(
        'Cette organisation est en lecture seule : vous pouvez consulter et exporter ses données, pas les modifier.'
      )
    )
    return null
  }
  return ctx as ContexteDepot
}

/**
 * L'activité ouverte de l'organisation si la personne l'administre, sinon null.
 * Une activité inconnue, archivée ou d'une autre organisation donne le même refus
 * qu'une activité non administrée.
 */
export async function activiteAdministree(
  ctx: ContexteDepot,
  activiteId: string
): Promise<{ id: string; slug: string } | null> {
  if (!(await ctx.estAdminDe(activiteId))) return null
  return prisma.activite.findFirst({
    where: {
      id: activiteId,
      organisationId: ctx.organisation.id,
      archivedAt: null,
    },
    select: { id: true, slug: true },
  })
}

/** Refuse la demande quand la personne a trop déposé en peu de temps. */
export async function dansLaLimite(
  res: express.Response,
  ctx: ContexteDepot
): Promise<boolean> {
  const permis = await limiterParCle(
    `depot:${ctx.personne.id}`,
    DEPOTS.max,
    DEPOTS.fenetreSecondes,
    { libelle: 'la limite des dépôts' }
  )
  if (!permis) {
    refuser(
      res,
      429,
      'TROP_DE_REQUETES',
      i18n._('Trop de dépôts en peu de temps. Réessayez dans quelques minutes.')
    )
  }
  return permis
}

/** Lit le corps avec un analyseur borné. Faux, et refus 413, au-delà de la borne. */
export async function lireCorps(
  req: express.Request,
  res: express.Response,
  analyseur: express.RequestHandler,
  messageTropLourd: string
): Promise<boolean> {
  try {
    await new Promise<void>((resoudre, rejeter) => {
      void analyseur(req, res, erreur => {
        if (erreur) rejeter(erreur as Error)
        else resoudre()
      })
    })
    return true
  } catch (erreur) {
    const statut = (erreur as { status?: number }).status
    refuser(
      res,
      statut === 413 ? 413 : 400,
      'SAISIE_INVALIDE',
      statut === 413 ? messageTropLourd : i18n._('La requête est illisible.')
    )
    return false
  }
}

const lireArchive = express.raw({
  type: 'application/zip',
  limit: LIMITES_DEPOT.taille,
})

export function routeDepotContenu(
  app: express.Express,
  contexte: Contexte,
  origines: readonly string[]
): void {
  routeDeDepot(app, ROUTE_DEPOT_CONTENU, contexte, origines, deposer)
}

async function deposer(
  req: express.Request,
  res: express.Response,
  ctx: ContexteDepot
): Promise<void> {
  // Sans activité désignée, le dépôt porte sur toute l'organisation et exige un
  // admin de l'organisation.
  const activiteId =
    typeof req.query.activite === 'string' && req.query.activite !== ''
      ? req.query.activite
      : null
  let activite: { id: string; slug: string } | null = null
  if (activiteId === null) {
    if (ctx.organisation.role !== 'ADMIN') {
      refuser(res, 403, 'FORBIDDEN', i18n._('Accès refusé.'))
      return
    }
  } else {
    activite = await activiteAdministree(ctx, activiteId)
    if (activite === null) {
      refuser(res, 403, 'FORBIDDEN', i18n._('Accès refusé.'))
      return
    }
  }
  if (!(await dansLaLimite(res, ctx))) return

  const mo = LIMITES_DEPOT.taille / (1024 * 1024)
  if (
    !(await lireCorps(
      req,
      res,
      lireArchive,
      i18n._('L’archive dépasse {mo} Mo.', { mo })
    ))
  ) {
    return
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    refuser(
      res,
      400,
      'SAISIE_INVALIDE',
      i18n._('Le fichier n’est pas une archive zip lisible.')
    )
    return
  }

  const simulation = req.query.simulation === '1'
  const rapport = await deposerContenu(prisma, {
    organisationId: ctx.organisation.id,
    organisationSlug: ctx.organisation.slug,
    activite,
    archive: req.body,
    simulation,
    forcer: req.query.forcer === '1',
  })
  if (!simulation) {
    journal.info(
      {
        evenement: 'contenu-depose',
        organisation: ctx.organisation.slug,
        activite: activite?.slug ?? null,
        personne: ctx.personne.id,
      },
      'Un dossier de contenu a été importé depuis l’espace organisateur.'
    )
  }
  res.json(rapport)
}
