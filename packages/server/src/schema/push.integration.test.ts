import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { AppContext } from '../context.ts'
import { notifier, notifierLePerimetre } from '../lib/notifications.ts'
import { organisationParDefaut } from '../lib/organisation.ts'
import { activiteParDefaut, contexteDeTest } from '../test/contexte.ts'

import { schema } from './index.ts'

// Notifications push (ADR 0024). Le canal s'ouvre ici avec des clés d'essai, et les
// mises en file se notent sans atteindre Redis : aucun message ne part.
const pousses = vi.hoisted(() => [] as string[])
vi.mock('../lib/push-file.ts', () => ({
  pousser: (notificationId: string) => {
    pousses.push(notificationId)
    return Promise.resolve()
  },
}))
vi.mock('../lib/push.ts', async importOriginal => {
  const reel = await importOriginal<typeof import('../lib/push.ts')>()
  return {
    ...reel,
    clesVapid: () => ({
      publique: 'cle-publique-d-essai',
      privee: 'cle-privee-d-essai',
      sujet: 'mailto:contact@exemple.org',
    }),
  }
})

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = { alice: '', bruno: '', perimetre: '', edition: '', tache: '' }

const ADRESSE = `https://fcm.googleapis.com/fcm/send/essai-${s}`
const CLES = {
  p256dh:
    'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await contexteDeTest(userId) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const ABONNER = `mutation ($adresse: String!, $p256dh: String!, $auth: String!) {
  abonnerPush(adresse: $adresse, p256dh: $p256dh, auth: $auth, agent: "Mozilla/5.0 (iPhone)")
}`
const DESABONNER = `mutation ($adresse: String!) { desabonnerPush(adresse: $adresse) }`
const ABONNE = `query ($adresse: String!) { abonnePush(adresse: $adresse) }`

const abonnementsDe = (userId: string) =>
  prisma.abonnementPush.findMany({ where: { userId } })

beforeAll(async () => {
  const organisationId = await organisationParDefaut()
  const activiteId = await activiteParDefaut()
  await apollo.start()
  for (const cle of ['alice', 'bruno'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-push-${s}@exemple.fr`,
        name: cle,
        appartenances: { create: { organisationId } },
      },
    })
  }
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId,
        activiteId,
        annee: 4000 + Math.floor(Math.random() * 900),
        nom: `Push ${s}`,
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id
  ids.perimetre = (
    await prisma.perimetre.create({
      data: {
        organisationId,
        activiteId,
        groupe: 'sport',
        slug: `push-${s}`,
        nom: 'Push',
        type: 'SPORT',
      },
    })
  ).id
  await prisma.affectation.createMany({
    data: [ids.alice, ids.bruno].map(userId => ({
      userId,
      perimetreId: ids.perimetre,
      editionId: ids.edition,
    })),
  })
  ids.tache = (
    await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.perimetre,
        titre: 'Réserver la salle',
      },
    })
  ).id
})

