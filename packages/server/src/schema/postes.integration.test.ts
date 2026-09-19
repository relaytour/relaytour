import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { env } from '../env.ts'

import { schema } from './index.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

// Postes à pourvoir et effectifs. Les contrôles d'accès se prouvent par le refus.
// La base de développement est partagée : les assertions ne portent que sur les
// périmètres créés par ce fichier.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  referente: '', // référente natation pour l'édition en cours
  bruno: '', // référent basket pour l'édition en cours
  ancienne: '', // compte archivé, encore affecté au volley
  edition: '',
  archivee: '',
  natation: '',
  volley: '',
  basket: '',
  communication: '',
  logistique: '', // périmètre archivé
}
let annee = 0

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const DEFINIR = `mutation ($p: ID!, $e: ID!, $n: Int!) {
  definirEffectif(perimetreId: $p, editionId: $e, effectif: $n)
}`

const POSTES = `query ($e: ID!) {
  postesAPourvoir(editionId: $e) {
    effectif
    aPourvoir
    etat
    perimetre { id nom }
    affectations { id personne { id } }
  }
}`

interface LignePostes {
  effectif: number | null
  aPourvoir: number
  etat: string
  perimetre: { id: string; nom: string }
  affectations: { id: string; personne: { id: string } }[]
}

const effectifsDe = (perimetreId: string) =>
  prisma.effectifPerimetre.count({ where: { perimetreId } })

