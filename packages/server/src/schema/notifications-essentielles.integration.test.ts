import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { genererRappels } from '../jobs/planification.ts'

import { schema } from './index.ts'

// Notifications essentielles et modèles de réglages (ADR 0065). Chaque compte part
// des réglages par défaut : le modèle Essentiel.

const s = randomUUID().slice(0, 8)
const slug = `essentielles-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  organisation: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  volley: '',
  lea: '',
  paul: '',
  noa: '',
  contact: '',
  zoe: '',
  victor: '',
  vanessa: '',
  admin: '',
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    {
      contextValue: await buildContext('127.0.0.1', userId, slug, false, null),
    }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

async function reussir(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await executer(userId, query, variables)
  expect(r.errors).toBeUndefined()
  return r.data as Record<string, unknown>
}

const types = async (userId: string, tacheId: string) =>
  (
    await prisma.notification.findMany({
      where: { userId, tacheId },
      orderBy: { createdAt: 'asc' },
      select: { type: true },
    })
  ).map(n => n.type)

async function compte(cle: string, role: 'ADMIN' | 'MEMBRE' = 'MEMBRE') {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: `${cle}-${s}@exemple.fr`,
      name: cle.charAt(0).toUpperCase() + cle.slice(1),
      emailVerified: true,
      appartenances: { create: { organisationId: ids.organisation, role } },
    },
  })
  return id
}

async function perimetre(cle: string, nom: string) {
  return (
    await prisma.perimetre.create({
      data: {
        organisationId: ids.organisation,
        activiteId: ids.activite,
        slug: `${cle}-${s}`,
        nom,
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
}

async function tache(
  perimetreId: string,
  titre: string,
  options: { assignes?: string[]; echeance?: Date } = {}
) {
  return (
    await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId,
        titre,
        echeance: options.echeance ?? null,
        assignations: {
          create: (options.assignes ?? []).map(userId => ({ userId })),
        },
      },
    })
  ).id
}

async function regler(
  userId: string,
  data: { suiviPerimetres?: 'MOI' | 'SUIVI' | 'DETAIL' }
) {
  await prisma.preferenceOrganisation.upsert({
    where: {
      userId_organisationId: { userId, organisationId: ids.organisation },
    },
    update: data,
    create: { userId, organisationId: ids.organisation, ...data },
  })
}

const ASSIGNER = `mutation ($id: ID!, $a: Boolean!, $p: ID) {
  assignerTache(id: $id, assigne: $a, personneId: $p) { id }
}`

beforeAll(async () => {
  await apollo.start()
  ids.organisation = (
    await prisma.organisation.create({
      data: { slug, nom: `Essentielles ${s}`, configuration: {} },
    })
  ).id
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.organisation,
        slug: `rencontres-${s}`,
        nom: 'Rencontres',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.organisation,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Rencontres 2027',
        debut: new Date('2027-06-01'),
        fin: new Date('2027-06-02'),
      },
    })
  ).id
  ids.natation = await perimetre('natation', 'Natation')
  ids.basket = await perimetre('basket', 'Basket')
  ids.volley = await perimetre('volley', 'Volley')
  ids.lea = await compte('lea')
  ids.paul = await compte('paul')
  ids.noa = await compte('noa')
  ids.contact = await compte('contact')
  ids.zoe = await compte('zoe')
  ids.victor = await compte('victor')
  ids.vanessa = await compte('vanessa')
  ids.admin = await compte('admin', 'ADMIN')
  const affecter = (
    userId: string,
    perimetreId: string,
    contactPrincipal = false
  ) => ({ userId, perimetreId, editionId: ids.edition, contactPrincipal })
  await prisma.affectation.createMany({
    data: [
      affecter(ids.lea, ids.natation),
      affecter(ids.paul, ids.natation),
      affecter(ids.noa, ids.natation),
      affecter(ids.contact, ids.basket, true),
      affecter(ids.zoe, ids.basket),
      affecter(ids.victor, ids.volley),
      affecter(ids.vanessa, ids.volley),
    ],
  })
})

afterAll(async () => {
  const users = Object.values(ids)
  await prisma.notification.deleteMany({
    where: { organisationId: ids.organisation },
  })
  await prisma.journal.deleteMany({ where: { editionId: ids.edition } })
  await prisma.tache.updateMany({
    where: { editionId: ids.edition },
    data: { origineId: null },
  })
  await prisma.tache.deleteMany({ where: { editionId: ids.edition } })
  await prisma.affectation.deleteMany({ where: { editionId: ids.edition } })
  await prisma.edition.deleteMany({ where: { id: ids.edition } })
  await prisma.perimetre.deleteMany({
    where: { organisationId: ids.organisation },
  })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  await prisma.activite.deleteMany({ where: { id: ids.activite } })
  await prisma.organisation.deleteMany({ where: { id: ids.organisation } })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('par défaut, ce qui vous concerne seulement', () => {
  it('un retrait puis une reprise ne préviennent que la personne retirée', async () => {
    const tacheId = await tache(ids.natation, 'Relire les catégories', {
      assignes: [ids.paul],
    })
    await reussir(ids.lea, ASSIGNER, { id: tacheId, a: false, p: ids.paul })
    await reussir(ids.lea, ASSIGNER, { id: tacheId, a: true })
    // Noa, co-référente du périmètre, ne reçoit rien : ni le retrait de Paul, ni
    // la reprise par Léa.
    expect(await types(ids.noa, tacheId)).toEqual([])
    expect(await types(ids.paul, tacheId)).toEqual(['TACHE_DESASSIGNEE'])
    expect(await types(ids.lea, tacheId)).toEqual([])
  })

  it('le suivi du périmètre ajoute les tâches à prendre, le détail le reste', async () => {
    const creer = async (titre: string, mAssigner: boolean) =>
      (
        (
          await reussir(
            ids.lea,
            `mutation ($p: ID!, $e: ID!, $t: String!, $m: Boolean) {
              creerTache(perimetreId: $p, editionId: $e, titre: $t, mAssigner: $m) { id }
            }`,
            { p: ids.natation, e: ids.edition, t: titre, m: mAssigner }
          )
        ).creerTache as { id: string }
      ).id
    const sansPersonne = await creer('Réserver le bassin', false)
    expect(await types(ids.noa, sansPersonne)).toEqual([])

    await regler(ids.noa, { suiviPerimetres: 'SUIVI' })
    const aPrendre = await creer('Commander les bonnets', false)
    const priseParLea = await creer('Imprimer les plans', true)
    expect(await types(ids.noa, aPrendre)).toEqual(['TACHE_CREEE'])
    expect(await types(ids.noa, priseParLea)).toEqual([])

    await regler(ids.noa, { suiviPerimetres: 'DETAIL' })
    const detail = await creer('Ranger les lignes', true)
    expect(await types(ids.noa, detail)).toEqual(['TACHE_CREEE'])
    await regler(ids.noa, { suiviPerimetres: 'MOI' })
  })

  it('le contact principal reçoit seul une déclinaison à accepter', async () => {
    const r = await reussir(
      ids.lea,
      `mutation ($p: ID!, $e: ID!, $d: DeclinaisonInput) {
        creerTache(perimetreId: $p, editionId: $e, titre: "Prévoir les arbitres", mAssigner: true, declinaison: $d) {
          declinaisons { id perimetre { id } }
        }
      }`,
      {
        p: ids.natation,
        e: ids.edition,
        d: { perimetreIds: [ids.basket, ids.volley] },
      }
    )
    const declinaisons = (
      r.creerTache as {
        declinaisons: { id: string; perimetre: { id: string } }[]
      }
    ).declinaisons
    const vers = (perimetreId: string) =>
      declinaisons.find(d => d.perimetre.id === perimetreId)!.id
    expect(await types(ids.contact, vers(ids.basket))).toEqual([
      'DECLINAISON_PROPOSEE',
    ])
    expect(await types(ids.zoe, vers(ids.basket))).toEqual([])
    // Sans contact principal, toute l'équipe du périmètre la reçoit.
    expect(await types(ids.victor, vers(ids.volley))).toEqual([
      'DECLINAISON_PROPOSEE',
    ])
    expect(await types(ids.vanessa, vers(ids.volley))).toEqual([
      'DECLINAISON_PROPOSEE',
    ])
  })

  it('le retard d’une tâche sans personne prévient le contact principal, ou l’équipe', async () => {
    const echeance = new Date('2027-05-01')
    const basket = await tache(ids.basket, 'Réserver le gymnase', { echeance })
    const volley = await tache(ids.volley, 'Monter les filets', { echeance })
    await genererRappels(
      prisma,
      { id: ids.organisation, fuseauHoraire: 'Europe/Paris' },
      new Date('2027-05-10T06:00:00Z'),
      { editionId: ids.edition }
    )
    expect(await types(ids.contact, basket)).toEqual(['TACHE_EN_RETARD'])
    expect(await types(ids.zoe, basket)).toEqual([])
    expect(await types(ids.victor, volley)).toEqual(['TACHE_EN_RETARD'])
    expect(await types(ids.vanessa, volley)).toEqual(['TACHE_EN_RETARD'])
  })

  it('le retard d’une tâche sans personne prévient l’équipe quand le contact principal est archivé', async () => {
    await prisma.appartenance.updateMany({
      where: { userId: ids.contact, organisationId: ids.organisation },
      data: { archiveLe: new Date() },
    })
    try {
      const basket = await tache(ids.basket, 'Commander les ballons', {
        echeance: new Date('2027-05-02'),
      })
      await genererRappels(
        prisma,
        { id: ids.organisation, fuseauHoraire: 'Europe/Paris' },
        new Date('2027-05-10T06:00:00Z'),
        { id: basket }
      )
      expect(await types(ids.contact, basket)).toEqual([])
      expect(await types(ids.zoe, basket)).toEqual(['TACHE_EN_RETARD'])
    } finally {
      await prisma.appartenance.updateMany({
        where: { userId: ids.contact, organisationId: ids.organisation },
        data: { archiveLe: null },
      })
    }
  })
})

describe('modèles de réglages', () => {
  const LIRE = `{ mesPreferencesNotification {
    modele modeleRecommande suiviPerimetres detailContactPrincipal suiviAdmin
    frequenceResume mailPriorites
  } }`
  const APPLIQUER = `mutation ($m: ModeleNotification!) {
    appliquerModeleNotification(modele: $m) { modele }
  }`

  it('part du modèle Essentiel et recommande le modèle du rôle', async () => {
    const lire = async (userId: string) =>
      (await reussir(userId, LIRE)).mesPreferencesNotification as Record<
        string,
        unknown
      >
    expect(await lire(ids.paul)).toMatchObject({
      modele: 'ESSENTIEL',
      modeleRecommande: 'REFERENT',
      suiviPerimetres: 'MOI',
      suiviAdmin: 'ACTIONS',
      mailPriorites: 'MES_PERIMETRES',
    })
    expect((await lire(ids.contact)).modeleRecommande).toBe('CONTACT_PRINCIPAL')
    expect((await lire(ids.admin)).modeleRecommande).toBe('ADMIN_ACTIVITE')
  })

  it('applique un modèle, puis devient personnalisé après un réglage', async () => {
    expect(
      (await reussir(ids.zoe, APPLIQUER, { m: 'CONTACT_PRINCIPAL' }))
        .appliquerModeleNotification
    ).toEqual({ modele: 'CONTACT_PRINCIPAL' })
    expect(
      (await reussir(ids.zoe, LIRE)).mesPreferencesNotification
    ).toMatchObject({
      suiviPerimetres: 'SUIVI',
      detailContactPrincipal: true,
      frequenceResume: 'QUOTIDIEN',
    })
    const modifie = await reussir(
      ids.zoe,
      `mutation { modifierPreferencesNotification(frequenceResume: AUCUN, mailModification: true, mailEcheance: true) { modele } }`
    )
    expect(modifie.modifierPreferencesNotification).toEqual({ modele: null })
    // Le modèle ne vaut que dans cette organisation : Paul n'a rien changé.
    expect(
      (
        (await reussir(ids.paul, LIRE)).mesPreferencesNotification as {
          modele: string
        }
      ).modele
    ).toBe('ESSENTIEL')
  })

  it('refuse un modèle sans session', async () => {
    const r = await executer(null, APPLIQUER, { m: 'ESSENTIEL' })
    expect(r.errors?.[0]?.extensions?.code).toBeDefined()
    expect(r.data?.appliquerModeleNotification ?? null).toBeNull()
  })
})
