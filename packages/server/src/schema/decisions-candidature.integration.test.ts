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
import { contexteDeJetonAcces } from '../contexte-jeton.ts'
import { empreinteJeton } from '../lib/abonnements-agenda.ts'
import {
  apercuJeton,
  empreinteJetonAcces,
  nouveauJetonAcces,
} from '../lib/jetons-acces.ts'
import { nouveauSel } from '../lib/liens.ts'
import { emettreJetons } from '../oauth/jetons.ts'

import { schema } from './index.ts'

// Garde d'état des décisions de candidature (ADR 0070). Une acceptation porte le
// statut lu du choix ; un écart répond CONFLIT_VERSION avant toute écriture et
// avant tout mail. Une remise en attente défait un refus sans rien envoyer. Chaque
// contrôle de la revue de sécurité se prouve par le refus (invariant 11).

const enFile = vi.hoisted(() => [] as { sorte: string }[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string) => {
    enFile.push({ sorte })
    return Promise.resolve(true)
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `decisions-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  appel: '',
  admin: '',
  referent: '', // écrit la natation
  basketteuse: '', // écrit le basket seulement
}
let jetonLecture = ''
let jetonApplication = ''

type Qui = string | { jeton: string }

async function executer(
  qui: Qui,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const contextValue =
    typeof qui === 'string'
      ? await buildContext('127.0.0.1', qui, slug)
      : await contexteDeJetonAcces('127.0.0.1', qui.jeton, null)
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const h = (heure: string) => new Date(`2027-06-05T${heure}:00+02:00`)

const ACCEPTER = `mutation ($id: ID!, $st: StatutChoix) { accepterChoixCandidature(id: $id, statutAttendu: $st) { id statut choix { id statut } } }`
const REFUSER = `mutation ($id: ID!) { refuserChoixCandidature(id: $id) { id } }`
const REMETTRE = `mutation ($id: ID!, $st: StatutChoix) { remettreChoixEnAttente(id: $id, statutAttendu: $st) { id statut choix { id statut } } }`
const PLACER = `mutation ($sq: ID!, $c: ID, $st: StatutChoix) { placerBenevole(sequenceId: $sq, candidatureId: $c, statutAttendu: $st) { id version renforts } }`

let numero = 0

/** Une séquence de la natation, avec son besoin de renforts. */
async function sequence(besoin = 2, perimetreId = ids.natation) {
  numero += 1
  return (
    await prisma.sequence.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        perimetreId,
        titre: `Séquence ${numero}`,
        debut: h('09:00'),
        fin: h('12:00'),
        besoinBenevoles: besoin,
      },
    })
  ).id
}

/** Une candidature déposée en ligne, avec un choix par séquence. */
async function deposer(
  sequenceIds: string[],
  options: {
    statut?: 'EN_ATTENTE' | 'LISTE_ATTENTE' | 'REFUSE'
    courriel?: string
    candidature?: 'EN_ATTENTE' | 'TRAITEE' | 'RETIREE'
    origine?: 'PUBLIC' | 'IMPORT'
    refExterne?: string | null
    courrielEnAttente?: string | null
  } = {}
) {
  const courriel = options.courriel ?? `${randomUUID()}@exemple.fr`
  const statutCandidature = options.candidature ?? 'EN_ATTENTE'
  return prisma.candidature.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      editionId: ids.edition,
      appelId: ids.appel,
      nom: `Candidate ${randomUUID().slice(0, 4)}`,
      courriel,
      courrielEnAttente:
        options.courrielEnAttente !== undefined
          ? options.courrielEnAttente
          : statutCandidature === 'EN_ATTENTE'
            ? courriel
            : null,
      statut: statutCandidature,
      origine: options.origine ?? 'PUBLIC',
      refExterne: options.refExterne ?? null,
      accordLe: new Date(),
      choix: {
        create: sequenceIds.map(sequenceId => ({
          sequenceId,
          statut: options.statut ?? 'EN_ATTENTE',
          ...(options.statut === 'REFUSE'
            ? { traiteParId: ids.admin, traiteLe: new Date() }
            : {}),
        })),
      },
    },
    include: { choix: true },
  })
}

/** L'état écrit d'une candidature et de ses séquences, pour prouver « rien n'a changé ». */
async function etat(candidatureId: string, sequenceIds: string[]) {
  const [candidature, sequences, places, fiches] = await Promise.all([
    prisma.candidature.findUniqueOrThrow({
      where: { id: candidatureId },
      select: {
        statut: true,
        benevoleId: true,
        courrielEnAttente: true,
        choix: {
          select: { statut: true, traiteParId: true, traiteLe: true },
          orderBy: { id: 'asc' },
        },
      },
    }),
    prisma.sequence.findMany({
      where: { id: { in: sequenceIds } },
      select: { id: true, version: true },
      orderBy: { id: 'asc' },
    }),
    prisma.placeSequence.count({
      where: { sequenceId: { in: sequenceIds } },
    }),
    prisma.benevole.count({ where: { organisationId: ids.org } }),
  ])
  return JSON.stringify({ candidature, sequences, places, fiches })
}

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: {
        slug,
        nom: `Organisation ${slug}`,
        configuration: {},
        apiActivee: true,
      },
    })
  ).id
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug,
        nom: 'Tournoi',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
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
  for (const cle of ['admin', 'referent', 'basketteuse'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
      },
    })
  }
  await prisma.adminActivite.create({
    data: {
      userId: ids.admin,
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
    ],
  })
  ids.appel = (
    await prisma.appelBenevoles.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        portee: 'PERIODE',
        nom: 'Appel',
        ouvertLe: new Date(),
        fermeLe: new Date('2027-06-06T20:00:00+02:00'),
        sel: nouveauSel(),
        empreinte: empreinteJeton(randomUUID()),
        fin: 'abcdef',
      },
    })
  ).id
  // Un jeton d'accès en lecture, et une application autorisée en lecture
  // (ADR 0064 et 0067), au nom de l'admin de l'activité.
  const expireLe = new Date(Date.now() + 86_400_000)
  jetonLecture = nouveauJetonAcces()
  await prisma.jetonAcces.create({
    data: {
      organisationId: ids.org,
      userId: ids.admin,
      creeParId: ids.admin,
      nom: 'lecture',
      empreinte: empreinteJetonAcces(jetonLecture),
      apercu: apercuJeton(jetonLecture),
      portee: 'LECTURE',
      expireLe,
    },
  })
  const application = await prisma.clientApplication.create({
    data: {
      clientId: `https://application-${s}.exemple.org/client.json`,
      source: 'CIMD',
      nom: 'Application de tri',
      redirectUris: ['https://application.exemple.org/retour'],
      valideJusquau: expireLe,
    },
  })
  const autorisation = await prisma.jetonAcces.create({
    data: {
      organisationId: ids.org,
      userId: ids.admin,
      creeParId: ids.admin,
      nom: 'Application de tri',
      empreinte: empreinteJetonAcces(nouveauJetonAcces()),
      apercu: 'appli000',
      portee: 'LECTURE',
      expireLe,
      clientApplicationId: application.id,
    },
  })
  jetonApplication = (
    await prisma.$transaction(tx =>
      emettreJetons(tx, {
        id: autorisation.id,
        portee: 'LECTURE',
        lectureDocuments: false,
        expireLe,
      })
    )
  ).access_token
})

