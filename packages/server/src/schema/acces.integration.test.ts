import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { testUtils } from 'better-auth/plugins'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { auth, creerAuth } from '../auth.ts'
import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Les contrôles d'accès se prouvent par le refus (CLAUDE.md, invariant 11).

const suffixe = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = { admin: '', referente: '', archivee: '' }

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

function codeErreur(resultat: Awaited<ReturnType<typeof executer>>) {
  return resultat.errors?.[0]?.extensions?.code
}

beforeAll(async () => {
  await apollo.start()
  for (const [cle, donnees] of Object.entries({
    admin: { isAdmin: true, archivedAt: null },
    referente: { isAdmin: false, archivedAt: null },
    archivee: { isAdmin: true, archivedAt: new Date() },
  })) {
    const id = randomUUID()
    await prisma.user.create({
      data: {
        id,
        email: `${cle}-${suffixe}@exemple.fr`,
        name: cle,
        ...donnees,
      },
    })
    ids[cle as keyof typeof ids] = id
  }
})

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${suffixe}@exemple.fr` } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('requêtes réservées aux admins', () => {
  const REQUETES = [
    '{ personnes { id } }',
    '{ nombreAbonnesNewsletter }',
    'query ($e: ID!) { affectations(editionId: $e) { id } }',
    'query ($e: ID!) { postesAPourvoir(editionId: $e) { etat } }',
    'query ($e: ID!) { appelPostes(editionId: $e) }',
    'mutation ($e: ID!) { definirSouhaits(personneId: $e, editionId: $e, perimetreIds: []) { id } }',
    'mutation ($e: ID!) { retirerSouhait(id: $e) }',
  ]

  it.each(REQUETES)('refuse sans session : %s', async query => {
    expect(codeErreur(await executer(null, query, { e: 'x' }))).toBe(
      'FORBIDDEN'
    )
  })

  it.each(REQUETES)('refuse à une référente : %s', async query => {
    expect(codeErreur(await executer(ids.referente, query, { e: 'x' }))).toBe(
      'FORBIDDEN'
    )
  })

  it.each(REQUETES)('refuse à un compte admin archivé : %s', async query => {
    expect(codeErreur(await executer(ids.archivee, query, { e: 'x' }))).toBe(
      'FORBIDDEN'
    )
  })

  it('accepte un admin', async () => {
    const resultat = await executer(ids.admin, '{ personnes { id } }')
    expect(resultat.errors).toBeUndefined()
  })
})

describe('mutations réservées aux admins', () => {
  it('refuse l’invitation à une référente', async () => {
    const resultat = await executer(
      ids.referente,
      'mutation { inviterPersonne(email: "pirate@exemple.fr", nom: "Pirate") { id } }'
    )
    expect(codeErreur(resultat)).toBe('FORBIDDEN')
    expect(
      await prisma.user.count({ where: { email: 'pirate@exemple.fr' } })
    ).toBe(0)
  })

  it('refuse qu’un admin retire ses propres droits', async () => {
    const resultat = await executer(
      ids.admin,
      'mutation ($id: ID!) { modifierPersonne(id: $id, nom: "admin", estAdmin: false) { id } }',
      { id: ids.admin }
    )
    expect(codeErreur(resultat)).toBe('SAISIE_INVALIDE')
  })
})

describe('données personnelles', () => {
  it('laisse une référente lire sa propre adresse', async () => {
    const resultat = await executer(ids.referente, '{ moi { email estAdmin } }')
    expect(resultat.errors).toBeUndefined()
    expect(resultat.data).toEqual({
      moi: { email: `referente-${suffixe}@exemple.fr`, estAdmin: false },
    })
  })

  it('renvoie null pour moi sans session', async () => {
    const resultat = await executer(null, '{ moi { id } }')
    expect(resultat.data).toEqual({ moi: null })
  })
})

describe('session Better Auth', () => {
  it('ferme les sessions à l’archivage', async () => {
    const authDeTest = creerAuth([testUtils()])
    const { test } = (await authDeTest.$context) as unknown as {
      test: { getAuthHeaders(o: { userId: string }): Promise<Headers> }
    }
    const cible = randomUUID()
    await prisma.user.create({
      data: { id: cible, email: `cible-${suffixe}@exemple.fr`, name: 'cible' },
    })
    const entetes = await test.getAuthHeaders({ userId: cible })
    expect((await auth.api.getSession({ headers: entetes }))?.user.id).toBe(
      cible
    )

    await executer(
      ids.admin,
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }',
      { id: cible }
    )
    expect(await auth.api.getSession({ headers: entetes })).toBeNull()
  })
})
