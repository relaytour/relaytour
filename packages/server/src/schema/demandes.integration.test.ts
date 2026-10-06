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
import { composer } from '../courriel/messages.ts'
import {
  PROPOSITIONS_EN_ATTENTE_MAX,
  purgerDemandes,
  signalerDemande,
} from '../lib/demandes.ts'

import { schema } from './index.ts'

// Demandes pour rejoindre l'équipe (ADR 0015) : proposition par un·e référent·e, file
// de revue des admins, acceptation et refus. Les contrôles d'accès se prouvent par le
// refus. Le fichier crée sa propre organisation : les notifications aux admins ne
// touchent aucune donnée locale.

// `enFile` reçoit les mails destinés aux personnes de l'équipe ; `mailsAdmins`, les
// mails regroupés qui préviennent les admins d'une demande (ADR 0016).
const enFile = vi.hoisted(() => [] as { sorte: string; cible: unknown }[])
const mailsAdmins = vi.hoisted(
  () => [] as { cible: unknown; options: unknown }[]
)
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: unknown, options: unknown = {}) => {
    if (sorte === 'demandes') mailsAdmins.push({ cible, options })
    else enFile.push({ sorte, cible })
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
  bruno: '', // référent natation, lui aussi
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
  for (const cle of [
    'admin',
    'alice',
    'bruno',
    'chloe',
    'emma',
    'fred',
  ] as const) {
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
      { userId: ids.bruno, perimetreId: ids.natation, editionId: ids.edition },
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
  mailsAdmins.length = 0
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
    // Aucun mail ne part vers la personne proposée. L'admin a un mail différé
    // jusqu'à la fin de l'heure en cours.
    expect(enFile).toEqual([])
    const mail = {
      cible: { userId: ids.admin },
      options: {
        organisationId: ids.org,
        activiteId: ids.activite,
        jobId: expect.stringMatching(
          new RegExp(`^demandes-${ids.activite}-${ids.admin}-\\d+$`)
        ) as string,
        delai: expect.any(Number) as number,
      },
    }
    expect(mailsAdmins).toEqual([mail])
    // Une seconde proposition le même jour n'ajoute aucune notification. Son mail
    // porte le même identifiant de job tant que l'heure n'a pas changé : la file
    // n'en garde qu'un.
    await proposer(ids.alice, 'yann')
    expect(mailsAdmins).toHaveLength(2)
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

  it('donne sa propre ligne à un co-référent qui propose la même adresse', async () => {
    const avant = await compter()
    expect((await proposer(ids.bruno, 'zoe')).data).toEqual({
      proposerPersonne: true,
    })
    // La demande reste unique : seule la liste du co-référent change, comme pour
    // une adresse inconnue.
    expect(await compter()).toEqual(avant)
    const demande = await demandeDe('zoe')
    expect(
      demande?.perimetres
        .filter(p => p.perimetreId === ids.natation)
        .map(p => p.proposeParId)
    ).toEqual([ids.alice, ids.bruno])
    const r = await executer(
      ids.bruno,
      `query ($p: ID!, $e: ID!) { mesPropositions(perimetreId: $p, editionId: $e) { nom } }`,
      { p: ids.natation, e: ids.edition }
    )
    expect(r.data).toEqual({ mesPropositions: [{ nom: 'Personne zoe' }] })
    // Proposer deux fois ne crée pas deux lignes.
    await proposer(ids.bruno, 'zoe')
    expect((await demandeDe('zoe'))?.perimetres).toHaveLength(3)
  })

  it('prévient un admin une seule fois par jour de son fuseau', async () => {
    const compterNotifications = () =>
      prisma.notification.count({ where: { organisationId: ids.org } })
    const avant = await compterNotifications()
    const signaler = (instant: string) =>
      signalerDemande(
        prisma,
        {
          organisationId: ids.org,
          activiteId: ids.activite,
          acteurId: ids.alice,
        },
        new Date(instant)
      )
    // 0 h 30 et 11 h le 11 janvier à Paris : deux jours différents en UTC.
    await signaler('2027-01-10T23:30:00Z')
    await signaler('2027-01-11T10:00:00Z')
    expect(await compterNotifications()).toBe(avant + 1)
    // Le lendemain à Paris, une nouvelle notification part.
    await signaler('2027-01-11T23:30:00Z')
    expect(await compterNotifications()).toBe(avant + 2)
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
      ids.natation,
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
    // Zoé est proposée deux fois pour la natation : sa demande compte une fois.
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

  it('refuse d’accepter sans périmètre une demande qui n’en porte aucun', async () => {
    const demande = await prisma.demande.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        origine: 'FORMULAIRE',
        nom: 'Sans choix',
        adresse: adresse('sans-choix'),
      },
    })
    const avant = await compter()
    const r = await executer(ids.admin, ACCEPTER, { id: demande.id, p: [] })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await compter()).toEqual(avant)
    expect((await demandeDe('sans-choix'))?.statut).toBe('EN_ATTENTE')
    expect(enFile).toEqual([])
    await prisma.demande.delete({ where: { id: demande.id } })
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

// La purge se limite à l'organisation du fichier : la base de développement porte
// d'autres données.
describe('purge des demandes d’une période archivée', () => {
  it('supprime les demandes de la période archivée, quel que soit leur état, et garde le reste', async () => {
    const zoe = await prisma.user.findUniqueOrThrow({
      where: { email: adresse('zoe') },
      select: { id: true },
    })
    // Une demande acceptée de la période archivée, liée à un compte bien réel.
    await prisma.demande.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.archivee,
        origine: 'FORMULAIRE',
        statut: 'ACCEPTEE',
        nom: 'Personne zoe',
        adresse: adresse('zoe'),
        userId: zoe.id,
        traiteeParId: ids.admin,
        traiteeLe: new Date(),
        texte: 'Réponse à effacer.',
        perimetres: { create: { perimetreId: ids.natation } },
      },
    })
    const compter = (editionId: string) =>
      prisma.demande.count({ where: { editionId } })
    const ouvertes = await compter(ids.edition)
    expect(await compter(ids.archivee)).toBe(2)
    const affectations = await prisma.affectation.count({
      where: { userId: zoe.id },
    })

    expect(await purgerDemandes(prisma, { organisationId: ids.org })).toBe(2)

    expect(await compter(ids.archivee)).toBe(0)
    expect(
      await prisma.demandePerimetre.count({
        where: { demande: { editionId: ids.archivee } },
      })
    ).toBe(0)
    // Les demandes de la période ouverte, le compte et ses affectations restent.
    expect(await compter(ids.edition)).toBe(ouvertes)
    expect(await prisma.user.count({ where: { email: adresse('zoe') } })).toBe(
      1
    )
    expect(await prisma.affectation.count({ where: { userId: zoe.id } })).toBe(
      affectations
    )
    // Une seconde purge ne trouve plus rien.
    expect(await purgerDemandes(prisma, { organisationId: ids.org })).toBe(0)
  })

  it('ne touche pas une autre organisation', async () => {
    const ailleurs = await prisma.organisation.create({
      data: { slug: `${slug}-purge`, nom: 'Purge', configuration: {} },
    })
    const activite = await prisma.activite.create({
      data: {
        organisationId: ailleurs.id,
        slug: `${slug}-purge`,
        nom: 'Purge',
        groupes: [],
      },
    })
    const edition = await prisma.edition.create({
      data: {
        organisationId: ailleurs.id,
        activiteId: activite.id,
        annee: 2020,
        nom: 'Purge 2020',
        debut: new Date('2020-01-01'),
        fin: new Date('2020-01-02'),
        statut: 'ARCHIVEE',
      },
    })
    try {
      await prisma.demande.create({
        data: {
          organisationId: ailleurs.id,
          activiteId: activite.id,
          editionId: edition.id,
          origine: 'FORMULAIRE',
          nom: 'Ailleurs',
          adresse: adresse('purge-ailleurs'),
          adresseEnAttente: adresse('purge-ailleurs'),
        },
      })
      await purgerDemandes(prisma, { organisationId: ids.org })
      expect(
        await prisma.demande.count({ where: { organisationId: ailleurs.id } })
      ).toBe(1)
      expect(
        await purgerDemandes(prisma, { organisationId: ailleurs.id })
      ).toBe(1)
    } finally {
      await prisma.demande.deleteMany({
        where: { organisationId: ailleurs.id },
      })
      await prisma.edition.deleteMany({ where: { id: edition.id } })
      await prisma.activite.deleteMany({ where: { id: activite.id } })
      await prisma.organisation.delete({ where: { id: ailleurs.id } })
    }
  })
})

