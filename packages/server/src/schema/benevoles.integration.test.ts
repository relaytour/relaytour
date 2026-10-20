import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { purgerBenevoles } from '../lib/benevoles.ts'

import { schema } from './index.ts'

// Fiches bénévoles (ADR 0038). Les coordonnées d'une fiche ne se lisent que par
// les admins de l'activité, par la personne qui l'a créée, et par les personnes
// qui écrivent dans un périmètre où la fiche est placée. Les contrôles se
// prouvent par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `benevoles-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  autreActivite: '',
  edition: '',
  natation: '',
  basket: '',
  adminActivite: '',
  referent: '', // affecté à la natation
  basketteuse: '', // affectée au basket
  etrangere: '', // référente de l'autre activité
  membre: '', // sans affectation
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

const CHAMPS =
  'id nom courriel telephone note coordonneesVisibles peutModifier places'
const CREER = `mutation ($a: ID!, $n: String!, $c: String, $t: String, $ok: Boolean!) {
  creerBenevole(activiteId: $a, nom: $n, courriel: $c, telephone: $t, accord: $ok) { ${CHAMPS} }
}`
const LISTE = `query ($a: ID!) { benevoles(activiteId: $a) { ${CHAMPS} } }`

interface Fiche {
  id: string
  nom: string
  courriel: string | null
  telephone: string | null
  coordonneesVisibles: boolean
  peutModifier: boolean
  places: number
}

const donnees = <T>(r: Awaited<ReturnType<typeof executer>>, champ: string) => {
  expect(r.errors).toBeUndefined()
  return (r.data as Record<string, T>)[champ]!
}

async function creer(userId: string, nom: string): Promise<Fiche> {
  return donnees<Fiche>(
    await executer(userId, CREER, {
      a: ids.activite,
      n: nom,
      c: `${nom.toLowerCase().replace(/\s/g, '.')}@exemple.org`,
      t: '06 12 34 56 78',
      ok: true,
    }),
    'creerBenevole'
  )
}

async function lire(userId: string): Promise<Fiche[]> {
  return donnees<Fiche[]>(
    await executer(userId, LISTE, { a: ids.activite }),
    'benevoles'
  )
}

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  for (const [cle, slugActivite] of [
    ['activite', slug],
    ['autreActivite', `${slug}-b`],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: slugActivite,
          nom: 'Tournoi',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      })
    ).id
  }
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: new Date('2027-06-05'),
        fin: new Date('2027-06-06'),
      },
    })
  ).id
  const autreEdition = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.autreActivite,
      annee: 2027,
      nom: 'Autre',
      debut: new Date('2027-06-05'),
      fin: new Date('2027-06-06'),
    },
  })
  const tennis = await prisma.perimetre.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.autreActivite,
      slug: 'tennis',
      nom: 'Tennis',
      type: 'SPORT',
      groupe: 'sport',
    },
  })
  for (const cle of ['natation', 'basket'] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom: cle,
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    ).id
  }
  for (const cle of [
    'adminActivite',
    'referent',
    'basketteuse',
    'etrangere',
    'membre',
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle.toLowerCase()}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
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
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.referent,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
      {
        userId: ids.basketteuse,
        perimetreId: ids.basket,
        editionId: ids.edition,
      },
      {
        userId: ids.etrangere,
        perimetreId: tennis.id,
        editionId: autreEdition.id,
      },
    ],
  })
})

afterAll(async () => {
  await prisma.sequence.deleteMany({ where: { organisationId: ids.org } })
  await prisma.benevole.deleteMany({ where: { organisationId: ids.org } })
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
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
})

