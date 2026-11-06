import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'
import { decalerJour } from '../lib/agenda.ts'
import { aujourdhui } from '../lib/droits.ts'
import { organisationParDefaut } from '../lib/organisation.ts'
import { contexteDeTest } from '../test/contexte.ts'

import { schema } from './index.ts'

// Priorités d'une période (ADR 0059) : lecture par l'équipe qui voit l'activité,
// refus en découverte, ajustement réservé aux personnes qui écrivent dans le
// périmètre, horizon fixé par la prochaine réunion de l'agenda global.

const suffixe = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  alice: '', // référente natation
  chloe: '', // référente basket, en consultation sur la natation
  emma: '', // membre de l'organisation sans lien avec l'activité
  noa: '', // rattachée à l'activité, en découverte
  natation: '',
  basket: '',
  edition: '',
  retard: '',
  proche: '',
  loin: '',
  sansEcheance: '',
  partagee: '',
  declinaison: '',
  enAttente: '',
  basketLoin: '',
  reunion: '',
}

// Les jours se calculent depuis aujourd'hui : un test daté finirait par échouer.
const JOUR = aujourdhui()
const dans = (jours: number) =>
  new Date(`${decalerJour(JOUR, jours)}T00:00:00Z`)

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

const PRIORITES = `query ($e: ID!) {
  priorites(editionId: $e) {
    fin
    prochainPoint { id }
    perimetres {
      perimetre { id }
      priorites { tache { id ajustement { niveau } } score raisons { code points nombre titre } }
      autres
      ensuite { id }
    }
    jalons { id }
  }
}`

const AJUSTER = `mutation ($id: ID!, $niveau: AjustementPriorite) {
  ajusterPriorite(id: $id, niveau: $niveau) { id ajustement { niveau jusquAu par { id } } }
}`

interface Lues {
  fin: string
  prochainPoint: { id: string } | null
  perimetres: {
    perimetre: { id: string }
    priorites: {
      tache: { id: string; ajustement: { niveau: string } | null }
      score: number
      raisons: {
        code: string
        points: number
        nombre: number | null
        titre: string | null
      }[]
    }[]
    autres: number
    ensuite: { id: string } | null
  }[]
  jalons: { id: string }[]
}

async function lire(userId: string) {
  const r = await executer(userId, PRIORITES, { e: ids.edition })
  expect(r.errors).toBeUndefined()
  const lues = (r.data as { priorites: Lues }).priorites
  return {
    ...lues,
    de: (perimetreId: string) =>
      lues.perimetres.find(p => p.perimetre.id === perimetreId)!,
  }
}

let ORGANISATION = ''
let ACTIVITE = ''

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  ACTIVITE = (
    await prisma.activite.create({
      data: {
        organisationId: ORGANISATION,
        slug: `priorites-${suffixe}`,
        nom: `Priorités ${suffixe}`,
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
  await apollo.start()
  for (const [cle, estAdmin] of [
    ['admin', true],
    ['alice', false],
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
        nom: `Priorités ${suffixe}`,
        debut: dans(60),
        fin: dans(62),
      },
    })
  ).id
  for (const [cle, nom, ordre] of [
    ['natation', 'Natation', 1],
    ['basket', 'Basket', 2],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ORGANISATION,
          activiteId: ACTIVITE,
          groupe: 'sport',
          slug: `${cle}-priorites-${suffixe}`,
          nom,
          type: 'SPORT',
          ordre,
        },
      })
    ).id
  }
  await prisma.affectation.createMany({
    data: [
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.chloe, perimetreId: ids.basket, editionId: ids.edition },
    ],
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
    echeance?: Date
    perimetreId?: string
    assignes?: string[]
    origineId?: string
    accord?: 'ACCEPTE' | 'EN_ATTENTE'
  }) =>
    prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: donnees.perimetreId ?? ids.natation,
        titre: donnees.titre,
        echeance: donnees.echeance ?? null,
        origineId: donnees.origineId ?? null,
        accord: donnees.accord ?? null,
        assignations: {
          create: (donnees.assignes ?? []).map(userId => ({ userId })),
        },
      },
    })
  ids.retard = (
    await tache({
      titre: 'En retard',
      echeance: dans(-3),
      assignes: [ids.alice],
    })
  ).id
  ids.proche = (
    await tache({ titre: 'Proche', echeance: dans(5), assignes: [ids.alice] })
  ).id
  ids.loin = (
    await tache({
      titre: 'Lointaine',
      echeance: dans(45),
      assignes: [ids.alice],
    })
  ).id
  ids.sansEcheance = (await tache({ titre: 'Sans échéance' })).id
  // Une tâche partagée de la natation, déclinée au basket.
  ids.partagee = (
    await tache({
      titre: 'Partagée',
      echeance: dans(20),
      assignes: [ids.alice],
    })
  ).id
  ids.declinaison = (
    await tache({
      titre: 'Déclinaison',
      perimetreId: ids.basket,
      echeance: dans(9),
      origineId: ids.partagee,
      accord: 'ACCEPTE',
    })
  ).id
  ids.basketLoin = (
    await tache({
      titre: 'Basket lointain',
      perimetreId: ids.basket,
      echeance: dans(90),
    })
  ).id
  // Une déclinaison en attente n'entre pas dans les priorités du basket.
  ids.enAttente = (
    await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.basket,
        titre: 'En attente',
        echeance: dans(2),
        origineId: ids.loin,
        accord: 'EN_ATTENTE',
      },
    })
  ).id
  ids.reunion = (
    await prisma.reunion.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        editionId: ids.edition,
        titre: 'Point',
        debut: new Date(dans(21).getTime() + 18 * 3_600_000),
        fin: new Date(dans(21).getTime() + 19 * 3_600_000),
        cible: 'EQUIPE',
        pointEquipe: true,
        taches: { create: [{ tacheId: ids.loin }] },
      },
    })
  ).id
  // Un rendez-vous global plus proche, qui n'est pas un point d'équipe : il ne
  // fixe pas l'horizon (ADR 0059). La requête `priorites` et la fin de validité
  // d'un ajustement (`ajusterPriorite`, J+21 et non J+16) le prouvent.
  await prisma.reunion.create({
    data: {
      organisationId: ORGANISATION,
      activiteId: ACTIVITE,
      editionId: ids.edition,
      titre: 'Rendez-vous',
      debut: new Date(dans(16).getTime() + 18 * 3_600_000),
      fin: new Date(dans(16).getTime() + 19 * 3_600_000),
      cible: 'CHOIX',
    },
  })
})

