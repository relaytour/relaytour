import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { Express } from 'express'

import { env } from './env.ts'
import { apercu, pageAvecApercu } from './lib/apercu.ts'
import { journal } from './lib/journal.ts'
import { configurationPublique } from './lib/organisation.ts'

/** Adresse de la page de l'espace organisateur, vers laquelle le proxy réécrit (ADR 0073). */
export const CHEMIN_PAGE_ORGANISATEUR = '/espace/page'

/**
 * Politique de contenu de l'espace organisateur, la même que celle du Caddyfile
 * d'exemple. Le serveur la pose sur la page qu'il sert, à la place de la
 * politique fermée de l'API.
 */
export const POLITIQUE_ESPACE_ORGANISATEUR =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

let lue: { chemin: string; date: number; page: string } | null = null

/** index.html du dossier monté, relu seulement quand le fichier change. */
async function lirePage(dossier: string): Promise<string> {
  const chemin = join(dossier, 'index.html')
  const { mtimeMs } = await stat(chemin)
  if (lue?.chemin === chemin && lue.date === mtimeMs) return lue.page
  const page = await readFile(chemin, 'utf8')
  lue = { chemin, date: mtimeMs, page }
  return page
}

/**
 * La page de l'espace organisateur, avec l'aperçu de l'organisation que l'adresse
 * désigne (ADR 0073). Le proxy y réécrit toute adresse qui ne désigne pas un
 * fichier : la page se lit sans session, comme le fichier statique qu'elle
 * remplace, et ne porte que le nom public d'une organisation.
 */
export function routePageOrganisateur(app: Express): void {
  app.get(CHEMIN_PAGE_ORGANISATEUR, (req, res) => {
    const dossier = env.ESPACE_ORGANISATEUR_DOSSIER
    if (dossier === undefined) {
      res.status(404).end()
      return
    }
    const demande = req.query.organisation
    const slug =
      typeof demande === 'string' && SLUG.test(demande) ? demande : undefined
    void Promise.all([
      lirePage(dossier),
      configurationPublique(undefined, slug),
    ])
      .then(([page, configuration]) => {
        // Une configuration sans ligne en base est l'identité d'amorçage d'une
        // installation à plusieurs organisations : l'aperçu ne nomme personne.
        const organisation = configuration.id === null ? null : configuration
        const resultat = pageAvecApercu(
          page,
          apercu(organisation, {
            nomSite: env.APERCU_NOM_SITE,
            description: env.APERCU_DESCRIPTION,
            image: env.APERCU_IMAGE,
            origineOrga: env.ORIGINE_ORGA,
          })
        )
        if (resultat === null) {
          journal.error(
            { evenement: 'page-organisateur-sans-apercu' },
            'La page de l’espace organisateur ne porte pas le bloc de l’aperçu.'
          )
          res.status(500).end()
          return
        }
        res
          .set({
            'Content-Type': 'text/html; charset=utf-8',
            // La page désigne ses scripts par leur empreinte : elle se relit à
            // chaque visite, pour ne jamais citer ceux d'une version retirée.
            'Cache-Control': 'no-cache',
            'Content-Security-Policy': POLITIQUE_ESPACE_ORGANISATEUR,
          })
          .send(resultat)
      })
      .catch((erreur: unknown) => {
        journal.error(
          {
            evenement: 'page-organisateur-illisible',
            message: erreur instanceof Error ? erreur.message : String(erreur),
          },
          'La page de l’espace organisateur n’a pas pu être servie.'
        )
        res.status(503).end()
      })
  })
}
