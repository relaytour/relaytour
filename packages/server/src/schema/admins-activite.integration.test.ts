import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Admins d'activité et visibilité des activités (ADR 0010).
//
// Une organisation porte deux activités, A1 et A2. L'admin de l'organisation les
// voit et les gère toutes. L'admin de A1 gère A1 et ne voit pas A2. Une personne ne
// voit que les activités où elle est affectée. La table des refus croisés prouve
// les refus opération par opération ; ce fichier prouve ce que chaque rôle peut
// faire, et les opérations réservées à l'admin de l'organisation.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slug = `admins-${s}`
const ids = {
  org: '',
  a1: '',
  a2: '',
  edition1: '',
  edition2: '',
  perimetre1: '',
  perimetre2: '',
  adminOrg: '',
  adminA1: '',
  membreA1: '',
  membreA2: '',
  sansActivite: '',
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
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

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

async function creerActivite(cle: string) {
  const activite = await prisma.activite.create({
    data: {
      organisationId: ids.org,
      slug: `${cle}-${s}`,
      nom: `Activité ${cle}`,
      groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
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

const ACTIVITES = 'query { activites { id } }'
const CREER_PERIMETRE =
  'mutation ($a: ID!, $s: String!) { creerPerimetre(activiteId: $a, slug: $s, nom: "Nouveau", groupe: "sport") { id } }'
const AFFECTER =
  'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }'
const DEFINIR_ADMIN =
  'mutation ($u: ID!, $a: ID!, $x: Boolean!) { definirAdminActivite(personneId: $u, activiteId: $a, admin: $x) }'

beforeAll(async () => {
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${s}`, configuration: {} },
    })
  ).id
  const a1 = await creerActivite('a1')
  const a2 = await creerActivite('a2')
  Object.assign(ids, {
    a1: a1.activite,
    a2: a2.activite,
    edition1: a1.edition,
    edition2: a2.edition,
    perimetre1: a1.perimetre,
    perimetre2: a2.perimetre,
  })
  ids.adminOrg = await creerCompte('admin-org', 'ADMIN')
  ids.adminA1 = await creerCompte('admin-a1', 'MEMBRE')
  ids.membreA1 = await creerCompte('membre-a1', 'MEMBRE')
  ids.membreA2 = await creerCompte('membre-a2', 'MEMBRE')
  ids.sansActivite = await creerCompte('sans-activite', 'MEMBRE')
  await prisma.adminActivite.create({
    data: { userId: ids.adminA1, activiteId: ids.a1, organisationId: ids.org },
  })
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.membreA1,
        perimetreId: ids.perimetre1,
        editionId: ids.edition1,
      },
      {
        userId: ids.membreA2,
        perimetreId: ids.perimetre2,
        editionId: ids.edition2,
      },
    ],
  })
})

afterAll(async () => {
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  invaliderConfigurationOrganisation()
})

describe('visibilité des activités', () => {
  it('montre à chaque rôle ses activités seulement', async () => {
    const liste = async (userId: string) =>
      ((await executer(userId, ACTIVITES)).data?.activites as { id: string }[])
        .map(a => a.id)
        .sort()
    expect(await liste(ids.adminOrg)).toEqual([ids.a1, ids.a2].sort())
    expect(await liste(ids.adminA1)).toEqual([ids.a1])
    expect(await liste(ids.membreA1)).toEqual([ids.a1])
    expect(await liste(ids.membreA2)).toEqual([ids.a2])
    expect(await liste(ids.sansActivite)).toEqual([])
  })

  it('refuse toute lecture d’une activité à une personne qui ne la voit pas', async () => {
    for (const userId of [ids.adminA1, ids.membreA1, ids.sansActivite]) {
      const r = await executer(
        userId,
        'query ($a: ID) { editions(activiteId: $a) { id } }',
        { a: ids.a2 }
      )
      expect(code(r)).toBe('FORBIDDEN')
    }
    // Sans activité visible, même la requête sans identifiant est refusée.
    expect(
      code(await executer(ids.sansActivite, 'query { editions { id } }'))
    ).toBe('FORBIDDEN')
  })

  it('ouvre une activité dès la première affectation', async () => {
    const affectation = await prisma.affectation.create({
      data: {
        userId: ids.sansActivite,
        perimetreId: ids.perimetre2,
        editionId: ids.edition2,
      },
    })
    try {
      const r = await executer(ids.sansActivite, ACTIVITES)
      expect(r.data?.activites).toEqual([{ id: ids.a2 }])
    } finally {
      await prisma.affectation.delete({ where: { id: affectation.id } })
    }
  })
})

describe('admin d’une activité', () => {
  it('gère son activité : périmètre, affectation, annuaire', async () => {
    const perimetre = await executer(ids.adminA1, CREER_PERIMETRE, {
      a: ids.a1,
      s: `nouveau-${s}`,
    })
    expect(perimetre.errors).toBeUndefined()
    const affectation = await executer(ids.adminA1, AFFECTER, {
      u: ids.membreA2,
      p: ids.perimetre1,
      e: ids.edition1,
    })
    expect(affectation.errors).toBeUndefined()
    const annuaire = await executer(
      ids.adminA1,
      'query { personnes { id email } }'
    )
    expect(annuaire.errors).toBeUndefined()
    await prisma.affectation.deleteMany({
      where: { userId: ids.membreA2, perimetreId: ids.perimetre1 },
    })
  })

  it('ne lit pas les affectations d’une activité qu’il n’administre pas', async () => {
    const r = await executer(
      ids.adminA1,
      'query { personnes { id affectations { perimetre { id } } } }'
    )
    const membre = (
      r.data?.personnes as {
        id: string
        affectations: { perimetre: { id: string } }[]
      }[]
    ).find(p => p.id === ids.membreA2)
    expect(membre?.affectations).toEqual([])
  })

  it('ne lit pas le rôle d’organisation des autres membres', async () => {
    const r = await executer(ids.adminA1, 'query { personnes { id estAdmin } }')
    const personnes = r.data?.personnes as {
      id: string
      estAdmin: boolean | null
    }[]
    expect(personnes.find(p => p.id === ids.adminOrg)?.estAdmin).toBeNull()
    expect(personnes.find(p => p.id === ids.adminA1)?.estAdmin).toBe(false)
  })

  it('refuse de gérer une autre activité', async () => {
    expect(
      code(
        await executer(ids.adminA1, CREER_PERIMETRE, {
          a: ids.a2,
          s: `intrus-${s}`,
        })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(ids.adminA1, AFFECTER, {
          u: ids.membreA1,
          p: ids.perimetre2,
          e: ids.edition2,
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('laisse à l’admin de l’organisation les opérations de l’organisation', async () => {
    for (const [query, variables] of [
      [
        'mutation { creerActivite(slug: "intruse", nom: "X", nature: SAISON) { id } }',
        {},
      ],
      [
        'mutation ($a: ID!) { archiverActivite(id: $a, archive: true) { id } }',
        { a: ids.a1 },
      ],
      [
        'mutation ($a: ID!) { modifierActivite(id: $a, nom: "X", nature: EVENEMENT, groupes: [{ cle: "sport", libelle: "Sport", libellePluriel: "Sports" }], ordre: 0, archive: true) { id } }',
        { a: ids.a1 },
      ],
      [DEFINIR_ADMIN, { u: ids.membreA1, a: ids.a1, x: true }],
      [
        'mutation { inviterPersonne(email: "admin-intrus@exemple.fr", nom: "X", estAdmin: true) { id } }',
        {},
      ],
      ['query { identiteOrganisation { nom } }', {}],
      ['query { exportContenu { nomFichier } }', {}],
      [
        'mutation ($u: ID!) { archiverPersonne(id: $u, archive: true) { id } }',
        { u: ids.membreA1 },
      ],
      [
        'mutation ($u: ID!) { accorderDroitRedaction(personneId: $u) { id } }',
        { u: ids.membreA1 },
      ],
    ] as const) {
      const r = await executer(ids.adminA1, query, variables)
      expect(code(r), query).toBe('FORBIDDEN')
    }
    expect(
      await prisma.adminActivite.count({ where: { userId: ids.membreA1 } })
    ).toBe(0)
    expect(
      await prisma.activite.count({ where: { organisationId: ids.org } })
    ).toBe(2)
  })

  it('refuse à une référente les opérations de gestion de sa propre activité', async () => {
    const r = await executer(ids.membreA1, AFFECTER, {
      u: ids.membreA2,
      p: ids.perimetre1,
      e: ids.edition1,
    })
    expect(code(r)).toBe('FORBIDDEN')
  })
})

describe('nomination d’un admin d’activité', () => {
  it('donne puis retire les droits de gestion d’une activité', async () => {
    const nomme = await executer(ids.adminOrg, DEFINIR_ADMIN, {
      u: ids.membreA2,
      a: ids.a2,
      x: true,
    })
    expect(nomme.data?.definirAdminActivite).toBe(true)
    const gestion = await executer(ids.membreA2, CREER_PERIMETRE, {
      a: ids.a2,
      s: `gere-${s}`,
    })
    expect(gestion.errors).toBeUndefined()

    await executer(ids.adminOrg, DEFINIR_ADMIN, {
      u: ids.membreA2,
      a: ids.a2,
      x: false,
    })
    const refus = await executer(ids.membreA2, CREER_PERIMETRE, {
      a: ids.a2,
      s: `refuse-${s}`,
    })
    expect(code(refus)).toBe('FORBIDDEN')
  })

  it('refuse de nommer une personne d’une autre organisation', async () => {
    const autre = randomUUID()
    await prisma.user.create({
      data: { id: autre, email: `externe-${s}@exemple.fr`, name: 'Externe' },
    })
    const r = await executer(ids.adminOrg, DEFINIR_ADMIN, {
      u: autre,
      a: ids.a1,
      x: true,
    })
    expect(code(r)).toBeOneOf(['FORBIDDEN', 'SAISIE_INVALIDE'])
    expect(await prisma.adminActivite.count({ where: { userId: autre } })).toBe(
      0
    )
  })
})
