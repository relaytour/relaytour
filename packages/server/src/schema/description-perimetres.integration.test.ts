import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { construireContenu } from '../orga/exporter.ts'

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
      // Une configuration valide : l'export relit les adresses de rôle.
      configuration: {
        slug,
        nom: `Organisation ${slug}`,
        domainesCourrielAutorises: ['exemple.fr'],
      },
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

  it('reste hors de l’export quand elle contient une coordonnée personnelle', async () => {
    await prisma.perimetre.update({
      where: { id: perimetreId },
      data: { description: 'Appelez le 06 12 34 56 78.' },
    })
    const contenu = await construireContenu(prisma, organisationId)
    const perimetres = [...contenu.fichiers.entries()].find(([chemin]) =>
      chemin.endsWith('perimetres.yaml')
    )
    expect(perimetres).toBeDefined()
    expect(String(perimetres![1])).toContain('natation')
    expect(String(perimetres![1])).not.toContain('06 12 34 56 78')
    const refus = contenu.refusees.find(r => r.fichier === perimetres![0])
    expect(refus?.raison).toMatch(
      /^description de natation : données personnelles/
    )
  })

  it('se retire avec une chaîne vide', async () => {
    const r = await executer(admin, MODIFIER, { id: perimetreId, d: '' })
    expect(r.errors).toBeUndefined()
    expect(await lire()).toBeNull()
  })
})

// Deux admins qui règlent le même périmètre ne s'écrasent pas : une modification
// porte la version lue.
describe('réglage d’un périmètre à plusieurs', () => {
  const REGLER = `mutation ($id: ID!, $n: String!, $v: Int) {
    modifierPerimetre(id: $id, nom: $n, ordre: 0, archive: false, versionAttendue: $v) { nom version }
  }`
  const enBase = () =>
    prisma.perimetre.findUniqueOrThrow({
      where: { id: perimetreId },
      select: { nom: true, version: true },
    })
  const code = (r: Awaited<ReturnType<typeof executer>>) =>
    r.errors?.[0]?.extensions?.code

  it('refuse d’écraser un réglage fait depuis la version lue', async () => {
    const { version } = await enBase()
    const premier = await executer(admin, REGLER, {
      id: perimetreId,
      n: 'Natation course',
      v: version,
    })
    expect(premier.data).toEqual({
      modifierPerimetre: { nom: 'Natation course', version: version + 1 },
    })

    const perime = await executer(admin, REGLER, {
      id: perimetreId,
      n: 'Natation loisir',
      v: version,
    })
    expect(code(perime)).toBe('CONFLIT_VERSION')
    expect(perime.errors?.[0]?.extensions).toMatchObject({
      versionCourante: version + 1,
    })
    expect(await enBase()).toEqual({
      nom: 'Natation course',
      version: version + 1,
    })

    // Avec la version actuelle, puis sans version attendue, l'écriture passe.
    const voulu = await executer(admin, REGLER, {
      id: perimetreId,
      n: 'Natation loisir',
      v: version + 1,
    })
    expect(voulu.errors).toBeUndefined()
    await executer(admin, REGLER, { id: perimetreId, n: 'Natation' })
    expect(await enBase()).toEqual({ nom: 'Natation', version: version + 3 })
  })

  it('ne laisse passer qu’un de deux réglages simultanés de la même version', async () => {
    const { version } = await enBase()
    const reponses = await Promise.all(
      ['Natation A', 'Natation B'].map(n =>
        executer(admin, REGLER, { id: perimetreId, n, v: version })
      )
    )
    expect(reponses.filter(r => r.errors === undefined)).toHaveLength(1)
    expect(reponses.filter(r => code(r) === 'CONFLIT_VERSION')).toHaveLength(1)
    expect((await enBase()).version).toBe(version + 1)
  })

  it('refuse l’accès avant de dire un conflit', async () => {
    for (const personne of [referente, null]) {
      const r = await executer(personne, REGLER, {
        id: perimetreId,
        n: 'Intrusion',
        v: -1,
      })
      expect(code(r)).toBe('FORBIDDEN')
    }
    expect((await enBase()).nom).not.toBe('Intrusion')
  })
})
