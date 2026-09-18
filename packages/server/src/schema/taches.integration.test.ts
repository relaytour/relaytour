import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Règles d'accès et de collaboration sur les tâches, prouvées par le refus.

const suffixe = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  alice: '', // référente natation, éditions en cours et archivée
  bruno: '', // référent natation, édition en cours
  chloe: '', // référente basket
  dora: '', // référente natation, édition archivée seulement
  natation: '',
  basket: '',
  escrime: '', // périmètre archivé
  edition: '',
  archivee: '',
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

const CREER = `mutation ($p: ID!, $e: ID!, $t: String!, $m: Boolean) {
  creerTache(perimetreId: $p, editionId: $e, titre: $t, mAssigner: $m, echeance: "2020-01-01") { id enRetard }
}`

async function creerTache(userId: string, titre: string, mAssigner = true) {
  const r = await executer(userId, CREER, {
    p: ids.natation,
    e: ids.edition,
    t: titre,
    m: mAssigner,
  })
  expect(r.errors).toBeUndefined()
  return (r.data as { creerTache: { id: string; enRetard: boolean } })
    .creerTache
}

beforeAll(async () => {
  await apollo.start()
  for (const [cle, estAdmin] of [
    ['admin', true],
    ['alice', false],
    ['bruno', false],
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
  const annee = 2100 + Math.floor(Math.random() * 800)
  ids.edition = (
    await prisma.edition.create({
      data: {
        annee,
        nom: `Essai ${suffixe}`,
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id
  ids.archivee = (
    await prisma.edition.create({
      data: {
        annee: annee - 1,
        nom: `Archive ${suffixe}`,
        debut: new Date('2025-08-27'),
        fin: new Date('2025-08-29'),
        statut: 'ARCHIVEE',
      },
    })
  ).id
  ids.natation = (
    await prisma.perimetre.create({
      data: { slug: `natation-${suffixe}`, nom: 'Natation', type: 'SPORT' },
    })
  ).id
  ids.basket = (
    await prisma.perimetre.create({
      data: { slug: `basket-${suffixe}`, nom: 'Basket', type: 'SPORT' },
    })
  ).id
  await prisma.affectation.createMany({
    data: [
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.archivee },
      { userId: ids.bruno, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.chloe, perimetreId: ids.basket, editionId: ids.edition },
      { userId: ids.dora, perimetreId: ids.natation, editionId: ids.archivee },
    ],
  })
})

afterAll(async () => {
  const editions = [ids.edition, ids.archivee]
  await prisma.activite.deleteMany({ where: { editionId: { in: editions } } })
  await prisma.tache.deleteMany({ where: { editionId: { in: editions } } })
  await prisma.affectation.deleteMany({
    where: { editionId: { in: editions } },
  })
  await prisma.edition.deleteMany({ where: { id: { in: editions } } })
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

describe('lecture d’un périmètre', () => {
  const LIRE = `query ($s: String!, $e: ID!) { perimetre(slug: $s) { taches(editionId: $e) { id } } }`

  it('refuse une référente d’un autre périmètre', async () => {
    expect(
      code(
        await executer(ids.chloe, LIRE, {
          s: `natation-${suffixe}`,
          e: ids.edition,
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('refuse sans session', async () => {
    expect(
      code(
        await executer(null, LIRE, { s: `natation-${suffixe}`, e: ids.edition })
      )
    ).toBe('FORBIDDEN')
  })

  it('donne la même réponse pour un périmètre inconnu', async () => {
    expect(
      code(
        await executer(ids.chloe, LIRE, {
          s: `inconnu-${suffixe}`,
          e: ids.edition,
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('ouvre les archives à une ancienne référente, en lecture seule', async () => {
    const lecture = await executer(ids.alice, LIRE, {
      s: `natation-${suffixe}`,
      e: ids.archivee,
    })
    expect(lecture.errors).toBeUndefined()
    const ecriture = await executer(ids.alice, CREER, {
      p: ids.natation,
      e: ids.archivee,
      t: 'Archive',
    })
    expect(code(ecriture)).toBe('SAISIE_INVALIDE')
  })
})

describe('écriture', () => {
  it('refuse la création à une référente d’un autre périmètre', async () => {
    expect(
      code(
        await executer(ids.chloe, CREER, {
          p: ids.natation,
          e: ids.edition,
          t: 'Intrusion',
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('signale une tâche en retard', async () => {
    expect((await creerTache(ids.alice, 'Réserver la piscine')).enRetard).toBe(
      true
    )
  })

  it('exige une confirmation pour modifier la tâche d’une autre personne', async () => {
    const tache = await creerTache(ids.alice, 'Commander les médailles')
    const MODIFIER = `mutation ($id: ID!, $c: Boolean) {
      modifierTache(id: $id, titre: "Commander les médailles et coupes", confirmer: $c) { titre }
    }`
    const sansConfirmation = await executer(ids.bruno, MODIFIER, {
      id: tache.id,
    })
    expect(code(sansConfirmation)).toBe('CONFIRMATION_REQUISE')
    expect(sansConfirmation.errors?.[0]?.extensions?.personnes).toEqual([
      `alice ${suffixe}`,
    ])

    const avecConfirmation = await executer(ids.bruno, MODIFIER, {
      id: tache.id,
      c: true,
    })
    expect(avecConfirmation.errors).toBeUndefined()
  })

  it('n’exige pas de confirmation pour sa propre tâche', async () => {
    const tache = await creerTache(ids.alice, 'Prévoir les bouées')
    const r = await executer(
      ids.alice,
      `mutation ($id: ID!) { changerStatutTache(id: $id, statut: EN_COURS) { statut } }`,
      {
        id: tache.id,
      }
    )
    expect(r.errors).toBeUndefined()
  })

  it('refuse qu’une référente assigne une autre personne', async () => {
    const tache = await creerTache(ids.alice, 'Trouver des bénévoles', false)
    const r = await executer(
      ids.alice,
      `mutation ($id: ID!, $p: ID!) { assignerTache(id: $id, assigne: true, personneId: $p) { id } }`,
      { id: tache.id, p: ids.bruno }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })
})

describe('assignation par les admins', () => {
  const ASSIGNER = `mutation ($id: ID!, $a: Boolean!, $p: ID) {
    assignerTache(id: $id, assigne: $a, personneId: $p) { assignes { id } }
  }`

  const assignes = (r: Awaited<ReturnType<typeof executer>>) =>
    (
      r.data as { assignerTache: { assignes: { id: string }[] } }
    ).assignerTache.assignes.map(p => p.id)

  it('refuse qu’une référente retire une autre personne', async () => {
    const tache = await creerTache(ids.alice, 'Réserver les couloirs')
    const r = await executer(ids.bruno, ASSIGNER, {
      id: tache.id,
      a: false,
      p: ids.alice,
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.tacheAssignation.count({
        where: { tacheId: tache.id, userId: ids.alice },
      })
    ).toBe(1)
  })

  it('refuse qu’un admin assigne une personne non affectée', async () => {
    const tache = await creerTache(ids.alice, 'Préparer les plots', false)
    const r = await executer(ids.admin, ASSIGNER, {
      id: tache.id,
      a: true,
      p: ids.chloe,
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(
      await prisma.tacheAssignation.count({ where: { tacheId: tache.id } })
    ).toBe(0)
  })

  it('laisse un admin assigner une personne affectée', async () => {
    const tache = await creerTache(ids.alice, 'Accueillir les juges', false)
    const r = await executer(ids.admin, ASSIGNER, {
      id: tache.id,
      a: true,
      p: ids.bruno,
    })
    expect(r.errors).toBeUndefined()
    expect(assignes(r)).toEqual([ids.bruno])
  })

  it('laisse un admin retirer une autre personne', async () => {
    const tache = await creerTache(ids.alice, 'Imprimer les feuilles de course')
    expect(
      await prisma.tacheAssignation.count({
        where: { tacheId: tache.id, userId: ids.alice },
      })
    ).toBe(1)
    const r = await executer(ids.admin, ASSIGNER, {
      id: tache.id,
      a: false,
      p: ids.alice,
    })
    expect(r.errors).toBeUndefined()
    expect(assignes(r)).not.toContain(ids.alice)
  })
})

describe('clôture', () => {
  it('cache qui a coché et réalisé la tâche aux autres référent·es', async () => {
    const tache = await creerTache(ids.alice, 'Envoyer le programme')
    const FAIRE = `mutation ($id: ID!, $r: ID) { changerStatutTache(id: $id, statut: FAITE, realiseeParId: $r) { id } }`
    expect(
      (await executer(ids.alice, FAIRE, { id: tache.id, r: ids.bruno })).errors
    ).toBeUndefined()

    const LIRE = `query ($s: String!, $e: ID!) {
      perimetre(slug: $s) { taches(editionId: $e) { id clotureePar { id } realiseePar { id } } }
    }`
    const trouver = async (userId: string) => {
      const r = await executer(userId, LIRE, {
        s: `natation-${suffixe}`,
        e: ids.edition,
      })
      const taches = (
        r.data as {
          perimetre: {
            taches: {
              id: string
              clotureePar: { id: string } | null
              realiseePar: { id: string } | null
            }[]
          }
        }
      ).perimetre.taches
      return taches.find(t => t.id === tache.id)
    }
    expect(await trouver(ids.alice)).toMatchObject({
      clotureePar: { id: ids.alice },
      realiseePar: { id: ids.bruno },
    })
    expect(await trouver(ids.admin)).toMatchObject({
      clotureePar: { id: ids.alice },
      realiseePar: { id: ids.bruno },
    })
    expect(await trouver(ids.bruno)).toMatchObject({
      clotureePar: null,
      realiseePar: null,
    })
  })

  it('refuse une personne non affectée comme réalisatrice', async () => {
    const tache = await creerTache(ids.alice, 'Ranger le matériel')
    const r = await executer(
      ids.alice,
      `mutation ($id: ID!, $r: ID) { changerStatutTache(id: $id, statut: FAITE, realiseeParId: $r) { id } }`,
      { id: tache.id, r: ids.chloe }
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })
})

describe('vues d’ensemble', () => {
  it('réserve l’avancement global aux admins', async () => {
    const Q = `query ($e: ID!) { avancementGlobal(editionId: $e) { avancement { total } } }`
    expect(code(await executer(ids.alice, Q, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
    expect(
      (await executer(ids.admin, Q, { e: ids.edition })).errors
    ).toBeUndefined()
  })

  it('liste les tâches à prendre dans les périmètres de la personne seulement', async () => {
    const libre = await creerTache(ids.alice, 'Tâche libre', false)
    const Q = `query ($e: ID!) { tachesAPrendre(editionId: $e) { id } }`
    const pourBruno = (await executer(ids.bruno, Q, { e: ids.edition }))
      .data as { tachesAPrendre: { id: string }[] }
    const pourChloe = (await executer(ids.chloe, Q, { e: ids.edition }))
      .data as { tachesAPrendre: { id: string }[] }
    expect(pourBruno.tachesAPrendre.map(t => t.id)).toContain(libre.id)
    expect(pourChloe.tachesAPrendre.map(t => t.id)).not.toContain(libre.id)
  })

  it('journalise les actions', async () => {
    const n = await prisma.activite.count({
      where: { editionId: ids.edition, acteurId: ids.alice },
    })
    expect(n).toBeGreaterThan(5)
  })
})

describe('rétroplanning', () => {
  const Q = `query ($e: ID!) { retroplanning(editionId: $e) { id echeance } }`
  const taches = {
    natationMai: '',
    natationSansEcheance: '',
    basketMars: '',
    basketJuin: '',
    escrimeAvril: '',
  }

  // La base de développement contient d'autres tâches : seules celles du bloc comptent.
  async function lire(userId: string) {
    const r = await executer(userId, Q, { e: ids.edition })
    expect(r.errors).toBeUndefined()
    const creees = Object.values(taches)
    return (r.data as { retroplanning: { id: string }[] }).retroplanning
      .map(t => t.id)
      .filter(id => creees.includes(id))
  }

  beforeAll(async () => {
    ids.escrime = (
      await prisma.perimetre.create({
        data: {
          slug: `escrime-${suffixe}`,
          nom: 'Escrime',
          type: 'SPORT',
          archivedAt: new Date(),
        },
      })
    ).id
    const creer = async (perimetreId: string, echeance: string | null) =>
      (
        await prisma.tache.create({
          data: {
            perimetreId,
            editionId: ids.edition,
            titre: `Rétroplanning ${suffixe}`,
            echeance: echeance === null ? null : new Date(echeance),
          },
        })
      ).id
    taches.natationMai = await creer(ids.natation, '2027-05-10')
    taches.natationSansEcheance = await creer(ids.natation, null)
    taches.basketMars = await creer(ids.basket, '2027-03-01')
    taches.basketJuin = await creer(ids.basket, '2027-06-01')
    taches.escrimeAvril = await creer(ids.escrime, '2027-04-01')
  })

  it('refuse sans session', async () => {
    expect(code(await executer(null, Q, { e: ids.edition }))).toBe('FORBIDDEN')
  })

  it('ne donne pas à une référente les tâches d’un autre périmètre', async () => {
    expect(await lire(ids.chloe)).toEqual([
      taches.basketMars,
      taches.basketJuin,
    ])
  })

  it('n’ajoute pas une tâche d’un autre périmètre assignée directement', async () => {
    await prisma.tacheAssignation.create({
      data: { tacheId: taches.natationMai, userId: ids.chloe },
    })
    expect(await lire(ids.chloe)).not.toContain(taches.natationMai)
  })

  it('suit la règle de lecture pour une personne affectée à une édition archivée', async () => {
    expect(await lire(ids.dora)).toEqual([
      taches.natationMai,
      taches.natationSansEcheance,
    ])
    const perimetre = await executer(
      ids.dora,
      `query ($s: String!, $e: ID!) { perimetre(slug: $s) { taches(editionId: $e) { id } } }`,
      { s: `natation-${suffixe}`, e: ids.edition }
    )
    expect(perimetre.errors).toBeUndefined()
  })

  it('charge les personnes assignées triées par nom', async () => {
    const tache = await creerTache(ids.bruno, 'Tracer les couloirs')
    await prisma.tacheAssignation.create({
      data: { tacheId: tache.id, userId: ids.alice },
    })
    const r = await executer(
      ids.admin,
      `query ($e: ID!) { retroplanning(editionId: $e) { id assignes { id } } }`,
      { e: ids.edition }
    )
    const lue = (
      r.data as { retroplanning: { id: string; assignes: { id: string }[] }[] }
    ).retroplanning.find(t => t.id === tache.id)
    expect(lue?.assignes.map(p => p.id)).toEqual([ids.alice, ids.bruno])
  })

  it('donne à un admin toutes les tâches des périmètres actifs, triées par échéance', async () => {
    expect(await lire(ids.admin)).toEqual([
      taches.basketMars,
      taches.natationMai,
      taches.basketJuin,
      taches.natationSansEcheance,
    ])
  })
})
