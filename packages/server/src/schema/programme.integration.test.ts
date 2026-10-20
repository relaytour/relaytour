import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Programme du jour J (ADR 0038). Les admins de l'activité gèrent les lieux et
// toute séquence ; les personnes qui écrivent dans un périmètre écrivent ses
// séquences. Toute personne qui voit l'activité lit le programme. Les contrôles se
// prouvent par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `programme-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  autreActivite: '',
  edition: '',
  natation: '',
  basket: '',
  bassin: '',
  terrain: '',
  lieuAutre: '',
  benevole: '',
  benevoleAutre: '',
  adminActivite: '',
  referent: '', // affecté à la natation
  basketteuse: '', // affectée au basket
  etrangere: '', // référente de l'autre activité
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

const CHAMPS = `id titre jour heureDebut heureFin peutModifier version lieu { id nom } perimetre { id } places { role personneId benevoleId nom estMoi }`
const CREER = `mutation ($e: ID!, $p: ID, $l: ID, $t: String!, $j: Date!, $jf: Date, $d: String!, $f: String!, $pl: [PlaceSequenceInput!]) {
  creerSequence(editionId: $e, perimetreId: $p, lieuId: $l, titre: $t, jour: $j, jourFin: $jf, heureDebut: $d, heureFin: $f, places: $pl) { ${CHAMPS} }
}`
const MODIFIER = `mutation ($id: ID!, $l: ID, $t: String!, $j: Date!, $d: String!, $f: String!, $pl: [PlaceSequenceInput!], $v: Int) {
  modifierSequence(id: $id, lieuId: $l, titre: $t, jour: $j, heureDebut: $d, heureFin: $f, places: $pl, versionAttendue: $v) { ${CHAMPS} }
}`
const PROGRAMME = `query ($e: ID!, $p: ID, $m: Boolean) { programme(editionId: $e, perimetreId: $p, mesSequences: $m) { ${CHAMPS} } }`

interface Sequence {
  id: string
  titre: string
  peutModifier: boolean
  version: number
  lieu: { id: string; nom: string } | null
  places: {
    role: string
    personneId: string | null
    benevoleId: string | null
    nom: string
    estMoi: boolean
  }[]
}

const donnees = <T>(r: Awaited<ReturnType<typeof executer>>, champ: string) => {
  expect(r.errors).toBeUndefined()
  return (r.data as Record<string, T>)[champ]!
}

