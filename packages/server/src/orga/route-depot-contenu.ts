import { prisma } from '@relaytour/database'
import express from 'express'
import { GraphQLError } from 'graphql'

import type { AppContext } from '../context.ts'
import { journal } from '../lib/journal.ts'
import {
  avecLangue,
  i18n,
  langueDe,
  languesDuNavigateur,
} from '../lib/langue.ts'
import { limiterParCle } from '../lib/limite.ts'

import { deposerContenu, ErreurDepot, LIMITES_DEPOT } from './depot-contenu.ts'

// Route du dépôt d'un dossier de contenu (ADR 0049). Une requête GraphQL est bornée
// à 1 Mo : l'archive arrive donc en corps brut, sous /medias/ que le proxy de
// l'installation relaie déjà vers l'API. Les droits se vérifient avant la lecture du
// corps : une personne sans droit n'envoie jamais 20 Mo au serveur.

export const ROUTE_DEPOT_CONTENU = '/medias/contenu/depot'

/** Dépôts permis par personne : un import réel suit en général une simulation. */
const DEPOTS = { max: 30, fenetreSecondes: 15 * 60 }

type Contexte = (req: express.Request) => Promise<AppContext>

const lireCorps = express.raw({
  type: 'application/zip',
  limit: LIMITES_DEPOT.taille,
})

function refuser(
  res: express.Response,
  statut: number,
  code: string,
  message: string,
  erreurs: string[] = []
): void {
  res.status(statut).json({ code, message, erreurs })
}

export function routeDepotContenu(
  app: express.Express,
  contexte: Contexte,
  origines: readonly string[]
): void {
  app.post(ROUTE_DEPOT_CONTENU, (req, res) => {
    res.set('Cache-Control', 'no-store')
    const navigateur = languesDuNavigateur(req.get('accept-language'))
    void avecLangue(langueDe(null, null, navigateur), () =>
      deposer(req, res, contexte, origines)
    ).catch((erreur: unknown) => {
      journal.error(
        {
          evenement: 'depot-contenu-echoue',
          message: (erreur as Error).message,
        },
        'Le dépôt d’un dossier de contenu a échoué.'
      )
      if (!res.headersSent) {
        refuser(res, 500, 'INTERNAL_SERVER_ERROR', i18n._('Erreur interne.'))
      }
    })
  })
}

async function deposer(
  req: express.Request,
  res: express.Response,
  contexte: Contexte,
  origines: readonly string[]
): Promise<void> {
  // Le dépôt part de l'espace organisateur seulement : une autre origine ne peut
  // pas se servir de la session de la personne.
  const origine = req.get('origin')
  if (origine === undefined || !origines.includes(origine)) {
    refuser(res, 403, 'FORBIDDEN', i18n._('Accès refusé.'))
    return
  }
  const ctx = await contexte(req)
  if (ctx.personne === null || ctx.organisation === null) {
    refuser(res, 401, 'UNAUTHENTICATED', i18n._('Accès refusé.'))
    return
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
    return
  }

  // Sans activité désignée, le dépôt porte sur toute l'organisation et exige un
  // admin de l'organisation. Une activité inconnue, archivée ou d'une autre
  // organisation donne le même refus qu'une activité non administrée.
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
    const ligne = (await ctx.estAdminDe(activiteId))
      ? await prisma.activite.findFirst({
          where: {
            id: activiteId,
            organisationId: ctx.organisation.id,
            archivedAt: null,
          },
          select: { id: true, slug: true },
        })
      : null
    if (ligne === null) {
      refuser(res, 403, 'FORBIDDEN', i18n._('Accès refusé.'))
      return
    }
    activite = ligne
  }

  const permis = await limiterParCle(
    `depot-contenu:${ctx.personne.id}`,
    DEPOTS.max,
    DEPOTS.fenetreSecondes,
    { libelle: 'la limite des dépôts de contenu' }
  )
  if (!permis) {
    refuser(
      res,
      429,
      'TROP_DE_REQUETES',
      i18n._('Trop de dépôts en peu de temps. Réessayez dans quelques minutes.')
    )
    return
  }

  try {
    await new Promise<void>((resoudre, rejeter) => {
      lireCorps(req, res, erreur => {
        if (erreur) rejeter(erreur as Error)
        else resoudre()
      })
    })
  } catch {
    refuser(
      res,
      413,
      'SAISIE_INVALIDE',
      i18n._('L’archive dépasse {mo} Mo.', {
        mo: LIMITES_DEPOT.taille / (1024 * 1024),
      })
    )
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
  try {
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
}
