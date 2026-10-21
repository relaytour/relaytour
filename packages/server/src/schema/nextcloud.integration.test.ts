import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Nextcloud par le Login Flow v2 (ADR 0038). L'admin saisit l'adresse du
// Nextcloud de l'association, y accorde l'accès, puis Relaytour interroge
// Nextcloud jusqu'à recevoir un mot de passe d'application. L'état de la
// demande n'appartient qu'à la personne qui l'a commencée. Relaytour garde le
// mot de passe chiffré. Un autre serveur Nextcloud est un autre espace : le
// dossier d'export de l'ancien s'efface.

const s = randomUUID().slice(0, 8)
const slug = `nextcloud-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = { org: '', admin: '', autreAdmin: '', membre: '' }
const MOT_DE_PASSE = `mdp-application-${s}`

/** Les demandes de connexion que l'admin a accordées dans Nextcloud. */
const accordees = new Set<string>()
let numero = 0

function nextcloudSimule() {
  const json = (valeur: unknown, statut = 200) =>
    new Response(JSON.stringify(valeur), {
      status: statut,
      headers: { 'content-type': 'application/json' },
    })
  vi.stubGlobal('fetch', (entree: string, init: RequestInit = {}) => {
    const adresse = new URL(entree)
    // La base de l'instance : son origine et son chemin éventuel.
    const origine = entree.slice(0, entree.search(/\/(index\.php|ocs)\//))
    if (adresse.pathname.endsWith('/index.php/login/v2')) {
      numero += 1
      return Promise.resolve(
        json({
          poll: {
            token: `jeton-${numero}`,
            endpoint: `${origine}/index.php/login/v2/poll`,
          },
          login: `${origine}/index.php/login/v2/flow/${numero}`,
        })
      )
    }
    if (adresse.pathname.endsWith('/index.php/login/v2/poll')) {
      const jeton = new URLSearchParams(init.body as string).get('token') ?? ''
      if (!accordees.has(jeton)) return Promise.resolve(json({}, 404))
      accordees.delete(jeton)
      return Promise.resolve(
        json({
          server: origine,
          loginName: 'camille@asso.exemple.org',
          appPassword: MOT_DE_PASSE,
        })
      )
    }
    if (adresse.pathname.endsWith('/ocs/v2.php/cloud/user')) {
      const attendu = `Basic ${Buffer.from(`camille@asso.exemple.org:${MOT_DE_PASSE}`).toString('base64')}`
      const entetes = init.headers as Record<string, string>
      if (entetes.authorization !== attendu)
        return Promise.resolve(json({}, 401))
      return Promise.resolve(
        json({ ocs: { data: { id: 'camille', 'display-name': 'Camille' } } })
      )
    }
    return Promise.resolve(json({}, 404))
  })
}

const COMMENCER = `mutation ($a: String!) { commencerConnexionNextcloud(adresse: $a) { connexion etat } }`
const TERMINER = `mutation ($e: String!) { terminerConnexionNextcloud(etat: $e) }`
const POSSIBLES = `{ espaceFichiers { connexionsPossibles { fournisseur methode } connexion { fournisseur compte exportDossier } } }`

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

/** Commence une connexion et rend son état et le numéro de la demande. */
async function commencer(adresse: string, userId = ids.admin) {
  const r = await executer(userId, COMMENCER, { a: adresse })
  expect(r.errors).toBeUndefined()
  const debut = (
    r.data as {
      commencerConnexionNextcloud: { connexion: string; etat: string }
    }
  ).commencerConnexionNextcloud
  return { ...debut, jeton: `jeton-${numero}` }
}

async function terminer(etat: string, userId = ids.admin) {
  return executer(userId, TERMINER, { e: etat })
}

beforeAll(async () => {
  await apollo.start()
  nextcloudSimule()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['autreAdmin', 'ADMIN'],
    ['membre', 'MEMBRE'],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle.toLowerCase()}-${slug}@exemple.fr`,
        name: cle,
        appartenances: { create: { organisationId: ids.org, role } },
      },
    })
  }
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await prisma.connexionFichiers.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('connexion à Nextcloud', () => {
  it('se propose quand l’hébergeur l’ouvre', async () => {
    const r = await executer(ids.admin, POSSIBLES)
    expect(r.errors).toBeUndefined()
    expect(
      (
        r.data as {
          espaceFichiers: {
            connexionsPossibles: { fournisseur: string; methode: string }[]
          }
        }
      ).espaceFichiers.connexionsPossibles
    ).toContainEqual({ fournisseur: 'NEXTCLOUD', methode: 'COMPTE' })
  })

  it('se commence par un admin de l’organisation seulement', async () => {
    expect(
      code(
        await executer(ids.membre, COMMENCER, {
          a: 'https://cloud.exemple.org',
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('refuse une adresse hors https, avec un port ou sur le réseau privé', async () => {
    for (const a of [
      'http://cloud.exemple.org',
      'https://cloud.exemple.org:8443',
      'https://127.0.0.1',
      'https://[::1]',
      'https://10.0.0.5',
      'https://localhost',
      'https://camille:secret@cloud.exemple.org',
      'pas une adresse',
    ]) {
      expect(code(await executer(ids.admin, COMMENCER, { a }))).toBe(
        'SAISIE_INVALIDE'
      )
    }
  })

  it('ramène une adresse de page à la base du Nextcloud', async () => {
    const debut = await commencer(
      'https://cloud.exemple.org/index.php/apps/files/?dir=/'
    )
    expect(debut.connexion).toMatch(
      /^https:\/\/cloud\.exemple\.org\/index\.php\/login\/v2\/flow\//
    )
  })

  it('attend l’accord de l’admin, puis garde le mot de passe chiffré', async () => {
    const debut = await commencer('https://cloud.exemple.org')
    const attente = await terminer(debut.etat)
    expect(attente.errors).toBeUndefined()
    expect(attente.data).toEqual({ terminerConnexionNextcloud: false })

    accordees.add(debut.jeton)
    const fin = await terminer(debut.etat)
    expect(fin.errors).toBeUndefined()
    expect(fin.data).toEqual({ terminerConnexionNextcloud: true })

    const r = await executer(ids.admin, POSSIBLES)
    expect(
      (r.data as { espaceFichiers: { connexion: unknown } }).espaceFichiers
        .connexion
    ).toEqual({
      fournisseur: 'NEXTCLOUD',
      compte: 'Camille (cloud.exemple.org)',
      exportDossier: null,
    })
    const connexion = await prisma.connexionFichiers.findUniqueOrThrow({
      where: { organisationId: ids.org },
    })
    expect(connexion.jeton).toMatch(/^v1\./)
    expect(connexion.jeton).not.toContain(MOT_DE_PASSE)

    // L'état ne sert qu'une fois.
    expect(code(await terminer(debut.etat))).toBe('SAISIE_INVALIDE')
  })

  it('n’appartient qu’à la personne qui l’a commencée', async () => {
    const debut = await commencer('https://cloud.exemple.org')
    accordees.add(debut.jeton)
    expect(code(await terminer(debut.etat, ids.autreAdmin))).toBe(
      'SAISIE_INVALIDE'
    )
    expect(code(await terminer('etat-inconnu'))).toBe('SAISIE_INVALIDE')
    accordees.delete(debut.jeton)
  })

  it('garde le dossier d’export sur le même serveur, et l’efface pour un autre', async () => {
    const exporter = () =>
      prisma.connexionFichiers.update({
        where: { organisationId: ids.org },
        data: {
          exportEmplacement: 'fichiers',
          exportElement: '42',
          exportNom: 'Fiches Relaytour',
        },
      })
    const exportActuel = async () =>
      (
        await prisma.connexionFichiers.findUniqueOrThrow({
          where: { organisationId: ids.org },
        })
      ).exportElement

    await exporter()
    const meme = await commencer('https://cloud.exemple.org/')
    accordees.add(meme.jeton)
    expect((await terminer(meme.etat)).errors).toBeUndefined()
    expect(await exportActuel()).toBe('42')

    const autre = await commencer('https://nuage.exemple.net')
    accordees.add(autre.jeton)
    expect((await terminer(autre.etat)).errors).toBeUndefined()
    expect(await exportActuel()).toBeNull()
  })

  it('distingue deux chemins de casse différente sur le même hôte', async () => {
    const premier = await commencer('https://exemple.org/Nextcloud')
    accordees.add(premier.jeton)
    expect((await terminer(premier.etat)).errors).toBeUndefined()
    await prisma.connexionFichiers.update({
      where: { organisationId: ids.org },
      data: {
        exportEmplacement: 'https://exemple.org/Nextcloud',
        exportElement: '42',
      },
    })
    const second = await commencer('https://exemple.org/nextcloud')
    accordees.add(second.jeton)
    expect((await terminer(second.etat)).errors).toBeUndefined()
    const connexion = await prisma.connexionFichiers.findUniqueOrThrow({
      where: { organisationId: ids.org },
    })
    expect(connexion.exportElement).toBeNull()
  })
})
