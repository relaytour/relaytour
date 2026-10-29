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
import {
  adresseOrganisateur,
  composer,
  reponsesDuMail,
} from '../courriel/messages.ts'
import { env } from '../env.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Réponses aux mails : une invitation portée par une activité renvoie les réponses
// au contact de cette activité, les autres mails au contact de l'organisation.
// Le pied ne propose de répondre que si une boîte reçoit la réponse (ADR 0053).

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
  'mutation ($email: String!, $e: ID, $p: [ID!]) { inviterPersonne(email: $email, nom: "Invitée", editionId: $e, perimetresSouhaites: $p) { personne { id } } }'

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
  const userId = (data.inviterPersonne as { personne: { id: string } }).personne
    .id
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
    const message = await inviter(ids.adminA1, 'par-admin-a1', {
      e: ids.edition1,
      p: [ids.perimetre1],
    })
    expect(message?.repondreA).toBe(CONTACT_A1)
  })

  it('n’envoie aucune invitation à une personne déjà membre rattachée à une équipe', async () => {
    await creerCompte('deja-membre', 'MEMBRE')
    await executer(ids.adminA1, INVITER, {
      email: `deja-membre-${s}@exemple.fr`,
      e: ids.edition1,
      p: [ids.perimetre1],
    })
    expect(enFile).toEqual([])
  })

  it('renvoie l’invitation d’un admin de l’organisation au contact de l’organisation', async () => {
    const message = await inviter(ids.adminOrg, 'sans-lien')
    expect(
      (enFile.at(-1)?.options as Partial<CourrielJobData>).activiteId
    ).toBeUndefined()
    expect(message?.repondreA).toBe(CONTACT_ORGA)
  })

  it('renvoie une invitation relancée au contact de l’activité de la personne', async () => {
    const membre = await creerCompte('relance', 'MEMBRE')
    await prisma.affectation.create({
      data: {
        userId: membre,
        perimetreId: ids.perimetre1,
        editionId: ids.edition1,
      },
    })
    const { connection } = await import('../jobs/queues.ts')
    for (const par of [ids.adminOrg, ids.adminA1]) {
      enFile.length = 0
      // Une relance par personne et par heure : le compteur se remet à zéro entre
      // les deux admins, et le refus se vérifie ensuite.
      await connection.del(`limite:relance-invitation:${ids.org}:${membre}`)
      await executer(
        par,
        'mutation ($id: ID!) { renvoyerInvitation(id: $id) }',
        {
          id: membre,
        }
      )
      const job = enFile.at(-1)
      expect(job?.sorte).toBe('invitation')
      expect(job?.options).toMatchObject({
        organisationId: ids.org,
        activiteId: ids.a1,
      })
      const message = await composer(prisma, {
        sorte: 'invitation',
        userId: membre,
        ...(job!.options as Partial<CourrielJobData>),
      })
      expect(message?.repondreA).toBe(CONTACT_A1)
    }
    enFile.length = 0
    await expect(
      executer(
        ids.adminOrg,
        'mutation ($id: ID!) { renvoyerInvitation(id: $id) }',
        { id: membre }
      )
    ).rejects.toThrow(/SAISIE_INVALIDE/)
    expect(enFile).toHaveLength(0)
    await connection.del(`limite:relance-invitation:${ids.org}:${membre}`)
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

describe('adresse de réponse et pied (ADR 0053)', () => {
  const REPONDRE = 'Pour toute question, répondez à ce mail.'
  const SANS_REPONSE = 'Cette adresse d’envoi ne reçoit pas de réponse.'
  const configuration = (
    contactRecrutement: string | undefined,
    expediteurRecoitReponses: boolean
  ) => ({
    contactRecrutement,
    expediteurRecoitReponses,
    expediteur: 'Les Rencontres <rencontres@envoi.exemple.org>',
  })

  it('propose de répondre quand le mail porte un contact', () => {
    expect(
      reponsesDuMail(configuration(CONTACT_ORGA, false), 'invitation')
    ).toEqual({ repondreA: CONTACT_ORGA, repondre: true })
  })

  it('propose de répondre sans contact quand l’expéditeur reçoit du courrier', () => {
    expect(reponsesDuMail(configuration(undefined, true), 'resume')).toEqual({
      repondreA: undefined,
      repondre: true,
    })
  })

  it('ne propose pas de répondre sans contact ni boîte d’expédition', () => {
    expect(reponsesDuMail(configuration(undefined, false), 'resume')).toEqual({
      repondreA: undefined,
      repondre: false,
    })
    // Un code de connexion n'a jamais de Reply-To, même avec un contact.
    expect(
      reponsesDuMail(configuration(CONTACT_ORGA, false), 'code-connexion')
    ).toEqual({ repondreA: undefined, repondre: false })
  })

  it('choisit l’organisateur d’une réunion selon la même règle', () => {
    expect(adresseOrganisateur(configuration(CONTACT_ORGA, false))).toBe(
      CONTACT_ORGA
    )
    expect(adresseOrganisateur(configuration(undefined, true))).toBe(
      'rencontres@envoi.exemple.org'
    )
    expect(adresseOrganisateur(configuration(undefined, false))).toBeUndefined()
  })

  it('ne dit qu’à la personne elle-même si son adresse est une adresse de rôle', async () => {
    const data = await executer(
      ids.adminOrg,
      '{ moi { id adresseDeRole } personnes { id adresseDeRole } }'
    )
    expect(data.moi).toEqual({ id: ids.adminOrg, adresseDeRole: true })
    const autres = (
      data.personnes as { id: string; adresseDeRole: boolean | null }[]
    ).filter(p => p.id !== ids.adminOrg)
    expect(autres.length).toBeGreaterThan(0)
    expect(autres.every(p => p.adresseDeRole === null)).toBe(true)
  })

  it('compose le pied selon le réglage de l’installation', async () => {
    const initial = env.COURRIEL_EXPEDITEUR_SANS_REPONSE
    const code = () =>
      composer(prisma, {
        sorte: 'code-connexion',
        userId: ids.adminA1,
        code: '123456',
        organisationId: ids.org,
      })
    try {
      env.COURRIEL_EXPEDITEUR_SANS_REPONSE = false
      invaliderConfigurationOrganisation()
      const avecBoite = await code()
      expect(avecBoite?.texte).toContain(REPONDRE)
      expect(avecBoite?.html).toContain(REPONDRE)

      env.COURRIEL_EXPEDITEUR_SANS_REPONSE = true
      invaliderConfigurationOrganisation()
      const sansBoite = await code()
      expect(sansBoite?.texte).toContain(SANS_REPONSE)
      expect(sansBoite?.texte).not.toContain(REPONDRE)
      expect(sansBoite?.html).toContain(SANS_REPONSE)

      // Une invitation garde le contact de l'organisation et propose de répondre.
      const invitation = await composer(prisma, {
        sorte: 'invitation',
        userId: ids.adminA1,
        organisationId: ids.org,
      })
      expect(invitation?.repondreA).toBe(CONTACT_ORGA)
      expect(invitation?.texte).toContain(REPONDRE)
    } finally {
      env.COURRIEL_EXPEDITEUR_SANS_REPONSE = initial
      invaliderConfigurationOrganisation()
    }
  })
})
