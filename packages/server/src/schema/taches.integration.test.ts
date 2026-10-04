import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'
import { activiteParDefaut, contexteDeTest } from '../test/contexte.ts'

import { schema } from './index.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

// Règles d'accès et de collaboration sur les tâches, prouvées par le refus.

const suffixe = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  alice: '', // référente natation, éditions en cours et archivée
  bruno: '', // référent natation, édition en cours
  chloe: '', // référente basket
  dora: '', // référente natation, édition archivée seulement
  emma: '', // membre de l'organisation, sans aucune affectation
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
    { contextValue: await contexteDeTest(userId) }
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

let ORGANISATION = ''
let ACTIVITE = ''

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  ACTIVITE = await activiteParDefaut()
  await apollo.start()
  for (const [cle, estAdmin] of [
    ['admin', true],
    ['alice', false],
    ['bruno', false],
    ['chloe', false],
    ['dora', false],
    ['emma', false],
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
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
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
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
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
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        groupe: 'sport',
        slug: `natation-${suffixe}`,
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
        slug: `basket-${suffixe}`,
        nom: 'Basket',
        type: 'SPORT',
      },
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
  await prisma.journal.deleteMany({ where: { editionId: { in: editions } } })
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

  it('refuse un membre sans affectation dans l’activité', async () => {
    expect(
      code(
        await executer(ids.emma, LIRE, {
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

// ADR 0014 : une personne affectée dans l'activité consulte les autres périmètres.
// Elle lit leurs tâches et leur équipe. Chaque refus qui subsiste est prouvé ici.
describe('consultation d’un autre périmètre de l’activité', () => {
  const CONSULTER = `query ($s: String!, $e: ID!) {
    perimetre(slug: $s) {
      acces
      peutModifier(editionId: $e)
      taches(editionId: $e) { id peutModifier clotureePar { id } assignes { id nom } }
      referents(editionId: $e) { id nom }
      avancement(editionId: $e) { total enRetard }
    }
  }`
  type Consulte = {
    perimetre: {
      acces: string
      peutModifier: boolean
      taches: {
        id: string
        peutModifier: boolean
        clotureePar: { id: string } | null
        assignes: { id: string; nom: string }[]
      }[]
      referents: { id: string; nom: string }[]
      avancement: { total: number; enRetard: number }
    }
  }
  let tache = ''

  beforeAll(async () => {
    tache = (await creerTache(ids.alice, 'Chronométrer les séries')).id
    const faite = await executer(
      ids.alice,
      `mutation ($id: ID!) { changerStatutTache(id: $id, statut: FAITE) { id } }`,
      { id: tache }
    )
    expect(faite.errors).toBeUndefined()
  })

  it('ouvre les tâches, l’équipe et l’avancement sans droit d’écriture', async () => {
    const r = await executer(ids.chloe, CONSULTER, {
      s: `natation-${suffixe}`,
      e: ids.edition,
    })
    expect(r.errors).toBeUndefined()
    const { perimetre } = r.data as Consulte
    expect(perimetre.acces).toBe('CONSULTATION')
    expect(perimetre.peutModifier).toBe(false)
    expect(perimetre.referents.map(p => p.id).sort()).toEqual(
      [ids.alice, ids.bruno].sort()
    )
    expect(perimetre.avancement.total).toBeGreaterThan(0)
    const lue = perimetre.taches.find(t => t.id === tache)
    expect(lue?.peutModifier).toBe(false)
    expect(lue?.assignes.map(p => p.id)).toEqual([ids.alice])
    // Qui a coché reste réservé à la personne qui a coché et aux admins.
    expect(lue?.clotureePar).toBeNull()
  })

  it('garde l’accès complet à la référente du périmètre', async () => {
    const r = await executer(ids.alice, CONSULTER, {
      s: `natation-${suffixe}`,
      e: ids.edition,
    })
    expect(r.errors).toBeUndefined()
    const { perimetre } = r.data as Consulte
    expect(perimetre.acces).toBe('COMPLET')
    expect(perimetre.peutModifier).toBe(true)
    expect(perimetre.taches.find(t => t.id === tache)?.clotureePar?.id).toBe(
      ids.alice
    )
  })

  it('refuse les fiches du périmètre consulté', async () => {
    const r = await executer(
      ids.chloe,
      `query ($s: String!) { perimetre(slug: $s) { fiches { id } } }`,
      { s: `natation-${suffixe}` }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse l’adresse des référentes et référents consultés', async () => {
    const r = await executer(
      ids.chloe,
      `query ($s: String!, $e: ID!) {
        perimetre(slug: $s) { referents(editionId: $e) { id email } }
      }`,
      { s: `natation-${suffixe}`, e: ids.edition }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse le changement de statut et l’assignation', async () => {
    const statut = await executer(
      ids.chloe,
      `mutation ($id: ID!) { changerStatutTache(id: $id, statut: EN_COURS) { id } }`,
      { id: tache }
    )
    expect(code(statut)).toBe('FORBIDDEN')
    const assignation = await executer(
      ids.chloe,
      `mutation ($id: ID!) { assignerTache(id: $id, assigne: true) { id } }`,
      { id: tache }
    )
    expect(code(assignation)).toBe('FORBIDDEN')
    const enBase = await prisma.tache.findUniqueOrThrow({
      where: { id: tache },
      select: { statut: true, assignations: { select: { userId: true } } },
    })
    expect(enBase.statut).toBe('FAITE')
    expect(enBase.assignations.map(a => a.userId)).toEqual([ids.alice])
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
    const n = await prisma.journal.count({
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
          organisationId: ORGANISATION,
          activiteId: ACTIVITE,
          groupe: 'sport',
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

  it('refuse un membre sans affectation dans l’activité', async () => {
    expect(code(await executer(ids.emma, Q, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
  })

  // ADR 0014 : le rétroplanning couvre tous les périmètres actifs de l'activité.
  it('donne à une référente les tâches des autres périmètres actifs', async () => {
    const lues = await lire(ids.chloe)
    expect(lues).toEqual([
      taches.basketMars,
      taches.natationMai,
      taches.basketJuin,
      taches.natationSansEcheance,
    ])
    expect(lues).not.toContain(taches.escrimeAvril)
  })

  it('ne propose pas à une référente les tâches à prendre d’un périmètre consulté', async () => {
    const r = await executer(
      ids.chloe,
      `query ($e: ID!) { tachesAPrendre(editionId: $e) { id } }`,
      { e: ids.edition }
    )
    expect(r.errors).toBeUndefined()
    const aPrendre = (
      r.data as { tachesAPrendre: { id: string }[] }
    ).tachesAPrendre.map(t => t.id)
    expect(aPrendre).toContain(taches.basketMars)
    expect(aPrendre).not.toContain(taches.natationMai)
  })

  it('ouvre le rétroplanning à une personne affectée à une édition archivée', async () => {
    expect(await lire(ids.dora)).toEqual([
      taches.basketMars,
      taches.natationMai,
      taches.basketJuin,
      taches.natationSansEcheance,
    ])
    // Son ancien périmètre garde la règle de lecture ; l'autre s'ouvre en consultation.
    const ACCES = `query ($s: String!, $e: ID!) { perimetre(slug: $s) { acces taches(editionId: $e) { id } } }`
    const acces = async (slug: string) => {
      const r = await executer(ids.dora, ACCES, { s: slug, e: ids.edition })
      expect(r.errors).toBeUndefined()
      return (r.data as { perimetre: { acces: string } }).perimetre.acces
    }
    expect(await acces(`natation-${suffixe}`)).toBe('COMPLET')
    expect(await acces(`basket-${suffixe}`)).toBe('CONSULTATION')
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

// Une assignation survit au retrait de l'affectation : la tâche reste dans « Vos
// tâches » alors que l'écriture est refusée. Le champ porte ce droit jusqu'à la
// carte, qui masque alors ses actions au lieu de les proposer en vain.
describe('droit d’écriture porté par la tâche', () => {
  const MES_TACHES = `query ($e: ID!) { mesTaches(editionId: $e) { id peutModifier } }`

  const mesTaches = async (userId: string) => {
    const r = await executer(userId, MES_TACHES, { e: ids.edition })
    expect(r.errors).toBeUndefined()
    return (r.data as { mesTaches: { id: string; peutModifier: boolean }[] })
      .mesTaches
  }

  it('refuse la modification à une personne assignée sans affectation', async () => {
    const tache = await creerTache(ids.bruno, 'Compter les bonnets', false)
    await prisma.tacheAssignation.create({
      data: { tacheId: tache.id, userId: ids.dora },
    })

    const lue = (await mesTaches(ids.dora)).find(t => t.id === tache.id)
    expect(lue?.peutModifier).toBe(false)

    const ecriture = await executer(
      ids.dora,
      `mutation ($id: ID!) { changerStatutTache(id: $id, statut: FAITE) { id } }`,
      { id: tache.id }
    )
    expect(code(ecriture)).toBe('FORBIDDEN')
  })

  it('accorde la modification à une référente affectée à l’édition', async () => {
    const tache = await creerTache(ids.alice, 'Ranger les plots')
    const lue = (await mesTaches(ids.alice)).find(t => t.id === tache.id)
    expect(lue?.peutModifier).toBe(true)
  })

  it('refuse la modification sur une édition archivée', async () => {
    const tache = await prisma.tache.create({
      data: {
        perimetreId: ids.natation,
        editionId: ids.archivee,
        titre: 'Classer les résultats',
        creeParId: ids.admin,
      },
    })
    const r = await executer(
      ids.alice,
      `query ($s: String!, $e: ID!) {
        perimetre(slug: $s) { taches(editionId: $e) { id peutModifier } }
      }`,
      { s: `natation-${suffixe}`, e: ids.archivee }
    )
    expect(r.errors).toBeUndefined()
    const taches = (
      r.data as {
        perimetre: { taches: { id: string; peutModifier: boolean }[] }
      }
    ).perimetre.taches
    expect(taches.find(t => t.id === tache.id)?.peutModifier).toBe(false)
  })
})

// Deux personnes qui écrivent la même tâche ne s'écrasent pas : une modification
// porte la version lue, un changement de statut le statut vu, et une écriture
// simultanée ne produit ni second journal ni seconde notification.
describe('travail à plusieurs', () => {
  const MODIFIER = `mutation ($id: ID!, $t: String, $d: String, $v: Int) {
    modifierTache(id: $id, titre: $t, description: $d, versionAttendue: $v) { titre description version }
  }`
  const STATUT = `mutation ($id: ID!, $s: StatutTache!, $a: StatutTache) {
    changerStatutTache(id: $id, statut: $s, statutAttendu: $a) { statut }
  }`
  const ASSIGNER = `mutation ($id: ID!, $a: Boolean!) { assignerTache(id: $id, assigne: $a) { id } }`
  const journal = (
    tacheId: string,
    type:
      'TACHE_MODIFIEE' | 'TACHE_STATUT' | 'TACHE_ASSIGNEE' | 'TACHE_DESASSIGNEE'
  ) => prisma.journal.count({ where: { tacheId, type } })
  const enBase = (id: string) =>
    prisma.tache.findUniqueOrThrow({
      where: { id },
      include: { assignations: true },
    })
  const extensions = (r: Awaited<ReturnType<typeof executer>>) =>
    r.errors?.[0]?.extensions

  it('refuse d’écraser une modification faite depuis la version lue', async () => {
    const tache = await creerTache(ids.alice, 'Réserver le bassin', false)
    // Alice et Bruno lisent la version 0. Bruno enregistre le premier.
    const parBruno = await executer(ids.bruno, MODIFIER, {
      id: tache.id,
      t: 'Réserver le grand bassin',
      v: 0,
    })
    expect(parBruno.data).toMatchObject({ modifierTache: { version: 1 } })

    const parAlice = await executer(ids.alice, MODIFIER, {
      id: tache.id,
      t: 'Réserver le petit bassin',
      v: 0,
    })
    expect(code(parAlice)).toBe('CONFLIT_VERSION')
    expect(extensions(parAlice)).toMatchObject({
      versionCourante: 1,
      modifieePar: `bruno ${suffixe}`,
    })
    expect(
      Number.isNaN(Date.parse(String(extensions(parAlice)?.modifieeLe)))
    ).toBe(false)
    expect(await enBase(tache.id)).toMatchObject({
      titre: 'Réserver le grand bassin',
      version: 1,
    })
    expect(await journal(tache.id, 'TACHE_MODIFIEE')).toBe(1)

    // Alice écrase en connaissance de cause : elle porte la version actuelle.
    const ecrase = await executer(ids.alice, MODIFIER, {
      id: tache.id,
      t: 'Réserver le petit bassin',
      v: 1,
    })
    expect(ecrase.data).toMatchObject({
      modifierTache: { titre: 'Réserver le petit bassin', version: 2 },
    })
  })

  it('refuse l’accès avant de dire un conflit', async () => {
    const tache = await creerTache(ids.alice, 'Louer les plots', false)
    await executer(ids.alice, MODIFIER, { id: tache.id, t: 'Louer des plots' })
    // Une version périmée ne renseigne pas une personne sans droit d'écriture.
    for (const personne of [ids.chloe, ids.emma, null]) {
      const r = await executer(personne, MODIFIER, {
        id: tache.id,
        t: 'Intrusion',
        v: 0,
      })
      expect(code(r)).toBe('FORBIDDEN')
      const s = await executer(personne, STATUT, {
        id: tache.id,
        s: 'FAITE',
        a: 'EN_COURS',
      })
      expect(code(s)).toBe('FORBIDDEN')
    }
    expect((await enBase(tache.id)).titre).toBe('Louer des plots')
  })

  it('ne change pas un champ absent, et efface un champ nul', async () => {
    const tache = await creerTache(ids.alice, 'Afficher les horaires', false)
    await executer(ids.alice, MODIFIER, {
      id: tache.id,
      d: 'Devant le vestiaire.',
    })
    expect(await enBase(tache.id)).toMatchObject({
      titre: 'Afficher les horaires',
      description: 'Devant le vestiaire.',
      version: 1,
    })
    // Sans version attendue, la dernière écriture gagne.
    await executer(ids.bruno, MODIFIER, {
      id: tache.id,
      t: 'Afficher les horaires du samedi',
    })
    expect(await enBase(tache.id)).toMatchObject({
      titre: 'Afficher les horaires du samedi',
      description: 'Devant le vestiaire.',
      version: 2,
    })
    await executer(ids.alice, MODIFIER, { id: tache.id, d: null })
    expect((await enBase(tache.id)).description).toBeNull()
    // Une modification sans aucun champ n'écrit rien.
    const vide = await executer(ids.alice, MODIFIER, { id: tache.id })
    expect(vide.errors).toBeUndefined()
    expect((await enBase(tache.id)).version).toBe(3)
    expect(await journal(tache.id, 'TACHE_MODIFIEE')).toBe(3)
  })

  it('ne journalise pas un statut déjà atteint, et garde la personne qui a coché', async () => {
    const tache = await creerTache(ids.alice, 'Compter les bonnets', false)
    const cocher = (userId: string) =>
      executer(userId, STATUT, { id: tache.id, s: 'FAITE' })
    expect((await cocher(ids.alice)).errors).toBeUndefined()
    expect((await cocher(ids.bruno)).data).toEqual({
      changerStatutTache: { statut: 'FAITE' },
    })
    expect((await enBase(tache.id)).clotureeParId).toBe(ids.alice)
    expect(await journal(tache.id, 'TACHE_STATUT')).toBe(1)

    // Les deux personnes cochent une autre tâche au même instant.
    const autre = await creerTache(ids.alice, 'Compter les planches', false)
    const reponses = await Promise.all(
      [ids.alice, ids.bruno].map(userId =>
        executer(userId, STATUT, { id: autre.id, s: 'FAITE' })
      )
    )
    for (const r of reponses) {
      expect(r.data).toEqual({ changerStatutTache: { statut: 'FAITE' } })
    }
    expect(await journal(autre.id, 'TACHE_STATUT')).toBe(1)
    expect([ids.alice, ids.bruno]).toContain(
      (await enBase(autre.id)).clotureeParId
    )
  })

  it('refuse de changer un statut qui a changé depuis la lecture, sans nommer personne', async () => {
    const tache = await creerTache(ids.alice, 'Tester le chronomètre', false)
    await executer(ids.alice, STATUT, { id: tache.id, s: 'FAITE' })
    // Bruno voit encore la tâche « à faire », et veut l'abandonner.
    const perime = await executer(ids.bruno, STATUT, {
      id: tache.id,
      s: 'ABANDONNEE',
      a: 'A_FAIRE',
    })
    expect(code(perime)).toBe('CONFLIT_VERSION')
    expect(extensions(perime)).toMatchObject({ statutCourant: 'FAITE' })
    // Qui a coché reste réservé à la personne qui a coché et aux admins.
    expect(JSON.stringify(perime.errors)).not.toContain(`alice ${suffixe}`)
    expect(extensions(perime)).not.toHaveProperty('modifieePar')
    expect(await enBase(tache.id)).toMatchObject({
      statut: 'FAITE',
      clotureeParId: ids.alice,
    })

    const voulu = await executer(ids.bruno, STATUT, {
      id: tache.id,
      s: 'ABANDONNEE',
      a: 'FAITE',
    })
    expect(voulu.data).toEqual({ changerStatutTache: { statut: 'ABANDONNEE' } })
  })

  it('n’assigne et ne retire qu’une fois deux demandes simultanées', async () => {
    const tache = await creerTache(ids.alice, 'Gonfler les bouées', false)
    const deuxFois = (assigne: boolean) =>
      Promise.all(
        [1, 2].map(() =>
          executer(ids.alice, ASSIGNER, { id: tache.id, a: assigne })
        )
      )
    for (const r of await deuxFois(true)) expect(r.errors).toBeUndefined()
    expect((await enBase(tache.id)).assignations).toHaveLength(1)
    expect(await journal(tache.id, 'TACHE_ASSIGNEE')).toBe(1)

    for (const r of await deuxFois(false)) expect(r.errors).toBeUndefined()
    expect((await enBase(tache.id)).assignations).toHaveLength(0)
    expect(await journal(tache.id, 'TACHE_DESASSIGNEE')).toBe(1)
  })
})
