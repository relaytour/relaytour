import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'
import { organisationParDefaut } from '../lib/organisation.ts'
import { contexteDeTest } from '../test/contexte.ts'

import { schema } from './index.ts'

// Charge de l'équipe (ADR 0055) : lecture par l'équipe qui voit les tâches, refus
// en découverte, nombre de tâches réalisées réservé à la personne et aux admins.

const suffixe = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  alice: '', // référente natation
  bruno: '', // référent natation
  chloe: '', // référente basket, placée au programme
  emma: '', // membre de l'organisation sans lien avec l'activité
  noa: '', // rattachée à l'activité, en découverte
  natation: '',
  basket: '',
  edition: '',
  ouverte: '',
  sansEcheance: '',
  faite: '',
  partagee: '',
  refusee: '',
  sequence: '',
  autre: '', // activité où seule Alice est affectée
  autreEdition: '',
  autrePerimetre: '',
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await contexteDeTest(userId) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const CHARGE = `query ($e: ID!) {
  chargeEquipe(editionId: $e) {
    personne { id }
    affectations { perimetre { id } contactPrincipal }
    maintenant { total enRetard proches plusTard sansEcheance partagees }
    edition { total faites parPhase { cle total } }
    places { total aVenir }
    realisees
  }
}`

interface LigneCharge {
  personne: { id: string }
  affectations: { perimetre: { id: string } }[]
  maintenant: {
    total: number
    enRetard: number
    sansEcheance: number
    partagees: number
  }
  edition: { total: number; faites: number }
  places: { total: number; aVenir: number }
  realisees: number | null
}

async function charge(userId: string) {
  const r = await executer(userId, CHARGE, { e: ids.edition })
  expect(r.errors).toBeUndefined()
  const lignes = (r.data as { chargeEquipe: LigneCharge[] }).chargeEquipe
  return (id: string) => lignes.find(l => l.personne.id === id)
}

let ORGANISATION = ''
let ACTIVITE = ''

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  const activite = (slug: string, nom: string) =>
    prisma.activite.create({
      data: {
        organisationId: ORGANISATION,
        slug,
        nom,
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ACTIVITE = (await activite(`charge-${suffixe}`, `Charge ${suffixe}`)).id
  ids.autre = (await activite(`autre-${suffixe}`, `Autre ${suffixe}`)).id
  await apollo.start()
  for (const [cle, estAdmin] of [
    ['admin', true],
    ['alice', false],
    ['bruno', false],
    ['chloe', false],
    ['emma', false],
    ['noa', false],
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
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        annee: 2100 + Math.floor(Math.random() * 800),
        nom: `Charge ${suffixe}`,
        debut: new Date('2099-08-27'),
        fin: new Date('2099-08-29'),
      },
    })
  ).id
  for (const [cle, nom] of [
    ['natation', 'Natation'],
    ['basket', 'Basket'],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ORGANISATION,
          activiteId: ACTIVITE,
          groupe: 'sport',
          slug: `${cle}-charge-${suffixe}`,
          nom,
          type: 'SPORT',
        },
      })
    ).id
  }
  await prisma.affectation.createMany({
    data: [
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.bruno, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.chloe, perimetreId: ids.basket, editionId: ids.edition },
    ],
  })
  ids.autreEdition = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ids.autre,
        annee: 2099,
        nom: `Autre ${suffixe}`,
        debut: new Date('2099-05-01'),
        fin: new Date('2099-05-02'),
      },
    })
  ).id
  ids.autrePerimetre = (
    await prisma.perimetre.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ids.autre,
        groupe: 'sport',
        slug: `voile-charge-${suffixe}`,
        nom: 'Voile',
        type: 'SPORT',
      },
    })
  ).id
  await prisma.affectation.create({
    data: {
      userId: ids.alice,
      perimetreId: ids.autrePerimetre,
      editionId: ids.autreEdition,
    },
  })
  await prisma.rattachementActivite.create({
    data: {
      userId: ids.noa,
      activiteId: ACTIVITE,
      organisationId: ORGANISATION,
    },
  })
  const tache = (donnees: {
    titre: string
    echeance?: string
    statut?: 'A_FAIRE' | 'FAITE'
    assignes: string[]
    realisateurs?: string[]
    perimetreId?: string
    origineId?: string
    accord?: 'REFUSE'
  }) =>
    prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: donnees.perimetreId ?? ids.natation,
        titre: donnees.titre,
        statut: donnees.statut ?? 'A_FAIRE',
        echeance: donnees.echeance ? new Date(donnees.echeance) : null,
        clotureeParId: donnees.statut === 'FAITE' ? ids.bruno : null,
        origineId: donnees.origineId ?? null,
        accord: donnees.accord ?? null,
        assignations: {
          create: donnees.assignes.map(userId => ({ userId })),
        },
        realisations: {
          create: (donnees.realisateurs ?? []).map(userId => ({ userId })),
        },
      },
    })
  ids.ouverte = (
    await tache({
      titre: 'En retard',
      echeance: '2020-01-01',
      assignes: [ids.alice, ids.bruno],
    })
  ).id
  ids.sansEcheance = (
    await tache({ titre: 'Sans échéance', assignes: [ids.alice] })
  ).id
  ids.faite = (
    await tache({
      titre: 'Faite à deux',
      echeance: '2099-08-01',
      statut: 'FAITE',
      assignes: [ids.bruno],
      realisateurs: [ids.alice, ids.bruno],
    })
  ).id
  // Une déclinaison refusée ne compte pas (ADR 0026).
  ids.partagee = (
    await tache({
      titre: 'Partagée',
      perimetreId: ids.basket,
      assignes: [],
    })
  ).id
  ids.refusee = (
    await tache({
      titre: 'Refusée',
      origineId: ids.partagee,
      accord: 'REFUSE',
      assignes: [ids.alice],
    })
  ).id
  ids.sequence = (
    await prisma.sequence.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        editionId: ids.edition,
        titre: 'Accueil',
        debut: new Date('2099-08-27T08:00:00Z'),
        fin: new Date('2099-08-27T10:00:00Z'),
        places: { create: [{ userId: ids.chloe, confirmeeLe: new Date() }] },
      },
    })
  ).id
})

