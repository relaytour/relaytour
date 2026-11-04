import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { GraphQLError } from 'graphql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { schema } from '../schema/index.ts'

import { importerEquipe } from './equipe-import.ts'
import { creerOrganisation, modifierOrganisation } from './installation.ts'

// Limite de membres (ADR 0058) : une place est une appartenance active ou une
// invitation en attente. Chaque entrée prend une place sous le verrou de
// l'organisation ; archiver une personne libère la sienne.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slug = `limite-${s}`
const ids = {
  organisation: '',
  activite: '',
  edition: '',
  admin: '',
  externe: '',
}

async function executer(query: string, variables: Record<string, unknown>) {
  const contextValue = await buildContext('127.0.0.1', ids.admin, slug)
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const INVITER = `mutation ($e: String!, $n: String!) {
  inviterPersonne(email: $e, nom: $n) { enAttente }
}`
const ARCHIVER = `mutation ($id: ID!, $a: Boolean!) {
  archiverPersonne(id: $id, archive: $a) { id }
}`
const adresse = (nom: string) => `${nom}-${s}@exemple.org`

async function occupees(): Promise<number> {
  const [actives, invitations] = await Promise.all([
    prisma.appartenance.count({
      where: { organisationId: ids.organisation, archiveLe: null },
    }),
    prisma.invitationOrganisation.count({
      where: { organisationId: ids.organisation, expireLe: { gt: new Date() } },
    }),
  ])
  return actives + invitations
}

async function limiter(membres: number | null) {
  await modifierOrganisation(slug, { limites: { membres } })
}

beforeAll(async () => {
  ids.organisation = await creerOrganisation({
    slug,
    nom: 'Limite de membres',
    domainesCourrielAutorises: ['exemple.org'],
  })
  const activite = await prisma.activite.findFirstOrThrow({
    where: { organisationId: ids.organisation },
    select: { id: true },
  })
  ids.activite = activite.id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.organisation,
        activiteId: ids.activite,
        annee: 2030,
        nom: 'Édition 2030',
        debut: new Date('2030-05-01'),
        fin: new Date('2030-05-02'),
      },
      select: { id: true },
    })
  ).id
  ids.admin = (
    await prisma.user.create({
      data: {
        id: randomUUID(),
        email: adresse('admin'),
        name: 'Admin Limite',
        appartenances: {
          create: { organisationId: ids.organisation, role: 'ADMIN' },
        },
      },
      select: { id: true },
    })
  ).id
  // Un compte connu hors de l'organisation : il ne reçoit qu'une invitation.
  ids.externe = (
    await prisma.user.create({
      data: {
        id: randomUUID(),
        email: adresse('externe'),
        name: 'Compte Externe',
      },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await prisma.organisation
    .update({ where: { id: ids.organisation }, data: { limiteMembres: null } })
    .catch(() => {})
})

describe('limite de membres', () => {
  it('garde la limite hors de la colonne limites et l’expose à l’administration', async () => {
    await limiter(3)
    const ligne = await prisma.organisation.findUniqueOrThrow({
      where: { id: ids.organisation },
      select: { limites: true, limiteMembres: true },
    })
    expect(ligne.limiteMembres).toBe(3)
    expect(ligne.limites).toEqual({})
    const reponse = await apollo.executeOperation(
      {
        query: `{ organisations { slug placesMembresOccupees limites { membres } } }`,
      },
      { contextValue: await buildContext('127.0.0.1', null, null, true) }
    )
    if (reponse.body.kind !== 'single') throw new Error('Réponse inattendue.')
    const organisations = reponse.body.singleResult.data?.organisations as {
      slug: string
      placesMembresOccupees: number
      limites: { membres: number | null }
    }[]
    expect(organisations.find(o => o.slug === slug)).toEqual({
      slug,
      placesMembresOccupees: 1,
      limites: { membres: 3 },
    })
  })

  it('refuse un compte de plus quand la limite est atteinte', async () => {
    await limiter(3)
    for (const nom of ['un', 'deux']) {
      const r = await executer(INVITER, { e: adresse(nom), n: nom })
      expect(r.errors).toBeUndefined()
    }
    const refus = await executer(INVITER, { e: adresse('trois'), n: 'trois' })
    expect(code(refus)).toBe('LIMITE_ATTEINTE')
    expect(
      await prisma.user.count({ where: { email: adresse('trois') } })
    ).toBe(0)
  })

  it('compte une invitation en attente, sans la compter deux fois', async () => {
    const un = await prisma.user.findUniqueOrThrow({
      where: { email: adresse('un') },
      select: { id: true },
    })
    // Archiver libère une place, que l'invitation du compte extérieur reprend.
    expect((await executer(ARCHIVER, { id: un.id, a: true })).errors).toBe(
      undefined
    )
    const invitee = await executer(INVITER, {
      e: adresse('externe'),
      n: 'Externe',
    })
    expect(invitee.data?.inviterPersonne).toMatchObject({ enAttente: true })
    expect(await occupees()).toBe(3)
    // Compléter l'invitation en attente ne prend pas de place.
    const reprise = await executer(INVITER, {
      e: adresse('externe'),
      n: 'Externe',
    })
    expect(reprise.errors).toBeUndefined()
    // Rétablir la personne archivée en reprendrait une.
    const retablie = await executer(ARCHIVER, { id: un.id, a: false })
    expect(code(retablie)).toBe('LIMITE_ATTEINTE')
    const appartenance = await prisma.appartenance.findUniqueOrThrow({
      where: {
        userId_organisationId: {
          userId: un.id,
          organisationId: ids.organisation,
        },
      },
      select: { archiveLe: true },
    })
    expect(appartenance.archiveLe).not.toBeNull()
  })

  it('refuse une demande acceptée au-delà de la limite', async () => {
    const demande = await prisma.demande.create({
      data: {
        organisationId: ids.organisation,
        activiteId: ids.activite,
        editionId: ids.edition,
        origine: 'FORMULAIRE',
        nom: 'Demande',
        adresse: adresse('demande'),
        adresseEnAttente: adresse('demande'),
      },
      select: { id: true },
    })
    const r = await executer(
      `mutation ($id: ID!) { accepterDemande(id: $id, affecter: []) { id statut } }`,
      { id: demande.id }
    )
    expect(code(r)).toBe('LIMITE_ATTEINTE')
    const relue = await prisma.demande.findUniqueOrThrow({
      where: { id: demande.id },
      select: { statut: true },
    })
    expect(relue.statut).toBe('EN_ATTENTE')
  })

  it('n’accorde qu’une place à deux invitations simultanées', async () => {
    await limiter((await occupees()) + 1)
    const [a, b] = await Promise.all([
      executer(INVITER, { e: adresse('simultane-a'), n: 'A' }),
      executer(INVITER, { e: adresse('simultane-b'), n: 'B' }),
    ])
    expect([code(a), code(b)].sort()).toEqual(['LIMITE_ATTEINTE', undefined])
  })

  it('refuse l’import, simulation comprise, et l’accepte sans limite', async () => {
    const personnes = ['import-a', 'import-b'].map(nom => ({
      nom,
      adresse: adresse(nom),
      affectations: [],
      contactPrincipal: [],
      souhaits: [],
    }))
    await limiter((await occupees()) + 1)
    for (const simulation of [true, false]) {
      const refus = await importerEquipe(prisma, personnes, {
        organisationId: ids.organisation,
        activiteId: ids.activite,
        annee: 2030,
        simulation,
      }).catch((e: unknown) => e)
      expect(refus).toBeInstanceOf(GraphQLError)
      expect((refus as GraphQLError).extensions.code).toBe('LIMITE_ATTEINTE')
    }
    expect(
      await prisma.user.count({ where: { email: adresse('import-a') } })
    ).toBe(0)
    await limiter(null)
    const rapport = await importerEquipe(prisma, personnes, {
      organisationId: ids.organisation,
      activiteId: ids.activite,
      annee: 2030,
    })
    expect(rapport.comptesCrees).toEqual(['import-a', 'import-b'])
  })
})
