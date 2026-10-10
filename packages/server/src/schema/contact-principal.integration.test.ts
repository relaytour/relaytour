import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'
import { organisationParDefaut } from '../lib/organisation.ts'
import { activiteParDefaut, contexteDeTest } from '../test/contexte.ts'

import { schema } from './index.ts'

// Contact principal d'un périmètre (ADR 0011). La désignation est réservée aux
// admins de l'activité et ne donne aucun droit : les refus se prouvent par l'échec
// de la mutation et par l'échec des actions réservées aux admins.
// La base de développement est partagée : les assertions ne portent que sur les
// données créées par ce fichier.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  alice: '', // référente natation
  bruno: '', // référent natation
  chloe: '', // référente basket
  edition: '',
  archivee: '',
  natation: '',
  basket: '',
  tache: '',
  affAlice: '',
  affBruno: '',
  affChloe: '',
  affArchivee: '',
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

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const DEFINIR = `mutation ($id: ID!, $c: Boolean!) {
  definirContactPrincipal(affectationId: $id, contactPrincipal: $c)
}`

const PERIMETRE = `query ($a: ID, $slug: String!, $e: ID!) {
  perimetre(slug: $slug, activiteId: $a) {
    referents(editionId: $e) { id }
    contactPrincipal(editionId: $e) { id }
  }
}`

