import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Tâches types appliquées à une période depuis l'espace organisateur (ADR 0048).
// La simulation n'écrit rien ; l'application suit la règle d'`orga:importer
// --edition` : une tâche par tâche type, jamais modifiée ensuite, et des
// déclinaisons acceptées d'office. Le fichier crée ses propres organisations.

const s = randomUUID().slice(0, 8)
const slug = `taches-types-${s}`
const slugAutre = `taches-types-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  autreActivite: '',
  lieux: '',
  natation: '',
  volley: '',
  archive: '',
  illisible: '',
  perimetreAutreActivite: '',
  edition: '',
  editionArchivee: '',
  fiche: '',
  admin: '',
  adminActivite: '',
  membre: '',
  externe: '',
}

const TACHES_LIEUX = [
  {
    modele: 'plan-des-lieux',
    titre: 'Dessiner le plan des lieux',
    description: 'Avec les entrées et les secours.',
    echeance: 'J-30',
    fiche: 'plan',
  },
  {
    modele: 'besoins-de-lieux',
    titre: 'Recenser les besoins de lieux',
    echeance: 'J-60',
    declinaison: { groupe: 'sport', echeance: 'J-45' },
  },
  // La fiche citée appartient à un autre périmètre : la tâche est créée sans elle.
  {
    modele: 'consignes-du-bassin',
    titre: 'Relire les consignes du bassin',
    fiche: 'bassin',
  },
]

const RAPPORT = `effectifsCrees effectifsDejaPresents tachesCreees tachesDejaPresentes tachesRattachees conflits illisibles`
const SIMULER = `query ($e: ID!, $p: [ID!]) { simulerTachesTypes(editionId: $e, perimetreIds: $p) { ${RAPPORT} } }`
const APPLIQUER = `mutation ($e: ID!, $p: [ID!]) { appliquerTachesTypes(editionId: $e, perimetreIds: $p) { ${RAPPORT} } }`

interface Rapport {
  effectifsCrees: string[]
  effectifsDejaPresents: string[]
  tachesCreees: string[]
  tachesDejaPresentes: string[]
  tachesRattachees: string[]
  conflits: string[]
  illisibles: string[]
}

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {},
  organisation = slug
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, organisation) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

async function rapportDe(
  query: string,
  variables: Record<string, unknown>,
  userId = ids.admin
): Promise<Rapport> {
  const r = await executer(userId, query, variables)
  expect(r.errors).toBeUndefined()
  const data = r.data as Record<string, Rapport>
  return Object.values(data)[0]!
}

const tachesDeLaPeriode = () =>
  prisma.tache.findMany({
    where: { editionId: ids.edition },
    orderBy: [{ perimetreId: 'asc' }, { modeleSlug: 'asc' }],
  })

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
  const groupes = [
    { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
    { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
  ]
  for (const [cle, slugActivite] of [
    ['activite', 'rencontres'],
    ['autreActivite', 'club'],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: slugActivite,
          nom: slugActivite,
          groupes,
        },
      })
    ).id
  }
  const perimetres = [
    ['lieux', ids.activite, 'pole', 0, TACHES_LIEUX, 2, null],
    ['natation', ids.activite, 'sport', 1, null, null, null],
    ['volley', ids.activite, 'sport', 2, null, 1, null],
    ['archive', ids.activite, 'sport', 3, null, null, new Date()],
    ['illisible', ids.activite, 'pole', 4, { pas: 'valide' }, null, null],
    [
      'perimetreAutreActivite',
      ids.autreActivite,
      'pole',
      0,
      TACHES_LIEUX,
      null,
      null,
    ],
  ] as const
  for (const [
    cle,
    activiteId,
    groupe,
    ordre,
    tachesTypes,
    effectif,
    archivedAt,
  ] of perimetres) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId,
          slug: cle,
          nom: cle,
          type: groupe === 'sport' ? 'SPORT' : 'POLE',
          groupe,
          ordre,
          tachesTypes: tachesTypes ?? undefined,
          effectifParDefaut: effectif,
          archivedAt,
        },
      })
    ).id
  }
  ids.fiche = (
    await prisma.fiche.create({
      data: { organisationId: ids.org, activiteId: ids.activite, slug: 'plan' },
    })
  ).id
  await prisma.fiche.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      perimetreId: ids.natation,
      slug: 'bassin',
    },
  })
  for (const [cle, annee, statut] of [
    ['edition', 2027, 'PREPARATION'],
    ['editionArchivee', 2026, 'ARCHIVEE'],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          annee,
          nom: `Édition ${annee}`,
          debut: new Date(`${annee}-06-12`),
          fin: new Date(`${annee}-06-13`),
          statut,
        },
      })
    ).id
  }
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
  await prisma.tache.deleteMany({
    where: { edition: { organisationId: ids.org }, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({
    where: { edition: { organisationId: ids.org } },
  })
  await prisma.effectifPerimetre.deleteMany({
    where: { edition: { organisationId: ids.org } },
  })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.fiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.orgAutre] } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('tâches types appliquées depuis l’espace organisateur', () => {
  it('est réservé aux admins de l’activité, dans leur organisation', async () => {
    expect(code(await executer(ids.membre, SIMULER, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
    expect(
      code(
        await executer(ids.externe, APPLIQUER, { e: ids.edition }, slugAutre)
      )
    ).toBe('FORBIDDEN')
  })

  it('refuse un périmètre archivé ou d’une autre activité, et une période archivée', async () => {
    for (const perimetre of [ids.perimetreAutreActivite, ids.archive]) {
      expect(
        code(
          await executer(ids.admin, SIMULER, { e: ids.edition, p: [perimetre] })
        )
      ).toBe('FORBIDDEN')
    }
    expect(
      code(await executer(ids.admin, APPLIQUER, { e: ids.editionArchivee }))
    ).toBe('SAISIE_INVALIDE')
  })

  it('simule sans rien écrire', async () => {
    const rapport = await rapportDe(SIMULER, { e: ids.edition })
    expect(rapport.tachesCreees).toEqual([
      'lieux/plan-des-lieux',
      'lieux/besoins-de-lieux',
      'natation/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
      'volley/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
      'lieux/consignes-du-bassin',
    ])
    expect(rapport.conflits).toEqual([
      'archive/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux) : le périmètre est archivé',
    ])
    expect(rapport.effectifsCrees).toEqual(['lieux (2)', 'volley (1)'])
    expect(rapport.illisibles).toEqual(['illisible'])
    expect(await tachesDeLaPeriode()).toEqual([])
    expect(
      await prisma.effectifPerimetre.count({
        where: { editionId: ids.edition },
      })
    ).toBe(0)
  })

  it('limite l’application aux périmètres demandés', async () => {
    const rapport = await rapportDe(SIMULER, {
      e: ids.edition,
      p: [ids.volley],
    })
    expect(rapport.tachesCreees).toEqual([])
    expect(rapport.effectifsCrees).toEqual(['volley (1)'])

    // Une tâche partagée d'un périmètre retenu se décline aussi hors de la sélection.
    const lieux = await rapportDe(SIMULER, { e: ids.edition, p: [ids.lieux] })
    expect(lieux.tachesCreees).toContain(
      'volley/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)'
    )
    expect(lieux.effectifsCrees).toEqual(['lieux (2)'])
  })

  it('crée les tâches, leurs déclinaisons et les effectifs, puis ne recrée rien', async () => {
    const rapport = await rapportDe(
      APPLIQUER,
      { e: ids.edition },
      ids.adminActivite
    )
    expect(rapport.tachesCreees).toHaveLength(5)

    const taches = await tachesDeLaPeriode()
    const plan = taches.find(t => t.modeleSlug === 'plan-des-lieux')!
    expect(plan).toMatchObject({
      perimetreId: ids.lieux,
      titre: 'Dessiner le plan des lieux',
      description: 'Avec les entrées et les secours.',
      ficheId: ids.fiche,
      creeParId: null,
      statut: 'A_FAIRE',
    })
    expect(plan.echeance?.toISOString().slice(0, 10)).toBe('2027-05-13')
    expect(
      taches.find(t => t.modeleSlug === 'consignes-du-bassin')!.ficheId
    ).toBeNull()
    const partagee = taches.find(
      t => t.modeleSlug === 'besoins-de-lieux' && t.perimetreId === ids.lieux
    )!
    const declinaisons = taches.filter(t => t.origineId === partagee.id)
    expect(declinaisons.map(t => t.perimetreId).sort()).toEqual(
      [ids.natation, ids.volley].sort()
    )
    for (const declinaison of declinaisons) {
      expect(declinaison.accord).toBe('ACCEPTE')
      expect(declinaison.echeance?.toISOString().slice(0, 10)).toBe(
        '2027-04-28'
      )
    }
    expect(
      await prisma.effectifPerimetre.findMany({
        where: { editionId: ids.edition },
        select: { perimetreId: true, effectif: true },
        orderBy: { effectif: 'desc' },
      })
    ).toEqual([
      { perimetreId: ids.lieux, effectif: 2 },
      { perimetreId: ids.volley, effectif: 1 },
    ])

    // Une tâche modifiée dans l'application ne change pas à la deuxième fois.
    await prisma.tache.update({
      where: { id: plan.id },
      data: { titre: 'Plan revu par l’équipe' },
    })
    const deuxieme = await rapportDe(APPLIQUER, { e: ids.edition })
    expect(deuxieme.tachesCreees).toEqual([])
    expect(deuxieme.tachesDejaPresentes).toHaveLength(5)
    expect(deuxieme.effectifsDejaPresents).toEqual(['lieux', 'volley'])
    expect(await tachesDeLaPeriode()).toHaveLength(5)
    expect(
      (await prisma.tache.findUniqueOrThrow({ where: { id: plan.id } })).titre
    ).toBe('Plan revu par l’équipe')
  })
  it('ne double rien quand deux applications arrivent en même temps', async () => {
    const edition = await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2028,
        nom: 'Édition 2028',
        debut: new Date('2028-06-10'),
        fin: new Date('2028-06-11'),
      },
    })
    const rapports = await Promise.all([
      rapportDe(APPLIQUER, { e: edition.id }),
      rapportDe(APPLIQUER, { e: edition.id }),
    ])
    expect(rapports.map(r => r.tachesCreees.length).sort()).toEqual([0, 5])
    expect(await prisma.tache.count({ where: { editionId: edition.id } })).toBe(
      5
    )
  })
})