afterAll(async () => {
  const users = [ids.alice, ids.bruno]
  await prisma.abonnementPush.deleteMany({ where: { userId: { in: users } } })
  await prisma.notification.deleteMany({ where: { userId: { in: users } } })
  await prisma.tache.deleteMany({ where: { editionId: ids.edition } })
  await prisma.affectation.deleteMany({ where: { editionId: ids.edition } })
  await prisma.edition.deleteMany({ where: { id: ids.edition } })
  await prisma.perimetre.deleteMany({ where: { id: ids.perimetre } })
  await prisma.preferenceNotification.deleteMany({
    where: { userId: { in: users } },
  })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('abonnement push', () => {
  it('donne la clé publique sans session', async () => {
    const r = await executer(null, '{ clePubliquePush }')
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({ clePubliquePush: 'cle-publique-d-essai' })
  })

  it('refuse une requête sans session', async () => {
    const variables = { adresse: ADRESSE, ...CLES }
    expect((await executer(null, ABONNER, variables)).errors).toBeDefined()
    expect(
      (await executer(null, DESABONNER, { adresse: ADRESSE })).errors
    ).toBeDefined()
    expect(
      (await executer(null, ABONNE, { adresse: ADRESSE })).errors
    ).toBeDefined()
    expect(
      await prisma.abonnementPush.count({ where: { adresse: ADRESSE } })
    ).toBe(0)
  })

  it('refuse une adresse hors des services de push, et des clés mal formées', async () => {
    for (const adresse of [
      'https://exemple.org/push',
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://localhost/interne',
    ]) {
      const r = await executer(ids.alice, ABONNER, { adresse, ...CLES })
      expect(r.errors?.[0]?.message).toContain('service de push reconnu')
    }
    const r = await executer(ids.alice, ABONNER, {
      adresse: ADRESSE,
      p256dh: 'court',
      auth: CLES.auth,
    })
    expect(r.errors?.[0]?.message).toContain('clés')
    expect(await abonnementsDe(ids.alice)).toHaveLength(0)
  })

  it('enregistre un abonnement une seule fois par appareil', async () => {
    const variables = { adresse: ADRESSE, ...CLES }
    expect((await executer(ids.alice, ABONNER, variables)).data).toEqual({
      abonnerPush: true,
    })
    expect(
      (await executer(ids.alice, ABONNER, variables)).errors
    ).toBeUndefined()
    const abonnements = await abonnementsDe(ids.alice)
    expect(abonnements).toHaveLength(1)
    expect(abonnements[0]?.appareil).toBe('iPhone')
    expect(
      (await executer(ids.alice, ABONNE, { adresse: ADRESSE })).data
    ).toEqual({ abonnePush: true })
  })

  it('ne laisse ni lire ni retirer l’abonnement d’une autre personne', async () => {
    expect(
      (await executer(ids.bruno, ABONNE, { adresse: ADRESSE })).data
    ).toEqual({ abonnePush: false })
    expect(
      (await executer(ids.bruno, DESABONNER, { adresse: ADRESSE })).data
    ).toEqual({ desabonnerPush: false })
    expect(await abonnementsDe(ids.alice)).toHaveLength(1)
  })

  it('ne garde qu’un compte par appareil', async () => {
    // Un autre compte s'abonne sur le même appareil : l'abonnement que le premier
    // y avait laissé est retiré, et ses notifications n'y arrivent plus.
    const variables = { adresse: ADRESSE, ...CLES }
    expect(
      (await executer(ids.bruno, ABONNER, variables)).errors
    ).toBeUndefined()
    expect(await abonnementsDe(ids.alice)).toHaveLength(0)
    expect(await abonnementsDe(ids.bruno)).toHaveLength(1)
    expect(
      (await executer(ids.alice, ABONNER, variables)).errors
    ).toBeUndefined()
    expect(await abonnementsDe(ids.bruno)).toHaveLength(0)
    expect(await abonnementsDe(ids.alice)).toHaveLength(1)
  })

  it('retire l’abonnement à la demande de sa personne', async () => {
    expect(
      (await executer(ids.alice, DESABONNER, { adresse: ADRESSE })).data
    ).toEqual({ desabonnerPush: true })
    expect(await abonnementsDe(ids.alice)).toHaveLength(0)
  })
})

describe('ce qui part en push', () => {
  const base = () => ({
    acteurId: ids.alice,
    tacheId: ids.tache,
    perimetreId: ids.perimetre,
  })
  const derniere = async (userId: string) =>
    (
      await prisma.notification.findFirstOrThrow({
        where: { userId, tacheId: ids.tache },
        orderBy: { createdAt: 'desc' },
      })
    ).id

  it('pousse l’assignation à la personne concernée', async () => {
    pousses.length = 0
    await notifier(prisma, {
      ...base(),
      type: 'TACHE_ASSIGNEE',
      destinataires: [ids.bruno],
      personneId: ids.bruno,
    })
    expect(pousses).toEqual([await derniere(ids.bruno)])
  })

  it('ne pousse pas l’assignation d’une autre personne', async () => {
    pousses.length = 0
    await notifier(prisma, {
      ...base(),
      type: 'TACHE_ASSIGNEE',
      destinataires: [ids.bruno],
      personneId: ids.alice,
    })
    expect(pousses).toEqual([])
  })

  it('pousse la modification d’une tâche assignée, comme son mail immédiat', async () => {
    pousses.length = 0
    await notifier(
      prisma,
      { ...base(), type: 'TACHE_MODIFIEE', destinataires: [ids.bruno] },
      { mailImmediat: true }
    )
    expect(pousses).toEqual([await derniere(ids.bruno)])
  })

  it('ne pousse ni une création de tâche ni une annonce au périmètre', async () => {
    pousses.length = 0
    await notifier(prisma, {
      ...base(),
      type: 'TACHE_CREEE',
      destinataires: [ids.bruno],
    })
    await notifierLePerimetre(prisma, {
      type: 'TACHE_MODIFIEE',
      perimetreId: ids.perimetre,
      editionId: ids.edition,
      acteurId: ids.alice,
      tacheId: ids.tache,
    })
    expect(pousses).toEqual([])
  })
})
