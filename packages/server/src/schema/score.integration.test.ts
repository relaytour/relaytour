import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'
import { contexteDeTest } from '../test/contexte.ts'
import { calculerScores } from '../lib/score.ts'

import { schema } from './index.ts'
import { activiteParDefaut } from '../lib/activites.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  alice: '',
  bruno: '',
  perimetre: '',
  edition: '',
  fiche: '',
}

async function executer(
  userId: string,
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

async function tacheFaite(donnees: {
  titre: string
  echeance: string
  termineeLe: string
  clotureeParId: string
  realiseeParId?: string
  creeParId?: string
}) {
  return prisma.tache.create({
    data: {
      editionId: ids.edition,
      perimetreId: ids.perimetre,
      titre: donnees.titre,
      statut: 'FAITE',
      echeance: new Date(donnees.echeance),
      termineeLe: new Date(donnees.termineeLe),
      clotureeParId: donnees.clotureeParId,
      realiseeParId: donnees.realiseeParId ?? null,
      creeParId: donnees.creeParId ?? null,
    },
  })
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
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${s}@exemple.fr`,
        name: cle,
        isAdmin: estAdmin,
      },
    })
  }
  // Une édition en 2099 : aucune autre donnée de la base ne tombe dans sa période.
  const annee = 5000 + Math.floor(Math.random() * 4000)
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        annee,
        nom: `Essai ${s}`,
        debut: new Date('2099-08-27'),
        fin: new Date('2099-08-29'),
      },
    })
  ).id
  ids.perimetre = (
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
  ids.fiche = (
    await prisma.fiche.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        slug: `fiche-${s}`,
        perimetreId: ids.perimetre,
      },
    })
  ).id
})

afterAll(async () => {
  await prisma.journal.deleteMany({ where: { ficheId: ids.fiche } })
  await prisma.fiche.delete({ where: { id: ids.fiche } })
  await prisma.tache.deleteMany({ where: { editionId: ids.edition } })
  await prisma.edition.delete({ where: { id: ids.edition } })
  await prisma.perimetre.delete({ where: { id: ids.perimetre } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('barème', () => {
  it('crédite la personne réalisatrice plutôt que celle qui a coché, avec le bonus à temps', async () => {
    await tacheFaite({
      titre: 'À temps',
      echeance: '2099-08-10',
      termineeLe: '2099-08-10T20:00:00Z',
      clotureeParId: ids.alice,
      realiseeParId: ids.bruno,
      creeParId: ids.alice,
    })
    const scores = await calculerScores(prisma, ids.edition)
    expect(scores.get(ids.bruno)).toMatchObject({
      points: 4,
      tachesRealisees: 1,
      tachesATemps: 1,
    })
    expect(scores.get(ids.alice)).toMatchObject({
      points: 1,
      tachesCreees: 1,
      tachesRealisees: 0,
    })
  })

  it('ne donne pas de bonus à une tâche faite en retard', async () => {
    const tache = await tacheFaite({
      titre: 'En retard',
      echeance: '2099-08-01',
      termineeLe: '2099-08-05T10:00:00Z',
      clotureeParId: ids.alice,
    })
    const alice = (await calculerScores(prisma, ids.edition)).get(ids.alice)
    expect(alice).toMatchObject({
      points: 4,
      tachesRealisees: 1,
      tachesATemps: 0,
    })
    await prisma.tache.delete({ where: { id: tache.id } })
  })

  it('retire les points d’une tâche rouverte', async () => {
    const tache = await tacheFaite({
      titre: 'Rouverte',
      echeance: '2099-08-10',
      termineeLe: '2099-08-09T10:00:00Z',
      clotureeParId: ids.alice,
    })
    const avant = (await calculerScores(prisma, ids.edition)).get(
      ids.alice
    )!.points
    await prisma.tache.update({
      where: { id: tache.id },
      data: { statut: 'A_FAIRE', termineeLe: null, clotureeParId: null },
    })
    const apres = (await calculerScores(prisma, ids.edition)).get(
      ids.alice
    )!.points
    expect(avant - apres).toBe(4)
    await prisma.tache.delete({ where: { id: tache.id } })
  })

  it('compte une modification de fiche au plus une fois par jour', async () => {
    const jour = new Date('2099-07-01T09:00:00Z')
    await prisma.journal.createMany({
      data: [
        {
          type: 'FICHE_CREEE',
          acteurId: ids.bruno,
          ficheId: ids.fiche,
          createdAt: jour,
        },
        {
          type: 'FICHE_MODIFIEE',
          acteurId: ids.bruno,
          ficheId: ids.fiche,
          createdAt: jour,
        },
        {
          type: 'FICHE_MODIFIEE',
          acteurId: ids.bruno,
          ficheId: ids.fiche,
          createdAt: new Date('2099-07-01T15:00:00Z'),
        },
        {
          type: 'FICHE_MODIFIEE',
          acteurId: ids.bruno,
          ficheId: ids.fiche,
          createdAt: new Date('2099-07-02T15:00:00Z'),
        },
      ],
    })
    const bruno = (await calculerScores(prisma, ids.edition)).get(ids.bruno)
    expect(bruno).toMatchObject({ fichesCreees: 1, fichesModifiees: 2 })
    expect(bruno!.points).toBe(4 + 3 + 2 * 2)
  })
})

describe('visibilité', () => {
  it('refuse le classement à une référente', async () => {
    const r = await executer(
      ids.alice,
      `query ($e: ID!) { classement(editionId: $e) { rang } }`,
      { e: ids.edition }
    )
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN')
  })

  it('donne à chaque personne son propre score seulement', async () => {
    const r = await executer(
      ids.alice,
      `query ($e: ID!) { monScore(editionId: $e) { points } }`,
      { e: ids.edition }
    )
    expect(r.data).toEqual({ monScore: { points: 1 } })
  })

  it('bonus refusé pour une tâche cochée après minuit à Paris', async () => {
    // 23 h 30 UTC le 10 août = 1 h 30 à Paris le 11 août, lendemain de l'échéance.
    const tache = await tacheFaite({
      titre: 'Après minuit',
      echeance: '2099-08-10',
      termineeLe: '2099-08-10T23:30:00Z',
      clotureeParId: ids.admin,
    })
    expect(
      (await calculerScores(prisma, ids.edition)).get(ids.admin)
    ).toMatchObject({
      tachesRealisees: 1,
      tachesATemps: 0,
    })
    await prisma.tache.delete({ where: { id: tache.id } })
  })

  it('partage le rang en cas d’égalité', async () => {
    // Admin : tâche réalisée en retard (3) et créée (1) = 4 points.
    // Alice : 1 tâche créée plus tôt, 3 de plus ici = 4 points. Bruno reste premier.
    await tacheFaite({
      titre: 'Égalité',
      echeance: '2099-08-01',
      termineeLe: '2099-08-05T10:00:00Z',
      clotureeParId: ids.admin,
      creeParId: ids.admin,
    })
    await prisma.tache.createMany({
      data: ['Alice 1', 'Alice 2', 'Alice 3'].map(titre => ({
        editionId: ids.edition,
        perimetreId: ids.perimetre,
        titre,
        creeParId: ids.alice,
      })),
    })
    const r = await executer(
      ids.admin,
      `query ($e: ID!) { classement(editionId: $e) { rang personne { id } score { points } } }`,
      { e: ids.edition }
    )
    const lignes = (
      r.data as {
        classement: {
          rang: number
          personne: { id: string }
          score: { points: number }
        }[]
      }
    ).classement
    const rangs = Object.fromEntries(
      lignes.map(l => [l.personne.id, [l.rang, l.score.points]])
    )
    expect(rangs[ids.bruno]?.[0]).toBe(1)
    expect(rangs[ids.admin]).toEqual([2, 4])
    expect(rangs[ids.alice]).toEqual([2, 4])
    await prisma.tache.deleteMany({
      where: {
        editionId: ids.edition,
        titre: { in: ['Égalité', 'Alice 1', 'Alice 2', 'Alice 3'] },
      },
    })
  })

  it('classe par points pour les admins', async () => {
    const r = await executer(
      ids.admin,
      `query ($e: ID!) { classement(editionId: $e) { rang personne { id } score { points } } }`,
      { e: ids.edition }
    )
    const lignes = (
      r.data as {
        classement: {
          rang: number
          personne: { id: string }
          score: { points: number }
        }[]
      }
    ).classement
    expect(lignes.map(l => [l.personne.id, l.rang])).toEqual([
      [ids.bruno, 1],
      [ids.alice, 2],
    ])
  })
})
