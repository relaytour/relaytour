import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { prisma } from '@relaytour/database'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { contexteDeJetonAcces } from '../contexte-jeton.ts'
import { creerJetonAcces, finDuJeton } from '../lib/jetons-acces.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'
import { schema } from '../schema/index.ts'

import { routeurApiRest } from './routeur.ts'

// API REST v1 (ADR 0064) : un jeton d'accès seul l'ouvre, chaque route suit les
// droits de GraphQL, et chaque refus a son statut HTTP. Les contrôles se prouvent
// par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `rest-${s}`
const ip = `10.65.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const ids = {
  org: '',
  activite: '',
  autreActivite: '',
  edition: '',
  natation: '',
  referente: '',
  admin: '',
}
const jetons = { ecriture: '', lecture: '', admin: '' }
let serveur: Server
let base = ''

async function appeler(
  methode: string,
  chemin: string,
  options: { jeton?: string; corps?: unknown; brut?: string } = {}
) {
  const reponse = await fetch(`${base}/api/v1${chemin}`, {
    method: methode,
    headers: {
      ...(options.jeton ? { authorization: `Bearer ${options.jeton}` } : {}),
      ...(options.corps !== undefined || options.brut !== undefined
        ? { 'content-type': 'application/json' }
        : {}),
    },
    body:
      options.brut ??
      (options.corps === undefined ? undefined : JSON.stringify(options.corps)),
  })
  const texte = await reponse.text()
  const corps = texte === '' ? null : (JSON.parse(texte) as unknown)
  return { statut: reponse.status, corps, entetes: reponse.headers }
}

const code = (r: { corps: unknown }) =>
  (r.corps as { erreurs?: { code: string }[] }).erreurs?.[0]?.code

beforeAll(async () => {
  ids.org = (
    await prisma.organisation.create({
      data: {
        slug,
        nom: `Organisation ${slug}`,
        configuration: {},
        apiActivee: true,
      },
    })
  ).id
  const groupes = [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }]
  ids.activite = (
    await prisma.activite.create({
      data: { organisationId: ids.org, slug, nom: 'Tournoi', groupes },
    })
  ).id
  ids.autreActivite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug: `${slug}-club`,
        nom: 'Club',
        groupes,
      },
    })
  ).id
  const jour = new Date(Date.now() + 60 * 86_400_000)
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: jour,
        fin: jour,
      },
    })
  ).id
  ids.natation = (
    await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: 'natation',
        nom: 'Natation',
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
  ids.referente = randomUUID()
  ids.admin = randomUUID()
  await prisma.user.create({
    data: {
      id: ids.referente,
      email: `referente-${slug}@exemple.fr`,
      name: `Référente ${s}`,
      appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
    },
  })
  await prisma.user.create({
    data: {
      id: ids.admin,
      email: `admin-${slug}@exemple.fr`,
      name: `Admin ${s}`,
      appartenances: { create: { organisationId: ids.org, role: 'ADMIN' } },
    },
  })
  await prisma.affectation.create({
    data: {
      userId: ids.referente,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
  const creer = async (
    userId: string,
    portee: 'LECTURE' | 'LECTURE_ECRITURE'
  ) =>
    (
      await creerJetonAcces({
        organisationId: ids.org,
        userId,
        creeParId: userId,
        nom: portee,
        portee,
        activiteIds: null,
        expireLe: finDuJeton(null),
      })
    ).jeton
  jetons.ecriture = await creer(ids.referente, 'LECTURE_ECRITURE')
  jetons.lecture = await creer(ids.referente, 'LECTURE')
  jetons.admin = await creer(ids.admin, 'LECTURE')

  const app = express()
  app.use(
    '/api/v1',
    routeurApiRest({
      schema,
      version: '9.9.9',
      contexte: (_req, jeton) => contexteDeJetonAcces(ip, jeton, null),
    })
  )
  serveur = app.listen(0, '127.0.0.1')
  await new Promise(r => serveur.once('listening', r))
  base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise(r => serveur.close(r))
  await prisma.jetonAcces.deleteMany({ where: { organisationId: ids.org } })
  await prisma.journal.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.commentaireTache.deleteMany({
    where: { tache: { perimetre: { organisationId: ids.org } } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  invaliderConfigurationOrganisation()
})

describe('accès à l’API REST', () => {
  it('sert le contrat sans jeton', async () => {
    const r = await appeler('GET', '/openapi.json')
    expect(r.statut).toBe(200)
    const contrat = r.corps as { openapi: string; info: { version: string } }
    expect(contrat.openapi).toBe('3.0.3')
    expect(contrat.info.version).toBe('9.9.9')
    expect(r.entetes.get('cache-control')).toBe('no-store')
  })

  it('refuse une requête sans jeton, même avec un cookie', async () => {
    const sans = await appeler('GET', '/moi')
    expect(sans.statut).toBe(401)
    expect(code(sans)).toBe('JETON_REQUIS')
    const cookie = await fetch(`${base}/api/v1/moi`, {
      headers: { cookie: 'relaytour.session_token=quelconque' },
    })
    expect(cookie.status).toBe(401)
  })

  it('refuse un jeton invalide', async () => {
    const r = await appeler('GET', '/moi', { jeton: `rt_${'C'.repeat(43)}` })
    expect(r.statut).toBe(401)
    expect(code(r)).toBe('JETON_INVALIDE')
    expect(r.entetes.get('www-authenticate')).toContain('invalid_token')
  })

  it('n’a ni webhook ni route inconnue', async () => {
    const webhook = await appeler('POST', '/webhook', {
      jeton: jetons.ecriture,
      corps: {},
    })
    expect(webhook.statut).toBe(404)
    expect(code(webhook)).toBe('ROUTE_INCONNUE')
  })
})

describe('lectures', () => {
  it('rend la personne, ses activités, périodes et périmètres', async () => {
    const moi = await appeler('GET', '/moi', { jeton: jetons.ecriture })
    expect(moi.statut).toBe(200)
    expect((moi.corps as { id: string }).id).toBe(ids.referente)
    const jeton = await appeler('GET', '/jeton', { jeton: jetons.lecture })
    expect((jeton.corps as { portee: string }).portee).toBe('LECTURE')
    const activites = await appeler('GET', '/activites', {
      jeton: jetons.ecriture,
    })
    expect((activites.corps as { id: string }[]).map(a => a.id)).toEqual([
      ids.activite,
    ])
    const editions = await appeler(
      'GET',
      `/activites/${ids.activite}/editions`,
      {
        jeton: jetons.ecriture,
      }
    )
    expect((editions.corps as { id: string }[]).map(e => e.id)).toEqual([
      ids.edition,
    ])
    const perimetres = await appeler(
      'GET',
      `/activites/${ids.activite}/perimetres`,
      { jeton: jetons.ecriture }
    )
    expect(perimetres.statut).toBe(200)
  })

  it('refuse une activité que la personne ne voit pas, sans dire si elle existe', async () => {
    for (const activite of [ids.autreActivite, 'inconnue']) {
      const r = await appeler('GET', `/activites/${activite}/editions`, {
        jeton: jetons.ecriture,
      })
      expect(r.statut).toBe(403)
      expect(code(r)).toBe('FORBIDDEN')
    }
  })

  it('rend l’équipe à un admin, sans adresse', async () => {
    const r = await appeler('GET', `/activites/${ids.activite}/equipe`, {
      jeton: jetons.admin,
    })
    expect(r.statut).toBe(200)
    expect(JSON.stringify(r.corps)).not.toContain('@')
  })

  it('refuse une variable obligatoire absente', async () => {
    const r = await appeler('GET', `/activites/${ids.activite}/taches`, {
      jeton: jetons.ecriture,
    })
    expect(r.statut).toBe(400)
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })
})

describe('écritures', () => {
  let tache = ''
  let version = 0

  it('crée une tâche, puis la lit seule et dans sa période', async () => {
    const r = await appeler('POST', '/taches', {
      jeton: jetons.ecriture,
      corps: {
        perimetreId: ids.natation,
        editionId: ids.edition,
        titre: 'Réserver le bassin',
        echeance: '2027-05-01',
        mAssigner: true,
      },
    })
    expect(r.statut).toBe(201)
    const creee = r.corps as {
      id: string
      version: number
      assignes: { id: string }[]
    }
    expect(creee.assignes.map(a => a.id)).toEqual([ids.referente])
    tache = creee.id
    version = creee.version
    const lue = await appeler('GET', `/taches/${tache}`, {
      jeton: jetons.lecture,
    })
    expect((lue.corps as { titre: string }).titre).toBe('Réserver le bassin')
    const periode = await appeler(
      'GET',
      `/activites/${ids.activite}/taches?editionId=${ids.edition}`,
      { jeton: jetons.lecture }
    )
    const perimetres = periode.corps as { taches: { id: string }[] }[]
    expect(perimetres.flatMap(p => p.taches.map(t => t.id))).toContain(tache)
    const miennes = await appeler(
      'GET',
      `/editions/${ids.edition}/mes-taches`,
      {
        jeton: jetons.lecture,
      }
    )
    expect((miennes.corps as { id: string }[]).map(t => t.id)).toContain(tache)
  })

  it('refuse d’écraser une modification faite entre-temps', async () => {
    const r = await appeler('PATCH', `/taches/${tache}`, {
      jeton: jetons.ecriture,
      corps: { titre: 'Autre titre', versionAttendue: version + 5 },
    })
    expect(r.statut).toBe(409)
    expect(code(r)).toBe('CONFLIT_VERSION')
    const ok = await appeler('PATCH', `/taches/${tache}`, {
      jeton: jetons.ecriture,
      corps: { titre: 'Réserver le grand bassin', versionAttendue: version },
    })
    expect(ok.statut).toBe(200)
  })

  it('commente une tâche et lit ses commentaires', async () => {
    const r = await appeler('POST', `/taches/${tache}/commentaires`, {
      jeton: jetons.ecriture,
      corps: { texte: 'Devis reçu.' },
    })
    expect(r.statut).toBe(201)
    const fil = await appeler('GET', `/taches/${tache}/commentaires`, {
      jeton: jetons.lecture,
    })
    expect(
      (fil.corps as { commentaires: { texte: string }[] }).commentaires.map(
        c => c.texte
      )
    ).toEqual(['Devis reçu.'])
  })

  it('change le statut d’une tâche', async () => {
    const r = await appeler('POST', `/taches/${tache}/statut`, {
      jeton: jetons.ecriture,
      corps: { statut: 'FAITE', statutAttendu: 'A_FAIRE' },
    })
    expect(r.statut).toBe(200)
    expect((r.corps as { statut: string }).statut).toBe('FAITE')
  })

  it('refuse une écriture avec un jeton en lecture', async () => {
    const r = await appeler('POST', '/taches', {
      jeton: jetons.lecture,
      corps: {
        perimetreId: ids.natation,
        editionId: ids.edition,
        titre: 'Interdit',
      },
    })
    expect(r.statut).toBe(403)
    expect(code(r)).toBe('PORTEE_INSUFFISANTE')
  })

  it('refuse un corps illisible ou incomplet', async () => {
    const illisible = await appeler('POST', '/taches', {
      jeton: jetons.ecriture,
      brut: '{"titre":',
    })
    expect(illisible.statut).toBe(400)
    const incomplet = await appeler('POST', '/taches', {
      jeton: jetons.ecriture,
      corps: { perimetreId: ids.natation },
    })
    expect(incomplet.statut).toBe(400)
    expect(code(incomplet)).toBe('SAISIE_INVALIDE')
  })

  it('rend les priorités de la période', async () => {
    const r = await appeler('GET', `/editions/${ids.edition}/priorites`, {
      jeton: jetons.lecture,
    })
    expect(r.statut).toBe(200)
  })
})

describe('module fermé', () => {
  it('rend 403 quand l’organisation désactive l’API', async () => {
    await prisma.organisation.update({
      where: { id: ids.org },
      data: { apiActivee: false },
    })
    const r = await appeler('GET', '/moi', { jeton: jetons.ecriture })
    expect(r.statut).toBe(403)
    expect(code(r)).toBe('API_INACTIVE')
    await prisma.organisation.update({
      where: { id: ids.org },
      data: { apiActivee: true },
    })
  })
})