describe('fiches bénévoles', () => {
  it('exigent l’accord de la personne', async () => {
    const r = await executer(ids.referent, CREER, {
      a: ids.activite,
      n: 'Sans accord',
      ok: false,
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('montrent leurs coordonnées aux seules personnes qui en ont besoin', async () => {
    const parReferent = await creer(ids.referent, 'Jo Martin')
    const parAdmin = await creer(ids.adminActivite, 'Sam Leroy')
    // La personne qui crée la fiche lit ses coordonnées et la modifie.
    expect(parReferent).toMatchObject({
      courriel: 'jo.martin@exemple.org',
      coordonneesVisibles: true,
      peutModifier: true,
    })
    // Une autre référente lit les noms, pas les coordonnées.
    const vuesParBasket = await lire(ids.basketteuse)
    for (const fiche of vuesParBasket) {
      expect(fiche).toMatchObject({
        courriel: null,
        telephone: null,
        coordonneesVisibles: false,
        peutModifier: false,
      })
    }
    expect(vuesParBasket.map(f => f.nom)).toEqual(['Jo Martin', 'Sam Leroy'])
    // Une fiche placée dans une séquence du basket s'ouvre à la basketteuse.
    await prisma.sequence.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        perimetreId: ids.basket,
        titre: 'Matchs de poule',
        debut: new Date('2027-06-05T07:00:00.000Z'),
        fin: new Date('2027-06-05T10:00:00.000Z'),
        places: { create: { benevoleId: parAdmin.id, role: 'RENFORT' } },
      },
    })
    const apres = await lire(ids.basketteuse)
    expect(apres.find(f => f.id === parAdmin.id)).toMatchObject({
      telephone: '06 12 34 56 78',
      coordonneesVisibles: true,
      places: 1,
    })
    expect(apres.find(f => f.id === parReferent.id)?.courriel).toBeNull()
    // L'admin de l'activité lit tout.
    expect(
      (await lire(ids.adminActivite)).every(f => f.coordonneesVisibles)
    ).toBe(true)
  })

  it('restent fermées aux personnes qui n’écrivent pas dans l’activité', async () => {
    for (const qui of [ids.membre, ids.etrangere]) {
      expect(code(await executer(qui, LISTE, { a: ids.activite }))).toBe(
        'FORBIDDEN'
      )
      expect(
        code(
          await executer(qui, CREER, {
            a: ids.activite,
            n: 'Intrusion',
            ok: true,
          })
        )
      ).toBe('FORBIDDEN')
    }
    expect(code(await executer(null, LISTE, { a: ids.activite }))).toBe(
      'FORBIDDEN'
    )
  })

  it('se modifient par leur autrice ou un admin, et se suppriment par un admin', async () => {
    const fiche = await creer(ids.referent, 'Alix Garnier')
    const MODIFIER = `mutation ($id: ID!, $n: String!) { modifierBenevole(id: $id, nom: $n) { nom } }`
    const SUPPRIMER = `mutation ($id: ID!) { supprimerBenevole(id: $id) }`
    expect(
      donnees<{ nom: string }>(
        await executer(ids.referent, MODIFIER, { id: fiche.id, n: 'Alix G.' }),
        'modifierBenevole'
      ).nom
    ).toBe('Alix G.')
    expect(
      code(await executer(ids.basketteuse, MODIFIER, { id: fiche.id, n: 'X' }))
    ).toBe('FORBIDDEN')
    expect(
      code(await executer(ids.referent, SUPPRIMER, { id: fiche.id }))
    ).toBe('FORBIDDEN')
    expect(
      (await executer(ids.adminActivite, SUPPRIMER, { id: fiche.id })).data
    ).toEqual({ supprimerBenevole: true })
  })

  it('se purgent quand aucune séquence ouverte ne les utilise depuis 24 mois', async () => {
    const ancienne = await prisma.benevole.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        nom: 'Ancienne fiche',
        accordLe: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    })
    const utilisee = await prisma.benevole.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        nom: 'Fiche utilisée',
        accordLe: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        places: {
          create: {
            role: 'RENFORT',
            sequence: {
              create: {
                organisationId: ids.org,
                activiteId: ids.activite,
                editionId: ids.edition,
                titre: 'Accueil',
                debut: new Date('2027-06-05T07:00:00.000Z'),
                fin: new Date('2027-06-05T08:00:00.000Z'),
              },
            },
          },
        },
      },
    })
    await purgerBenevoles(prisma, { organisationId: ids.org })
    expect(await prisma.benevole.count({ where: { id: ancienne.id } })).toBe(0)
    expect(await prisma.benevole.count({ where: { id: utilisee.id } })).toBe(1)
  })
})
