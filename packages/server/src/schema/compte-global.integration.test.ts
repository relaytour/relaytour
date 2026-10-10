import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { composer } from '../courriel/messages.ts'
import { nommerAdmin } from '../lib/installation.ts'
import { cleRelance } from '../lib/invitations.ts'
import {
  configurationOrganisation,
  invaliderConfigurationOrganisation,
} from '../lib/organisation.ts'

import { schema } from './index.ts'

// Ce qu'un compte global ne laisse pas passer d'une organisation à l'autre
// (ADR 0030, audit du cloisonnement d'octobre 2026) : la date de création du
// compte, la limite de relance, l'habillage d'un mail sans organisation désignée,
// et le rôle d'admin posé par la commande de l'opérateur.

const enFile = vi.hoisted(() => [] as { sorte: string; cible: unknown }[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: unknown) => {
    enFile.push({ sorte, cible })
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const adresse = (cle: string) => `${cle}-global-${s}@exemple.fr`
const ids = {
  orgA: '',
  orgB: '',
  editionA: '',
  perimetreA: '',
  adminA: '',
  adminB: '',
  zoe: '', // compte créé en 2024 par B, arrivé dans A en 2026
  ancienne: '', // affectée dans A, mais plus membre de A
}
const slugA = `global-a-${s}`
const slugB = `global-b-${s}`
const CREATION = new Date('2024-01-15T10:00:00.000Z')
const ARRIVEE_DANS_A = new Date('2026-03-02T09:00:00.000Z')

async function executer(
  userId: string,
  slug: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

async function creerCompte(
  cle: keyof typeof ids,
  appartenances: {
    organisationId: string
    role: 'ADMIN' | 'MEMBRE'
    createdAt?: Date
  }[],
  createdAt?: Date
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: adresse(cle),
      name: `${cle} ${s}`,
      ...(createdAt === undefined ? {} : { createdAt }),
      appartenances: { create: appartenances },
    },
  })
  ids[cle] = id
}

beforeAll(async () => {
  await apollo.start()
  for (const [cle, slug, nom] of [
    ['orgA', slugA, 'Les Foulées du Lac'],
    ['orgB', slugB, 'Le Cercle des Nageurs'],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: { slug, nom, configuration: {} },
      })
    ).id
  }
  const activite = await prisma.activite.create({
    data: {
      organisationId: ids.orgA,
      slug: `activite-${s}`,
      nom: 'Activité',
      groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
    },
  })
  ids.editionA = (
    await prisma.edition.create({
      data: {
        organisationId: ids.orgA,
        activiteId: activite.id,
        annee: 2027,
        nom: 'Période',
        debut: new Date('2027-06-01'),
        fin: new Date('2027-06-02'),
      },
    })
  ).id
  ids.perimetreA = (
    await prisma.perimetre.create({
      data: {
        organisationId: ids.orgA,
        activiteId: activite.id,
        slug: 'natation',
        nom: 'Natation',
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
  await creerCompte('adminA', [{ organisationId: ids.orgA, role: 'ADMIN' }])
  await creerCompte('adminB', [{ organisationId: ids.orgB, role: 'ADMIN' }])
  await creerCompte(
    'zoe',
    [
      { organisationId: ids.orgB, role: 'MEMBRE', createdAt: CREATION },
      { organisationId: ids.orgA, role: 'MEMBRE', createdAt: ARRIVEE_DANS_A },
    ],
    CREATION
  )
  // Une personne qui n'est plus membre de A, mais dont une affectation y demeure.
  await creerCompte('ancienne', [{ organisationId: ids.orgB, role: 'MEMBRE' }])
  await prisma.affectation.createMany({
    data: [ids.zoe, ids.ancienne].map(userId => ({
      userId,
      perimetreId: ids.perimetreA,
      editionId: ids.editionA,
    })),
  })
})

afterAll(async () => {
  const orgs = { organisationId: { in: [ids.orgA, ids.orgB] } }
  await prisma.invitationOrganisation.deleteMany({ where: orgs })
  await prisma.affectation.deleteMany({ where: { perimetre: orgs } })
  await prisma.edition.deleteMany({ where: orgs })
  await prisma.perimetre.deleteMany({ where: orgs })
  await prisma.activite.deleteMany({ where: orgs })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-global-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.orgA, ids.orgB] } },
  })
  invaliderConfigurationOrganisation()
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
})

describe('la date lue d’une personne', () => {
  it('est celle de son arrivée dans l’organisation, pas celle de la création de son compte', async () => {
    const r = await executer(
      ids.adminA,
      slugA,
      `query { personnes { id creeLe } }`
    )
    expect(r.errors).toBeUndefined()
    // Le scalaire arrive ici en objet Date : la comparaison passe par sa forme ISO.
    const date = (donnees: unknown) =>
      new Date(
        (
          donnees as { personnes: { id: string; creeLe: string }[] }
        ).personnes.find(p => p.id === ids.zoe)!.creeLe
      ).toISOString()
    expect(date(r.data)).toBe(ARRIVEE_DANS_A.toISOString())
    expect(JSON.stringify(r.data)).not.toContain('2024-01-15')
    // L'organisation où le compte est né lit sa propre date.
    const chezB = await executer(
      ids.adminB,
      slugB,
      `query { personnes { id creeLe } }`
    )
    expect(date(chezB.data)).toBe(CREATION.toISOString())
  })
})

