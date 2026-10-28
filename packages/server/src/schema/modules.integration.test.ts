import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { lireAbonnement } from '../lib/abonnements-agenda.ts'
import { modifierOrganisation } from '../lib/installation.ts'

import { schema } from './index.ts'

// Modules d'une activité (ADR 0052). Une activité plus ancienne garde tous ses
// modules ; un admin de l'activité les règle ; l'administration de l'installation
// restreint ceux de l'organisation. Un module inactif ferme ses requêtes, ses
// mutations et ses adresses publiques. Les contrôles se prouvent par le refus
// (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `modules-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  edition: '',
  adminOrg: '',
  adminActivite: '',
  referent: '',
  natation: '',
}

async function executer(
  userId: string | null,
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

const ACTIVITES = `query { activites { id modules modulesAutorises } }`
const REGLER = `mutation ($id: ID!, $m: [ModuleActivite!]) {
  modifierActivite(id: $id, nom: "Tournoi", nature: EVENEMENT, ordre: 0,
    groupes: [{ cle: "sport", libelle: "Sport", libellePluriel: "Sports" }],
    modules: $m) { id modules }
}`
const AGENDA = `query ($e: ID!) { agenda(editionId: $e) { peutGerer } }`
const REUNIONS = `query ($e: ID!) { reunions(editionId: $e) { id } }`
const DATE_CLE = `mutation ($e: ID!) { creerDateCle(editionId: $e, titre: "Clôture", jour: "2027-06-05") { id } }`
const BENEVOLES = `query ($a: ID!) { benevoles(activiteId: $a) { id } }`
const APPELS = `query ($e: ID!) { appelsBenevoles(editionId: $e) { id } }`
const CREER_ACTIVITE = `mutation ($slug: String!) { creerActivite(slug: $slug, nom: "Saison", nature: SAISON) { id modules } }`
const ABONNEMENT = `mutation ($a: ID!) { creerAbonnementAgendaActivite(activiteId: $a) { adresse } }`

async function modulesDe(userId: string): Promise<string[]> {
  const r = await executer(userId, ACTIVITES)
  expect(r.errors).toBeUndefined()
  const activites = (
    r.data as { activites: { id: string; modules: string[] }[] }
  ).activites
  return activites.find(a => a.id === ids.activite)!.modules
}

async function regler(userId: string, modules: string[] | null) {
  return executer(userId, REGLER, { id: ids.activite, m: modules })
}

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  // Une activité créée sans liste : comme une activité antérieure à l'ADR 0052.
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug,
        nom: 'Tournoi',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: new Date('2027-06-05'),
        fin: new Date('2027-06-06'),
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
  for (const cle of ['adminOrg', 'adminActivite', 'referent'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle.toLowerCase()}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: {
          create: {
            organisationId: ids.org,
            role: cle === 'adminOrg' ? 'ADMIN' : 'MEMBRE',
          },
        },
      },
    })
  }
  await prisma.adminActivite.create({
    data: {
      userId: ids.adminActivite,
      activiteId: ids.activite,
      organisationId: ids.org,
    },
  })
  await prisma.affectation.create({
    data: {
      userId: ids.referent,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
})

afterAll(async () => {
  await prisma.abonnementAgenda.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.dateCle.deleteMany({ where: { organisationId: ids.org } })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { id: { in: [ids.adminOrg, ids.adminActivite, ids.referent] } },
  })
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
})

