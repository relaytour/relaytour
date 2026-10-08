import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { parse } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { GROUPES_PAR_DEFAUT } from '../lib/activites.ts'
import { PHASES_PAR_DEFAUT } from '../lib/phases.ts'
import { construireContenu } from '../orga/exporter.ts'

import { schema } from './index.ts'

// Phases d'une activité (ADR 0025) : un admin de l'activité les règle, le serveur
// applique les règles du contenu, et l'export les écrit dans activite.yaml. Le refus
// par organisation et par activité est couvert par la table des refus croisés. Le
// fichier crée sa propre organisation : une modification d'activité date une
// modification du contenu (ADR 0009).

const s = randomUUID().slice(0, 8)
const slug = `phases-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
let admin = ''
let referente = ''
let organisationId = ''
let ACTIVITE = ''

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

const LIRE = `query { activites { id phases { cle libelle jusquA } } }`
const MODIFIER = `mutation ($id: ID!, $phases: [PhaseInput!]) {
  modifierActivite(
    id: $id, nom: "Activité", nature: EVENEMENT, ordre: 0, phases: $phases
    groupes: [
      { cle: "sport", libelle: "Sport", libellePluriel: "Sports" }
      { cle: "pole", libelle: "Pôle", libellePluriel: "Pôles" }
    ]
  ) { phases { cle libelle jusquA } }
}`
const CREER = `mutation ($slug: String!, $phases: [PhaseInput!]) {
  creerActivite(slug: $slug, nom: "Autre activité", nature: SAISON, phases: $phases) {
    id phases { cle libelle jusquA }
  }
}`

const PHASES = [
  { cle: 'cadrage', libelle: 'Cadrage', jusquA: 'J-90' },
  { cle: 'preparation', libelle: 'Préparation', jusquA: 'J-7' },
  { cle: 'bilan', libelle: 'Bilan', jusquA: null },
]
// Ce que la base garde : la dernière phase n'a pas de borne.
const EN_BASE = [
  { cle: 'cadrage', libelle: 'Cadrage', jusquA: 'J-90' },
  { cle: 'preparation', libelle: 'Préparation', jusquA: 'J-7' },
  { cle: 'bilan', libelle: 'Bilan' },
]
// Ce que l'API rend : une borne absente vaut null.
const parDefaut = PHASES_PAR_DEFAUT.map(p => ({
  cle: p.cle,
  libelle: p.libelle,
  jusquA: p.jusquA ?? null,
}))

const enBase = async (id = ACTIVITE) =>
  (
    await prisma.activite.findUniqueOrThrow({
      where: { id },
      select: { phases: true },
    })
  ).phases

beforeAll(async () => {
  await apollo.start()
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: `Organisation ${slug}`,
      configuration: {
        slug,
        nom: `Organisation ${slug}`,
        domainesCourrielAutorises: ['exemple.fr'],
      },
      // Une activité que la disposition plate décrit : le slug de l'organisation,
      // un événement, les groupes par défaut, aucune identité.
      activites: {
        create: { slug, nom: 'Activité', groupes: GROUPES_PAR_DEFAUT },
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
  await prisma.activite.deleteMany({ where: { organisationId } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: organisationId } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('phases d’une activité', () => {
  it('valent les phases par défaut tant que l’activité n’en déclare pas', async () => {
    const r = await executer(admin, LIRE)
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      activites: [{ id: ACTIVITE, phases: parDefaut }],
    })
    expect(await enBase()).toBeNull()
    // Sans phases déclarées, la disposition plate décrit encore l'activité.
    const contenu = await construireContenu(prisma, organisationId)
    expect([...contenu.fichiers.keys()]).not.toContain(
      `activites/${slug}/activite.yaml`
    )
  })

  it('ne changent pas quand la modification ne les mentionne pas', async () => {
    const r = await executer(admin, MODIFIER, { id: ACTIVITE })
    expect(r.errors).toBeUndefined()
    expect(await enBase()).toBeNull()
  })

  it('s’écrivent et se relisent dans l’ordre déclaré', async () => {
    const r = await executer(admin, MODIFIER, { id: ACTIVITE, phases: PHASES })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({ modifierActivite: { phases: PHASES } })
    expect(await enBase()).toEqual(EN_BASE)

    const sans = await executer(admin, MODIFIER, { id: ACTIVITE })
    expect(sans.data).toEqual({ modifierActivite: { phases: PHASES } })
  })

  it.each([
    ['une liste vide', []],
    [
      'des bornes décroissantes',
      [
        { cle: 'a', libelle: 'A', jusquA: 'J-7' },
        { cle: 'b', libelle: 'B', jusquA: 'J-90' },
        { cle: 'c', libelle: 'C' },
      ],
    ],
    [
      'une dernière phase bornée',
      [
        { cle: 'a', libelle: 'A', jusquA: 'J-7' },
        { cle: 'b', libelle: 'B', jusquA: 'J+30' },
      ],
    ],
    [
      'une phase sans borne avant la dernière',
      [
        { cle: 'a', libelle: 'A' },
        { cle: 'b', libelle: 'B' },
      ],
    ],
    [
      'deux phases de même clé',
      [
        { cle: 'a', libelle: 'A', jusquA: 'J-7' },
        { cle: 'a', libelle: 'B' },
      ],
    ],
    [
      'une borne mal formée',
      [
        { cle: 'a', libelle: 'A', jusquA: '-7' },
        { cle: 'b', libelle: 'B' },
      ],
    ],
    [
      'treize phases',
      Array.from({ length: 13 }, (_, rang) => ({
        cle: `phase-${rang}`,
        libelle: `Phase ${rang}`,
        ...(rang === 12 ? {} : { jusquA: `J+${rang}` }),
      })),
    ],
  ])('refusent %s, sans rien écrire', async (_cas, phases) => {
    const r = await executer(admin, MODIFIER, { id: ACTIVITE, phases })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await enBase()).toEqual(EN_BASE)
  })

  it('refusent une référente et une requête sans session, sans rien écrire', async () => {
    for (const personne of [referente, null]) {
      const r = await executer(personne, MODIFIER, {
        id: ACTIVITE,
        phases: [{ cle: 'intrusion', libelle: 'Intrusion' }],
      })
      expect(code(r)).toBe('FORBIDDEN')
    }
    expect(await enBase()).toEqual(EN_BASE)
  })

  it('s’exportent dans activite.yaml, que la disposition plate ne décrit plus', async () => {
    const contenu = await construireContenu(prisma, organisationId)
    const fichier = contenu.fichiers.get(`activites/${slug}/activite.yaml`)
    expect(fichier).toBeDefined()
    expect((parse(String(fichier)) as { phases: unknown }).phases).toEqual(
      EN_BASE
    )
    await expect(
      construireContenu(prisma, organisationId, { disposition: 'plate' })
    ).rejects.toThrow(/des phases/)
  })

  it('se posent à la création d’une activité, ou restent par défaut', async () => {
    const avec = await executer(admin, CREER, {
      slug: `avec-${s}`,
      phases: PHASES,
    })
    expect(avec.errors).toBeUndefined()
    const creee = (
      avec.data as { creerActivite: { id: string; phases: unknown } }
    ).creerActivite
    expect(creee.phases).toEqual(PHASES)
    expect(await enBase(creee.id)).toEqual(EN_BASE)

    const sans = await executer(admin, CREER, { slug: `sans-${s}` })
    expect(sans.errors).toBeUndefined()
    const defaut = (
      sans.data as { creerActivite: { id: string; phases: unknown } }
    ).creerActivite
    expect(defaut.phases).toEqual(parDefaut)
    expect(await enBase(defaut.id)).toBeNull()
  })
})