describe('un compte qui n’est pas membre de l’organisation', () => {
  it('ne livre ni son adresse ni sa date, même atteint par un objet de l’organisation', async () => {
    const LIRE = (champ: string) =>
      `query ($e: ID!) { affectations(editionId: $e) { personne { id nom ${champ} } } }`
    for (const champ of ['email', 'creeLe']) {
      const r = await executer(ids.adminA, slugA, LIRE(champ), {
        e: ids.editionA,
      })
      expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN')
      expect(r.errors?.[0]?.path).toContain(champ)
      expect(JSON.stringify(r.data ?? null)).not.toContain(adresse('ancienne'))
    }
    // L'adresse d'un membre se lit toujours.
    const membres = await executer(
      ids.adminA,
      slugA,
      `query { personnes { id email } }`
    )
    expect(membres.errors).toBeUndefined()
    expect(JSON.stringify(membres.data)).toContain(adresse('zoe'))
  })
})

describe('la limite de relance', () => {
  it('se compte par organisation : l’une ne bloque pas l’autre et ne l’apprend pas', async () => {
    const { connection } = await import('../jobs/queues.ts')
    for (const org of [ids.orgA, ids.orgB]) {
      await connection.del(`limite:${cleRelance(org, ids.zoe)}`)
    }
    const RELANCER = `mutation ($id: ID!) { renvoyerInvitation(id: $id) }`
    const b1 = await executer(ids.adminB, slugB, RELANCER, { id: ids.zoe })
    expect(b1.data).toEqual({ renvoyerInvitation: true })
    // A n'a relancé personne : sa relance part, bien que B vienne d'écrire.
    const a1 = await executer(ids.adminA, slugA, RELANCER, { id: ids.zoe })
    expect(a1.data).toEqual({ renvoyerInvitation: true })
    // La limite vaut toujours dans chaque organisation.
    const a2 = await executer(ids.adminA, slugA, RELANCER, { id: ids.zoe })
    expect(a2.errors?.[0]?.extensions?.code).toBe('SAISIE_INVALIDE')
    for (const org of [ids.orgA, ids.orgB]) {
      await connection.del(`limite:${cleRelance(org, ids.zoe)}`)
    }
  })
})

describe('un mail sans organisation désignée', () => {
  it('ne prend le nom d’aucune organisation sur une installation qui en porte plusieurs', async () => {
    invaliderConfigurationOrganisation()
    const neutre = await configurationOrganisation()
    expect(neutre.id).toBeNull()
    const noms = (
      await prisma.organisation.findMany({ select: { nom: true } })
    ).map(o => o.nom)
    // Le code de connexion d'un compte membre de deux organisations.
    const message = await composer(prisma, {
      sorte: 'code-connexion',
      userId: ids.zoe,
      code: '000000',
    })
    expect(message).not.toBeNull()
    for (const nom of ['Les Foulées du Lac', 'Le Cercle des Nageurs']) {
      expect(noms).toContain(nom)
      expect(message!.sujet).not.toContain(nom)
      expect(message!.texte).not.toContain(nom)
    }
  })
})

describe('nommerAdmin, pour la commande de l’opérateur', () => {
  it('n’accorde à un compte d’une autre organisation qu’une invitation au rôle d’admin', async () => {
    const admin = await nommerAdmin(ids.orgA, adresse('adminB'), 'Saisi')
    expect(admin).toEqual({ userId: ids.adminB, issue: 'invite' })
    expect(
      await prisma.appartenance.count({
        where: { userId: ids.adminB, organisationId: ids.orgA },
      })
    ).toBe(0)
    expect(
      await prisma.invitationOrganisation.findFirst({
        where: { userId: ids.adminB, organisationId: ids.orgA },
        select: { role: true, origine: true },
      })
    ).toEqual({ role: 'ADMIN', origine: 'INSTALLATION' })
  })

  it('crée un compte, ou promeut un membre', async () => {
    const cree = await nommerAdmin(ids.orgA, adresse('nouvelle'), 'Nouvelle')
    expect(cree.issue).toBe('cree')
    const promu = await nommerAdmin(ids.orgA, adresse('zoe'), 'Zoé')
    expect(promu).toEqual({ userId: ids.zoe, issue: 'promu' })
    const roles = await prisma.appartenance.findMany({
      where: { userId: ids.zoe },
      select: { organisationId: true, role: true },
    })
    // Le rôle ne change que dans l'organisation visée.
    expect(roles).toContainEqual({ organisationId: ids.orgA, role: 'ADMIN' })
    expect(roles).toContainEqual({ organisationId: ids.orgB, role: 'MEMBRE' })
    await prisma.appartenance.updateMany({
      where: { userId: ids.zoe, organisationId: ids.orgA },
      data: { role: 'MEMBRE' },
    })
  })

  it('ne rétablit un compte archivé que s’il n’appartient qu’à cette organisation', async () => {
    await prisma.user.update({
      where: { id: ids.zoe },
      data: { archivedAt: new Date() },
    })
    await expect(nommerAdmin(ids.orgA, adresse('zoe'), 'Zoé')).rejects.toThrow(
      /archivé/
    )
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: ids.zoe } }))
        .archivedAt
    ).not.toBeNull()
    await prisma.user.update({
      where: { id: ids.zoe },
      data: { archivedAt: null },
    })
    await prisma.user.update({
      where: { id: ids.adminA },
      data: { archivedAt: new Date() },
    })
    const retabli = await nommerAdmin(ids.orgA, adresse('adminA'), 'Admin')
    expect(retabli.issue).toBe('retabli')
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: ids.adminA } }))
        .archivedAt
    ).toBeNull()
  })
})