let ORGANISATION = ''

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  await apollo.start()
  for (const [cle, estAdmin, archive] of [
    ['admin', true, false],
    ['referente', false, false],
    ['bruno', false, false],
    ['ancienne', false, true],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${s}@exemple.fr`,
        name: `${cle} ${s}`,
        isAdmin: estAdmin,
        archivedAt: archive ? new Date() : null,
      },
    })
  }
  annee = 9100 + Math.floor(Math.random() * 800)
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
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
        annee: annee - 1,
        nom: `Archive ${s}`,
        debut: new Date('2025-08-27'),
        fin: new Date('2025-08-29'),
        statut: 'ARCHIVEE',
      },
    })
  ).id
  for (const [cle, nom, type, ordre, archive] of [
    ['natation', 'Natation', 'SPORT', 1, false],
    ['volley', 'Volley', 'SPORT', 2, false],
    ['basket', 'Basket', 'SPORT', 3, false],
    ['communication', 'Communication', 'POLE', 1, false],
    ['logistique', 'Logistique', 'POLE', 2, true],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ORGANISATION,
        slug: `${cle}-${s}`,
          nom: `${nom} ${s}`,
          type,
          ordre,
          archivedAt: archive ? new Date() : null,
        },
      })
    ).id
  }
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.referente,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
      { userId: ids.bruno, perimetreId: ids.basket, editionId: ids.edition },
      { userId: ids.ancienne, perimetreId: ids.volley, editionId: ids.edition },
    ],
  })
})

afterAll(async () => {
  const perimetres = [
    ids.natation,
    ids.volley,
    ids.basket,
    ids.communication,
    ids.logistique,
  ]
  await prisma.effectifPerimetre.deleteMany({
    where: { perimetreId: { in: perimetres } },
  })
  await prisma.affectation.deleteMany({
    where: { editionId: { in: [ids.edition, ids.archivee] } },
  })
  await prisma.perimetre.deleteMany({ where: { id: { in: perimetres } } })
  await prisma.edition.deleteMany({
    where: { id: { in: [ids.edition, ids.archivee] } },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('definirEffectif', () => {
  it('refuse une référente du périmètre, sans rien écrire', async () => {
    const r = await executer(ids.referente, DEFINIR, {
      p: ids.natation,
      e: ids.edition,
      n: 3,
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await effectifsDe(ids.natation)).toBe(0)
  })

  it('refuse une requête sans session', async () => {
    const r = await executer(null, DEFINIR, {
      p: ids.natation,
      e: ids.edition,
      n: 3,
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await effectifsDe(ids.natation)).toBe(0)
  })

  it('refuse un effectif hors des bornes 0 et 50', async () => {
    for (const n of [-1, 51]) {
      const r = await executer(ids.admin, DEFINIR, {
        p: ids.natation,
        e: ids.edition,
        n,
      })
      expect(code(r)).toBe('SAISIE_INVALIDE')
    }
    expect(await effectifsDe(ids.natation)).toBe(0)
    for (const n of [0, 50]) {
      const r = await executer(ids.admin, DEFINIR, {
        p: ids.natation,
        e: ids.edition,
        n,
      })
      expect(r.errors).toBeUndefined()
      expect(r.data).toEqual({ definirEffectif: n })
    }
  })

  it('refuse une édition archivée', async () => {
    const r = await executer(ids.admin, DEFINIR, {
      p: ids.volley,
      e: ids.archivee,
      n: 2,
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toMatch(/archivée/)
    expect(await effectifsDe(ids.volley)).toBe(0)
  })

  it('refuse un périmètre inconnu', async () => {
    const r = await executer(ids.admin, DEFINIR, {
      p: `inconnu-${s}`,
      e: ids.edition,
      n: 2,
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toMatch(/introuvable/)
  })

  it('met à jour la ligne existante sans créer de doublon', async () => {
    for (const n of [2, 3]) {
      const r = await executer(ids.admin, DEFINIR, {
        p: ids.natation,
        e: ids.edition,
        n,
      })
      expect(r.errors).toBeUndefined()
    }
    const lignes = await prisma.effectifPerimetre.findMany({
      where: { perimetreId: ids.natation, editionId: ids.edition },
    })
    expect(lignes.map(l => l.effectif)).toEqual([3])
  })
})

describe('postesAPourvoir', () => {
  let lignes: LignePostes[] = []

  beforeAll(async () => {
    // Natation vaut 3 depuis le bloc précédent. Volley reste sans effectif.
    await prisma.effectifPerimetre.createMany({
      data: [
        { perimetreId: ids.basket, editionId: ids.edition, effectif: 1 },
        { perimetreId: ids.communication, editionId: ids.edition, effectif: 2 },
        { perimetreId: ids.logistique, editionId: ids.edition, effectif: 2 },
      ],
    })
    const r = await executer(ids.admin, POSTES, { e: ids.edition })
    expect(r.errors).toBeUndefined()
    const toutes = (r.data as { postesAPourvoir: LignePostes[] })
      .postesAPourvoir
    const nosPerimetres = new Set(Object.values(ids))
    lignes = toutes.filter(l => nosPerimetres.has(l.perimetre.id))
  })

  it('refuse une référente', async () => {
    const r = await executer(ids.referente, POSTES, { e: ids.edition })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse une édition inconnue', async () => {
    const r = await executer(ids.admin, POSTES, { e: `inconnue-${s}` })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('trie par état, postes à pourvoir, type puis ordre', () => {
    expect(
      lignes.map(l => [l.perimetre.id, l.etat, l.aPourvoir, l.effectif])
    ).toEqual([
      [ids.communication, 'SANS_PERSONNE', 2, 2],
      [ids.volley, 'SANS_PERSONNE', 1, null],
      [ids.natation, 'INCOMPLET', 2, 3],
      [ids.basket, 'COMPLET', 0, 1],
    ])
  })

  it('attend au moins une personne quand l’effectif n’est pas défini', () => {
    const volley = lignes.find(l => l.perimetre.id === ids.volley)
    expect(volley).toMatchObject({
      effectif: null,
      aPourvoir: 1,
      etat: 'SANS_PERSONNE',
      affectations: [],
    })
  })

  it('renvoie les personnes affectées', () => {
    const natation = lignes.find(l => l.perimetre.id === ids.natation)
    expect(natation?.affectations.map(a => a.personne.id)).toEqual([
      ids.referente,
    ])
  })

  it('ne compte pas l’affectation d’un compte archivé', () => {
    const volley = lignes.find(l => l.perimetre.id === ids.volley)
    expect(volley?.affectations.map(a => a.personne.id)).not.toContain(
      ids.ancienne
    )
    expect(volley?.etat).toBe('SANS_PERSONNE')
  })

  it('exclut les périmètres archivés', () => {
    expect(lignes.map(l => l.perimetre.id)).not.toContain(ids.logistique)
  })

  it('prépare un appel qui liste les périmètres à pourvoir et exclut les complets', async () => {
    const r = await executer(
      ids.admin,
      'query ($e: ID!) { appelPostes(editionId: $e) }',
      { e: ids.edition }
    )
    expect(r.errors).toBeUndefined()
    const appel = (r.data as { appelPostes: string | null }).appelPostes ?? ''
    expect(appel).toContain(`${env.ORGANISATION_NOM} ${annee}`)
    expect(appel).toContain(`- Natation ${s}`)
    expect(appel).toContain(`- Volley ${s}`)
    expect(appel).toContain(`- Communication ${s}`)
    expect(appel).not.toContain(`Basket ${s}`)
    expect(appel).not.toContain(`Logistique ${s}`)
  })
})