afterAll(async () => {
  await prisma.lienJalon.deleteMany({
    where: { jalon: { editionId: ids.edition } },
  })
  await prisma.journal.deleteMany({ where: { editionId: ids.edition } })
  await prisma.reunion.deleteMany({ where: { editionId: ids.edition } })
  await prisma.tache.deleteMany({
    where: { editionId: ids.edition, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { editionId: ids.edition } })
  await prisma.affectation.deleteMany({ where: { editionId: ids.edition } })
  await prisma.edition.deleteMany({ where: { id: ids.edition } })
  await prisma.perimetre.deleteMany({
    where: { id: { in: [ids.natation, ids.basket] } },
  })
  await prisma.rattachementActivite.deleteMany({
    where: { activiteId: ACTIVITE },
  })
  await prisma.activite.deleteMany({ where: { id: ACTIVITE } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${suffixe}@exemple.fr` } },
  })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('priorites', () => {
  it('fixe l’horizon au prochain point de l’agenda global', async () => {
    const lues = await lire(ids.chloe)
    expect(lues.prochainPoint?.id).toBe(ids.reunion)
    expect(lues.fin).toBe(decalerJour(JOUR, 21))
  })

  it('retient les retards et l’horizon, dans l’ordre des périmètres', async () => {
    const lues = await lire(ids.chloe)
    expect(lues.perimetres.map(p => p.perimetre.id)).toEqual([
      ids.natation,
      ids.basket,
    ])
    const natation = lues.de(ids.natation)
    // La tâche partagée prend l'échéance de sa déclinaison, à 9 jours : elle égale
    // le retard (45 points), qui passe devant par son échéance.
    expect(natation.priorites.map(p => [p.tache.id, p.score])).toEqual([
      [ids.proche, 50],
      [ids.retard, 45],
      [ids.partagee, 45],
    ])
    expect(natation.priorites[0]!.raisons.map(r => r.code)).toEqual([
      'ECHEANCE_PROCHE',
      'AVANT_LE_POINT',
    ])
    expect(natation.ensuite).toBeNull()
    const basket = lues.de(ids.basket)
    // La déclinaison en attente n'entre pas.
    expect(basket.priorites.map(p => p.tache.id)).toEqual([ids.declinaison])
  })

  it('montre la prochaine tâche d’un périmètre sans priorité', async () => {
    await prisma.tache.update({
      where: { id: ids.declinaison },
      data: { statut: 'FAITE' },
    })
    try {
      const basket = (await lire(ids.alice)).de(ids.basket)
      expect(basket.priorites).toEqual([])
      expect(basket.ensuite?.id).toBe(ids.basketLoin)
    } finally {
      await prisma.tache.update({
        where: { id: ids.declinaison },
        data: { statut: 'A_FAIRE' },
      })
    }
  })

  // Jalons (ADR 0062) : un jalon du basket, dans l'horizon, lie la déclinaison.
  it('compte les jalons et liste ceux de l’horizon', async () => {
    const jalon = await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.basket,
        titre: 'Basket prêt',
        echeance: dans(10),
        jalonLe: new Date(),
        liensJalon: {
          create: [{ tacheId: ids.declinaison }, { tacheId: ids.basketLoin }],
        },
      },
    })
    // Un jalon au-delà de l'horizon n'entre pas dans la liste.
    const lointain = await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.natation,
        titre: 'Saison prête',
        echeance: dans(80),
        jalonLe: new Date(),
      },
    })
    try {
      const lues = await lire(ids.chloe)
      expect(lues.jalons.map(j => j.id)).toEqual([jalon.id])
      const basket = lues.de(ids.basket)
      const raisons = (id: string) =>
        basket.priorites.find(p => p.tache.id === id)!.raisons
      expect(raisons(jalon.id)).toContainEqual({
        code: 'JALON',
        points: 5,
        nombre: 2,
        titre: null,
      })
      expect(raisons(ids.declinaison)).toContainEqual({
        code: 'MENE_A_UN_JALON',
        points: 10,
        nombre: null,
        titre: 'Basket prêt',
      })
    } finally {
      await prisma.lienJalon.deleteMany({ where: { jalonId: jalon.id } })
      await prisma.tache.deleteMany({
        where: { id: { in: [jalon.id, lointain.id] } },
      })
    }
  })

  it('refuse une personne en découverte, sans lien ou sans session', async () => {
    for (const userId of [ids.noa, ids.emma, null]) {
      const r = await executer(userId, PRIORITES, { e: ids.edition })
      expect(r.data).toBeNull()
      expect(code(r)).toMatch(/FORBIDDEN|UNAUTHENTICATED/)
    }
  })
})

describe('ajusterPriorite', () => {
  it('épingle une tâche sans échéance, jusqu’à la fin de l’horizon', async () => {
    const r = await executer(ids.alice, AJUSTER, {
      id: ids.sansEcheance,
      niveau: 'EPINGLEE',
    })
    expect(r.errors).toBeUndefined()
    expect(
      (r.data as { ajusterPriorite: { ajustement: unknown } }).ajusterPriorite
        .ajustement
    ).toEqual({
      niveau: 'EPINGLEE',
      jusquAu: decalerJour(JOUR, 21),
      par: { id: ids.alice },
    })
    const natation = (await lire(ids.chloe)).de(ids.natation)
    expect(natation.priorites[0]!.tache).toEqual({
      id: ids.sansEcheance,
      ajustement: { niveau: 'EPINGLEE' },
    })
    const journal = await prisma.journal.findFirst({
      where: { tacheId: ids.sansEcheance, type: 'TACHE_PRIORITE' },
    })
    expect(journal?.ajustement).toBe('EPINGLEE')
  })

  it('oublie un ajustement dont le dernier jour est passé', async () => {
    await prisma.tache.update({
      where: { id: ids.sansEcheance },
      data: { ajustementJusquAu: dans(-1) },
    })
    const natation = (await lire(ids.chloe)).de(ids.natation)
    expect(natation.priorites.map(p => p.tache.id)).not.toContain(
      ids.sansEcheance
    )
  })

  it('retire un ajustement sans changer la version de la tâche', async () => {
    const avant = await prisma.tache.findUniqueOrThrow({
      where: { id: ids.proche },
    })
    await executer(ids.alice, AJUSTER, { id: ids.proche, niveau: 'BASSE' })
    const r = await executer(ids.admin, AJUSTER, { id: ids.proche })
    expect(r.errors).toBeUndefined()
    const apres = await prisma.tache.findUniqueOrThrow({
      where: { id: ids.proche },
    })
    expect(apres.ajustementPriorite).toBeNull()
    expect(apres.ajustementParId).toBeNull()
    expect(apres.version).toBe(avant.version)
  })

  it('refuse une personne en consultation, en découverte ou sans session', async () => {
    for (const userId of [ids.chloe, ids.noa, ids.emma, null]) {
      const r = await executer(userId, AJUSTER, {
        id: ids.proche,
        niveau: 'HAUTE',
      })
      expect(r.data).toBeNull()
      expect(code(r)).toMatch(/FORBIDDEN|UNAUTHENTICATED/)
    }
    const tache = await prisma.tache.findUniqueOrThrow({
      where: { id: ids.proche },
    })
    expect(tache.ajustementPriorite).toBeNull()
  })

  it('refuse une déclinaison en attente', async () => {
    const r = await executer(ids.admin, AJUSTER, {
      id: ids.enAttente,
      niveau: 'HAUTE',
    })
    expect(r.errors?.[0]?.message).toMatch(/attend l’accord/)
  })
})
