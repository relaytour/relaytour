import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { Express } from 'express'

import { apercu, pageAvecApercu, type ReglagesApercu } from './lib/apercu.ts'
import { adresseClient } from './lib/adresse-client.ts'
import { journal } from './lib/journal.ts'
import type { ConfigurationOrganisation } from './lib/organisation.ts'

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

/** Une page composée sert une minute, pour toute requête qui désigne la même organisation. */
const DUREE_CACHE_MS = 60_000
/** Au-delà, la plus ancienne page composée sort du cache. */
const PAGES_EN_CACHE = 100

export interface OptionsPageOrganisateur {
  /** Dossier qui contient index.html ; absent, la route répond 404. */
  dossier: string | undefined
  reglages: ReglagesApercu
  /** La configuration publique de l'organisation désignée par son slug. */
  configuration: (
    slug: string | undefined
  ) => Promise<Pick<ConfigurationOrganisation, 'id' | 'nom' | 'langue'>>
  /** Compte une lecture de la base pour une adresse ; false au-delà de la limite. */
  limiter: (adresse: string) => Promise<boolean>
}

/**
 * La page de l'espace organisateur, avec l'aperçu de l'organisation que l'adresse
 * désigne (ADR 0073). Le proxy y réécrit toute adresse qui ne désigne pas un
 * fichier : la page se lit sans session, comme le fichier statique qu'elle
 * remplace, et ne porte que le nom public d'une organisation.
 *
 * Une page composée se garde une minute par slug. Au-delà de la limite d'une
 * adresse, la page part avec l'aperçu qui ne nomme personne, sans lire la base :
 * une page de l'application n'est jamais refusée.
 */
export function routePageOrganisateur(
  app: Express,
  options: OptionsPageOrganisateur
): void {
  let lue: { date: number; page: string } | null = null
  const cache = new Map<
    string,
    { date: number; expire: number; html: string }
  >()

  /** index.html du dossier, relu seulement quand le fichier change. */
  async function lirePage(
    dossier: string
  ): Promise<{ date: number; page: string }> {
    const chemin = join(dossier, 'index.html')
    const { mtimeMs } = await stat(chemin)
    if (lue?.date !== mtimeMs) {
      lue = { date: mtimeMs, page: await readFile(chemin, 'utf8') }
    }
    return lue
  }

  /** La page avec l'aperçu, ou la page telle quelle si elle ne porte pas le bloc. */
  function composer(
    page: string,
    organisation: Pick<ConfigurationOrganisation, 'nom' | 'langue'> | null
  ): string {
    const html = pageAvecApercu(page, apercu(organisation, options.reglages))
    if (html !== null) return html
    journal.warn(
      { evenement: 'page-organisateur-sans-apercu' },
      'La page de l’espace organisateur ne porte pas le bloc de l’aperçu : elle part telle quelle.'
    )
    return page
  }

  app.get(CHEMIN_PAGE_ORGANISATEUR, (req, res) => {
    const dossier = options.dossier
    if (dossier === undefined) {
      res.status(404).end()
      return
    }
    const demande = req.query.organisation
    const slug =
      typeof demande === 'string' && SLUG.test(demande) ? demande : undefined
    const cle = slug ?? ''
    const envoyer = (html: string) =>
      res
        .set({
          'Content-Type': 'text/html; charset=utf-8',
          // La page désigne ses scripts par leur empreinte : elle se relit à
          // chaque visite, pour ne jamais citer ceux d'une version retirée.
          'Cache-Control': 'no-cache',
          'Content-Security-Policy': POLITIQUE_ESPACE_ORGANISATEUR,
        })
        .send(html)

    void (async () => {
      const { date, page } = await lirePage(dossier)
      const maintenant = Date.now()
      const enCache = cache.get(cle)
      if (enCache?.date === date && enCache.expire > maintenant) {
        envoyer(enCache.html)
        return
      }
      if (!(await options.limiter(adresseClient(req)))) {
        envoyer(composer(page, null))
        return
      }
      const configuration = await options.configuration(slug)
      // Une configuration sans ligne en base est l'identité d'amorçage d'une
      // installation à plusieurs organisations : l'aperçu ne nomme personne.
      const html = composer(
        page,
        configuration.id === null ? null : configuration
      )
      cache.delete(cle)
      if (cache.size >= PAGES_EN_CACHE) {
        const plusAncienne = cache.keys().next().value
        if (plusAncienne !== undefined) cache.delete(plusAncienne)
      }
      cache.set(cle, { date, expire: maintenant + DUREE_CACHE_MS, html })
      envoyer(html)
    })().catch((erreur: unknown) => {
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
