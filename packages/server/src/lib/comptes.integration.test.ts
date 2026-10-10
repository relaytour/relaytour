import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { creerAffectations } from './affectations.ts'
import { creerOuRattacherCompte } from './comptes.ts'
import { inviterAdmin } from './installation.ts'

// Entrée d'une personne dans une organisation, puis dans des périmètres. Les deux
// fonctions servent l'invitation, l'affectation et l'import d'une équipe : elles
// écrivent dans le client ou la transaction de l'appelant. Le fichier crée ses deux
// organisations.

// Aucun mail ne part de ce fichier.
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: () => Promise.resolve(),
}))

const s = randomUUID().slice(0, 8)
const adresse = (cle: string) => `${cle}-comptes-${s}@exemple.fr`
const ids = { org: '', autre: '', activite: '', edition: '', a: '', b: '' }

const appartenances = (userId: string) =>
  prisma.appartenance.findMany({
    where: { userId },
    select: { organisationId: true, role: true },
    orderBy: { createdAt: 'asc' },
  })

beforeAll(async () => {
  const organisation = await prisma.organisation.create({
    data: {
      slug: `comptes-${s}`,
      nom: 'Organisation',
      configuration: {},
      activites: {
        create: {
          slug: `comptes-${s}`,
          nom: 'Tournoi',
          groupes: [{ cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' }],
        },
      },
    },
    include: { activites: true },
  })
  ids.org = organisation.id
  ids.activite = organisation.activites[0]!.id
  ids.autre = (
    await prisma.organisation.create({
      data: { slug: `comptes-autre-${s}`, nom: 'Autre', configuration: {} },
    })
  ).id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id
  for (const cle of ['a', 'b'] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom: cle,
          type: 'POLE',
          groupe: 'pole',
        },
      })
    ).id
  }
})

afterAll(async () => {
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-comptes-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { slug: { endsWith: `-${s}` } },
  })
  await prisma.$disconnect()
})

describe('creerOuRattacherCompte', () => {
  const demande = (cle: string) => ({
    email: adresse(cle),
    nom: `Personne ${cle}`,
    organisationId: ids.org,
    role: 'MEMBRE' as const,
  })

  it('crée le compte et son appartenance pour une adresse inconnue', async () => {
    const compte = await creerOuRattacherCompte(prisma, demande('nouvelle'))
    expect(compte).toMatchObject({
      issue: 'cree',
      dejaMembre: false,
      nomDuCompte: null,
    })
    const enBase = await prisma.user.findUniqueOrThrow({
      where: { email: adresse('nouvelle') },
    })
    expect(enBase.id).toBe(compte.userId)
    expect(enBase.name).toBe('Personne nouvelle')
    expect(await appartenances(compte.userId)).toEqual([
      { organisationId: ids.org, role: 'MEMBRE' },
    ])
  })

  it('n’écrit rien pour le compte d’une autre organisation, et ne rend pas son nom', async () => {
    const userId = randomUUID()
    await prisma.user.create({
      data: {
        id: userId,
        email: adresse('ailleurs'),
        name: 'Nom du compte',
        appartenances: { create: { organisationId: ids.autre } },
      },
    })
    const compte = await creerOuRattacherCompte(prisma, {
      ...demande('ailleurs'),
      role: 'ADMIN',
    })
    // ADR 0030 : l'appelant enregistre une invitation, sans rien lire du compte.
    expect(compte).toEqual({
      userId,
      issue: 'externe',
      dejaMembre: false,
      nomDuCompte: null,
    })
    expect(await appartenances(userId)).toEqual([
      { organisationId: ids.autre, role: 'MEMBRE' },
    ])
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name
    ).toBe('Nom du compte')
  })

  it('ne change rien pour une personne déjà membre, pas même son rôle', async () => {
    const premiere = await creerOuRattacherCompte(prisma, demande('membre'))
    const seconde = await creerOuRattacherCompte(prisma, {
      ...demande('membre'),
      role: 'ADMIN',
    })
    expect(seconde).toEqual({
      userId: premiere.userId,
      issue: 'membre',
      dejaMembre: true,
      nomDuCompte: 'Personne membre',
    })
    expect(await appartenances(premiere.userId)).toEqual([
      { organisationId: ids.org, role: 'MEMBRE' },
    ])
  })

  it('n’écrit rien pour un compte archivé, membre ou non', async () => {
    const membre = randomUUID()
    const exterieur = randomUUID()
    await prisma.user.create({
      data: {
        id: membre,
        email: adresse('archive-membre'),
        name: 'Archivée',
        archivedAt: new Date(),
        appartenances: { create: { organisationId: ids.org } },
      },
    })
    await prisma.user.create({
      data: {
        id: exterieur,
        email: adresse('archive-exterieur'),
        name: 'Archivé',
        archivedAt: new Date(),
      },
    })
    expect(
      await creerOuRattacherCompte(prisma, demande('archive-membre'))
    ).toMatchObject({ userId: membre, issue: 'archive', dejaMembre: true })
    expect(
      await creerOuRattacherCompte(prisma, demande('archive-exterieur'))
    ).toMatchObject({ userId: exterieur, issue: 'archive', dejaMembre: false })
    expect(await appartenances(exterieur)).toEqual([])
  })

  it('décide sans écrire en simulation', async () => {
    const compte = await creerOuRattacherCompte(prisma, {
      ...demande('simulee'),
      simulation: true,
    })
    expect(compte.issue).toBe('cree')
    expect(
      await prisma.user.findUnique({ where: { email: adresse('simulee') } })
    ).toBeNull()
  })

  it('s’annule avec la transaction de l’appelant', async () => {
    await expect(
      prisma.$transaction(async tx => {
        await creerOuRattacherCompte(tx, demande('annulee'))
        throw new Error('annulation')
      })
    ).rejects.toThrow('annulation')
    expect(
      await prisma.user.findUnique({ where: { email: adresse('annulee') } })
    ).toBeNull()
  })
})

