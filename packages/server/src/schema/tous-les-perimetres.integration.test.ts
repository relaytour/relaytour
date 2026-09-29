import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Page « Tous les périmètres » et souhaits formulés par la personne (ADR 0012).
// Une activité ouverte aux souhaits se découvre sans ouvrir ses tâches ni ses fiches.
// Les contrôles se prouvent par le refus (invariant 11). Le fichier crée sa propre
// organisation et ne touche pas à l'organisation par défaut.

const s = randomUUID().slice(0, 8)
const slug = `decouverte-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  edition: '',
  archivee: '',
  natation: '',
  basket: '',
  archive: '',
  admin: '',
  referente: '', // affectée à la natation
  membre: '', // aucune affectation, aucun souhait
  autreMembre: '',
  fiche: '',
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const TOUS = `query ($a: ID) {
  tousLesPerimetres(activiteId: $a) {
    edition { id }
    perimetres { perimetre { slug description } affecte souhaite }
  }
}`
const ACTIVITES = `{ activites { id acces souhaitsOuverts } }`
const FORMULER = `mutation ($p: ID!, $e: ID!) { formulerSouhait(perimetreId: $p, editionId: $e) }`
const RETIRER = `mutation ($p: ID!, $e: ID!) { retirerMonSouhait(perimetreId: $p, editionId: $e) }`
const OUVRIR = `mutation ($id: ID!, $o: Boolean) {
  modifierActivite(id: $id, nom: "Tournoi", nature: EVENEMENT, groupes: [{ cle: "sport", libelle: "Sport", libellePluriel: "Sports" }], ordre: 0, souhaitsOuverts: $o) { souhaitsOuverts }
}`

type Tous = {
  tousLesPerimetres: {
    edition: { id: string } | null
    perimetres: {
      perimetre: { slug: string; description: string | null }
      affecte: boolean
      souhaite: boolean
    }[]
  }
}

const souhaitsDe = (userId: string) =>
  prisma.souhait.findMany({
    where: { userId, perimetre: { organisationId: ids.org } },
    select: { perimetreId: true },
  })

beforeAll(async () => {
  await apollo.start()
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: `Organisation ${slug}`,
      configuration: {},
      activites: {
        create: {
          slug,
          nom: 'Tournoi',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      },
    },
    include: { activites: true },
  })
  ids.org = organisation.id
  ids.activite = organisation.activites[0]!.id
  for (const [cle, annee, statut] of [
    ['edition', 2027, 'PREPARATION'],
    ['archivee', 2025, 'ARCHIVEE'],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          annee,
          nom: `Tournoi ${annee}`,
          debut: new Date(`${annee}-08-27`),
          fin: new Date(`${annee}-08-29`),
          statut,
        },
      })
    ).id
  }
  for (const [cle, nom, archive] of [
    ['natation', 'Natation', false],
    ['basket', 'Basket', false],
    ['archive', 'Squash', true],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom,
          description: `Le périmètre ${nom}.`,
          type: 'SPORT',
          groupe: 'sport',
          archivedAt: archive ? new Date() : null,
        },
      })
    ).id
  }
  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['referente', 'MEMBRE'],
    ['membre', 'MEMBRE'],
    ['autreMembre', 'MEMBRE'],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle.toLowerCase()}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId: ids.org, role } },
      },
    })
  }
  await prisma.affectation.create({
    data: {
      userId: ids.referente,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
  ids.fiche = (
    await prisma.fiche.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: `fiche-${s}`,
        perimetreId: null,
      },
    })
  ).id
})

afterAll(async () => {
  await prisma.souhait.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.fiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('activité fermée aux souhaits', () => {
  it('reste invisible pour un membre sans affectation', async () => {
    const r = await executer(ids.membre, ACTIVITES)
    expect(r.errors).toBeUndefined()
    expect((r.data as { activites: unknown[] }).activites).toEqual([])
    expect(code(await executer(ids.membre, TOUS, { a: ids.activite }))).toBe(
      'FORBIDDEN'
    )
  })

  it('refuse un souhait du membre, sans rien écrire', async () => {
    const r = await executer(ids.membre, FORMULER, {
      p: ids.natation,
      e: ids.edition,
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await souhaitsDe(ids.membre)).toEqual([])
  })

  it('reste complète pour une référente affectée', async () => {
    const r = await executer(ids.referente, ACTIVITES)
    expect((r.data as { activites: { acces: string }[] }).activites).toEqual([
      { id: ids.activite, acces: 'COMPLET', souhaitsOuverts: false },
    ])
    const tous = (
      (await executer(ids.referente, TOUS, { a: ids.activite })).data as Tous
    ).tousLesPerimetres
    expect(tous.edition?.id).toBe(ids.edition)
    // Tri par ordre puis par nom ; le périmètre archivé n'apparaît pas.
    expect(
      tous.perimetres.map(p => [p.perimetre.slug, p.affecte, p.souhaite])
    ).toEqual([
      ['basket', false, false],
      ['natation', true, false],
    ])
  })

  it('refuse l’ouverture par une référente', async () => {
    const r = await executer(ids.referente, OUVRIR, {
      id: ids.activite,
      o: true,
    })
    expect(code(r)).toBe('FORBIDDEN')
  })
})

describe('activité ouverte aux souhaits', () => {
  beforeAll(async () => {
    const r = await executer(ids.admin, OUVRIR, { id: ids.activite, o: true })
    expect(r.errors).toBeUndefined()
  })

  it('se découvre par un membre sans affectation', async () => {
    const r = await executer(ids.membre, ACTIVITES)
    expect((r.data as { activites: { acces: string }[] }).activites).toEqual([
      { id: ids.activite, acces: 'DECOUVERTE', souhaitsOuverts: true },
    ])
    const tous = (
      (await executer(ids.membre, TOUS, { a: ids.activite })).data as Tous
    ).tousLesPerimetres
    expect(tous.perimetres.map(p => p.perimetre.description)).toEqual([
      'Le périmètre Basket.',
      'Le périmètre Natation.',
    ])
  })

  it('n’ouvre ni les tâches, ni les fiches, ni les périodes', async () => {
    for (const [query, variables] of [
      [
        'query ($a: ID) { perimetre(slug: "natation", activiteId: $a) { id } }',
        { a: ids.activite },
      ],
      ['query ($a: ID) { fiches(activiteId: $a) { id } }', { a: ids.activite }],
      [
        'query ($a: ID) { editions(activiteId: $a) { id } }',
        { a: ids.activite },
      ],
      [
        'query ($e: ID!) { mesTaches(editionId: $e) { id } }',
        { e: ids.edition },
      ],
    ] as const) {
      expect(code(await executer(ids.membre, query, variables))).toBe(
        'FORBIDDEN'
      )
    }
  })

  it('refuse le champ des tâches d’un périmètre découvert', async () => {
    const r = await executer(
      ids.membre,
      `query ($a: ID, $e: ID!) { tousLesPerimetres(activiteId: $a) { perimetres { perimetre { taches(editionId: $e) { id } } } } }`,
      { a: ids.activite, e: ids.edition }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('laisse le membre formuler puis retirer son souhait', async () => {
    const formule = await executer(ids.membre, FORMULER, {
      p: ids.basket,
      e: ids.edition,
    })
    expect(formule.errors).toBeUndefined()
    expect(await souhaitsDe(ids.membre)).toEqual([{ perimetreId: ids.basket }])
    // Formuler deux fois ne crée pas de doublon.
    await executer(ids.membre, FORMULER, { p: ids.basket, e: ids.edition })
    expect(await souhaitsDe(ids.membre)).toHaveLength(1)

    const tous = (
      (await executer(ids.membre, TOUS, { a: ids.activite })).data as Tous
    ).tousLesPerimetres
    expect(tous.perimetres.find(p => p.souhaite)?.perimetre.slug).toBe('basket')

    const retire = await executer(ids.membre, RETIRER, {
      p: ids.basket,
      e: ids.edition,
    })
    expect(
      (retire.data as { retirerMonSouhait: boolean }).retirerMonSouhait
    ).toBe(true)
    expect(await souhaitsDe(ids.membre)).toEqual([])
  })

  it('ne montre pas les souhaits d’une autre personne', async () => {
    await executer(ids.autreMembre, FORMULER, {
      p: ids.natation,
      e: ids.edition,
    })
    const tous = (
      (await executer(ids.membre, TOUS, { a: ids.activite })).data as Tous
    ).tousLesPerimetres
    expect(tous.perimetres.every(p => !p.souhaite)).toBe(true)
    // Retirer le souhait d'une autre personne ne change rien.
    const r = await executer(ids.membre, RETIRER, {
      p: ids.natation,
      e: ids.edition,
    })
    expect((r.data as { retirerMonSouhait: boolean }).retirerMonSouhait).toBe(
      false
    )
    expect(await souhaitsDe(ids.autreMembre)).toHaveLength(1)
  })

  it('refuse un périmètre archivé et une période archivée', async () => {
    expect(
      code(
        await executer(ids.membre, FORMULER, {
          p: ids.archive,
          e: ids.edition,
        })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(ids.membre, FORMULER, {
          p: ids.basket,
          e: ids.archivee,
        })
      )
    ).toBe('SAISIE_INVALIDE')
    expect(await souhaitsDe(ids.membre)).toEqual([])
  })
})

describe('limite des souhaits', () => {
  const limite = randomUUID()
  const perimetresLimite: string[] = []

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: limite,
        email: `limite-${slug}@exemple.fr`,
        name: `Limite ${s}`,
        appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
      },
    })
    for (let i = 0; i < 31; i++) {
      perimetresLimite.push(
        (
          await prisma.perimetre.create({
            data: {
              organisationId: ids.org,
              activiteId: ids.activite,
              slug: `limite-${i}`,
              nom: `Limite ${i}`,
              type: 'SPORT',
              groupe: 'sport',
              ordre: 100 + i,
            },
          })
        ).id
      )
    }
    await prisma.souhait.createMany({
      data: perimetresLimite.slice(0, 29).map(perimetreId => ({
        userId: limite,
        perimetreId,
        editionId: ids.edition,
      })),
    })
  })

  it('ne dépasse pas la limite avec deux souhaits simultanés', async () => {
    const [a, b] = await Promise.all(
      perimetresLimite
        .slice(29, 31)
        .map(p => executer(limite, FORMULER, { p, e: ids.edition }))
    )
    expect([code(a!), code(b!)].sort()).toEqual(
      ['SAISIE_INVALIDE', undefined].sort()
    )
    expect(
      await prisma.souhait.count({
        where: { userId: limite, editionId: ids.edition },
      })
    ).toBe(30)
  })

  it('accepte de nouveau un souhait déjà présent, même à la limite', async () => {
    const r = await executer(limite, FORMULER, {
      p: perimetresLimite[0],
      e: ids.edition,
    })
    expect(r.errors).toBeUndefined()
    expect((r.data as { formulerSouhait: boolean }).formulerSouhait).toBe(true)
  })
})

describe('activité refermée', () => {
  beforeAll(async () => {
    await executer(ids.admin, OUVRIR, { id: ids.activite, o: false })
  })

  it('reste découverte pour une personne qui y a un souhait', async () => {
    const r = await executer(ids.autreMembre, ACTIVITES)
    expect((r.data as { activites: { acces: string }[] }).activites).toEqual([
      { id: ids.activite, acces: 'DECOUVERTE', souhaitsOuverts: false },
    ])
  })

  it('redevient invisible pour un membre sans souhait', async () => {
    expect(code(await executer(ids.membre, TOUS, { a: ids.activite }))).toBe(
      'FORBIDDEN'
    )
  })
})