async function sequenceNatation(variables: Record<string, unknown> = {}) {
  return donnees<Sequence>(
    await executer(ids.referent, CREER, {
      e: ids.edition,
      p: ids.natation,
      l: ids.bassin,
      t: 'Finales du 50 m',
      j: '2027-06-05',
      d: '09:00',
      f: '12:00',
      pl: [
        { personneId: ids.referent, role: 'RESPONSABLE' },
        { benevoleId: ids.benevole, role: 'RENFORT' },
      ],
      ...variables,
    }),
    'creerSequence'
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
  for (const [cle, activiteId, nom] of [
    ['bassin', ids.activite, 'Bassin'],
    ['terrain', ids.activite, 'Terrain 2'],
    ['lieuAutre', ids.autreActivite, 'Court 1'],
  ] as const) {
    ids[cle] = (
      await prisma.lieu.create({
        data: { organisationId: ids.org, activiteId, nom },
      })
    ).id
  }
  for (const [cle, activiteId] of [
    ['benevole', ids.activite],
    ['benevoleAutre', ids.autreActivite],
  ] as const) {
    ids[cle] = (
      await prisma.benevole.create({
        data: {
          organisationId: ids.org,
          activiteId,
          nom: `Bénévole ${cle}`,
          telephone: '0600000000',
          accordLe: new Date(),
        },
      })
    ).id
  }
  for (const cle of [
    'adminActivite',
    'referent',
    'basketteuse',
    'etrangere',
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
  await prisma.lieu.deleteMany({ where: { organisationId: ids.org } })
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

describe('séquences', () => {
  it('se créent dans un périmètre, avec un lieu, un membre et une ou un bénévole', async () => {
    const sequence = await sequenceNatation()
    expect(sequence).toMatchObject({
      titre: 'Finales du 50 m',
      peutModifier: true,
      lieu: { nom: 'Bassin' },
    })
    expect(sequence.places).toEqual([
      {
        role: 'RESPONSABLE',
        personneId: ids.referent,
        benevoleId: null,
        nom: `referent ${s}`,
        estMoi: true,
      },
      {
        role: 'RENFORT',
        personneId: null,
        benevoleId: ids.benevole,
        nom: 'Bénévole benevole',
        estMoi: false,
      },
    ])
  })

  it('se lisent par toute l’équipe, et se filtrent par personne et par périmètre', async () => {
    const sequence = await sequenceNatation({ t: 'Relais' })
    const lu = donnees<Sequence[]>(
      await executer(ids.basketteuse, PROGRAMME, { e: ids.edition }),
      'programme'
    )
    const relais = lu.find(l => l.id === sequence.id)
    expect(relais).toMatchObject({ peutModifier: false })
    // Le programme ne publie que le nom d'une ou d'un bénévole.
    expect(JSON.stringify(relais)).not.toContain('0600000000')
    const miennes = donnees<Sequence[]>(
      await executer(ids.referent, PROGRAMME, { e: ids.edition, m: true }),
      'programme'
    )
    expect(miennes.every(m => m.places.some(p => p.estMoi))).toBe(true)
    expect(
      donnees<Sequence[]>(
        await executer(ids.basketteuse, PROGRAMME, { e: ids.edition, m: true }),
        'programme'
      )
    ).toEqual([])
    expect(
      donnees<Sequence[]>(
        await executer(ids.adminActivite, PROGRAMME, {
          e: ids.edition,
          p: ids.basket,
        }),
        'programme'
      )
    ).toEqual([])
  })

  it('refusent un lieu, une personne ou une fiche hors de l’activité', async () => {
    for (const variables of [
      { l: ids.lieuAutre },
      { pl: [{ personneId: ids.etrangere, role: 'RENFORT' }] },
      { pl: [{ benevoleId: ids.benevoleAutre, role: 'RENFORT' }] },
    ]) {
      expect(
        code(
          await executer(ids.referent, CREER, {
            e: ids.edition,
            p: ids.natation,
            t: 'Refusée',
            j: '2027-06-05',
            d: '09:00',
            f: '10:00',
            ...variables,
          })
        )
      ).toBe('FORBIDDEN')
    }
    expect(
      code(
        await executer(ids.referent, CREER, {
          e: ids.edition,
          p: ids.natation,
          t: 'Trop longue',
          j: '2027-06-05',
          jf: '2027-06-06',
          d: '09:00',
          f: '10:00',
        })
      )
    ).toBe('SAISIE_INVALIDE')
  })

  it('se modifient avec la version lue, et remplacent leurs places', async () => {
    const sequence = await sequenceNatation({ t: 'Séries' })
    const modifiee = donnees<Sequence>(
      await executer(ids.referent, MODIFIER, {
        id: sequence.id,
        l: ids.bassin,
        t: 'Séries du matin',
        j: '2027-06-05',
        d: '08:30',
        f: '11:00',
        pl: [{ benevoleId: ids.benevole, role: 'RESPONSABLE' }],
        v: 0,
      }),
      'modifierSequence'
    )
    expect(modifiee.places).toEqual([
      expect.objectContaining({
        benevoleId: ids.benevole,
        role: 'RESPONSABLE',
      }),
    ])
    expect(
      code(
        await executer(ids.referent, MODIFIER, {
          id: sequence.id,
          t: 'Conflit',
          j: '2027-06-05',
          d: '08:30',
          f: '11:00',
          v: 0,
        })
      )
    ).toBe('CONFLIT_VERSION')
  })

  it('restent hors de portée d’un autre périmètre et d’une autre activité', async () => {
    const sequence = await sequenceNatation({ t: 'Interdite' })
    const commun = { t: 'Intrusion', j: '2027-06-05', d: '09:00', f: '10:00' }
    expect(
      code(
        await executer(ids.basketteuse, CREER, {
          e: ids.edition,
          p: ids.natation,
          ...commun,
        })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(ids.basketteuse, MODIFIER, {
          id: sequence.id,
          ...commun,
        })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          ids.basketteuse,
          'mutation ($id: ID!) { supprimerSequence(id: $id) }',
          {
            id: sequence.id,
          }
        )
      )
    ).toBe('FORBIDDEN')
    // Une séquence de toute l'activité revient à ses admins.
    expect(
      code(await executer(ids.referent, CREER, { e: ids.edition, ...commun }))
    ).toBe('FORBIDDEN')
    expect(
      code(await executer(ids.etrangere, PROGRAMME, { e: ids.edition }))
    ).toBe('FORBIDDEN')
    expect(code(await executer(null, PROGRAMME, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
  })
})

describe('lieux', () => {
  const CREER_LIEU = `mutation ($a: ID!, $n: String!) { creerLieu(activiteId: $a, nom: $n) { id nom } }`

  it('se gèrent par les admins de l’activité seulement', async () => {
    const r = await executer(ids.adminActivite, CREER_LIEU, {
      a: ids.activite,
      n: 'Gymnase',
    })
    const lieu = donnees<{ id: string }>(r, 'creerLieu')
    for (const qui of [ids.referent, ids.etrangere]) {
      expect(
        code(await executer(qui, CREER_LIEU, { a: ids.activite, n: 'Intrus' }))
      ).toBe('FORBIDDEN')
    }
    const archive = await executer(
      ids.adminActivite,
      'mutation ($id: ID!) { modifierLieu(id: $id, nom: "Gymnase", ordre: 3, archive: true) { archive } }',
      { id: lieu.id }
    )
    expect(archive.data).toEqual({ modifierLieu: { archive: true } })
    const lus = donnees<{ nom: string }[]>(
      await executer(
        ids.basketteuse,
        'query ($a: ID!) { lieux(activiteId: $a) { nom } }',
        { a: ids.activite }
      ),
      'lieux'
    )
    expect(lus.map(l => l.nom)).toEqual(['Bassin', 'Terrain 2'])
  })
})