// Deux organisations invitent au même instant la même adresse nouvelle comme premier
// admin. Chaque invitation tient le verrou de sa propre organisation : rien ne les
// sépare, et la seconde création de compte bute sur l'unicité de l'adresse.
describe('deux invitations simultanées de la même adresse', () => {
  it('créent un seul compte : admin de l’une, invité de l’autre', async () => {
    for (let tour = 0; tour < 5; tour += 1) {
      const slugs = [`comptes-x${tour}-${s}`, `comptes-y${tour}-${s}`]
      await prisma.organisation.createMany({
        data: slugs.map(slug => ({ slug, nom: slug, configuration: {} })),
      })
      const email = adresse(`simultanee-${tour}`)
      const [premier, second] = await Promise.all(
        slugs.map(slug => inviterAdmin(slug, email, 'Première Admin'))
      )
      expect(second!.userId).toBe(premier!.userId)
      // L'une crée le compte ; l'autre le trouve hors de son organisation et
      // n'enregistre qu'une invitation au rôle d'admin (ADR 0030).
      expect([premier!.enAttente, second!.enAttente].sort()).toEqual([
        false,
        true,
      ])
      expect((await appartenances(premier!.userId)).map(a => a.role)).toEqual([
        'ADMIN',
      ])
      expect(
        await prisma.invitationOrganisation.findMany({
          where: { userId: premier!.userId },
          select: { role: true, origine: true, globale: true },
        })
      ).toEqual([{ role: 'ADMIN', origine: 'INSTALLATION', globale: true }])
    }
  })
})

describe('creerAffectations', () => {
  const instant = new Date('2027-01-15T10:00:00.000Z')
  let userId = ''
  let admin = ''

  beforeAll(async () => {
    userId = (
      await creerOuRattacherCompte(prisma, {
        email: adresse('affectee'),
        nom: 'Affectée',
        organisationId: ids.org,
        role: 'MEMBRE',
      })
    ).userId
    admin = (
      await creerOuRattacherCompte(prisma, {
        email: adresse('admin'),
        nom: 'Admin',
        organisationId: ids.org,
        role: 'ADMIN',
      })
    ).userId
  })

  const demande = (perimetreIds: string[]) => ({
    userId,
    perimetreIds,
    editionId: ids.edition,
    creeParId: admin,
    instant,
  })

  it('décide sans écrire en simulation', async () => {
    expect(
      await creerAffectations(prisma, {
        ...demande([ids.a]),
        simulation: true,
      })
    ).toEqual({ creees: [ids.a], existantes: [] })
    expect(await prisma.affectation.count({ where: { userId } })).toBe(0)
  })

  it('crée les affectations demandées, datées et attribuées', async () => {
    expect(await creerAffectations(prisma, demande([ids.a]))).toEqual({
      creees: [ids.a],
      existantes: [],
    })
    const enBase = await prisma.affectation.findMany({ where: { userId } })
    expect(enBase).toHaveLength(1)
    expect(enBase[0]).toMatchObject({
      perimetreId: ids.a,
      editionId: ids.edition,
      creeParId: admin,
      createdAt: instant,
      contactPrincipal: false,
    })
  })

  it('laisse une affectation présente telle quelle et ne compte un périmètre qu’une fois', async () => {
    expect(
      await creerAffectations(prisma, demande([ids.a, ids.b, ids.b]))
    ).toEqual({ creees: [ids.b], existantes: [ids.a] })
    expect(await prisma.affectation.count({ where: { userId } })).toBe(2)
  })

  it('ne lit rien sans périmètre', async () => {
    expect(await creerAffectations(prisma, demande([]))).toEqual({
      creees: [],
      existantes: [],
    })
  })
})
