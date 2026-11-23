import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { prisma } from '@relaytour/database'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { creerOrganisation } from './lib/installation.ts'
import { configurationPublique } from './lib/organisation.ts'
import {
  CHEMIN_PAGE_ORGANISATEUR,
  POLITIQUE_ESPACE_ORGANISATEUR,
  routePageOrganisateur,
  type OptionsPageOrganisateur,
} from './route-page-organisateur.ts'

// Page de l'espace organisateur avec l'aperçu d'un lien partagé (ADR 0073).

const s = randomUUID().slice(0, 8)
const slug = `apercu-${s}`
const NOM = `Rencontres ${s}`
const PAGE = readFileSync(
  new URL('../../orga/index.html', import.meta.url),
  'utf8'
)
const dossiers: string[] = []
const serveurs: ReturnType<express.Express['listen']>[] = []
let organisationId = ''

function dossierAvec(page: string): string {
  const dossier = mkdtempSync(join(tmpdir(), 'relaytour-page-'))
  writeFileSync(join(dossier, 'index.html'), page)
  dossiers.push(dossier)
  return dossier
}

/** Une API qui ne monte que la route de la page, avec ses options. */
async function demarrer(
  options: Partial<OptionsPageOrganisateur> = {}
): Promise<{ adresse: string; lectures: string[] }> {
  const lectures: string[] = []
  const app = express()
  routePageOrganisateur(app, {
    dossier: dossierAvec(PAGE),
    reglages: {
      nomSite: undefined,
      description: undefined,
      image: undefined,
      origineOrga: 'https://orga.exemple.org',
    },
    configuration: slugDemande => {
      lectures.push(slugDemande ?? '')
      return configurationPublique(undefined, slugDemande)
    },
    limiter: () => Promise.resolve(true),
    ...options,
  })
  const serveur = await new Promise<ReturnType<express.Express['listen']>>(
    resoudre => {
      const s = app.listen(0, '127.0.0.1', () => resoudre(s))
    }
  )
  serveurs.push(serveur)
  const { port } = serveur.address() as AddressInfo
  return { adresse: `http://127.0.0.1:${port}`, lectures }
}

const titre = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1]

beforeAll(async () => {
  // L'installation de test porte au moins deux organisations : celle-ci et
  // l'organisation par défaut.
  organisationId = await creerOrganisation({ slug, nom: NOM })
})

afterAll(async () => {
  for (const serveur of serveurs) serveur.close()
  for (const dossier of dossiers) rmSync(dossier, { recursive: true })
  await prisma.activite.deleteMany({ where: { organisationId } })
  await prisma.organisation.delete({ where: { id: organisationId } })
})

describe('page de l’espace organisateur', () => {
  it('nomme l’organisation désignée par son slug', async () => {
    const { adresse } = await demarrer()
    const reponse = await fetch(
      `${adresse}${CHEMIN_PAGE_ORGANISATEUR}?organisation=${slug}`
    )
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get('cache-control')).toBe('no-cache')
    expect(reponse.headers.get('content-security-policy')).toBe(
      POLITIQUE_ESPACE_ORGANISATEUR
    )
    const html = await reponse.text()
    expect(titre(html)).toBe(`Espace organisateur · ${NOM}`)
    expect(html).toContain(
      '<meta property="og:image" content="https://orga.exemple.org/apercu.jpg" />'
    )
    expect(html).toContain('<div id="racine"></div>')
  })

  it('ne nomme personne sans slug, avec un slug inconnu ou invalide', async () => {
    const { adresse, lectures } = await demarrer()
    for (const requete of [
      '',
      '?organisation=inconnue-0000',
      '?organisation=%3Cscript%3E',
    ]) {
      const html = await (
        await fetch(`${adresse}${CHEMIN_PAGE_ORGANISATEUR}${requete}`)
      ).text()
      expect(titre(html)).toBe('Espace organisateur')
    }
    // Un slug invalide ne part pas vers la base : il vaut une absence de slug.
    expect(lectures).toEqual(['', 'inconnue-0000'])
  })

  it('garde la page composée au lieu de relire la base', async () => {
    const { adresse, lectures } = await demarrer()
    for (let i = 0; i < 3; i++)
      await fetch(`${adresse}${CHEMIN_PAGE_ORGANISATEUR}?organisation=${slug}`)
    expect(lectures).toEqual([slug])
  })

  it('au-delà de la limite, sert la page sans lire la base', async () => {
    const { adresse, lectures } = await demarrer({
      limiter: () => Promise.resolve(false),
    })
    const reponse = await fetch(
      `${adresse}${CHEMIN_PAGE_ORGANISATEUR}?organisation=${slug}`
    )
    expect(reponse.status).toBe(200)
    expect(titre(await reponse.text())).toBe('Espace organisateur')
    expect(lectures).toEqual([])
  })

  it('sert telle quelle une page sans bloc d’aperçu', async () => {
    const page =
      '<!doctype html><html><head><title>Ancienne</title></head></html>'
    const { adresse } = await demarrer({ dossier: dossierAvec(page) })
    const reponse = await fetch(`${adresse}${CHEMIN_PAGE_ORGANISATEUR}`)
    expect(reponse.status).toBe(200)
    expect(await reponse.text()).toBe(page)
  })

  it('répond 404 sans dossier et 503 sans fichier lisible', async () => {
    const sansDossier = await demarrer({ dossier: undefined })
    expect(
      (await fetch(`${sansDossier.adresse}${CHEMIN_PAGE_ORGANISATEUR}`)).status
    ).toBe(404)
    const sansFichier = await demarrer({
      dossier: join(tmpdir(), `relaytour-absent-${s}`),
    })
    expect(
      (await fetch(`${sansFichier.adresse}${CHEMIN_PAGE_ORGANISATEUR}`)).status
    ).toBe(503)
  })
})
