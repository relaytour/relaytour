import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { PROPOSITIONS_EN_ATTENTE_MAX } from '../lib/demandes.ts'

import { schema } from './index.ts'

// Demandes pour rejoindre l'équipe (ADR 0015) : proposition par un·e référent·e, file
// de revue des admins, acceptation et refus. Les contrôles d'accès se prouvent par le
// refus. Le fichier crée sa propre organisation : les notifications aux admins ne
// touchent aucune donnée locale.

const enFile = vi.hoisted(() => [] as { sorte: string; cible: unknown }[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: unknown) => {
    enFile.push({ sorte, cible })
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `demandes-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const adresse = (cle: string) => `${cle}-${slug}@exemple.fr`
const ids = {
  org: '',
  ailleurs: '',
  activite: '',
  edition: '',
  archivee: '',
  natation: '',
  basket: '',
  admin: '',
  alice: '', // référente natation
  chloe: '', // référente basket
  emma: '', // membre sans affectation
  fred: '', // membre sans affectation, proposé plus bas
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const PROPOSER = `mutation ($p: ID!, $e: ID!, $n: String!, $a: String!, $m: String) {
  proposerPersonne(perimetreId: $p, editionId: $e, nom: $n, email: $a, mot: $m)
}`
const proposer = (
  userId: string | null,
  cle: string,
  perimetre = ids.natation,
  edition = ids.edition
) =>
  executer(userId, PROPOSER, {
    p: perimetre,
    e: edition,
    n: `Personne ${cle}`,
    a: adresse(cle),
    m: 'Disponible en août.',
  })

const ACCEPTER = `mutation ($id: ID!, $p: [ID!]!) {
  accepterDemande(id: $id, affecter: $p) { id statut traiteePar { id } }
}`
const REFUSER = `mutation ($id: ID!) { refuserDemande(id: $id) { id statut } }`

const demandeDe = (cle: string) =>
  prisma.demande.findFirst({
    where: { editionId: ids.edition, adresse: adresse(cle) },
    include: { perimetres: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })

const compter = async () => ({
  demandes: await prisma.demande.count({ where: { organisationId: ids.org } }),
  comptes: await prisma.user.count({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  }),
  affectations: await prisma.affectation.count({
    where: { perimetre: { organisationId: ids.org } },
  }),
})

beforeAll(async () => {
  await apollo.start()
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: 'Organisation',
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
  ids.ailleurs = (
    await prisma.organisation.create({
      data: { slug: `${slug}-ailleurs`, nom: 'Ailleurs', configuration: {} },
    })
  ).id
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
  for (const cle of ['admin', 'alice', 'chloe', 'emma', 'fred'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: adresse(cle),
        name: `${cle} ${s}`,
        appartenances: {
          create: {
            organisationId: ids.org,
            role: cle === 'admin' ? 'ADMIN' : 'MEMBRE',
          },
        },
      },
    })
  }
  await prisma.affectation.createMany({
    data: [
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.archivee },
      { userId: ids.chloe, perimetreId: ids.basket, editionId: ids.edition },
    ],
  })
})

afterAll(async () => {
  const dansLOrganisation = { perimetre: { organisationId: ids.org } }
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
  await prisma.demande.deleteMany({ where: { organisationId: ids.org } })
  await prisma.souhait.deleteMany({ where: dansLOrganisation })
  await prisma.affectation.deleteMany({ where: dansLOrganisation })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.ailleurs] } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

beforeEach(() => {
  enFile.length = 0
})

describe('proposer une personne', () => {
  it('refuse une référente d’un autre périmètre, un membre sans affectation et une requête sans session', async () => {
    const avant = await compter()
    expect(code(await proposer(ids.chloe, 'intrusion'))).toBe('FORBIDDEN')
    expect(code(await proposer(ids.emma, 'intrusion'))).toBe('FORBIDDEN')
    expect(code(await proposer(null, 'intrusion'))).toBe('FORBIDDEN')
    expect(await compter()).toEqual(avant)
  })

  it('refuse une période archivée et une adresse invalide', async () => {
    const avant = await compter()
    expect(
      code(await proposer(ids.alice, 'archive', ids.natation, ids.archivee))
    ).toBe('SAISIE_INVALIDE')
    const r = await executer(ids.alice, PROPOSER, {
      p: ids.natation,
      e: ids.edition,
      n: 'Sans adresse',
      a: 'pas une adresse',
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await compter()).toEqual(avant)
  })

  it('crée une demande en attente, sans compte, et prévient l’admin une fois', async () => {
    const avant = await compter()
    const r = await proposer(ids.alice, 'zoe')
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({ proposerPersonne: true })
    const demande = await demandeDe('zoe')
    expect(demande).toMatchObject({
      organisationId: ids.org,
      activiteId: ids.activite,
      origine: 'PROPOSITION',
      statut: 'EN_ATTENTE',
      nom: 'Personne zoe',
      adresseEnAttente: adresse('zoe'),
      userId: null,
    })
    expect(demande?.perimetres).toMatchObject([
      {
        perimetreId: ids.natation,
        proposeParId: ids.alice,
        mot: 'Disponible en août.',
      },
    ])
    expect(await compter()).toEqual({ ...avant, demandes: avant.demandes + 1 })
    expect(enFile).toEqual([])
    // Une seconde proposition le même jour n'ajoute aucune notification.
    await proposer(ids.alice, 'yann')
    const notifications = await prisma.notification.findMany({
      where: { organisationId: ids.org },
      select: { userId: true, type: true, activiteId: true, tacheId: true },
    })
    expect(notifications).toEqual([
      {
        userId: ids.admin,
        type: 'DEMANDE_RECUE',
        activiteId: ids.activite,
        tacheId: null,
      },
    ])
  })

  it('répond de la même façon pour une adresse déjà proposée ou déjà membre', async () => {
    const avant = await compter()
    expect((await proposer(ids.alice, 'zoe')).data).toEqual({
      proposerPersonne: true,
    })
    expect(await compter()).toEqual(avant)
    expect((await proposer(ids.alice, 'fred')).data).toEqual({
      proposerPersonne: true,
    })
    expect((await demandeDe('fred'))?.statut).toBe('EN_ATTENTE')
  })

  it('ajoute le périmètre d’une autre référente à la demande en attente', async () => {
    expect(
      (await proposer(ids.chloe, 'zoe', ids.basket)).errors
    ).toBeUndefined()
    const demande = await demandeDe('zoe')
    expect(
      demande?.perimetres.map(p => [p.perimetreId, p.proposeParId])
    ).toEqual([
      [ids.natation, ids.alice],
      [ids.basket, ids.chloe],
    ])
  })

  it('ne montre à chaque personne que ses propres propositions, sans adresse', async () => {
    const Q = `query ($p: ID!, $e: ID!) { mesPropositions(perimetreId: $p, editionId: $e) { nom statut } }`
    const lire = async (userId: string, perimetre: string) => {
      const r = await executer(userId, Q, { p: perimetre, e: ids.edition })
      expect(r.errors).toBeUndefined()
      return (
        r.data as { mesPropositions: { nom: string; statut: string }[] }
      ).mesPropositions.map(p => p.nom)
    }
    expect((await lire(ids.alice, ids.natation)).sort()).toEqual([
      'Personne fred',
      'Personne yann',
      'Personne zoe',
    ])
    expect(await lire(ids.chloe, ids.basket)).toEqual(['Personne zoe'])
    expect(await lire(ids.chloe, ids.natation)).toEqual([])
    // Le type ne porte pas l'adresse : la demander est une erreur de requête.
    const adresseDemandee = await executer(
      ids.alice,
      `query ($p: ID!, $e: ID!) { mesPropositions(perimetreId: $p, editionId: $e) { adresse } }`,
      { p: ids.natation, e: ids.edition }
    )
    expect(code(adresseDemandee)).toBe('GRAPHQL_VALIDATION_FAILED')
  })
})

describe('file de revue', () => {
  const Q = `query ($e: ID!, $s: StatutDemande) {
    demandes(editionId: $e, statut: $s) {
      nom adresse origine statut dejaMembre
      perimetres { perimetre { id } proposePar { id } mot }
    }
  }`

  it('refuse une référente et un membre', async () => {
    expect(code(await executer(ids.alice, Q, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
    expect(code(await executer(ids.emma, Q, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
  })

  it('donne à l’admin les demandes de la période, avec l’adresse et les périmètres', async () => {
    const r = await executer(ids.admin, Q, { e: ids.edition, s: 'EN_ATTENTE' })
    expect(r.errors).toBeUndefined()
    const demandes = (
      r.data as {
        demandes: {
          nom: string
          adresse: string
          dejaMembre: boolean
          perimetres: { perimetre: { id: string } }[]
        }[]
      }
    ).demandes
    expect(demandes.map(d => [d.nom, d.dejaMembre])).toEqual([
      ['Personne zoe', false],
      ['Personne yann', false],
      ['Personne fred', true],
    ])
    expect(demandes[0]).toMatchObject({
      adresse: adresse('zoe'),
      origine: 'PROPOSITION',
      statut: 'EN_ATTENTE',
    })
    expect(demandes[0]?.perimetres.map(p => p.perimetre.id)).toEqual([
      ids.natation,
      ids.basket,
    ])
  })

  it('compte les demandes en attente de chaque périmètre dans « Équipe »', async () => {
    const r = await executer(
      ids.admin,
      `query ($e: ID!) { postesAPourvoir(editionId: $e) { perimetre { id } demandesEnAttente } }`,
      { e: ids.edition }
    )
    expect(r.errors).toBeUndefined()
    const comptes = new Map(
      (
        r.data as {
          postesAPourvoir: {
            perimetre: { id: string }
            demandesEnAttente: number
          }[]
        }
      ).postesAPourvoir.map(p => [p.perimetre.id, p.demandesEnAttente])
    )
    expect(comptes.get(ids.natation)).toBe(3)
    expect(comptes.get(ids.basket)).toBe(1)
  })
})

describe('accepter une demande', () => {
  it('refuse une référente, même pour sa propre proposition', async () => {
    const demande = await demandeDe('zoe')
    const r = await executer(ids.alice, ACCEPTER, {
      id: demande!.id,
      p: [ids.natation],
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect((await demandeDe('zoe'))?.statut).toBe('EN_ATTENTE')
  })

  it('refuse un périmètre inconnu de l’activité, sans rien écrire', async () => {
    const avant = await compter()
    const demande = await demandeDe('zoe')
    const r = await executer(ids.admin, ACCEPTER, {
      id: demande!.id,
      p: [randomUUID()],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await compter()).toEqual(avant)
  })

  it('crée le compte, l’affectation choisie et un souhait pour l’autre périmètre', async () => {
    const demande = await demandeDe('zoe')
    const r = await executer(ids.admin, ACCEPTER, {
      id: demande!.id,
      p: [ids.natation],
    })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      accepterDemande: {
        id: demande!.id,
        statut: 'ACCEPTEE',
        traiteePar: { id: ids.admin },
      },
    })
    const compte = await prisma.user.findUniqueOrThrow({
      where: { email: adresse('zoe') },
      select: {
        id: true,
        name: true,
        appartenances: { select: { organisationId: true, role: true } },
        affectations: { select: { perimetreId: true, creeParId: true } },
        souhaits: { select: { perimetreId: true, editionId: true } },
      },
    })
    expect(compte).toMatchObject({
      name: 'Personne zoe',
      appartenances: [{ organisationId: ids.org, role: 'MEMBRE' }],
      affectations: [{ perimetreId: ids.natation, creeParId: ids.admin }],
      souhaits: [{ perimetreId: ids.basket, editionId: ids.edition }],
    })
    expect(await demandeDe('zoe')).toMatchObject({
      statut: 'ACCEPTEE',
      adresseEnAttente: null,
      userId: compte.id,
      traiteeParId: ids.admin,
    })
    expect(enFile).toEqual([
      { sorte: 'invitation', cible: { userId: compte.id } },
    ])
  })

  it('refuse une demande déjà traitée', async () => {
    const avant = await compter()
    const demande = await demandeDe('zoe')
    for (const mutation of [ACCEPTER, REFUSER]) {
      const r = await executer(ids.admin, mutation, {
        id: demande!.id,
        p: [ids.basket],
      })
      expect(code(r)).toBe('SAISIE_INVALIDE')
    }
    expect(await compter()).toEqual(avant)
    expect(enFile).toEqual([])
  })

  it('affecte une personne déjà membre sans nouveau compte, et l’annonce par le mail d’équipe', async () => {
    const avant = await compter()
    const demande = await demandeDe('fred')
    const r = await executer(ids.admin, ACCEPTER, {
      id: demande!.id,
      p: [ids.natation],
    })
    expect(r.errors).toBeUndefined()
    expect(await compter()).toEqual({
      ...avant,
      affectations: avant.affectations + 1,
    })
    expect((await demandeDe('fred'))?.userId).toBe(ids.fred)
    expect(enFile.map(m => m.sorte)).toEqual(['equipe'])
  })

  it('rattache le compte d’une autre organisation', async () => {
    const userId = randomUUID()
    await prisma.user.create({
      data: {
        id: userId,
        email: adresse('ailleurs'),
        name: 'Nom du compte',
        appartenances: { create: { organisationId: ids.ailleurs } },
      },
    })
    await proposer(ids.alice, 'ailleurs')
    const demande = await demandeDe('ailleurs')
    const r = await executer(ids.admin, ACCEPTER, { id: demande!.id, p: [] })
    expect(r.errors).toBeUndefined()
    expect(
      await prisma.appartenance.count({
        where: { userId, organisationId: ids.org },
      })
    ).toBe(1)
    // Sans périmètre affecté, la proposition devient un souhait.
    expect(
      await prisma.souhait.count({
        where: { userId, perimetreId: ids.natation },
      })
    ).toBe(1)
    expect(enFile).toEqual([{ sorte: 'invitation', cible: { userId } }])
  })

  it('refuse un compte archivé et laisse la demande en attente', async () => {
    await prisma.user.create({
      data: {
        id: randomUUID(),
        email: adresse('archive'),
        name: 'Archivée',
        archivedAt: new Date(),
      },
    })
    await proposer(ids.alice, 'archive')
    const avant = await compter()
    const demande = await demandeDe('archive')
    const r = await executer(ids.admin, ACCEPTER, {
      id: demande!.id,
      p: [ids.natation],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await compter()).toEqual(avant)
    expect((await demandeDe('archive'))?.statut).toBe('EN_ATTENTE')
    expect(enFile).toEqual([])
  })
})

describe('refuser une demande', () => {
  it('refuse une référente', async () => {
    const demande = await demandeDe('yann')
    expect(code(await executer(ids.alice, REFUSER, { id: demande!.id }))).toBe(
      'FORBIDDEN'
    )
  })

  it('ne crée aucun compte, n’envoie aucun mail et libère l’adresse', async () => {
    const avant = await compter()
    const demande = await demandeDe('yann')
    const r = await executer(ids.admin, REFUSER, { id: demande!.id })
    expect(r.errors).toBeUndefined()
    expect(await demandeDe('yann')).toMatchObject({
      statut: 'REFUSEE',
      adresseEnAttente: null,
      traiteeParId: ids.admin,
      userId: null,
    })
    expect(await compter()).toEqual(avant)
    expect(enFile).toEqual([])
    // L'adresse peut être proposée de nouveau : une nouvelle demande naît.
    await proposer(ids.alice, 'yann')
    expect(await compter()).toEqual({ ...avant, demandes: avant.demandes + 1 })
    expect((await demandeDe('yann'))?.statut).toBe('EN_ATTENTE')
  })
})

describe('retirer une proposition', () => {
  const RETIRER = `mutation ($id: ID!) { retirerProposition(id: $id) }`

  it('ne change rien pour la proposition d’une autre personne', async () => {
    const demande = await demandeDe('yann')
    const r = await executer(ids.chloe, RETIRER, {
      id: demande!.perimetres[0]!.id,
    })
    expect(r.data).toEqual({ retirerProposition: false })
    expect((await demandeDe('yann'))?.perimetres).toHaveLength(1)
  })

  it('supprime la demande avec son dernier périmètre', async () => {
    const demande = await demandeDe('yann')
    const r = await executer(ids.alice, RETIRER, {
      id: demande!.perimetres[0]!.id,
    })
    expect(r.data).toEqual({ retirerProposition: true })
    expect(
      await prisma.demande.findUnique({ where: { id: demande!.id } })
    ).toBeNull()
  })
})

describe('limites', () => {
  it('plafonne les propositions en attente d’une même personne', async () => {
    const enAttente = await prisma.demandePerimetre.count({
      where: { proposeParId: ids.alice, demande: { statut: 'EN_ATTENTE' } },
    })
    for (let i = enAttente; i < PROPOSITIONS_EN_ATTENTE_MAX; i += 1) {
      expect((await proposer(ids.alice, `plafond${i}`)).errors).toBeUndefined()
    }
    const avant = await compter()
    expect(code(await proposer(ids.alice, 'de-trop'))).toBe('SAISIE_INVALIDE')
    expect(await compter()).toEqual(avant)
  })

  it('ne traite plus les demandes d’une période archivée', async () => {
    const demande = await prisma.demande.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.archivee,
        origine: 'PROPOSITION',
        nom: 'Ancienne demande',
        adresse: adresse('ancienne'),
        adresseEnAttente: adresse('ancienne'),
      },
    })
    for (const mutation of [ACCEPTER, REFUSER]) {
      const r = await executer(ids.admin, mutation, { id: demande.id, p: [] })
      expect(code(r)).toBe('SAISIE_INVALIDE')
    }
    expect(
      (await prisma.demande.findUniqueOrThrow({ where: { id: demande.id } }))
        .statut
    ).toBe('EN_ATTENTE')
  })
})
