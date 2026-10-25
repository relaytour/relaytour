import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Liste « Premiers pas » (ADR 0048). Chaque étape se coche à partir des données,
// sauf la description de l'activité, qu'un admin confirme. La personne qui lit la
// liste ne compte pas dans l'équipe. Le fichier crée ses propres organisations.

const s = randomUUID().slice(0, 8)
const slug = `premiers-pas-${s}`
const slugAutre = `premiers-pas-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  admin: '',
  adminActivite: '',
  membre: '',
  externe: '',
}

const ETAT = `etapes { etape faite } masques termines`
const LIRE = `query ($a: ID) { premiersPas(activiteId: $a) { ${ETAT} } }`
const CONFIRMER = `mutation ($a: ID) { confirmerActivite(activiteId: $a) { ${ETAT} } }`
const MASQUER = `mutation ($a: ID) { masquerPremiersPas(activiteId: $a) { ${ETAT} } }`
const AFFICHER = `mutation ($a: ID) { afficherPremiersPas(activiteId: $a) { ${ETAT} } }`

interface Etat {
  etapes: { etape: string; faite: boolean }[]
  masques: boolean
  termines: boolean
}

async function executer(userId: string, query: string, organisation = slug) {
  const r = await apollo.executeOperation(
    { query, variables: { a: ids.activite } },
    { contextValue: await buildContext('127.0.0.1', userId, organisation) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

async function etat(query = LIRE, userId = ids.adminActivite): Promise<Etat> {
  const r = await executer(userId, query)
  expect(r.errors).toBeUndefined()
  return Object.values(r.data as Record<string, Etat>)[0]!
}

const faites = (e: Etat) => e.etapes.filter(x => x.faite).map(x => x.etape)

beforeAll(async () => {
  await apollo.start()
  for (const [cle, slugOrg] of [
    ['org', slug],
    ['orgAutre', slugAutre],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: {
          slug: slugOrg,
          nom: `Organisation ${slugOrg}`,
          configuration: {},
        },
      })
    ).id
  }
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug: 'rencontres',
        nom: 'Rencontres',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
  for (const [cle, role, organisationId] of [
    ['admin', 'ADMIN', ids.org],
    ['adminActivite', 'MEMBRE', ids.org],
    ['membre', 'MEMBRE', ids.org],
    ['externe', 'ADMIN', ids.orgAutre],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: cle,
        appartenances: { create: { organisationId, role } },
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
})

afterAll(async () => {
  const dansLOrg = { organisationId: ids.org }
  await prisma.tache.deleteMany({ where: { edition: dansLOrg } })
  await prisma.affectation.deleteMany({ where: { edition: dansLOrg } })
  await prisma.edition.deleteMany({ where: dansLOrg })
  await prisma.perimetre.deleteMany({ where: dansLOrg })
  await prisma.rattachementActivite.deleteMany({ where: dansLOrg })
  await prisma.adminActivite.deleteMany({ where: dansLOrg })
  await prisma.activite.deleteMany({ where: dansLOrg })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.orgAutre] } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('premiers pas d’une activité', () => {
  it('sont réservés aux admins de l’activité, dans leur organisation', async () => {
    expect(code(await executer(ids.membre, LIRE))).toBe('FORBIDDEN')
    expect(code(await executer(ids.membre, CONFIRMER))).toBe('FORBIDDEN')
    expect(code(await executer(ids.externe, MASQUER, slugAutre))).toBe(
      'FORBIDDEN'
    )
  })

  it('partent tous à faire, et l’admin qui lit la liste ne compte pas dans l’équipe', async () => {
    // Le rattachement de l'admin qui lit la liste ne coche pas « Inviter l'équipe ».
    await prisma.rattachementActivite.create({
      data: {
        userId: ids.adminActivite,
        activiteId: ids.activite,
        organisationId: ids.org,
      },
    })
    const depart = await etat()
    expect(depart.etapes.map(e => e.etape)).toEqual([
      'ACTIVITE',
      'PERIODE',
      'PERIMETRES',
      'TACHES',
      'EQUIPE',
    ])
    expect(faites(depart)).toEqual([])
    expect(depart).toMatchObject({ masques: false, termines: false })
  })

  it('se cochent à partir des données, quel que soit le chemin', async () => {
    expect(faites(await etat(CONFIRMER))).toEqual(['ACTIVITE'])

    const edition = await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Rencontres 2027',
        debut: new Date('2027-06-12'),
        fin: new Date('2027-06-13'),
      },
    })
    const perimetre = await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: 'natation',
        nom: 'Natation',
        type: 'SPORT',
        groupe: 'sport',
      },
    })
    expect(faites(await etat())).toEqual(['ACTIVITE', 'PERIODE', 'PERIMETRES'])

    await prisma.tache.create({
      data: {
        editionId: edition.id,
        perimetreId: perimetre.id,
        titre: 'Réserver le bassin',
      },
    })
    await prisma.affectation.create({
      data: {
        userId: ids.membre,
        editionId: edition.id,
        perimetreId: perimetre.id,
      },
    })
    const fin = await etat()
    expect(faites(fin)).toHaveLength(5)
    expect(fin.termines).toBe(true)

    // Une deuxième confirmation garde la date de la première.
    const avant = await prisma.activite.findUniqueOrThrow({
      where: { id: ids.activite },
      select: { premiersPas: true },
    })
    await etat(CONFIRMER, ids.admin)
    expect(
      (
        await prisma.activite.findUniqueOrThrow({
          where: { id: ids.activite },
          select: { premiersPas: true },
        })
      ).premiersPas
    ).toEqual(avant.premiersPas)
  })

  it('se masquent et s’affichent pour toute l’activité', async () => {
    expect((await etat(MASQUER)).masques).toBe(true)
    expect((await etat(LIRE, ids.admin)).masques).toBe(true)
    const affiches = await etat(AFFICHER, ids.admin)
    expect(affiches.masques).toBe(false)
    expect(faites(affiches)).toContain('ACTIVITE')
  })
})

describe('chaque chemin de calcul des premiers pas', () => {
  // Une activité neuve, lue par l'admin de l'organisation : chaque cas ajoute une
  // donnée et vérifie l'étape qu'elle coche, ou qu'elle ne coche pas.
  const etapes = async () => faites(await etat(LIRE, ids.admin))
  const editions: string[] = []

  beforeAll(async () => {
    ids.activite = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: 'club',
          nom: 'Club',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      })
    ).id
  })

  const edition = (annee: number, statut: 'ARCHIVEE' | 'PREPARATION') =>
    prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee,
        nom: `Club ${annee}`,
        debut: new Date(`${annee}-09-01`),
        fin: new Date(`${annee + 1}-06-30`),
        statut,
      },
    })

  it('ne compte ni une période archivée, ni un périmètre archivé', async () => {
    editions.push((await edition(2025, 'ARCHIVEE')).id)
    await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: 'ancien',
        nom: 'Ancien',
        type: 'SPORT',
        groupe: 'sport',
        archivedAt: new Date(),
      },
    })
    expect(await etapes()).toEqual([])
  })

  it('ne compte ni une tâche abandonnée, ni une tâche d’une autre période', async () => {
    const perimetre = await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: 'judo',
        nom: 'Judo',
        type: 'SPORT',
        groupe: 'sport',
      },
    })
    const courante = await edition(2026, 'PREPARATION')
    await prisma.tache.createMany({
      data: [
        {
          editionId: editions[0]!,
          perimetreId: perimetre.id,
          titre: 'Tâche de la saison passée',
        },
        {
          editionId: courante.id,
          perimetreId: perimetre.id,
          titre: 'Tâche abandonnée',
          statut: 'ABANDONNEE',
        },
      ],
    })
    expect(await etapes()).toEqual(['PERIODE', 'PERIMETRES'])
  })

  it('compte le rattachement ou le rôle d’admin d’une autre personne', async () => {
    await prisma.rattachementActivite.create({
      data: {
        userId: ids.membre,
        activiteId: ids.activite,
        organisationId: ids.org,
      },
    })
    expect(await etapes()).toContain('EQUIPE')
    await prisma.rattachementActivite.deleteMany({
      where: { activiteId: ids.activite },
    })
    expect(await etapes()).not.toContain('EQUIPE')
    await prisma.adminActivite.create({
      data: {
        userId: ids.adminActivite,
        activiteId: ids.activite,
        organisationId: ids.org,
      },
    })
    expect(await etapes()).toContain('EQUIPE')
  })
})
