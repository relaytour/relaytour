import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Organigramme d'une activité (ADR 0035). Une adresse personnelle ne s'affiche
// qu'avec deux accords : le réglage de l'activité et celui de la personne. Les
// contrôles se prouvent par le refus (invariant 11). Le fichier crée ses propres
// organisations et ne touche pas à l'organisation par défaut.

const s = randomUUID().slice(0, 8)
const slug = `organigramme-${s}`
const slugAutre = `organigramme-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  autreActivite: '',
  edition: '',
  editionAutre: '',
  natation: '',
  basket: '',
  admin: '', // admin de l'organisation, sans rôle dans l'activité
  adminActivite: '',
  contact: '', // contact principal de la natation
  referent: '', // référent de la natation
  basketteuse: '', // référente du basket, sans accord
  archive: '', // affecté à la natation, archivé dans l'organisation (ADR 0031)
  membre: '', // aucune affectation
  etrangere: '', // référente de l'autre activité seulement
  externe: '', // membre de l'autre organisation seulement
  double: '', // membre des deux organisations
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {},
  organisation = slug
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, organisation) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const ORGANIGRAMME = `query ($a: ID) {
  organigramme(activiteId: $a) {
    edition { id }
    complet
    adresses
    contactActivite
    admins { id: personneId nom adresse moi }
    perimetres { perimetre { slug } referents { id: personneId adresse contactPrincipal } }
  }
}`
const ACCORD = `mutation ($v: Boolean!) { modifierMonAdresseVisible(visible: $v) }`
const MOI = `{ moi { adresseVisible } }`
const REGLER = `mutation ($id: ID!, $r: AdressesOrganigramme, $o: Boolean) {
  modifierActivite(id: $id, nom: "Tournoi", nature: EVENEMENT, groupes: [{ cle: "sport", libelle: "Sport", libellePluriel: "Sports" }], ordre: 0, adressesOrganigramme: $r, souhaitsOuverts: $o) { adressesOrganigramme }
}`

interface Membre {
  id: string
  nom?: string
  adresse: string | null
  contactPrincipal?: boolean
  moi?: boolean
}
interface Lu {
  organigramme: {
    edition: { id: string } | null
    complet: boolean
    adresses: string
    contactActivite: string | null
    admins: Membre[]
    perimetres: { perimetre: { slug: string }; referents: Membre[] }[]
  }
}

async function lire(userId: string) {
  const r = await executer(userId, ORGANIGRAMME, { a: ids.activite })
  expect(r.errors).toBeUndefined()
  return (r.data as unknown as Lu).organigramme
}

const adresseDe = (cle: keyof typeof ids) =>
  `${cle.toLowerCase()}-${slug}@exemple.fr`

/** Les adresses lues, par identifiant de compte, admins et référents confondus. */
function adresses(o: Lu['organigramme']): Record<string, string | null> {
  const lues: Record<string, string | null> = {}
  for (const m of [...o.admins, ...o.perimetres.flatMap(p => p.referents)]) {
    lues[m.id] = m.adresse
  }
  return lues
}

async function regler(reglage: string) {
  const r = await executer(ids.adminActivite, REGLER, {
    id: ids.activite,
    r: reglage,
  })
  expect(r.errors).toBeUndefined()
}

async function accord(userId: string, visible: boolean) {
  const r = await executer(userId, ACCORD, { v: visible })
  expect(r.errors).toBeUndefined()
}

beforeAll(async () => {
  await apollo.start()
  for (const [cle, slugOrg] of [
    ['org', slug],
    ['orgAutre', slugAutre],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: {
          slug: slugOrg,
          nom: `Organisation ${slugOrg}`,
          configuration: {},
        },
      })
    ).id
  }
  for (const [cle, slugActivite, org, identite] of [
    ['activite', slug, ids.org, { contactRecrutement: 'equipe@exemple.fr' }],
    ['autreActivite', `${slug}-b`, ids.org, null],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: org,
          slug: slugActivite,
          nom: 'Tournoi',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
          ...(identite === null ? {} : { identite }),
        },
      })
    ).id
  }
  for (const [cle, activiteId] of [
    ['edition', ids.activite],
    ['editionAutre', ids.autreActivite],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId,
          annee: 2027,
          nom: 'Tournoi 2027',
          debut: new Date('2027-08-27'),
          fin: new Date('2027-08-29'),
          statut: 'PREPARATION',
        },
      })
    ).id
  }
  const perimetreAutre = await prisma.perimetre.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.autreActivite,
      slug: 'tennis',
      nom: 'Tennis',
      type: 'SPORT',
      groupe: 'sport',
    },
  })
  for (const [cle, nom, ordre] of [
    ['natation', 'Natation', 0],
    ['basket', 'Basket', 1],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom,
          ordre,
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    ).id
  }
  for (const [cle, role, organisations] of [
    ['admin', 'ADMIN', [ids.org]],
    ['adminActivite', 'MEMBRE', [ids.org]],
    ['contact', 'MEMBRE', [ids.org]],
    ['referent', 'MEMBRE', [ids.org]],
    ['basketteuse', 'MEMBRE', [ids.org]],
    ['archive', 'MEMBRE', [ids.org]],
    ['membre', 'MEMBRE', [ids.org]],
    ['etrangere', 'MEMBRE', [ids.org]],
    ['externe', 'MEMBRE', [ids.orgAutre]],
    ['double', 'MEMBRE', [ids.org, ids.orgAutre]],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: adresseDe(cle),
        // Les noms fixent l'ordre alphabétique attendu dans un périmètre.
        name: `${cle} ${s}`,
        appartenances: {
          create: organisations.map(organisationId => ({
            organisationId,
            role,
            archiveLe: cle === 'archive' ? new Date() : null,
          })),
        },
      },
    })
  }
  await prisma.adminActivite.create({
    data: {
      userId: ids.adminActivite,
      activiteId: ids.activite,
      organisationId: ids.org,
    },
  })
  for (const [userId, perimetreId, editionId, contactPrincipal] of [
    [ids.contact, ids.natation, ids.edition, true],
    [ids.referent, ids.natation, ids.edition, false],
    [ids.archive, ids.natation, ids.edition, false],
    [ids.double, ids.natation, ids.edition, false],
    [ids.basketteuse, ids.basket, ids.edition, false],
    [ids.etrangere, perimetreAutre.id, ids.editionAutre, false],
  ] as const) {
    await prisma.affectation.create({
      data: { userId, perimetreId, editionId, contactPrincipal },
    })
  }
})

afterAll(async () => {
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.orgAutre] } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('lecture par une personne qui voit l’activité', () => {
  it('présente les admins de l’activité, puis le contact principal en tête', async () => {
    const o = await lire(ids.referent)
    expect(o.complet).toBe(true)
    expect(o.edition?.id).toBe(ids.edition)
    expect(o.contactActivite).toBe('equipe@exemple.fr')
    expect(o.admins.map(m => m.id)).toEqual([ids.adminActivite])
    const natation = o.perimetres.find(p => p.perimetre.slug === 'natation')!
    // La personne archivée n'apparaît pas ; le contact principal ouvre la liste.
    expect(natation.referents.map(m => m.id)).toEqual([
      ids.contact,
      ids.double,
      ids.referent,
    ])
    expect(natation.referents[0]!.contactPrincipal).toBe(true)
    expect(o.perimetres.map(p => p.perimetre.slug)).toEqual([
      'natation',
      'basket',
    ])
  })

  it('n’affiche aucune adresse par défaut, même avec l’accord des personnes', async () => {
    await accord(ids.contact, true)
    await accord(ids.referent, true)
    await accord(ids.adminActivite, true)
    const o = await lire(ids.referent)
    expect(o.adresses).toBe('AUCUNE')
    expect(Object.values(adresses(o)).every(a => a === null)).toBe(true)
  })

  it('ouvre les adresses des admins et des contacts principaux avec CONTACTS', async () => {
    await regler('CONTACTS')
    const lues = adresses(await lire(ids.referent))
    expect(lues[ids.adminActivite]).toBe(adresseDe('adminActivite'))
    expect(lues[ids.contact]).toBe(adresseDe('contact'))
    // Le référent a donné son accord, mais le réglage ne l'ouvre pas.
    expect(lues[ids.referent]).toBeNull()
  })

  it('ouvre les référentes et référents avec REFERENTS, selon leur accord', async () => {
    await regler('REFERENTS')
    const lues = adresses(await lire(ids.basketteuse))
    expect(lues[ids.referent]).toBe(adresseDe('referent'))
    expect(lues[ids.contact]).toBe(adresseDe('contact'))
    // Aucun accord : l'adresse reste vide.
    expect(lues[ids.basketteuse]).toBeNull()
    expect(lues[ids.double]).toBeNull()
  })

  it('referme l’adresse dès que la personne retire son accord', async () => {
    await accord(ids.referent, false)
    const lues = adresses(await lire(ids.contact))
    expect(lues[ids.referent]).toBeNull()
    expect(lues[ids.contact]).toBe(adresseDe('contact'))
  })
})

describe('accord de la personne', () => {
  it('se lit par la personne seule', async () => {
    const r = await executer(ids.contact, MOI)
    expect(r.data).toEqual({ moi: { adresseVisible: true } })
    const equipe = await executer(
      ids.adminActivite,
      `query ($a: ID) { equipe(activiteId: $a) { id adresseVisible } }`,
      { a: ids.activite }
    )
    expect(equipe.errors).toBeUndefined()
    const lignes = (
      equipe.data as {
        equipe: { id: string; adresseVisible: boolean | null }[]
      }
    ).equipe
    expect(lignes.find(l => l.id === ids.contact)?.adresseVisible).toBeNull()
  })

  it('vaut pour l’organisation active seulement', async () => {
    await accord(ids.double, true)
    const appartenances = await prisma.appartenance.findMany({
      where: { userId: ids.double },
      select: { organisationId: true, adresseVisible: true },
    })
    expect(
      Object.fromEntries(
        appartenances.map(a => [a.organisationId, a.adresseVisible])
      )
    ).toEqual({ [ids.org]: true, [ids.orgAutre]: false })
    const r = await executer(ids.double, MOI, {}, slugAutre)
    expect(r.data).toEqual({ moi: { adresseVisible: false } })
    await accord(ids.double, false)
  })

  it('refuse une personne sans session', async () => {
    expect(code(await executer(null, ACCORD, { v: true }))).toBe('FORBIDDEN')
  })
})

describe('réglage de l’activité', () => {
  it('se refuse à une personne qui n’administre pas l’activité', async () => {
    const r = await executer(ids.contact, REGLER, {
      id: ids.activite,
      r: 'AUCUNE',
    })
    expect(code(r)).toBe('FORBIDDEN')
    const activite = await prisma.activite.findUniqueOrThrow({
      where: { id: ids.activite },
      select: { adressesOrganigramme: true },
    })
    expect(activite.adressesOrganigramme).toBe('REFERENTS')
  })
})

describe('refus', () => {
  it('refuse une activité fermée à un membre sans affectation', async () => {
    const r = await executer(ids.membre, ORGANIGRAMME, { a: ids.activite })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse une référente d’une autre activité', async () => {
    const r = await executer(ids.etrangere, ORGANIGRAMME, { a: ids.activite })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse une personne d’une autre organisation', async () => {
    const r = await executer(ids.externe, ORGANIGRAMME, { a: ids.activite })
    expect(code(r)).toBe('FORBIDDEN')
    const ailleurs = await executer(
      ids.externe,
      ORGANIGRAMME,
      { a: ids.activite },
      slugAutre
    )
    expect(code(ailleurs)).toBe('FORBIDDEN')
  })

  it('refuse une personne sans session', async () => {
    const r = await executer(null, ORGANIGRAMME, { a: ids.activite })
    expect(code(r)).toBe('FORBIDDEN')
  })
})

describe('lecture en découverte', () => {
  it('montre les admins et les contacts principaux, sans aucune adresse personnelle', async () => {
    const ouvrir = await executer(ids.adminActivite, REGLER, {
      id: ids.activite,
      o: true,
    })
    expect(ouvrir.errors).toBeUndefined()
    const o = await lire(ids.membre)
    expect(o.complet).toBe(false)
    expect(o.contactActivite).toBe('equipe@exemple.fr')
    expect(o.admins.map(m => m.id)).toEqual([ids.adminActivite])
    const natation = o.perimetres.find(p => p.perimetre.slug === 'natation')!
    expect(natation.referents.map(m => m.id)).toEqual([ids.contact])
    const basket = o.perimetres.find(p => p.perimetre.slug === 'basket')!
    expect(basket.referents).toEqual([])
    // Le réglage vaut REFERENTS et le contact a donné son accord : rien ne s'affiche.
    expect(Object.values(adresses(o)).every(a => a === null)).toBe(true)
  })
})
