import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Recherche globale et tâches liées à une fiche : une personne ne trouve que ce
// qu'elle peut déjà lire. Les règles se prouvent par le refus.

const suffixe = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  alice: '', // référente natation
  chloe: '', // référente basket et d'un périmètre archivé
  dora: '', // affectée seulement au périmètre archivé
  natation: '',
  basket: '',
  escrime: '', // périmètre archivé
  edition: '',
  ficheNatation: '',
  ficheCommune: '',
}

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

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const CHERCHER = `query ($t: String!, $e: ID) {
  recherche(texte: $t, editionId: $e) {
    taches { id titre }
    fiches { id titre }
    personnes { id nom perimetres { id } }
  }
}`

interface Resultats {
  recherche: {
    taches: { id: string }[]
    fiches: { id: string }[]
    personnes: { id: string; perimetres: { id: string }[] }[]
  }
}

async function chercher(userId: string | null, texte: string) {
  const r = await executer(userId, CHERCHER, { t: texte, e: ids.edition })
  return { r, data: r.data as Resultats | undefined }
}

beforeAll(async () => {
  const organisation = await organisationParDefaut()
  await apollo.start()
  for (const [cle, estAdmin] of [
    ['admin', true],
    ['alice', false],
    ['chloe', false],
    ['dora', false],
  ] as const) {
    const id = randomUUID()
    await prisma.user.create({
      data: {
        id,
        email: `${cle}-${suffixe}@exemple.fr`,
        name: `${cle} ${suffixe}`,
        isAdmin: estAdmin,
      },
    })
    ids[cle] = id
  }
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: organisation,
        annee: 2100 + Math.floor(Math.random() * 800),
        nom: `Essai ${suffixe}`,
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id
  for (const [cle, slug, nom] of [
    ['natation', `natation-${suffixe}`, 'Natation'],
    ['basket', `basket-${suffixe}`, 'Basket'],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: { organisationId: organisation, slug, nom, type: 'SPORT' },
      })
    ).id
  }
  ids.escrime = (
    await prisma.perimetre.create({
      data: {
        organisationId: organisation,
        slug: `escrime-${suffixe}`,
        nom: 'Escrime',
        type: 'SPORT',
        archivedAt: new Date(),
      },
    })
  ).id
  await prisma.affectation.createMany({
    data: [
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.chloe, perimetreId: ids.basket, editionId: ids.edition },
      { userId: ids.chloe, perimetreId: ids.escrime, editionId: ids.edition },
      { userId: ids.dora, perimetreId: ids.escrime, editionId: ids.edition },
    ],
  })
  for (const [cle, perimetreId] of [
    ['ficheNatation', ids.natation],
    ['ficheCommune', null],
  ] as const) {
    const fiche = await prisma.fiche.create({
      data: {
        organisationId: organisation,
        slug: `${cle.toLowerCase()}-${suffixe}`,
        perimetreId,
      },
    })
    const version = await prisma.ficheVersion.create({
      data: {
        ficheId: fiche.id,
        titre: `Fiche ${cle} ${suffixe}`,
        contenu: 'Contenu.',
        source: 'APP',
        empreinte: randomUUID().replaceAll('-', '').padEnd(64, '0'),
      },
    })
    await prisma.fiche.update({
      where: { id: fiche.id },
      data: { versionCouranteId: version.id },
    })
    ids[cle] = fiche.id
  }
  await prisma.tache.createMany({
    data: [
      {
        titre: `Tâche natation ${suffixe}`,
        perimetreId: ids.natation,
        editionId: ids.edition,
        ficheId: ids.ficheNatation,
      },
      {
        titre: `Tâche basket ${suffixe}`,
        perimetreId: ids.basket,
        editionId: ids.edition,
        ficheId: ids.ficheCommune,
      },
      {
        titre: `Tâche commune natation ${suffixe}`,
        perimetreId: ids.natation,
        editionId: ids.edition,
        ficheId: ids.ficheCommune,
      },
    ],
  })
})

