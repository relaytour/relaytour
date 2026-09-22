import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { composer } from '../courriel/messages.ts'
import { genererRappels, personnesAResumer } from '../jobs/planification.ts'

import { schema } from './index.ts'
import { activiteParDefaut } from '../lib/activites.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  alice: '',
  bruno: '',
  chloe: '',
  david: '',
  natation: '',
  basket: '',
  edition: '',
  archivee: '',
}

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  if (r.body.singleResult.errors)
    throw new Error(JSON.stringify(r.body.singleResult.errors))
  return r.body.singleResult.data as Record<string, unknown>
}

const notificationsDe = (userId: string, tacheId: string) =>
  prisma.notification.findMany({
    where: { userId, tacheId },
    orderBy: { createdAt: 'asc' },
  })

let ORGANISATION = ''
let ACTIVITE = ''

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  ACTIVITE = await activiteParDefaut()
  await apollo.start()
  for (const cle of ['alice', 'bruno', 'chloe', 'david'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${s}@exemple.fr`,
        name: cle.charAt(0).toUpperCase() + cle.slice(1),
      },
    })
  }
  const annee = 3000 + Math.floor(Math.random() * 900)
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        annee,
        nom: `Essai ${s}`,
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id
  ids.archivee = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        annee: annee - 1,
        nom: `Archive ${s}`,
        debut: new Date('2025-08-27'),
        fin: new Date('2025-08-29'),
        statut: 'ARCHIVEE',
      },
    })
  ).id
  ids.natation = (
    await prisma.perimetre.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        groupe: 'sport',
        slug: `natation-${s}`,
        nom: 'Natation',
        type: 'SPORT',
      },
    })
  ).id
  ids.basket = (
    await prisma.perimetre.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        groupe: 'sport',
        slug: `basket-${s}`,
        nom: 'Basket',
        type: 'SPORT',
      },
    })
  ).id
  await prisma.affectation.createMany({
    data: [
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.bruno, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.chloe, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.david, perimetreId: ids.basket, editionId: ids.edition },
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.archivee },
    ],
  })
})

afterAll(async () => {
  const editions = [ids.edition, ids.archivee]
  const users = [ids.alice, ids.bruno, ids.chloe, ids.david]
  await prisma.notification.deleteMany({ where: { userId: { in: users } } })
  await prisma.journal.deleteMany({ where: { editionId: { in: editions } } })
  await prisma.tache.deleteMany({ where: { editionId: { in: editions } } })
  await prisma.affectation.deleteMany({
    where: { editionId: { in: editions } },
  })
  await prisma.edition.deleteMany({ where: { id: { in: editions } } })
  await prisma.perimetre.deleteMany({
    where: { id: { in: [ids.natation, ids.basket] } },
  })
  await prisma.preferenceNotification.deleteMany({
    where: { userId: { in: users } },
  })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('notifications de collaboration', () => {
  let tacheId = ''

  it('prévient les autres référent·es du périmètre à la création, et personne d’autre', async () => {
    const data = await executer(
      ids.alice,
      `mutation ($p: ID!, $e: ID!) { creerTache(perimetreId: $p, editionId: $e, titre: "Réserver la piscine", mAssigner: true) { id } }`,
      { p: ids.natation, e: ids.edition }
    )
    tacheId = (data.creerTache as { id: string }).id
    expect(await notificationsDe(ids.bruno, tacheId)).toHaveLength(1)
    expect(await notificationsDe(ids.chloe, tacheId)).toHaveLength(1)
    expect(await notificationsDe(ids.alice, tacheId)).toHaveLength(0)
    expect(await notificationsDe(ids.david, tacheId)).toHaveLength(0)
  })

  it('annonce qui prend une tâche', async () => {
    await executer(
      ids.bruno,
      `mutation ($id: ID!) { assignerTache(id: $id, assigne: true) { id } }`,
      { id: tacheId }
    )
    const [notification] = (await notificationsDe(ids.chloe, tacheId)).filter(
      n => n.type === 'TACHE_ASSIGNEE'
    )
    expect(notification).toBeDefined()
    const lues = await executer(
      ids.chloe,
      `{ notifications(nonLuesSeulement: true) { id message } }`
    )
    const messages = (lues.notifications as { message: string }[]).map(
      n => n.message
    )
    expect(messages).toContain(
      'Bruno s’occupe de la tâche « Réserver la piscine » (Natation).'
    )
  })

  it('prévient les personnes assignées d’une modification, avec un mail', async () => {
    await executer(
      ids.chloe,
      `mutation ($id: ID!) { modifierTache(id: $id, titre: "Réserver la piscine olympique", confirmer: true) { id } }`,
      { id: tacheId }
    )
    const types = (await notificationsDe(ids.alice, tacheId)).map(n => n.type)
    expect(types).toContain('TACHE_MODIFIEE')
    expect(
      (await notificationsDe(ids.bruno, tacheId)).map(n => n.type)
    ).toContain('TACHE_MODIFIEE')
  })

  it('ne laisse marquer comme lues que ses propres notifications', async () => {
    const aAlice = await notificationsDe(ids.alice, tacheId)
    const data = await executer(
      ids.bruno,
      `mutation ($ids: [ID!]) { marquerNotificationsLues(ids: $ids) }`,
      {
        ids: aAlice.map(n => n.id),
      }
    )
    expect(data.marquerNotificationsLues).toBe(0)
    expect(
      (await notificationsDe(ids.alice, tacheId)).every(n => n.lueLe === null)
    ).toBe(true)
  })

  it('ne renvoie jamais les notifications d’une autre personne', async () => {
    const data = await executer(
      ids.david,
      `{ notifications { id } nombreNotificationsNonLues }`
    )
    expect(data.notifications).toEqual([])
    expect(data.nombreNotificationsNonLues).toBe(0)
  })
})

describe('rappels d’échéance', () => {
  // Mardi 10 août 2027, 8 h à Paris.
  const maintenant = new Date('2027-08-10T06:00:00Z')
  // Les tests partagent la base de développement : seules leurs éditions sont examinées.

  it('crée un rappel à 7 jours et un retard, sans doublon au second passage', async () => {
    const proche = await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.natation,
        titre: 'Commander les bonnets',
        echeance: new Date('2027-08-17'),
        assignations: { create: { userId: ids.bruno } },
      },
    })
    const enRetard = await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.natation,
        titre: 'Envoyer le programme',
        echeance: new Date('2027-08-01'),
      },
    })
    const archivee = await prisma.tache.create({
      data: {
        editionId: ids.archivee,
        perimetreId: ids.natation,
        titre: 'Ancienne tâche',
        echeance: new Date('2025-08-01'),
      },
    })

    const premier = await genererRappels(prisma, maintenant, {
      editionId: { in: [ids.edition, ids.archivee] },
    })
    const second = await genererRappels(prisma, maintenant, {
      editionId: { in: [ids.edition, ids.archivee] },
    })
    expect(second.flatMap(r => r.notificationIds)).toEqual([])

    const rappelBruno = await notificationsDe(ids.bruno, proche.id)
    expect(rappelBruno.map(n => [n.type, n.jours])).toEqual([
      ['ECHEANCE_PROCHE', 7],
    ])
    // Sans personne assignée, les trois référent·es du périmètre sont prévenus.
    expect(
      await prisma.notification.count({
        where: { tacheId: enRetard.id, type: 'TACHE_EN_RETARD' },
      })
    ).toBe(3)
    expect(
      await prisma.notification.count({ where: { tacheId: archivee.id } })
    ).toBe(0)
    expect(
      premier.find(r => r.userId === ids.bruno)?.notificationIds.length
    ).toBeGreaterThanOrEqual(2)
  })

  it('compose un mail qui liste les rappels, sauf si la personne les a désactivés', async () => {
    const notificationIds = (
      await prisma.notification.findMany({
        where: {
          userId: ids.bruno,
          type: { in: ['ECHEANCE_PROCHE', 'TACHE_EN_RETARD'] },
        },
        select: { id: true },
      })
    ).map(n => n.id)
    const message = await composer(prisma, {
      sorte: 'rappels-echeance',
      userId: ids.bruno,
      notificationIds,
    })
    expect(message?.texte).toContain(
      '- La tâche « Commander les bonnets » (Natation) arrive à échéance dans 7 jours.'
    )
    expect(message?.desabonnement).toMatch(/\/preferences$/)

    await prisma.preferenceNotification.create({
      data: {
        organisationId: ORGANISATION,
        userId: ids.bruno,
        mailEcheance: false,
      },
    })
    expect(
      await composer(prisma, {
        sorte: 'rappels-echeance',
        userId: ids.bruno,
        notificationIds,
      })
    ).toBeNull()
  })
})

describe('résumés', () => {
  const lundi = new Date('2027-08-09T05:00:00Z')
  const mardi = new Date('2027-08-10T05:00:00Z')

  it('choisit les personnes selon leur fréquence et le jour', async () => {
    await prisma.preferenceNotification.upsert({
      where: { userId: ids.chloe },
      update: { frequenceResume: 'QUOTIDIEN' },
      create: {
        organisationId: ORGANISATION,
        userId: ids.chloe,
        frequenceResume: 'QUOTIDIEN',
      },
    })
    await prisma.preferenceNotification.upsert({
      where: { userId: ids.david },
      update: { frequenceResume: 'AUCUN' },
      create: {
        organisationId: ORGANISATION,
        userId: ids.david,
        frequenceResume: 'AUCUN',
      },
    })
    const lundiIds = await personnesAResumer(prisma, lundi)
    const mardiIds = await personnesAResumer(prisma, mardi)
    expect(lundiIds).toEqual(expect.arrayContaining([ids.alice, ids.chloe]))
    expect(lundiIds).not.toContain(ids.david)
    expect(mardiIds).toContain(ids.chloe)
    expect(mardiIds).not.toContain(ids.alice)
  })

  it('résume l’activité non lue, puis ne la répète pas', async () => {
    const message = await composer(prisma, {
      sorte: 'resume',
      userId: ids.chloe,
    })
    expect(message?.texte).toContain('Bruno s’occupe de la tâche')
    await message?.apresEnvoi?.()
    const apres = await composer(prisma, { sorte: 'resume', userId: ids.chloe })
    expect(apres?.texte ?? '').not.toContain('Bruno s’occupe de la tâche')
    expect(await personnesAResumer(prisma, new Date())).not.toContain(ids.chloe)
  })
})
