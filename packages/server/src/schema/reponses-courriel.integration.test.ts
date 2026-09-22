import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import type { CourrielJobData } from '../jobs/queues.ts'
import { composer } from '../courriel/messages.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Réponses aux mails : une invitation portée par une activité renvoie les réponses
// au contact de cette activité, les autres mails au contact de l'organisation.

const enFile = vi.hoisted(() => [] as { sorte: string; options: unknown }[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, _cible: unknown, options: unknown = {}) => {
    enFile.push({ sorte, options })
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slug = `reponses-${s}`
const CONTACT_ORGA = `bureau-${s}@exemple.fr`
const CONTACT_A1 = `a1-${s}@exemple.fr`
const ids = {
  org: '',
  a1: '',
  a2: '',
  edition1: '',
  perimetre1: '',
  perimetre2: '',
  adminOrg: '',
  adminA1: '',
}

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  if (reponse.body.singleResult.errors)
    throw new Error(JSON.stringify(reponse.body.singleResult.errors))
  return reponse.body.singleResult.data as Record<string, unknown>
}

async function creerActivite(cle: string, contact?: string) {
  const activite = await prisma.activite.create({
    data: {
      organisationId: ids.org,
      slug: `${cle}-${s}`,
      nom: `Activité ${cle}`,
      groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      identite: contact === undefined ? {} : { contactRecrutement: contact },
    },
  })
  const edition = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: activite.id,
      annee: 2027,
      nom: `Période ${cle}`,
      debut: new Date('2027-06-01'),
      fin: new Date('2027-06-02'),
    },
  })
  const perimetre = await prisma.perimetre.create({
    data: {
      organisationId: ids.org,
      activiteId: activite.id,
      slug: 'natation',
      nom: `Natation ${cle}`,
      type: 'SPORT',
      groupe: 'sport',
    },
  })
  return { activite: activite.id, edition: edition.id, perimetre: perimetre.id }
}

async function creerCompte(cle: string, role: 'ADMIN' | 'MEMBRE') {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: `${cle}-${s}@exemple.fr`,
      name: `${cle} ${s}`,
      appartenances: { create: { organisationId: ids.org, role } },
    },
  })
  return id
}

const INVITER =
  'mutation ($email: String!, $e: ID, $p: [ID!]) { inviterPersonne(email: $email, nom: "Invitée", editionId: $e, perimetresSouhaites: $p) { id } }'

/** Invite une personne, puis compose le mail mis en file. */
async function inviter(
  par: string,
  cle: string,
  variables: Record<string, unknown> = {}
) {
  const data = await executer(par, INVITER, {
    email: `${cle}-${s}@exemple.fr`,
    ...variables,
  })
  const userId = (data.inviterPersonne as { id: string }).id
  const job = enFile.at(-1)
  expect(job?.sorte).toBe('invitation')
  return composer(prisma, {
    sorte: 'invitation',
    userId,
    ...(job!.options as Partial<CourrielJobData>),
  })
}

beforeAll(async () => {
  ids.org = (
    await prisma.organisation.create({
      data: {
        slug,
        nom: `Organisation ${s}`,
        configuration: {
          slug,
          nom: `Organisation ${s}`,
          domainesCourrielAutorises: ['exemple.fr'],
          contactRecrutement: CONTACT_ORGA,
        },
      },
    })
  ).id
  const a1 = await creerActivite('a1', CONTACT_A1)
  const a2 = await creerActivite('a2')
  Object.assign(ids, {
    a1: a1.activite,
    a2: a2.activite,
    edition1: a1.edition,
    perimetre1: a1.perimetre,
    perimetre2: a2.perimetre,
  })
  ids.adminOrg = await creerCompte('admin-org', 'ADMIN')
  ids.adminA1 = await creerCompte('admin-a1', 'MEMBRE')
  await prisma.adminActivite.create({
    data: { userId: ids.adminA1, activiteId: ids.a1, organisationId: ids.org },
  })
})

beforeEach(() => {
  enFile.length = 0
  invaliderConfigurationOrganisation()
})

afterAll(async () => {
  await prisma.souhait.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.appartenance.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  invaliderConfigurationOrganisation()
})

describe('réponses aux mails', () => {
  it('renvoie une invitation avec souhait au contact de son activité', async () => {
    const message = await inviter(ids.adminOrg, 'souhait', {
      e: ids.edition1,
      p: [ids.perimetre1],
    })
    expect(enFile.at(-1)?.options).toMatchObject({ activiteId: ids.a1 })
    expect(message?.repondreA).toBe(CONTACT_A1)
  })

  it('renvoie l’invitation d’un admin d’activité au contact de son activité', async () => {
    const message = await inviter(ids.adminA1, 'par-admin-a1')
    expect(message?.repondreA).toBe(CONTACT_A1)
  })

  it('renvoie l’invitation d’un admin de l’organisation au contact de l’organisation', async () => {
    const message = await inviter(ids.adminOrg, 'sans-lien')
    expect(
      (enFile.at(-1)?.options as Partial<CourrielJobData>).activiteId
    ).toBeUndefined()
    expect(message?.repondreA).toBe(CONTACT_ORGA)
  })

  it('reprend le contact de l’organisation pour une activité qui n’en déclare pas', async () => {
    const message = await composer(prisma, {
      sorte: 'invitation',
      userId: ids.adminA1,
      organisationId: ids.org,
      activiteId: ids.a2,
    })
    expect(message?.repondreA).toBe(CONTACT_ORGA)
  })

  it('laisse un code de connexion sans adresse de réponse', async () => {
    const message = await composer(prisma, {
      sorte: 'code-connexion',
      userId: ids.adminA1,
      code: '123456',
      organisationId: ids.org,
    })
    expect(message?.repondreA).toBeUndefined()
  })
})