afterAll(async () => {
  await prisma.candidature.deleteMany({ where: { organisationId: ids.org } })
  await prisma.appelBenevoles.deleteMany({ where: { organisationId: ids.org } })
  await prisma.sequence.deleteMany({ where: { organisationId: ids.org } })
  await prisma.benevole.deleteMany({ where: { organisationId: ids.org } })
  await prisma.jetonAcces.deleteMany({ where: { organisationId: ids.org } })
  await prisma.clientApplication.deleteMany({
    where: { clientId: { contains: `application-${s}.` } },
  })
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

beforeEach(() => {
  enFile.length = 0
})

const liens = () => enFile.filter(j => j.sorte === 'benevole-lien').length

describe('acceptation avec le statut lu', () => {
  it('refuse un choix refusé entre-temps : rien ne s’écrit, aucun mail', async () => {
    const sq = await sequence()
    const c = await deposer([sq])
    const choix = c.choix[0]!.id
    expect(
      (await executer(ids.referent, REFUSER, { id: choix })).errors
    ).toBeUndefined()
    const avant = await etat(c.id, [sq])
    const r = await executer(ids.admin, ACCEPTER, {
      id: choix,
      st: 'EN_ATTENTE',
    })
    expect(code(r)).toBe('CONFLIT_VERSION')
    expect(r.errors?.[0]?.extensions?.statutCourant).toBe('REFUSE')
    expect(await etat(c.id, [sq])).toBe(avant)
    expect(enFile).toEqual([])
  })

  it('accepte un choix dont le statut n’a pas changé, et sans argument comme avant', async () => {
    const sq = await sequence()
    const [a, b] = [await deposer([sq]), await deposer([sq])]
    const r = await executer(ids.referent, ACCEPTER, {
      id: a.choix[0]!.id,
      st: 'EN_ATTENTE',
    })
    expect(r.errors).toBeUndefined()
    expect(liens()).toBe(1)
    // Sans statutAttendu, un choix refusé s'accepte encore (ADR 0070).
    await executer(ids.referent, REFUSER, { id: b.choix[0]!.id })
    const sans = await executer(ids.referent, ACCEPTER, { id: b.choix[0]!.id })
    expect(sans.errors).toBeUndefined()
    expect(
      (sans.data as { accepterChoixCandidature: { statut: string } })
        .accepterChoixCandidature.statut
    ).toBe('TRAITEE')
    expect(
      await prisma.placeSequence.count({ where: { sequenceId: sq } })
    ).toBe(2)
  })

  it('deux acceptations simultanées ne créent qu’une place et un mail', async () => {
    const sq = await sequence()
    const c = await deposer([sq])
    const choix = c.choix[0]!.id
    const [r1, r2] = await Promise.all([
      executer(ids.admin, ACCEPTER, { id: choix, st: 'EN_ATTENTE' }),
      executer(ids.referent, ACCEPTER, { id: choix, st: 'EN_ATTENTE' }),
    ])
    for (const r of [r1, r2]) {
      expect(r.errors).toBeUndefined()
      expect(
        (
          r.data as {
            accepterChoixCandidature: { choix: { statut: string }[] }
          }
        ).accepterChoixCandidature.choix
      ).toEqual([{ id: choix, statut: 'ACCEPTE' }])
    }
    expect(
      await prisma.placeSequence.count({ where: { sequenceId: sq } })
    ).toBe(1)
    expect(liens()).toBe(1)
    expect(enFile).toHaveLength(1)
  })

  it('rend sans erreur ni écriture un choix déjà accepté', async () => {
    const sq = await sequence()
    const c = await deposer([sq])
    const choix = c.choix[0]!.id
    await executer(ids.admin, ACCEPTER, { id: choix })
    const avant = await etat(c.id, [sq])
    enFile.length = 0
    for (const st of ['EN_ATTENTE', 'REFUSE', 'ACCEPTE']) {
      const r = await executer(ids.referent, ACCEPTER, { id: choix, st })
      expect(r.errors).toBeUndefined()
      // placerBenevole suit la même règle pour un choix accepté et placé.
      const p = await executer(ids.referent, PLACER, { sq, c: c.id, st })
      expect(p.errors).toBeUndefined()
    }
    expect(await etat(c.id, [sq])).toBe(avant)
    expect(enFile).toEqual([])
  })
})

describe('placement avec le statut lu', () => {
  it('refuse une séquence sans choix : statutCourant nul, rien ne s’écrit', async () => {
    const choisie = await sequence()
    const autre = await sequence()
    const c = await deposer([choisie])
    const avant = await etat(c.id, [choisie, autre])
    for (const st of ['EN_ATTENTE', 'LISTE_ATTENTE', 'REFUSE']) {
      const r = await executer(ids.referent, PLACER, { sq: autre, c: c.id, st })
      expect(code(r)).toBe('CONFLIT_VERSION')
      expect(r.errors?.[0]?.extensions).toHaveProperty('statutCourant', null)
    }
    expect(await etat(c.id, [choisie, autre])).toBe(avant)
    expect(enFile).toEqual([])
    // Sans l'argument, la candidature se place sur une séquence non choisie.
    const r = await executer(ids.referent, PLACER, { sq: autre, c: c.id })
    expect(r.errors).toBeUndefined()
    expect(liens()).toBe(1)
  })

  it('refuse un choix refusé entre-temps, et place un choix au statut lu', async () => {
    const sq = await sequence()
    const c = await deposer([sq], { statut: 'LISTE_ATTENTE' })
    await executer(ids.referent, REFUSER, { id: c.choix[0]!.id })
    const avant = await etat(c.id, [sq])
    const r = await executer(ids.referent, PLACER, {
      sq,
      c: c.id,
      st: 'LISTE_ATTENTE',
    })
    expect(code(r)).toBe('CONFLIT_VERSION')
    expect(r.errors?.[0]?.extensions?.statutCourant).toBe('REFUSE')
    expect(await etat(c.id, [sq])).toBe(avant)
    expect(enFile).toEqual([])
    const ok = await executer(ids.referent, PLACER, {
      sq,
      c: c.id,
      st: 'REFUSE',
    })
    expect(ok.errors).toBeUndefined()
    expect(liens()).toBe(1)
  })

  it('deux placements simultanés ne créent qu’une place et un mail', async () => {
    const sq = await sequence()
    const c = await deposer([sq])
    const [r1, r2] = await Promise.all([
      executer(ids.admin, PLACER, { sq, c: c.id, st: 'EN_ATTENTE' }),
      executer(ids.referent, PLACER, { sq, c: c.id, st: 'EN_ATTENTE' }),
    ])
    expect(r1.errors).toBeUndefined()
    expect(r2.errors).toBeUndefined()
    expect(
      await prisma.placeSequence.count({ where: { sequenceId: sq } })
    ).toBe(1)
    expect(enFile).toHaveLength(1)
  })
})

describe('remise en attente', () => {
  it('rend « en attente » sous le besoin, efface le traitement et rouvre la candidature', async () => {
    const sq = await sequence(2)
    const c = await deposer([sq])
    await executer(ids.referent, REFUSER, { id: c.choix[0]!.id })
    const close = await prisma.candidature.findUniqueOrThrow({
      where: { id: c.id },
    })
    expect(close).toMatchObject({ statut: 'TRAITEE', courrielEnAttente: null })
    const r = await executer(ids.referent, REMETTRE, {
      id: c.choix[0]!.id,
      st: 'REFUSE',
    })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      remettreChoixEnAttente: {
        id: c.id,
        statut: 'EN_ATTENTE',
        choix: [{ id: c.choix[0]!.id, statut: 'EN_ATTENTE' }],
      },
    })
    const ecrite = await prisma.candidature.findUniqueOrThrow({
      where: { id: c.id },
      include: { choix: true },
    })
    expect(ecrite.courrielEnAttente).toBe(c.courriel)
    expect(ecrite.choix[0]).toMatchObject({
      statut: 'EN_ATTENTE',
      traiteParId: null,
      traiteLe: null,
    })
    expect(enFile).toEqual([])
  })

  it('rend « en liste d’attente » quand les renforts atteignent le besoin', async () => {
    const sq = await sequence(1)
    const placee = await deposer([sq])
    await executer(ids.admin, ACCEPTER, { id: placee.choix[0]!.id })
    const c = await deposer([sq], { statut: 'REFUSE', candidature: 'TRAITEE' })
    enFile.length = 0
    const r = await executer(ids.admin, REMETTRE, { id: c.choix[0]!.id })
    expect(r.errors).toBeUndefined()
    expect(
      (r.data as { remettreChoixEnAttente: { choix: { statut: string }[] } })
        .remettreChoixEnAttente.choix[0]!.statut
    ).toBe('LISTE_ATTENTE')
    expect(enFile).toEqual([])
  })

  it('refuse un choix dans un autre statut, et un statut attendu autre que refusé', async () => {
    const sq = await sequence()
    const c = await deposer([sq])
    const choix = c.choix[0]!.id
    const avant = await etat(c.id, [sq])
    const attente = await executer(ids.referent, REMETTRE, { id: choix })
    expect(await etat(c.id, [sq])).toBe(avant)
    expect(code(attente)).toBe('CONFLIT_VERSION')
    expect(attente.errors?.[0]?.extensions?.statutCourant).toBe('EN_ATTENTE')
    const mauvais = await executer(ids.referent, REMETTRE, {
      id: choix,
      st: 'EN_ATTENTE',
    })
    expect(code(mauvais)).toBe('SAISIE_INVALIDE')
    await executer(ids.referent, ACCEPTER, { id: choix })
    const acceptee = await executer(ids.referent, REMETTRE, { id: choix })
    expect(code(acceptee)).toBe('CONFLIT_VERSION')
    expect(acceptee.errors?.[0]?.extensions?.statutCourant).toBe('ACCEPTE')
  })

  it('se refuse à une personne qui n’écrit pas la séquence', async () => {
    const sq = await sequence()
    const c = await deposer([sq], { statut: 'REFUSE', candidature: 'TRAITEE' })
    const avant = await etat(c.id, [sq])
    const r = await executer(ids.basketteuse, REMETTRE, { id: c.choix[0]!.id })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await etat(c.id, [sq])).toBe(avant)
  })

  it('se refuse à un jeton d’accès ou d’application en lecture', async () => {
    const sq = await sequence()
    const c = await deposer([sq], { statut: 'REFUSE', candidature: 'TRAITEE' })
    const avant = await etat(c.id, [sq])
    for (const jeton of [jetonLecture, jetonApplication]) {
      // Le jeton se lit : seule l'écriture lui est refusée.
      const lu = await executer(
        { jeton },
        'query ($e: ID!) { candidatures(editionId: $e) { id } }',
        { e: ids.edition }
      )
      expect(lu.errors).toBeUndefined()
      const r = await executer({ jeton }, REMETTRE, { id: c.choix[0]!.id })
      expect(code(r)).toBe('PORTEE_INSUFFISANTE')
    }
    expect(await etat(c.id, [sq])).toBe(avant)
  })

  it('ne remet pas en attente le choix d’une candidature retirée', async () => {
    const sq = await sequence()
    const c = await deposer([sq], { statut: 'REFUSE', candidature: 'RETIREE' })
    const avant = await etat(c.id, [sq])
    const r = await executer(ids.admin, REMETTRE, { id: c.choix[0]!.id })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await etat(c.id, [sq])).toBe(avant)
  })

  it('garde une adresse en attente nulle pour une ligne importée avec un identifiant externe', async () => {
    const sq = await sequence()
    const courriel = `acheteur-${randomUUID()}@exemple.fr`
    // L'autre billet du même acheteur attend sur l'appel, sans adresse en
    // attente (ADR 0042).
    await deposer([sq], {
      courriel,
      origine: 'IMPORT',
      refExterne: `billet-a-${s}`,
      courrielEnAttente: null,
    })
    const c = await deposer([sq], {
      courriel,
      statut: 'REFUSE',
      candidature: 'TRAITEE',
      origine: 'IMPORT',
      refExterne: `billet-b-${s}`,
    })
    const r = await executer(ids.admin, REMETTRE, { id: c.choix[0]!.id })
    expect(r.errors).toBeUndefined()
    expect(
      await prisma.candidature.findUniqueOrThrow({
        where: { id: c.id },
        select: { statut: true, courrielEnAttente: true },
      })
    ).toEqual({ statut: 'EN_ATTENTE', courrielEnAttente: null })
  })

  it('reprend l’adresse d’une ligne importée sans identifiant externe', async () => {
    const sq = await sequence()
    const c = await deposer([sq], {
      statut: 'REFUSE',
      candidature: 'TRAITEE',
      origine: 'IMPORT',
    })
    const r = await executer(ids.admin, REMETTRE, { id: c.choix[0]!.id })
    expect(r.errors).toBeUndefined()
    expect(
      (
        await prisma.candidature.findUniqueOrThrow({
          where: { id: c.id },
          select: { courrielEnAttente: true },
        })
      ).courrielEnAttente
    ).toBe(c.courriel)
  })

  it('refuse une seconde candidature en attente pour la même adresse sur l’appel', async () => {
    const sq = await sequence()
    const courriel = `double-${randomUUID()}@exemple.fr`
    const c = await deposer([sq], {
      courriel,
      statut: 'REFUSE',
      candidature: 'TRAITEE',
    })
    await deposer([sq], { courriel })
    const avant = await etat(c.id, [sq])
    const r = await executer(ids.admin, REMETTRE, { id: c.choix[0]!.id })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await etat(c.id, [sq])).toBe(avant)
  })

  it('simultanée d’une acceptation du même choix, ne laisse jamais un choix en attente à côté d’une place', async () => {
    for (let essai = 0; essai < 6; essai++) {
      const sq = await sequence()
      const c = await deposer([sq], {
        statut: 'REFUSE',
        candidature: 'TRAITEE',
      })
      const choix = c.choix[0]!.id
      // L'ordre de départ alterne : chaque mutation passe parfois la première.
      const actions = [
        () => executer(ids.admin, ACCEPTER, { id: choix }),
        () => executer(ids.referent, REMETTRE, { id: choix, st: 'REFUSE' }),
      ]
      if (essai % 2 === 1) actions.reverse()
      const reponses = await Promise.all(actions.map(a => a()))
      for (const r of reponses) {
        if (r.errors !== undefined) expect(code(r)).toBe('CONFLIT_VERSION')
      }
      const ecrit = await prisma.choixCandidature.findUniqueOrThrow({
        where: { id: choix },
        select: { statut: true },
      })
      const places = await prisma.placeSequence.count({
        where: { sequenceId: sq },
      })
      expect({ statut: ecrit.statut, places }, `essai ${essai}`).toSatisfy(
        (e: { statut: string; places: number }) =>
          (e.statut === 'ACCEPTE' && e.places === 1) ||
          (['EN_ATTENTE', 'LISTE_ATTENTE'].includes(e.statut) && e.places === 0)
      )
    }
  })

  it('simultanée d’une acceptation sur la même séquence, compte les renforts de cette acceptation', async () => {
    const sq = await sequence(1)
    const c = await deposer([sq], { statut: 'REFUSE', candidature: 'TRAITEE' })
    const fiche = await prisma.benevole.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        nom: 'Fiche placée',
        accordLe: new Date(),
        creeParId: ids.admin,
      },
    })
    // Une acceptation tient le verrou de la séquence : la remise en attente
    // l'attend, puis lit le renfort que cette acceptation vient d'ajouter.
    let liberer: () => void = () => undefined
    let verrouPris: () => void = () => undefined
    const pris = new Promise<void>(r => (verrouPris = r))
    const relache = new Promise<void>(r => (liberer = r))
    const acceptation = prisma.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT id FROM Sequence WHERE id = ${sq} FOR UPDATE`
        verrouPris()
        await relache
        await tx.placeSequence.create({
          data: { sequenceId: sq, benevoleId: fiche.id, role: 'RENFORT' },
        })
      },
      { timeout: 20_000 }
    )
    await pris
    const remise = executer(ids.admin, REMETTRE, { id: c.choix[0]!.id })
    // La remise en attente part avant le renfort, et bloque sur la séquence.
    await new Promise(r => setTimeout(r, 300))
    liberer()
    await acceptation
    const r = await remise
    expect(r.errors).toBeUndefined()
    expect(
      (r.data as { remettreChoixEnAttente: { choix: { statut: string }[] } })
        .remettreChoixEnAttente.choix[0]!.statut
    ).toBe('LISTE_ATTENTE')
  })
})
