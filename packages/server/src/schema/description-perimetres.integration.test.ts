import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Description d'un périmètre (ADR 0012) : un admin la pose à la création, la change
// ou la retire. Les refus par activité sont couverts par la table des refus croisés.
// Le fichier crée sa propre organisation : une mutation de périmètre date une
// modification du contenu, qui refuserait ensuite les imports des autres tests dans
// l'organisation par défaut (ADR 0009).

const s = randomUUID().slice(0, 8)
const slug = `desc-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
let admin = ''
let referente = ''
let organisationId = ''
let ACTIVITE = ''
let perimetreId = ''

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

const CREER = `mutation ($a: ID, $slug: String!, $d: String) {
  creerPerimetre(activiteId: $a, slug: $slug, nom: "Natation", groupe: "sport", description: $d) { id description }
}`
const MODIFIER = `mutation ($id: ID!, $d: String) {
  modifierPerimetre(id: $id, nom: "Natation", ordre: 0, archive: false, description: $d) { description }
}`
const MODIFIER_SANS = `mutation ($id: ID!) {
  modifierPerimetre(id: $id, nom: "Natation bis", ordre: 0, archive: false) { description }
}`

const lire = async () =>
  (
    await prisma.perimetre.findUniqueOrThrow({
      where: { id: perimetreId },
      select: { description: true },
    })
  ).description

beforeAll(async () => {
  await apollo.start()
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: `Organisation ${slug}`,
      configuration: {},
      activites: {
        create: {
          slug,
          nom: 'Activité',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      },
    },
    include: { activites: true },
  })
  organisationId = organisation.id
  ACTIVITE = organisation.activites[0]!.id
  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['referente', 'MEMBRE'],
  ] as const) {
    const id = randomUUID()
    await prisma.user.create({
      data: {
        id,
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId, role } },
      },
    })
    if (cle === 'admin') admin = id
    else referente = id
  }
})

afterAll(async () => {
  await prisma.perimetre.deleteMany({ where: { organisationId } })
  await prisma.activite.deleteMany({ where: { organisationId } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: organisationId } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('description d’un périmètre', () => {
  it('se pose à la création, sans les espaces autour', async () => {
    const r = await executer(admin, CREER, {
      a: ACTIVITE,
      slug: 'natation',
      d: '  Le pôle obtient les lieux.  ',
    })
    expect(r.errors).toBeUndefined()
    const cree = (
      r.data as { creerPerimetre: { id: string; description: string } }
    ).creerPerimetre
    perimetreId = cree.id
    expect(cree.description).toBe('Le pôle obtient les lieux.')
  })

  it('reste inchangée quand la modification ne la mentionne pas', async () => {
    const r = await executer(admin, MODIFIER_SANS, { id: perimetreId })
    expect(r.errors).toBeUndefined()
    expect(await lire()).toBe('Le pôle obtient les lieux.')
  })

  it('refuse une description de plus de 400 caractères, sans rien écrire', async () => {
    const r = await executer(admin, MODIFIER, {
      id: perimetreId,
      d: 'x'.repeat(401),
    })
    expect(r.errors?.[0]?.extensions?.code).toBe('SAISIE_INVALIDE')
    expect(await lire()).toBe('Le pôle obtient les lieux.')
  })

  it('refuse une référente, sans rien écrire', async () => {
    const r = await executer(referente, MODIFIER, {
      id: perimetreId,
      d: 'Intrusion',
    })
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN')
    expect(await lire()).toBe('Le pôle obtient les lieux.')
  })

  it('se retire avec une chaîne vide', async () => {
    const r = await executer(admin, MODIFIER, { id: perimetreId, d: '' })
    expect(r.errors).toBeUndefined()
    expect(await lire()).toBeNull()
  })
})