afterAll(async () => {
  await prisma.tache.deleteMany({ where: { editionId: ids.edition } })
  await prisma.affectation.deleteMany({ where: { editionId: ids.edition } })
  const fiches = [ids.ficheNatation, ids.ficheCommune]
  await prisma.fiche.updateMany({
    where: { id: { in: fiches } },
    data: { versionCouranteId: null },
  })
  await prisma.ficheVersion.deleteMany({ where: { ficheId: { in: fiches } } })
  await prisma.fiche.deleteMany({ where: { id: { in: fiches } } })
  await prisma.edition.deleteMany({ where: { id: ids.edition } })
  await prisma.perimetre.deleteMany({
    where: { id: { in: [ids.natation, ids.basket, ids.escrime] } },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${suffixe}@exemple.fr` } },
  })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('recherche globale', () => {
  it('refuse sans session', async () => {
    const { r } = await chercher(null, suffixe)
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse un texte trop court', async () => {
    const { r } = await chercher(ids.alice, 'a')
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('ne donne pas les tâches ni les fiches d’un autre périmètre', async () => {
    const { r, data } = await chercher(ids.chloe, suffixe)
    expect(r.errors).toBeUndefined()
    const taches = data!.recherche.taches.map(t => t.id)
    expect(taches).toHaveLength(1)
    const fiches = data!.recherche.fiches.map(f => f.id)
    expect(fiches).toContain(ids.ficheCommune)
    expect(fiches).not.toContain(ids.ficheNatation)
  })

  it('ne donne pas les personnes d’un autre périmètre', async () => {
    const { data } = await chercher(ids.chloe, `alice ${suffixe}`)
    expect(data!.recherche.personnes).toHaveLength(0)
  })

  it('ne donne pas une personne affectée seulement à un périmètre archivé', async () => {
    const { data } = await chercher(ids.chloe, `dora ${suffixe}`)
    expect(data!.recherche.personnes).toHaveLength(0)
  })

  it('ne montre que les périmètres lisibles d’une personne trouvée', async () => {
    const { data } = await chercher(ids.chloe, `chloe ${suffixe}`)
    const personne = data!.recherche.personnes[0]!
    expect(personne.perimetres.map(p => p.id)).toEqual([ids.basket])
  })

  it('ne donne aucune tâche sans édition', async () => {
    const r = await executer(ids.admin, CHERCHER, { t: suffixe })
    expect(r.errors).toBeUndefined()
    const data = r.data as unknown as Resultats
    expect(data.recherche.taches).toHaveLength(0)
    expect(data.recherche.fiches.length).toBeGreaterThan(0)
  })

  it('donne tout à un admin', async () => {
    const { data } = await chercher(ids.admin, suffixe)
    expect(data!.recherche.taches).toHaveLength(3)
    expect(data!.recherche.personnes.length).toBeGreaterThanOrEqual(3)
  })
})

describe('fiche : tâches liées et nombre de versions', () => {
  const LIRE = `query ($s: String!, $e: ID!) {
    fiche(slug: $s) { taches(editionId: $e) { id perimetre { id } } nombreVersions }
  }`

  it('ne donne que les tâches liées des périmètres lisibles', async () => {
    const r = await executer(ids.chloe, LIRE, {
      s: `fichecommune-${suffixe}`,
      e: ids.edition,
    })
    expect(r.errors).toBeUndefined()
    const fiche = (
      r.data as {
        fiche: { taches: { perimetre: { id: string } }[]; nombreVersions: null }
      }
    ).fiche
    expect(fiche.taches.map(t => t.perimetre.id)).toEqual([ids.basket])
    expect(fiche.nombreVersions).toBeNull()
  })

  it('donne le nombre de versions à un admin', async () => {
    const r = await executer(ids.admin, LIRE, {
      s: `fichecommune-${suffixe}`,
      e: ids.edition,
    })
    const fiche = (r.data as { fiche: { nombreVersions: number } }).fiche
    expect(fiche.nombreVersions).toBe(1)
  })
})
