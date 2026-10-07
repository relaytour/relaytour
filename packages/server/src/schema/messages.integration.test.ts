import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { construireExport } from '../lib/export.ts'
import { peutRecevoir } from '../lib/flux.ts'
import { CORPS_MAX } from '../lib/messages.ts'

import { schema } from './index.ts'

// Messages (ADR 0020) : un admin prépare un message et l'envoie depuis sa messagerie.
// Les contrôles d'accès se prouvent par le refus : qui écrit, à qui, et qui relit
// l'historique. Le fichier crée sa propre organisation.

const s = randomUUID().slice(0, 8)
const slug = `messages-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const adresse = (cle: string) => `${cle}-${slug}@exemple.fr`
const ids = {
  org: '',
  ailleurs: '',
  tournoi: '',
  club: '',
  edition: '',
  saison: '',
  natation: '',
  course: '',
  admin: '', // admin de l'organisation
  anna: '', // admin du tournoi
  boris: '', // admin du club
  carla: '', // référente natation (tournoi)
  dan: '', // souhait pour la natation (tournoi)
  eve: '', // membre sans lien avec une activité
  fay: '', // référente course (club)
  gil: '', // compte archivé, affecté à la natation
  hors: '', // membre d'une autre organisation
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

const LIRE = `query ($a: ID) {
  messages(activiteId: $a) {
    id objet corps modele champ statut statutLe activiteId editionId perimetreId
    estLeMien
    auteur { id nom }
    destinataires { enCopie personne { id nom } }
  }
}`
const CREER = `mutation ($m: MessageInput!) {
  creerMessage(message: $m) {
    id statut champ estLeMien destinataires { enCopie personne { id } }
  }
}`
const STATUT = `mutation ($id: ID!, $s: StatutMessage!) {
  definirStatutMessage(id: $id, statut: $s) { id statut statutLe }
}`

interface Saisie {
  activiteId?: string | null
  editionId?: string | null
  perimetreId?: string | null
  modele?: string
  objet?: string
  corps?: string
  champ?: 'A' | 'CC' | 'CCI'
  destinataireIds?: string[]
  enCopieIds?: string[]
}

const creer = (userId: string | null, saisie: Saisie = {}) =>
  executer(userId, CREER, {
    m: {
      activiteId: ids.tournoi,
      modele: 'message-libre',
      objet: 'Réunion de lancement',
      corps: 'Bonjour à toutes et à tous,\n\nLa réunion a lieu jeudi.',
      champ: 'CCI',
      destinataireIds: [ids.carla, ids.dan],
      ...saisie,
    },
  })

const idCree = (r: Awaited<ReturnType<typeof executer>>) =>
  (r.data?.creerMessage as { id: string } | undefined)?.id ?? ''

const compter = () =>
  prisma.message.count({ where: { organisationId: ids.org } })

beforeAll(async () => {
  await apollo.start()
  const groupes = [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }]
  const organisation = await prisma.organisation.create({
    data: { slug, nom: 'Organisation', configuration: {} },
  })
  ids.org = organisation.id
  ids.ailleurs = (
    await prisma.organisation.create({
      data: { slug: `${slug}-ailleurs`, nom: 'Ailleurs', configuration: {} },
    })
  ).id
  for (const [cle, nom] of [
    ['tournoi', 'Tournoi'],
    ['club', 'Club'],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: `${slug}-${cle}`,
          nom,
          groupes,
        },
      })
    ).id
  }
  for (const [cle, activite] of [
    ['edition', 'tournoi'],
    ['saison', 'club'],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId: ids[activite],
          annee: 2027,
          nom: `${activite} 2027`,
          debut: new Date('2027-08-27'),
          fin: new Date('2027-08-29'),
          statut: 'PREPARATION',
        },
      })
    ).id
  }
  for (const [cle, activite] of [
    ['natation', 'tournoi'],
    ['course', 'club'],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids[activite],
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
    'anna',
    'boris',
    'carla',
    'dan',
    'eve',
    'fay',
    'gil',
    'hors',
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: adresse(cle),
        name: `${cle} ${s}`,
        archivedAt: cle === 'gil' ? new Date() : null,
        appartenances: {
          create: {
            organisationId: cle === 'hors' ? ids.ailleurs : ids.org,
            role: cle === 'admin' ? 'ADMIN' : 'MEMBRE',
          },
        },
      },
    })
  }
  await prisma.adminActivite.createMany({
    data: [
      { userId: ids.anna, activiteId: ids.tournoi, organisationId: ids.org },
      { userId: ids.boris, activiteId: ids.club, organisationId: ids.org },
    ],
  })
  await prisma.affectation.createMany({
    data: [
      { userId: ids.carla, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.gil, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.fay, perimetreId: ids.course, editionId: ids.saison },
    ],
  })
  await prisma.souhait.create({
    data: {
      userId: ids.dan,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
})

afterAll(async () => {
  const dansLOrganisation = { perimetre: { organisationId: ids.org } }
  await prisma.message.deleteMany({ where: { organisationId: ids.org } })
  await prisma.souhait.deleteMany({ where: dansLOrganisation })
  await prisma.affectation.deleteMany({ where: dansLOrganisation })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
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

describe('écrire un message', () => {
  it('refuse une requête sans session, une référente et une personne d’une autre organisation', async () => {
    const avant = await compter()
    for (const userId of [null, ids.carla, ids.hors]) {
      expect((await creer(userId)).errors).toBeDefined()
      expect(
        (await executer(userId, LIRE, { a: ids.tournoi })).errors
      ).toBeDefined()
    }
    expect(await compter()).toBe(avant)
  })

  it('garde le message d’un admin d’activité pour son équipe', async () => {
    const r = await creer(ids.anna, {
      editionId: ids.edition,
      perimetreId: ids.natation,
      enCopieIds: [ids.carla],
    })
    expect(r.errors).toBeUndefined()
    expect(r.data?.creerMessage).toMatchObject({
      statut: 'EN_COURS',
      champ: 'CCI',
      estLeMien: true,
    })
    const message = await prisma.message.findUniqueOrThrow({
      where: { id: idCree(r) },
      include: { destinataires: true },
    })
    expect(message).toMatchObject({
      organisationId: ids.org,
      activiteId: ids.tournoi,
      editionId: ids.edition,
      perimetreId: ids.natation,
      auteurId: ids.anna,
    })
    expect(
      message.destinataires
        .map(d => [d.userId, d.enCopie])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    ).toEqual(
      [
        [ids.carla, true],
        [ids.dan, false],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    )
  })

  it('refuse un destinataire que l’admin d’activité ne lit pas', async () => {
    const avant = await compter()
    for (const cle of ['eve', 'fay', 'gil', 'hors'] as const) {
      const r = await creer(ids.anna, {
        destinataireIds: [ids.carla, ids[cle]],
      })
      expect(code(r), cle).toBe('FORBIDDEN')
    }
    const inconnu = await creer(ids.anna, { destinataireIds: [randomUUID()] })
    expect(code(inconnu)).toBe('FORBIDDEN')
    expect(await compter()).toBe(avant)
  })

  it('refuse à un admin d’activité un message de l’annuaire ou d’une autre activité', async () => {
    const avant = await compter()
    expect(code(await creer(ids.anna, { activiteId: null }))).toBe('FORBIDDEN')
    expect(
      code(
        await creer(ids.anna, {
          activiteId: ids.club,
          destinataireIds: [ids.fay],
        })
      )
    ).toBe('FORBIDDEN')
    expect(await compter()).toBe(avant)
  })

  it('refuse une période ou un périmètre d’une autre activité', async () => {
    const avant = await compter()
    expect(code(await creer(ids.admin, { editionId: ids.saison }))).toBe(
      'FORBIDDEN'
    )
    expect(code(await creer(ids.admin, { perimetreId: ids.course }))).toBe(
      'FORBIDDEN'
    )
    // Un message de l'annuaire ne porte ni période ni périmètre.
    expect(
      code(
        await creer(ids.admin, {
          activiteId: null,
          editionId: ids.edition,
          destinataireIds: [ids.eve],
        })
      )
    ).toBe('FORBIDDEN')
    expect(await compter()).toBe(avant)
  })

  it('laisse un admin de l’organisation écrire à des membres depuis l’annuaire', async () => {
    const r = await creer(ids.admin, {
      activiteId: null,
      champ: 'CC',
      destinataireIds: [ids.eve, ids.fay, ids.eve],
    })
    expect(r.errors).toBeUndefined()
    const message = await prisma.message.findUniqueOrThrow({
      where: { id: idCree(r) },
      include: { destinataires: true },
    })
    expect(message.activiteId).toBeNull()
    expect(message.destinataires).toHaveLength(2)

    const avant = await compter()
    for (const cle of ['hors', 'gil'] as const) {
      const refus = await creer(ids.admin, {
        activiteId: null,
        destinataireIds: [ids[cle]],
      })
      expect(code(refus), cle).toBe('FORBIDDEN')
    }
    expect(await compter()).toBe(avant)
  })

  it('refuse une saisie incohérente', async () => {
    const avant = await compter()
    const saisies: Saisie[] = [
      { champ: 'A' },
      { champ: 'CC', destinataireIds: [ids.carla] },
      { champ: 'CCI', destinataireIds: [ids.carla] },
      { destinataireIds: [ids.carla, ids.anna] },
      { champ: 'CC', enCopieIds: [ids.carla] },
      { enCopieIds: [ids.anna] },
      { objet: '   ' },
      { corps: 'x'.repeat(CORPS_MAX + 1) },
      { modele: 'Modèle inconnu' },
      { destinataireIds: [] },
    ]
    for (const saisie of saisies) {
      expect(code(await creer(ids.anna, saisie)), JSON.stringify(saisie)).toBe(
        'SAISIE_INVALIDE'
      )
    }
    expect(await compter()).toBe(avant)
  })

  it('accepte le champ « À » pour une seule personne', async () => {
    const r = await creer(ids.anna, {
      champ: 'A',
      destinataireIds: [ids.carla],
    })
    expect(r.errors).toBeUndefined()
  })
})

describe('relire l’historique', () => {
  it('montre à un admin d’activité les messages de son activité seulement', async () => {
    const r = await executer(ids.anna, LIRE, { a: ids.tournoi })
    expect(r.errors).toBeUndefined()
    const messages = r.data?.messages as {
      activiteId: string | null
      auteur: { id: string }
    }[]
    expect(messages.length).toBeGreaterThan(0)
    expect(messages.every(m => m.activiteId === ids.tournoi)).toBe(true)

    // L'historique de l'organisation et celui d'une autre activité lui sont fermés.
    expect(code(await executer(ids.anna, LIRE))).toBe('FORBIDDEN')
    expect(code(await executer(ids.anna, LIRE, { a: ids.club }))).toBe(
      'FORBIDDEN'
    )
    expect(code(await executer(ids.boris, LIRE, { a: ids.tournoi }))).toBe(
      'FORBIDDEN'
    )
  })

  it('ne montre à l’admin d’une autre activité aucun message du tournoi', async () => {
    const r = await executer(ids.boris, LIRE, { a: ids.club })
    expect(r.errors).toBeUndefined()
    expect(r.data?.messages).toEqual([])
  })

  it('montre tous les messages à un admin de l’organisation', async () => {
    const r = await executer(ids.admin, LIRE)
    expect(r.errors).toBeUndefined()
    const messages = r.data?.messages as { activiteId: string | null }[]
    expect(messages.some(m => m.activiteId === null)).toBe(true)
    expect(messages.some(m => m.activiteId === ids.tournoi)).toBe(true)
  })
})

describe('déclarer le statut d’un message', () => {
  it('laisse l’auteur déclarer l’envoi, puis revenir en arrière', async () => {
    const id = idCree(await creer(ids.anna))
    const envoye = await executer(ids.anna, STATUT, { id, s: 'ENVOYE' })
    expect(envoye.errors).toBeUndefined()
    expect(envoye.data?.definirStatutMessage).toMatchObject({
      statut: 'ENVOYE',
    })
    expect(
      (envoye.data?.definirStatutMessage as { statutLe: string | null })
        .statutLe
    ).not.toBeNull()

    const repris = await executer(ids.anna, STATUT, { id, s: 'EN_COURS' })
    expect(repris.data?.definirStatutMessage).toMatchObject({
      statut: 'EN_COURS',
      statutLe: null,
    })
  })

  it('refuse le statut à toute autre personne que l’auteur', async () => {
    const id = idCree(await creer(ids.anna))
    for (const userId of [null, ids.admin, ids.boris, ids.carla]) {
      const r = await executer(userId, STATUT, { id, s: 'ANNULE' })
      expect(r.errors).toBeDefined()
    }
    expect(code(await executer(ids.admin, STATUT, { id, s: 'ANNULE' }))).toBe(
      'FORBIDDEN'
    )
    expect(
      code(await executer(ids.anna, STATUT, { id: randomUUID(), s: 'ANNULE' }))
    ).toBe('FORBIDDEN')
    const message = await prisma.message.findUniqueOrThrow({ where: { id } })
    expect(message.statut).toBe('EN_COURS')
  })
})

describe('signal et export', () => {
  const signal = (activiteId: string | null) => ({
    entite: 'MESSAGE' as const,
    organisationId: ids.org,
    activiteId,
    id: 'x',
  })
  const recoit = async (userId: string, activiteId: string | null) =>
    peutRecevoir(
      await buildContext('127.0.0.1', userId, slug),
      signal(activiteId)
    )

  it('envoie le signal d’un message aux seules personnes qui le lisent', async () => {
    expect(await recoit(ids.anna, ids.tournoi)).toBe(true)
    expect(await recoit(ids.admin, ids.tournoi)).toBe(true)
    expect(await recoit(ids.boris, ids.tournoi)).toBe(false)
    expect(await recoit(ids.carla, ids.tournoi)).toBe(false)
    // Un message de l'annuaire ne concerne que les admins de l'organisation.
    expect(await recoit(ids.admin, null)).toBe(true)
    expect(await recoit(ids.anna, null)).toBe(false)
  })

  it('porte les messages dans l’export de l’organisation', async () => {
    const { messages } = await construireExport(ids.org)
    expect(messages.length).toBe(await compter())
    const annuaire = messages.find(m => m.activite === null)
    expect(annuaire?.auteur).toBe(adresse('admin'))
    expect(annuaire?.destinataires.map(d => d.email).sort()).toEqual(
      [adresse('eve'), adresse('fay')].sort()
    )
  })
})