// Le mail regroupé aux admins (ADR 0016) : un job par admin, par activité et par
// heure. Le bloc a sa propre activité : son nombre de demandes en attente ne dépend
// pas des tests précédents.
describe('mail regroupé aux admins', () => {
  const gala = { id: '', slug: `${slug}-gala` }
  const mail = (userId: string) =>
    composer(prisma, {
      sorte: 'demandes',
      userId,
      organisationId: ids.org,
      activiteId: gala.id,
    })
  const signaler = (instant: string, acteurId?: string) =>
    signalerDemande(
      prisma,
      { organisationId: ids.org, activiteId: gala.id, acteurId },
      new Date(instant)
    )
  const jobDe = (heure: string) =>
    `demandes-${gala.id}-${ids.admin}-${Date.parse(heure)}`

  beforeAll(async () => {
    gala.id = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: gala.slug,
          nom: 'Gala',
          groupes: [],
        },
      })
    ).id
    const editions: Record<string, string> = {}
    for (const [annee, statut] of [
      [2027, 'PREPARATION'],
      [2025, 'ARCHIVEE'],
    ] as const) {
      editions[statut] = (
        await prisma.edition.create({
          data: {
            organisationId: ids.org,
            activiteId: gala.id,
            annee,
            nom: `Gala ${annee}`,
            debut: new Date(`${annee}-05-01`),
            fin: new Date(`${annee}-05-02`),
            statut,
          },
        })
      ).id
    }
    const base = {
      organisationId: ids.org,
      activiteId: gala.id,
      editionId: editions.PREPARATION!,
      origine: 'FORMULAIRE' as const,
      nom: 'Nom Secret',
    }
    // Deux demandes en attente, une demande refusée, et une demande d'une période
    // archivée.
    for (const cle of ['gala-a', 'gala-b']) {
      await prisma.demande.create({
        data: {
          ...base,
          adresse: adresse(cle),
          adresseEnAttente: adresse(cle),
        },
      })
    }
    await prisma.demande.create({
      data: { ...base, statut: 'REFUSEE', adresse: adresse('gala-c') },
    })
    await prisma.demande.create({
      data: {
        ...base,
        editionId: editions.ARCHIVEE!,
        adresse: adresse('gala-d'),
        adresseEnAttente: adresse('gala-d'),
      },
    })
  })

  it('place un mail par admin et par heure, à la fin de l’heure du signalement', async () => {
    // Le signalement suit la validation de la demande : un signalement de 10 h 59
    // rejoint le mail de 11 h, et celui de 11 h le mail de midi.
    await signaler('2027-03-01T10:59:59.900Z')
    await signaler('2027-03-01T11:00:00.100Z')
    expect(mailsAdmins).toEqual([
      {
        cible: { userId: ids.admin },
        options: {
          organisationId: ids.org,
          activiteId: gala.id,
          jobId: jobDe('2027-03-01T10:00:00Z'),
          delai: 100,
        },
      },
      {
        cible: { userId: ids.admin },
        options: {
          organisationId: ids.org,
          activiteId: gala.id,
          jobId: jobDe('2027-03-01T11:00:00Z'),
          delai: 3_599_900,
        },
      },
    ])
  })

  it('ne prévient pas l’admin de sa propre proposition', async () => {
    await signaler('2027-03-01T12:30:00Z', ids.admin)
    expect(mailsAdmins).toEqual([])
  })

  it('compte les demandes en attente à l’envoi, sans citer personne', async () => {
    const message = await mail(ids.admin)
    expect(message?.sujet).toMatch(/^Demandes pour rejoindre l’équipe .+$/)
    expect(message?.texte).toContain(
      '2 demandes pour rejoindre l’équipe de l’activité Gala attendent votre décision.'
    )
    expect(message?.texte).toContain(
      `/${gala.slug}/admin/personnes?onglet=demandes`
    )
    expect(message?.desabonnement).toMatch(/\/preferences$/)
    for (const corps of [message?.texte, message?.html]) {
      expect(corps).not.toContain('Secret')
      expect(corps).not.toContain('@exemple.fr')
    }
  })

  it('note l’envoi sur la notification de l’admin', async () => {
    const enAttente = () =>
      prisma.notification.count({
        where: {
          userId: ids.admin,
          activiteId: gala.id,
          type: 'DEMANDE_RECUE',
          envoyeeLe: null,
        },
      })
    expect(await enAttente()).toBe(1)
    await (await mail(ids.admin))?.apresEnvoi?.()
    expect(await enAttente()).toBe(0)
  })

  it('n’envoie rien à une personne qui n’administre pas l’activité', async () => {
    expect(await mail(ids.alice)).toBeNull()
    // Avec un admin d'activité, l'admin de l'organisation n'est plus prévenu : le
    // rôle se relit à l'envoi.
    const nomination = await prisma.adminActivite.create({
      data: {
        userId: ids.bruno,
        activiteId: gala.id,
        organisationId: ids.org,
      },
    })
    expect(await mail(ids.admin)).toBeNull()
    expect((await mail(ids.bruno))?.texte).toContain('2 demandes')
    await prisma.adminActivite.delete({ where: { id: nomination.id } })
    expect(await mail(ids.bruno)).toBeNull()
  })

  it('se règle par une préférence, qu’une requête sans cette valeur ne change pas', async () => {
    const LIRE = `{ mesPreferencesNotification { mailDemandes } }`
    const REGLER = `mutation ($d: Boolean) {
      modifierPreferencesNotification(frequenceResume: HEBDOMADAIRE, mailModification: true, mailEcheance: true, mailDemandes: $d) { mailDemandes }
    }`
    expect(code(await executer(null, REGLER, { d: false }))).toBe('FORBIDDEN')
    expect((await executer(ids.admin, LIRE)).data).toEqual({
      mesPreferencesNotification: { mailDemandes: true },
    })
    expect((await executer(ids.admin, REGLER, { d: false })).data).toEqual({
      modifierPreferencesNotification: { mailDemandes: false },
    })
    expect((await executer(ids.admin, REGLER)).data).toEqual({
      modifierPreferencesNotification: { mailDemandes: false },
    })
    expect(await mail(ids.admin)).toBeNull()
    expect((await executer(ids.admin, REGLER, { d: true })).data).toEqual({
      modifierPreferencesNotification: { mailDemandes: true },
    })
    expect(await mail(ids.admin)).not.toBeNull()
  })

  it('n’annonce pas une demande déjà traitée', async () => {
    const traiter = (cle: string) =>
      prisma.demande.updateMany({
        where: { activiteId: gala.id, adresseEnAttente: adresse(cle) },
        data: { statut: 'REFUSEE', adresseEnAttente: null },
      })
    await traiter('gala-a')
    expect((await mail(ids.admin))?.texte).toContain(
      'Une demande pour rejoindre l’équipe de l’activité Gala attend votre décision.'
    )
    // Sans demande en attente dans une période ouverte, aucun mail ne part.
    await traiter('gala-b')
    expect(await mail(ids.admin)).toBeNull()
  })
})