afterAll(async () => {
  await prisma.sequence.deleteMany({ where: { editionId: ids.edition } })
  await prisma.tache.deleteMany({
    where: { editionId: ids.edition, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { editionId: ids.edition } })
  const editions = [ids.edition, ids.autreEdition]
  await prisma.affectation.deleteMany({
    where: { editionId: { in: editions } },
  })
  await prisma.edition.deleteMany({ where: { id: { in: editions } } })
  await prisma.perimetre.deleteMany({
    where: { id: { in: [ids.natation, ids.basket, ids.autrePerimetre] } },
  })
  await prisma.rattachementActivite.deleteMany({
    where: { activiteId: { in: [ACTIVITE, ids.autre] } },
  })
  await prisma.activite.deleteMany({
    where: { id: { in: [ACTIVITE, ids.autre] } },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${suffixe}@exemple.fr` } },
  })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('chargeEquipe', () => {
  it('compte les tâches ouvertes, partagées et sans échéance, sans la déclinaison refusée', async () => {
    const de = await charge(ids.chloe)
    expect(de(ids.alice)).toMatchObject({
      maintenant: { total: 2, enRetard: 1, sansEcheance: 1, partagees: 1 },
      edition: { total: 2, faites: 0 },
      affectations: [{ perimetre: { id: ids.natation } }],
    })
    expect(de(ids.bruno)).toMatchObject({
      maintenant: { total: 1, enRetard: 1, partagees: 1 },
      edition: { total: 2, faites: 1 },
    })
    expect(de(ids.chloe)).toMatchObject({
      maintenant: { total: 0 },
      places: { total: 1, aVenir: 1 },
    })
  })

  it('réserve le nombre de tâches réalisées à la personne et aux admins', async () => {
    const parChloe = await charge(ids.chloe)
    expect(parChloe(ids.alice)?.realisees).toBeNull()
    expect(parChloe(ids.chloe)?.realisees).toBe(0)
    const parAlice = await charge(ids.alice)
    expect(parAlice(ids.alice)?.realisees).toBe(1)
    expect(parAlice(ids.bruno)?.realisees).toBeNull()
    const parAdmin = await charge(ids.admin)
    expect(parAdmin(ids.bruno)?.realisees).toBe(1)
  })

  it('refuse une personne en découverte, sans lien ou sans session', async () => {
    for (const userId of [ids.noa, ids.emma, null]) {
      const r = await executer(userId, CHARGE, { e: ids.edition })
      expect(r.data).toBeNull()
      expect(code(r)).toMatch(/FORBIDDEN|UNAUTHENTICATED/)
    }
  })
})

describe('tachesDe', () => {
  const Q = `query ($p: ID!, $e: ID!, $t: TempsCharge!) {
    tachesDe(personneId: $p, editionId: $e, temps: $t) { id }
  }`
  const lire = async (userId: string, personneId: string, temps: string) => {
    const r = await executer(userId, Q, {
      p: personneId,
      e: ids.edition,
      t: temps,
    })
    expect(r.errors).toBeUndefined()
    return (r.data as { tachesDe: { id: string }[] }).tachesDe
      .map(t => t.id)
      .sort()
  }

  it('liste les tâches d’une personne pour une personne en consultation', async () => {
    expect(await lire(ids.chloe, ids.alice, 'MAINTENANT')).toEqual(
      [ids.ouverte, ids.sansEcheance].sort()
    )
    expect(await lire(ids.chloe, ids.bruno, 'EDITION')).toEqual(
      [ids.ouverte, ids.faite].sort()
    )
  })

  it('refuse une personne en découverte', async () => {
    const r = await executer(ids.noa, Q, {
      p: ids.alice,
      e: ids.edition,
      t: 'MAINTENANT',
    })
    expect(code(r)).toBe('FORBIDDEN')
  })
})

describe('chargeCumulee', () => {
  const Q = `query ($p: ID!) {
    chargeCumulee(personneId: $p) { activite { id } edition { id } ouvertes enRetard perimetres }
  }`

  it('cumule la charge dans les activités visibles seulement', async () => {
    type Ligne = {
      activite: { id: string }
      ouvertes: number
      enRetard: number
      perimetres: number
    }
    const lire = async (userId: string) => {
      const r = await executer(userId, Q, { p: ids.alice })
      expect(r.errors).toBeUndefined()
      return (r.data as { chargeCumulee: Ligne[] }).chargeCumulee
    }
    const parChloe = await lire(ids.chloe)
    expect(parChloe.map(l => l.activite.id)).toEqual([ACTIVITE])
    expect(parChloe[0]).toMatchObject({
      ouvertes: 2,
      enRetard: 1,
      perimetres: 1,
    })

    const parAdmin = await lire(ids.admin)
    expect(parAdmin.map(l => l.activite.id).sort()).toEqual(
      [ACTIVITE, ids.autre].sort()
    )

    for (const userId of [ids.emma, ids.noa]) {
      expect(await lire(userId)).toEqual([])
    }
  })
})
