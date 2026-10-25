import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { lireModeleDeDepart } from '../orga/modele-de-depart.ts'

import { schema } from './index.ts'

// Modèle de départ (ADR 0048). La simulation n'écrit rien ; l'application crée
// les périmètres, leurs tâches types, les fiches et les tâches de la période
// courante, ajoute les groupes qui manquent, et ne déplace jamais une fiche d'une
// autre activité. Elle n'est permise qu'à une activité sans périmètre.

const s = randomUUID().slice(0, 8)
const slug = `modele-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  autreActivite: '',
  ficheAilleurs: '',
  edition: '',
  admin: '',
  membre: '',
}

const RAPPORT = `perimetres { slug nom groupe tachesTypes } fiches groupesAjoutes fichesEnConflit periode tachesCreees effectifsCrees`
const SIMULER = `query ($a: ID) { simulerModeleDeDepart(activiteId: $a, modele: EVENEMENT_MULTISPORTS) { ${RAPPORT} } }`
const APPLIQUER = `mutation ($a: ID) { appliquerModeleDeDepart(activiteId: $a, modele: EVENEMENT_MULTISPORTS) { ${RAPPORT} } }`

interface Rapport {
  perimetres: {
    slug: string
    nom: string
    groupe: string
    tachesTypes: number
  }[]
  fiches: string[]
  groupesAjoutes: string[]
  fichesEnConflit: string[]
  periode: string | null
  tachesCreees: string[]
  effectifsCrees: string[]
}

async function executer(userId: string, query: string) {
  const r = await apollo.executeOperation(
    { query, variables: { a: ids.activite } },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

async function rapportDe(query: string): Promise<Rapport> {
  const r = await executer(ids.admin, query)
  expect(r.errors).toBeUndefined()
  return Object.values(r.data as Record<string, Rapport>)[0]!
}

// Une fiche du modèle, que l'autre activité porte déjà sous le même slug.
const modele = lireModeleDeDepart('EVENEMENT_MULTISPORTS', 'fr')
const ficheCommune = modele.fiches.find(f => f.perimetre === null)!

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  for (const [cle, slugActivite] of [
    ['activite', 'tournoi'],
    ['autreActivite', 'club'],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: slugActivite,
          nom: slugActivite,
          groupes: [
            {
              cle: 'sport',
              libelle: 'Discipline',
              libellePluriel: 'Disciplines',
            },
          ],
        },
      })
    ).id
  }
  ids.ficheAilleurs = (
    await prisma.fiche.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.autreActivite,
        slug: ficheCommune.slug,
      },
    })
  ).id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: new Date('2027-06-12'),
        fin: new Date('2027-06-13'),
      },
    })
  ).id
  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['membre', 'MEMBRE'],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: cle,
        appartenances: { create: { organisationId: ids.org, role } },
      },
    })
  }
})

afterAll(async () => {
  const dansLOrg = { organisationId: ids.org }
  await prisma.tache.deleteMany({
    where: { edition: dansLOrg, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { edition: dansLOrg } })
  await prisma.effectifPerimetre.deleteMany({ where: { edition: dansLOrg } })
  await prisma.edition.deleteMany({ where: dansLOrg })
  await prisma.fiche.updateMany({
    where: dansLOrg,
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: dansLOrg })
  await prisma.perimetre.deleteMany({ where: dansLOrg })
  await prisma.activite.deleteMany({ where: dansLOrg })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('modèle de départ', () => {
  it('est réservé aux admins de l’activité', async () => {
    expect(code(await executer(ids.membre, SIMULER))).toBe('FORBIDDEN')
    expect(code(await executer(ids.membre, APPLIQUER))).toBe('FORBIDDEN')
  })

  it('se décrit sans rien écrire', async () => {
    const rapport = await rapportDe(SIMULER)
    expect(rapport.perimetres.map(p => p.slug)).toEqual(
      modele.perimetres.map(p => p.slug)
    )
    expect(rapport.perimetres.some(p => p.tachesTypes > 0)).toBe(true)
    expect(rapport.groupesAjoutes).toEqual(['pole'])
    expect(rapport.fichesEnConflit).toEqual([ficheCommune.titre])
    expect(rapport.periode).toBe('Tournoi 2027')
    expect(rapport.tachesCreees.length).toBeGreaterThan(0)
    expect(
      await prisma.perimetre.count({ where: { activiteId: ids.activite } })
    ).toBe(0)
  })

  it('crée les périmètres, les fiches et les tâches, sans déplacer une fiche d’une autre activité', async () => {
    const rapport = await rapportDe(APPLIQUER)
    const perimetres = await prisma.perimetre.findMany({
      where: { activiteId: ids.activite },
      select: { slug: true, tachesTypes: true },
    })
    expect(perimetres).toHaveLength(modele.perimetres.length)
    expect(perimetres.filter(p => p.tachesTypes !== null).length).toBe(
      modele.taches.size
    )
    const activite = await prisma.activite.findUniqueOrThrow({
      where: { id: ids.activite },
      select: { groupes: true },
    })
    // Le libellé déjà choisi par l'admin reste ; le groupe absent s'ajoute.
    expect(activite.groupes).toEqual([
      { cle: 'sport', libelle: 'Discipline', libellePluriel: 'Disciplines' },
      expect.objectContaining({ cle: 'pole' }),
    ])
    expect(
      await prisma.tache.count({ where: { editionId: ids.edition } })
    ).toBe(rapport.tachesCreees.length)
    expect(
      (
        await prisma.fiche.findUniqueOrThrow({
          where: { id: ids.ficheAilleurs },
        })
      ).activiteId
    ).toBe(ids.autreActivite)
    expect(
      await prisma.fiche.count({ where: { activiteId: ids.activite } })
    ).toBe(modele.fiches.length - 1)
  })

  it('refuse une activité qui a déjà des périmètres', async () => {
    expect(code(await executer(ids.admin, APPLIQUER))).toBe('SAISIE_INVALIDE')
  })

  it('refuse de dépasser dix groupes, dès la simulation', async () => {
    ids.activite = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: 'neuf-groupes',
          nom: 'Neuf groupes',
          groupes: Array.from({ length: 9 }, (_, i) => ({
            cle: `groupe-${i}`,
            libelle: `Groupe ${i}`,
            libellePluriel: `Groupes ${i}`,
          })),
        },
      })
    ).id
    expect(code(await executer(ids.admin, SIMULER))).toBe('SAISIE_INVALIDE')
    expect(code(await executer(ids.admin, APPLIQUER))).toBe('SAISIE_INVALIDE')
  })
})