describe('modules d’une activité', () => {
  it('garde tous les modules d’une activité antérieure', async () => {
    expect(await modulesDe(ids.referent)).toEqual([
      'AGENDA',
      'BENEVOLES',
      'DOCUMENTS',
    ])
    const r = await executer(ids.referent, AGENDA, { e: ids.edition })
    expect(r.errors).toBeUndefined()
  })

  it('refuse le réglage à une personne qui n’administre pas l’activité', async () => {
    expect(code(await regler(ids.referent, []))).toBe('FORBIDDEN')
    expect(await modulesDe(ids.referent)).toHaveLength(3)
  })

  it('ferme les requêtes et les mutations d’un module désactivé', async () => {
    const r = await regler(ids.adminActivite, ['DOCUMENTS'])
    expect(r.errors).toBeUndefined()
    expect(await modulesDe(ids.adminActivite)).toEqual(['DOCUMENTS'])

    for (const [userId, query, variables] of [
      [ids.referent, AGENDA, { e: ids.edition }],
      [ids.referent, REUNIONS, { e: ids.edition }],
      [ids.adminActivite, DATE_CLE, { e: ids.edition }],
      [ids.referent, BENEVOLES, { a: ids.activite }],
      [ids.referent, APPELS, { e: ids.edition }],
      [ids.adminActivite, ABONNEMENT, { a: ids.activite }],
    ] as const) {
      expect(code(await executer(userId, query, variables))).toBe(
        'MODULE_INACTIF'
      )
    }

    // La réactivation rend l'écran tel qu'il était.
    expect((await regler(ids.adminActivite, ['AGENDA'])).errors).toBeUndefined()
    const lu = await executer(ids.referent, AGENDA, { e: ids.edition })
    expect(lu.errors).toBeUndefined()
  })

  it('ferme l’abonnement iCalendar de l’activité sans le module agenda', async () => {
    await regler(ids.adminActivite, ['AGENDA'])
    const r = await executer(ids.adminActivite, ABONNEMENT, {
      a: ids.activite,
    })
    expect(r.errors).toBeUndefined()
    const adresse = (
      r.data as { creerAbonnementAgendaActivite: { adresse: string } }
    ).creerAbonnementAgendaActivite.adresse
    const lire = () =>
      lireAbonnement(
        adresse.split('/agenda/')[1]!,
        '127.0.0.1',
        new Date(),
        () => Promise.resolve(true)
      )
    expect((await lire()).statut).toBe(200)
    await regler(ids.adminActivite, [])
    expect((await lire()).statut).toBe(404)
  })

  it('démarre une activité créée sans module', async () => {
    const r = await executer(ids.adminOrg, CREER_ACTIVITE, {
      slug: `${slug}-saison`,
    })
    expect(r.errors).toBeUndefined()
    expect(
      (r.data as { creerActivite: { modules: string[] } }).creerActivite.modules
    ).toEqual([])
  })
})

describe('modules autorisés par l’hébergeur', () => {
  afterAll(async () => {
    await modifierOrganisation(slug, { modulesAutorises: null })
  })

  it('désactive un module non autorisé et garde le choix de l’activité', async () => {
    await regler(ids.adminActivite, ['AGENDA', 'DOCUMENTS'])
    await modifierOrganisation(slug, { modulesAutorises: ['AGENDA'] })

    const r = await executer(ids.adminActivite, ACTIVITES)
    const activite = (
      r.data as {
        activites: {
          id: string
          modules: string[]
          modulesAutorises: string[]
        }[]
      }
    ).activites.find(a => a.id === ids.activite)!
    expect(activite.modules).toEqual(['AGENDA'])
    expect(activite.modulesAutorises).toEqual(['AGENDA'])

    // Un module non autorisé ne s'active pas.
    expect(code(await regler(ids.adminActivite, ['AGENDA', 'BENEVOLES']))).toBe(
      'SAISIE_INVALIDE'
    )

    // Un réglage sans le module retiré le garde en base : il revient ensuite.
    expect((await regler(ids.adminActivite, ['AGENDA'])).errors).toBeUndefined()
    await modifierOrganisation(slug, { modulesAutorises: null })
    expect(await modulesDe(ids.adminActivite)).toEqual(['AGENDA', 'DOCUMENTS'])
  })

  it('refuse un module inconnu dans la liste de l’hébergeur', async () => {
    await expect(
      modifierOrganisation(slug, { modulesAutorises: ['CAISSE'] })
    ).rejects.toThrow()
  })
})