/** Les affectations marquées comme contact principal, parmi celles du fichier. */
async function contacts(): Promise<string[]> {
  const lignes = await prisma.affectation.findMany({
    where: {
      id: {
        in: [ids.affAlice, ids.affBruno, ids.affChloe, ids.affArchivee],
      },
      contactPrincipal: true,
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  return lignes.map(l => l.id)
}

let ACTIVITE = ''

beforeAll(async () => {
  const organisationId = await organisationParDefaut()
  ACTIVITE = await activiteParDefaut()
  await apollo.start()
  for (const [cle, estAdmin, nom] of [
    ['admin', true, 'Admin'],
    ['alice', false, 'Zoé'],
    ['bruno', false, 'Bruno'],
    ['chloe', false, 'Chloé'],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${s}@exemple.fr`,
        name: `${nom} ${s}`,
        isAdmin: estAdmin,
      },
    })
  }
  const annee = 9100 + Math.floor(Math.random() * 800)
  for (const [cle, decalage, statut] of [
    ['edition', 0, 'PREPARATION'],
    ['archivee', 1, 'ARCHIVEE'],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId,
          activiteId: ACTIVITE,
          annee: annee - decalage,
          nom: `Contact ${cle} ${s}`,
          debut: new Date('2027-08-27'),
          fin: new Date('2027-08-29'),
          statut,
        },
      })
    ).id
  }
  for (const [cle, nom] of [
    ['natation', 'Natation'],
    ['basket', 'Basket'],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId,
          activiteId: ACTIVITE,
          groupe: 'sport',
          slug: `${cle}-contact-${s}`,
          nom: `${nom} ${s}`,
          type: 'SPORT',
        },
      })
    ).id
  }
  for (const [cle, userId, perimetreId, editionId] of [
    ['affAlice', ids.alice, ids.natation, ids.edition],
    ['affBruno', ids.bruno, ids.natation, ids.edition],
    ['affChloe', ids.chloe, ids.basket, ids.edition],
    ['affArchivee', ids.alice, ids.natation, ids.archivee],
  ] as const) {
    ids[cle] = (
      await prisma.affectation.create({
        data: { userId, perimetreId, editionId },
      })
    ).id
  }
  ids.tache = (
    await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.natation,
        titre: `Tâche contact ${s}`,
      },
    })
  ).id
})

afterAll(async () => {
  const perimetres = [ids.natation, ids.basket]
  await prisma.notification.deleteMany({
    where: { perimetreId: { in: perimetres } },
  })
  await prisma.journal.deleteMany({
    where: { perimetreId: { in: perimetres } },
  })
  await prisma.tache.deleteMany({ where: { perimetreId: { in: perimetres } } })
  await prisma.affectation.deleteMany({
    where: { perimetreId: { in: perimetres } },
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

describe('definirContactPrincipal', () => {
  it('refuse une requête sans session, sans rien écrire', async () => {
    const r = await executer(null, DEFINIR, { id: ids.affAlice, c: true })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await contacts()).toEqual([])
  })

  it('refuse une référente du périmètre, sans rien écrire', async () => {
    const r = await executer(ids.alice, DEFINIR, { id: ids.affAlice, c: true })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await contacts()).toEqual([])
  })

  it('répond faux pour une affectation inconnue', async () => {
    const r = await executer(ids.admin, DEFINIR, { id: 'inconnue', c: true })
    expect(r.errors).toBeUndefined()
    expect(r.data?.definirContactPrincipal).toBe(false)
  })

  it('refuse une édition archivée', async () => {
    const r = await executer(ids.admin, DEFINIR, {
      id: ids.affArchivee,
      c: true,
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await contacts()).toEqual([])
  })

  it('désigne le contact principal d’un admin de l’activité', async () => {
    const r = await executer(ids.admin, DEFINIR, { id: ids.affAlice, c: true })
    expect(r.errors).toBeUndefined()
    expect(r.data?.definirContactPrincipal).toBe(true)
    expect(await contacts()).toEqual([ids.affAlice])
  })

  it('garde un seul contact principal par périmètre et par édition', async () => {
    await executer(ids.admin, DEFINIR, { id: ids.affChloe, c: true })
    const r = await executer(ids.admin, DEFINIR, { id: ids.affBruno, c: true })
    expect(r.errors).toBeUndefined()
    // Bruno remplace Zoé en natation ; Chloé reste le contact du basket.
    expect(await contacts()).toEqual([ids.affBruno, ids.affChloe].sort())
  })

  it('retire la désignation', async () => {
    const r = await executer(ids.admin, DEFINIR, { id: ids.affChloe, c: false })
    expect(r.errors).toBeUndefined()
    expect(await contacts()).toEqual([ids.affBruno])
  })
})

describe('lecture du contact principal', () => {
  it('place le contact principal en tête des référent·es, lisible par une référente', async () => {
    // Par ordre alphabétique, Bruno précède Zoé. Zoé, désignée, doit passer devant.
    await executer(ids.admin, DEFINIR, { id: ids.affAlice, c: true })
    const lire = async () =>
      (
        (
          await executer(ids.bruno, PERIMETRE, {
            a: ACTIVITE,
            slug: `natation-contact-${s}`,
            e: ids.edition,
          })
        ).data as {
          perimetre: {
            referents: { id: string }[]
            contactPrincipal: { id: string } | null
          }
        }
      ).perimetre
    const avecZoe = await lire()
    expect(avecZoe.contactPrincipal?.id).toBe(ids.alice)
    expect(avecZoe.referents.map(p => p.id)).toEqual([ids.alice, ids.bruno])
    // Bruno redevient le contact, pour les cas suivants.
    await executer(ids.admin, DEFINIR, { id: ids.affBruno, c: true })
    const avecBruno = await lire()
    expect(avecBruno.contactPrincipal?.id).toBe(ids.bruno)
    expect(avecBruno.referents.map(p => p.id)).toEqual([ids.bruno, ids.alice])
    expect(await contacts()).toEqual([ids.affBruno])
  })

  it('renvoie null pour un périmètre sans contact principal', async () => {
    const r = await executer(ids.chloe, PERIMETRE, {
      a: ACTIVITE,
      slug: `basket-contact-${s}`,
      e: ids.edition,
    })
    expect(r.errors).toBeUndefined()
    expect(
      (r.data as { perimetre: { contactPrincipal: unknown } }).perimetre
        .contactPrincipal
    ).toBeNull()
  })
})

describe('le contact principal ne reçoit aucun droit', () => {
  it('ne peut pas désigner un autre contact principal', async () => {
    const r = await executer(ids.bruno, DEFINIR, { id: ids.affAlice, c: true })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await contacts()).toEqual([ids.affBruno])
  })

  it('ne peut pas fixer l’effectif du périmètre', async () => {
    const r = await executer(
      ids.bruno,
      `mutation ($p: ID!, $e: ID!) { definirEffectif(perimetreId: $p, editionId: $e, effectif: 3) }`,
      { p: ids.natation, e: ids.edition }
    )
    expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.effectifPerimetre.count({
        where: { perimetreId: ids.natation },
      })
    ).toBe(0)
  })
})
