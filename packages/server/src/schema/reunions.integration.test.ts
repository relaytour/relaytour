import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Réunions de l'agenda et convocations (ADR 0037). Les personnes qui écrivent
// dans un périmètre écrivent dans son agenda ; les admins de l'activité écrivent
// dans l'agenda global. En consultation, une réunion de périmètre ne montre que son
// titre et son horaire. Les contrôles se prouvent par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `reunions-${s}`
const slugAutre = `reunions-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  autreActivite: '',
  edition: '',
  archivee: '',
  natation: '',
  basket: '',
  tacheNatation: '',
  tacheBasket: '',
  adminOrg: '', // admin de l'organisation : archive les personnes
  adminActivite: '',
  referent: '', // affecté à la natation
  nageuse: '', // affectée à la natation, retirée en cours de test
  basketteuse: '', // affectée au basket : consulte la natation
  archive: '', // affecté à la natation, archivé dans l'organisation
  membre: '', // aucune affectation
  etrangere: '', // référente de l'autre activité seulement
  externe: '', // membre de l'autre organisation seulement
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

const CHAMPS = `id titre jour heureDebut heureFin debut fin statut cible version
  lieu lienVisio description detailMasque peutModifier estConvoquee maReponse
  taches { id } reponses { presentes absentes peutEtre sansReponse }
  convocations { personneId reponse }`
const CREER = `mutation ($e: ID!, $p: ID, $t: String!, $j: Date!, $d: String!, $f: String!, $l: String, $v: String, $desc: String, $taches: [ID!], $c: CibleConvocation, $u: [ID!]) {
  creerReunion(editionId: $e, perimetreId: $p, titre: $t, jour: $j, heureDebut: $d, heureFin: $f, lieu: $l, lienVisio: $v, description: $desc, tacheIds: $taches, cible: $c, personneIds: $u) { ${CHAMPS} }
}`
const MODIFIER = `mutation ($id: ID!, $t: String!, $j: Date!, $d: String!, $f: String!, $l: String, $v: String, $desc: String, $c: CibleConvocation, $u: [ID!], $version: Int) {
  modifierReunion(id: $id, titre: $t, jour: $j, heureDebut: $d, heureFin: $f, lieu: $l, lienVisio: $v, description: $desc, cible: $c, personneIds: $u, versionAttendue: $version) { ${CHAMPS} }
}`
const ANNULER = `mutation ($id: ID!) { annulerReunion(id: $id) { ${CHAMPS} } }`
const REPONDRE = `mutation ($id: ID!, $r: ReponseConvocation!) { repondreConvocation(reunionId: $id, reponse: $r) { ${CHAMPS} } }`
const LIRE = `query ($id: ID!) { reunion(id: $id) { ${CHAMPS} } }`
const LISTE = `query ($e: ID!, $p: ID) { reunions(editionId: $e, perimetreId: $p) { ${CHAMPS} } }`

interface Reunion {
  id: string
  titre: string
  jour: string
  heureDebut: string
  heureFin: string
  debut: string
  statut: string
  version: number
  lieu: string | null
  lienVisio: string | null
  description: string | null
  detailMasque: boolean
  peutModifier: boolean
  estConvoquee: boolean
  maReponse: string | null
  taches: { id: string }[]
  reponses: Record<string, number> | null
  convocations: { personneId: string; reponse: string | null }[] | null
}

const donnees = <T>(r: Awaited<ReturnType<typeof executer>>, champ: string) => {
  expect(r.errors).toBeUndefined()
  return (r.data as Record<string, T>)[champ]!
}

const convoques = (r: Reunion) =>
  (r.convocations ?? []).map(c => c.personneId).sort()

const adresseDe = (cle: string) => `${cle.toLowerCase()}-${slug}@exemple.fr`

/** Une réunion de natation, créée par le référent, dans un an. */
async function reunionNatation(variables: Record<string, unknown> = {}) {
  return donnees<Reunion>(
    await executer(ids.referent, CREER, {
      e: ids.edition,
      p: ids.natation,
      t: 'Point natation',
      j: '2027-03-01',
      d: '18:30',
      f: '20:00',
      l: 'Piscine municipale',
      v: 'https://visio.exemple.org/natation',
      desc: 'Ordre du jour : les lignes d’eau.',
      taches: [ids.tacheNatation],
      c: 'PERIMETRE',
      ...variables,
    }),
    'creerReunion'
  )
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
          debut: new Date(`${annee}-06-05`),
          fin: new Date(`${annee}-06-06`),
          statut,
        },
      })
    ).id
  }
  const autreEdition = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.autreActivite,
      annee: 2027,
      nom: 'Autre 2027',
      debut: new Date('2027-09-01'),
      fin: new Date('2027-09-02'),
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
    'adminOrg',
    'adminActivite',
    'referent',
    'nageuse',
    'basketteuse',
    'archive',
    'membre',
    'etrangere',
    'externe',
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: adresseDe(cle),
        name: `${cle} ${s}`,
        appartenances: {
          create: {
            organisationId: cle === 'externe' ? ids.orgAutre : ids.org,
            role: cle === 'adminOrg' ? 'ADMIN' : 'MEMBRE',
            archiveLe: cle === 'archive' ? new Date() : null,
          },
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
  await prisma.affectation.createMany({
    data: [
      ['referent', ids.natation],
      ['nageuse', ids.natation],
      ['archive', ids.natation],
      ['basketteuse', ids.basket],
    ].map(([cle, perimetreId]) => ({
      userId: ids[cle as keyof typeof ids],
      perimetreId: perimetreId!,
      editionId: ids.edition,
    })),
  })
  await prisma.affectation.create({
    data: {
      userId: ids.etrangere,
      perimetreId: tennis.id,
      editionId: autreEdition.id,
    },
  })
  for (const [cle, perimetreId] of [
    ['tacheNatation', ids.natation],
    ['tacheBasket', ids.basket],
  ] as const) {
    ids[cle] = (
      await prisma.tache.create({
        data: { editionId: ids.edition, perimetreId, titre: cle },
      })
    ).id
  }
})

afterAll(async () => {
  await prisma.reunion.deleteMany({ where: { organisationId: ids.org } })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.notification.deleteMany({
    where: { organisationId: { in: [ids.org, ids.orgAutre] } },
  })
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
})

describe('réunion d’un périmètre', () => {
  it('se crée par un référent et convoque les personnes actives du périmètre', async () => {
    const reunion = await reunionNatation()
    expect(reunion).toMatchObject({
      titre: 'Point natation',
      jour: '2027-03-01',
      heureDebut: '18:30',
      heureFin: '20:00',
      debut: new Date('2027-03-01T17:30:00.000Z'),
      statut: 'PREVUE',
      lieu: 'Piscine municipale',
      lienVisio: 'https://visio.exemple.org/natation',
      detailMasque: false,
      peutModifier: true,
      estConvoquee: true,
      taches: [{ id: ids.tacheNatation }],
    })
    expect(convoques(reunion)).toEqual([ids.nageuse, ids.referent].sort())
  })

  it('ne montre en consultation que le titre et l’horaire', async () => {
    const { id } = await reunionNatation()
    const lue = donnees<Reunion>(
      await executer(ids.basketteuse, LIRE, { id }),
      'reunion'
    )
    expect(lue).toMatchObject({
      titre: 'Point natation',
      heureDebut: '18:30',
      detailMasque: true,
      lieu: null,
      lienVisio: null,
      description: null,
      taches: [],
      reponses: null,
      convocations: null,
      peutModifier: false,
    })
    const liste = donnees<Reunion[]>(
      await executer(ids.basketteuse, LISTE, {
        e: ids.edition,
        p: ids.natation,
      }),
      'reunions'
    )
    expect(liste.every(r => r.lieu === null && r.lienVisio === null)).toBe(true)
  })

  it('refuse l’écriture à une personne qui consulte, et dans une période archivée', async () => {
    const { id } = await reunionNatation()
    for (const [requete, variables] of [
      [
        CREER,
        {
          e: ids.edition,
          p: ids.natation,
          t: 'Intrusion',
          j: '2027-03-01',
          d: '10:00',
          f: '11:00',
        },
      ],
      [
        MODIFIER,
        { id, t: 'Intrusion', j: '2027-03-01', d: '10:00', f: '11:00' },
      ],
      [ANNULER, { id }],
    ] as const) {
      expect(code(await executer(ids.basketteuse, requete, variables))).toBe(
        'FORBIDDEN'
      )
    }
    expect(
      code(
        await executer(ids.adminActivite, CREER, {
          e: ids.archivee,
          p: ids.natation,
          t: 'Trop tard',
          j: '2025-03-01',
          d: '10:00',
          f: '11:00',
        })
      )
    ).toBe('SAISIE_INVALIDE')
  })

  it('refuse une tâche d’un autre périmètre, un lien qui n’est pas web, une fin avant le début', async () => {
    for (const variables of [
      { taches: [ids.tacheBasket] },
      { v: 'javascript:alert(1)' },
      { d: '20:00', f: '19:00' },
    ]) {
      const r = await executer(ids.referent, CREER, {
        e: ids.edition,
        p: ids.natation,
        t: 'Refusée',
        j: '2027-03-01',
        d: '18:00',
        f: '19:00',
        ...variables,
      })
      expect(code(r)).toBe('SAISIE_INVALIDE')
    }
  })

  it('refuse les personnes extérieures, sans session ou d’une autre organisation', async () => {
    const { id } = await reunionNatation()
    for (const qui of [ids.membre, ids.etrangere, ids.archive]) {
      expect(code(await executer(qui, LIRE, { id }))).toBe('FORBIDDEN')
    }
    expect(code(await executer(null, LIRE, { id }))).toBe('FORBIDDEN')
    expect(code(await executer(ids.externe, LIRE, { id }, slugAutre))).toBe(
      'FORBIDDEN'
    )
  })
})

describe('modification, réponses et annulation', () => {
  it('monte la version iCalendar sur un changement d’horaire, pas sur la description', async () => {
    const reunion = await reunionNatation()
    const base = {
      id: reunion.id,
      t: 'Point natation',
      j: '2027-03-01',
      d: '18:30',
      f: '20:00',
      l: 'Piscine municipale',
      v: 'https://visio.exemple.org/natation',
      c: 'PERIMETRE',
    }
    const sequence = () =>
      prisma.reunion
        .findUniqueOrThrow({ where: { id: reunion.id } })
        .then(r => r.sequence)
    donnees(
      await executer(ids.referent, MODIFIER, {
        ...base,
        desc: 'Nouvel ordre du jour.',
        version: 0,
      }),
      'modifierReunion'
    )
    expect(await sequence()).toBe(0)
    const modifiee = donnees<Reunion>(
      await executer(ids.referent, MODIFIER, {
        ...base,
        d: '19:00',
        version: 1,
      }),
      'modifierReunion'
    )
    expect(modifiee.heureDebut).toBe('19:00')
    expect(await sequence()).toBe(1)
    const conflit = await executer(ids.referent, MODIFIER, {
      ...base,
      version: 1,
    })
    expect(code(conflit)).toBe('CONFLIT_VERSION')
  })

  it('enregistre la réponse d’une personne convoquée, et refuse les autres', async () => {
    const { id } = await reunionNatation()
    const lue = donnees<Reunion>(
      await executer(ids.nageuse, REPONDRE, { id, r: 'PRESENT' }),
      'repondreConvocation'
    )
    expect(lue.maReponse).toBe('PRESENT')
    expect(lue.reponses).toEqual({
      presentes: 1,
      absentes: 0,
      peutEtre: 0,
      sansReponse: 1,
    })
    // Une personne qui écrit dans le périmètre lit les réponses nominatives.
    expect(lue.convocations).toContainEqual({
      personneId: ids.nageuse,
      reponse: 'PRESENT',
    })
    expect(
      code(await executer(ids.basketteuse, REPONDRE, { id, r: 'PRESENT' }))
    ).toBe('FORBIDDEN')
  })

  it('s’annule, puis ne change plus', async () => {
    const { id } = await reunionNatation()
    const annulee = donnees<Reunion>(
      await executer(ids.referent, ANNULER, { id }),
      'annulerReunion'
    )
    expect(annulee.statut).toBe('ANNULEE')
    expect(annulee.peutModifier).toBe(false)
    expect(
      (await prisma.reunion.findUniqueOrThrow({ where: { id } })).sequence
    ).toBe(1)
    expect(
      code(
        await executer(ids.referent, MODIFIER, {
          id,
          t: 'Reprise',
          j: '2027-03-01',
          d: '10:00',
          f: '11:00',
        })
      )
    ).toBe('SAISIE_INVALIDE')
    expect(
      code(await executer(ids.nageuse, REPONDRE, { id, r: 'ABSENT' }))
    ).toBe('SAISIE_INVALIDE')
  })
})

describe('agenda global', () => {
  it('se crée par un admin de l’activité et convoque toute l’équipe', async () => {
    const reunion = donnees<Reunion>(
      await executer(ids.adminActivite, CREER, {
        e: ids.edition,
        t: 'Assemblée',
        j: '2027-02-01',
        d: '19:00',
        f: '21:00',
        l: 'Salle des fêtes',
        taches: [ids.tacheNatation, ids.tacheBasket],
        c: 'EQUIPE',
      }),
      'creerReunion'
    )
    expect(convoques(reunion)).toEqual(
      [ids.adminActivite, ids.referent, ids.nageuse, ids.basketteuse].sort()
    )
    expect(reunion.taches).toHaveLength(2)
    const lue = donnees<Reunion>(
      await executer(ids.basketteuse, LIRE, { id: reunion.id }),
      'reunion'
    )
    expect(lue).toMatchObject({ detailMasque: false, lieu: 'Salle des fêtes' })
    // Une personne convoquée qui n'écrit pas dans l'agenda global lit les nombres,
    // pas la liste nominative.
    const repondue = donnees<Reunion>(
      await executer(ids.basketteuse, REPONDRE, {
        id: reunion.id,
        r: 'ABSENT',
      }),
      'repondreConvocation'
    )
    expect(repondue.convocations).toBeNull()
    expect(repondue.reponses).toMatchObject({ absentes: 1, sansReponse: 3 })
  })

  it('refuse les référents, la cible du périmètre et une personne hors de l’équipe', async () => {
    const commun = {
      e: ids.edition,
      t: 'Assemblée',
      j: '2027-02-01',
      d: '19:00',
      f: '21:00',
    }
    expect(
      code(await executer(ids.referent, CREER, { ...commun, c: 'EQUIPE' }))
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(ids.adminActivite, CREER, { ...commun, c: 'PERIMETRE' })
      )
    ).toBe('SAISIE_INVALIDE')
    for (const intrus of [
      ids.etrangere,
      ids.membre,
      ids.externe,
      ids.archive,
    ]) {
      expect(
        code(
          await executer(ids.adminActivite, CREER, {
            ...commun,
            c: 'CHOIX',
            u: [ids.referent, intrus],
          })
        )
      ).toBe('FORBIDDEN')
    }
  })
})

describe('les convocations suivent les affectations', () => {
  it('retirent une personne des réunions à venir de son ancien périmètre, pas des passées', async () => {
    const aVenir = await reunionNatation()
    const passee = await prisma.reunion.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        perimetreId: ids.natation,
        titre: 'Réunion passée',
        debut: new Date('2026-01-10T17:00:00.000Z'),
        fin: new Date('2026-01-10T18:00:00.000Z'),
        cible: 'PERIMETRE',
        convocations: { create: { userId: ids.nageuse } },
      },
    })
    const affectation = await prisma.affectation.findFirstOrThrow({
      where: { userId: ids.nageuse, perimetreId: ids.natation },
    })
    const r = await executer(
      ids.adminActivite,
      'mutation ($id: ID!) { retirerAffectation(id: $id) }',
      { id: affectation.id }
    )
    expect(r.errors).toBeUndefined()
    const restantes = await prisma.convocationReunion.findMany({
      where: { userId: ids.nageuse, reunionId: { in: [aVenir.id, passee.id] } },
      select: { reunionId: true },
    })
    expect(restantes).toEqual([{ reunionId: passee.id }])
  })

  it('convoquent une personne nouvellement affectée aux réunions du périmètre à venir', async () => {
    const reunion = await reunionNatation()
    const choix = await reunionNatation({ c: 'CHOIX', u: [ids.referent] })
    // La nageuse a quitté l'équipe de l'activité : l'admin de l'organisation la
    // réaffecte (ADR 0018).
    const r = await executer(
      ids.adminOrg,
      'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }',
      { u: ids.nageuse, p: ids.natation, e: ids.edition }
    )
    expect(r.errors).toBeUndefined()
    const convocations = await prisma.convocationReunion.findMany({
      where: { userId: ids.nageuse, reunionId: { in: [reunion.id, choix.id] } },
      select: { reunionId: true },
    })
    expect(convocations).toEqual([{ reunionId: reunion.id }])
  })

  it('retirent une personne archivée de toutes les réunions à venir', async () => {
    await reunionNatation()
    const r = await executer(
      ids.adminOrg,
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }',
      { id: ids.nageuse }
    )
    expect(r.errors).toBeUndefined()
    expect(
      await prisma.convocationReunion.count({
        where: {
          userId: ids.nageuse,
          reunion: { statut: 'PREVUE', debut: { gt: new Date() } },
        },
      })
    ).toBe(0)
  })
})
