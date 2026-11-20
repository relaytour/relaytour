import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { contexteDeJetonAcces } from '../contexte-jeton.ts'
import { construireExport } from '../lib/export.ts'
import { peutRecevoir } from '../lib/flux.ts'
import {
  apercuJeton,
  empreinteJetonAcces,
  nouveauJetonAcces,
} from '../lib/jetons-acces.ts'
import { CORPS_MAX } from '../lib/messages.ts'
import { purgerApplications } from '../oauth/entretien.ts'
import { emettreJetons } from '../oauth/jetons.ts'

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
        appartenances: {
          create: {
            organisationId: cle === 'hors' ? ids.ailleurs : ids.org,
            role: cle === 'admin' ? 'ADMIN' : 'MEMBRE',
            archiveLe: cle === 'gil' ? new Date() : null,
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
  await prisma.applicationRefusee.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.jetonAcces.deleteMany({ where: { organisationId: ids.org } })
  await prisma.clientApplication.deleteMany({
    where: { clientId: { contains: s } },
  })
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

// Origine d'un message préparé par un programme (ADR 0071). Chaque point de la
// revue de sécurité de l'ADR se prouve ici, par le refus quand il s'agit d'un
// contrôle d'accès.
describe('origine d’un message', () => {
  const ip = '127.0.0.1'
  const CIMD = `https://outil-${s}.exemple.org/client.json`
  const DCR = `dcr_${s}-assistant`
  const jetons = {
    acces: '', // valeur du jeton d'accès d'Anna
    accesId: '',
    accesApercu: '',
    accesEmpreinte: '',
    cimd: '', // autorisation de l'application CIMD
    dcr: '', // autorisation de l'application DCR
    clientCimd: '',
    clientDcr: '',
  }
  const enUnAn = () => new Date(Date.now() + 365 * 86_400_000)

  const executerAvec = async (
    ctx: AppContext,
    query: string,
    variables: Record<string, unknown> = {}
  ) => {
    const reponse = await apollo.executeOperation(
      { query, variables },
      { contextValue: ctx }
    )
    if (reponse.body.kind !== 'single')
      throw new Error('Réponse incrémentale inattendue.')
    return reponse.body.singleResult
  }

  /** Un jeton d'application tout neuf pour une autorisation. */
  const jetonApplication = async (autorisationId: string) => {
    const a = await prisma.jetonAcces.findUniqueOrThrow({
      where: { id: autorisationId },
    })
    const emis = await prisma.$transaction(tx => emettreJetons(tx, a))
    return emis.access_token
  }

  const saisie = (objet: string) => ({
    activiteId: ids.tournoi,
    modele: 'message-libre',
    objet,
    corps: 'Bonjour à toutes et à tous,\n\nLe planning est en ligne.',
    champ: 'CCI',
    destinataireIds: [ids.carla, ids.dan],
  })

  const creerAvec = async (ctx: AppContext, objet: string) => {
    const r = await executerAvec(ctx, CREER, { m: saisie(objet) })
    expect(r.errors).toBeUndefined()
    return idCree(r)
  }

  const LIRE_ORIGINE = `query ($a: ID) {
    messages(activiteId: $a) { id objet corps origine { sorte nom hote nonVerifiee } }
  }`

  interface Lu {
    id: string
    objet: string
    corps: string
    origine: {
      sorte: string
      nom: string
      hote: string | null
      nonVerifiee: boolean
    } | null
  }
  const lire = async (userId: string, id: string) => {
    const r = await executer(userId, LIRE_ORIGINE, { a: ids.tournoi })
    expect(r.errors).toBeUndefined()
    return (r.data?.messages as Lu[]).find(m => m.id === id)
  }

  beforeAll(async () => {
    await prisma.organisation.update({
      where: { id: ids.org },
      data: { apiActivee: true },
    })
    const client = (clientId: string, source: 'CIMD' | 'DCR', nom: string) =>
      prisma.clientApplication.create({
        data: {
          clientId,
          source,
          nom,
          redirectUris: ['https://outil.exemple.org/retour'],
          valideJusquau: new Date(Date.now() + 86_400_000),
        },
      })
    jetons.clientCimd = (await client(CIMD, 'CIMD', 'Outil de rédaction')).id
    jetons.clientDcr = (await client(DCR, 'DCR', 'Assistant libre')).id
    const autorisation = async (clientApplicationId: string, nom: string) =>
      (
        await prisma.jetonAcces.create({
          data: {
            organisationId: ids.org,
            userId: ids.anna,
            nom,
            empreinte: randomUUID().replaceAll('-', '').padEnd(64, '0'),
            apercu: randomUUID().slice(0, 8),
            portee: 'LECTURE_ECRITURE',
            expireLe: enUnAn(),
            clientApplicationId,
          },
        })
      ).id
    jetons.cimd = await autorisation(jetons.clientCimd, 'Outil de rédaction')
    jetons.dcr = await autorisation(jetons.clientDcr, 'Assistant libre')
    jetons.acces = nouveauJetonAcces()
    jetons.accesApercu = apercuJeton(jetons.acces)
    jetons.accesEmpreinte = empreinteJetonAcces(jetons.acces)
    jetons.accesId = (
      await prisma.jetonAcces.create({
        data: {
          organisationId: ids.org,
          userId: ids.anna,
          nom: 'Script d’annonces',
          empreinte: jetons.accesEmpreinte,
          apercu: jetons.accesApercu,
          portee: 'LECTURE_ECRITURE',
          expireLe: enUnAn(),
        },
      })
    ).id
  })

  it('ne donne aucune origine à un message créé avec une session', async () => {
    const id = idCree(await creer(ids.anna))
    expect((await lire(ids.anna, id))?.origine).toBeNull()
    const ligne = await prisma.message.findUniqueOrThrow({ where: { id } })
    expect(ligne).toMatchObject({
      origineSorte: null,
      origineNom: null,
      origineHote: null,
      origineNonVerifiee: null,
      clientApplicationId: null,
      jetonAccesId: null,
    })
  })

  it('donne au message d’une application son nom et l’hôte de son client_id', async () => {
    const ctx = await contexteDeJetonAcces(
      ip,
      await jetonApplication(jetons.cimd),
      null
    )
    expect(ctx.refus).toBeNull()
    const id = await creerAvec(ctx, 'Par une application vérifiée')
    expect((await lire(ids.anna, id))?.origine).toEqual({
      sorte: 'APPLICATION',
      nom: 'Outil de rédaction',
      hote: `outil-${s}.exemple.org`,
      nonVerifiee: false,
    })
    const ligne = await prisma.message.findUniqueOrThrow({ where: { id } })
    expect(ligne.clientApplicationId).toBe(jetons.clientCimd)
    expect(ligne.jetonAccesId).toBe(jetons.cimd)
    expect(ligne.auteurId).toBe(ids.anna)
  })

  it('marque « non vérifiée » l’application enregistrée seule, sans hôte', async () => {
    const ctx = await contexteDeJetonAcces(
      ip,
      await jetonApplication(jetons.dcr),
      null
    )
    const id = await creerAvec(ctx, 'Par une application non vérifiée')
    expect((await lire(ids.anna, id))?.origine).toEqual({
      sorte: 'APPLICATION',
      nom: 'Assistant libre',
      hote: null,
      nonVerifiee: true,
    })
  })

  it('donne au message d’un jeton d’accès le libellé du jeton', async () => {
    const ctx = await contexteDeJetonAcces(ip, jetons.acces, null)
    expect(ctx.refus).toBeNull()
    const id = await creerAvec(ctx, 'Par un script')
    expect((await lire(ids.anna, id))?.origine).toEqual({
      sorte: 'JETON_ACCES',
      nom: 'Script d’annonces',
      hote: null,
      nonVerifiee: false,
    })
    const ligne = await prisma.message.findUniqueOrThrow({ where: { id } })
    expect(ligne.jetonAccesId).toBe(jetons.accesId)
    expect(ligne.clientApplicationId).toBeNull()
  })

  it('refuse tout argument qui déclarerait une origine', async () => {
    const ctx = await contexteDeJetonAcces(
      ip,
      await jetonApplication(jetons.cimd),
      null
    )
    const avant = await compter()
    for (const champ of [
      { origine: { sorte: 'APPLICATION', nom: 'Autre application' } },
      { origineNom: 'Autre application' },
      { origineHote: 'ailleurs.exemple.org' },
      { clientApplicationId: jetons.clientDcr },
      { jetonAccesId: jetons.accesId },
    ]) {
      for (const contexte of [ctx, await buildContext(ip, ids.anna, slug)]) {
        const r = await executerAvec(contexte, CREER, {
          m: { ...saisie('Origine choisie'), ...champ },
        })
        expect(r.errors).toBeDefined()
      }
    }
    expect(await compter()).toBe(avant)
    // L'origine tirée du jeton reste celle de l'application qui écrit.
    const id = await creerAvec(ctx, 'Origine du jeton')
    expect((await lire(ids.anna, id))?.origine?.nom).toBe('Outil de rédaction')
  })

  it('n’ajoute aucune mention à l’objet ni au corps du message', async () => {
    const ctx = await contexteDeJetonAcces(
      ip,
      await jetonApplication(jetons.cimd),
      null
    )
    const id = await creerAvec(ctx, 'Objet inchangé')
    const ligne = await prisma.message.findUniqueOrThrow({ where: { id } })
    expect(ligne.objet).toBe('Objet inchangé')
    expect(ligne.corps).toBe(saisie('').corps)
    const lu = await lire(ids.anna, id)
    expect(lu?.objet).toBe('Objet inchangé')
    expect(lu?.corps).toBe(saisie('').corps)
  })

  it('refuse l’origine à un admin d’une autre activité et à une autre organisation', async () => {
    const ctx = await contexteDeJetonAcces(ip, jetons.acces, null)
    const id = await creerAvec(ctx, 'Lu par les seuls admins du tournoi')
    for (const userId of [null, ids.boris, ids.carla, ids.hors]) {
      const r = await executer(userId, LIRE_ORIGINE, { a: ids.tournoi })
      expect(r.errors).toBeDefined()
      expect(JSON.stringify(r)).not.toContain('Script d’annonces')
    }
    const club = await executer(ids.boris, LIRE_ORIGINE, { a: ids.club })
    expect(club.errors).toBeUndefined()
    expect((club.data?.messages as Lu[]).some(m => m.id === id)).toBe(false)
    // Un message de l'annuaire, sans activité, ne s'ouvre qu'aux admins de
    // l'organisation : Anna n'y lit rien.
    expect((await executer(ids.anna, LIRE_ORIGINE, {})).errors).toBeDefined()
    // L'admin de l'organisation lit l'origine, comme le message.
    expect((await lire(ids.admin, id))?.origine?.nom).toBe('Script d’annonces')
  })

  it('ne rend ni l’identifiant du jeton, ni son aperçu, ni son empreinte', async () => {
    const champs = await executer(
      ids.anna,
      '{ __type(name: "OrigineMessage") { fields { name } } }'
    )
    expect(
      (champs.data?.__type as { fields: { name: string }[] }).fields
        .map(f => f.name)
        .sort()
    ).toEqual(['hote', 'nom', 'nonVerifiee', 'sorte'])
    const r = await executer(ids.anna, LIRE_ORIGINE, { a: ids.tournoi })
    const texte = JSON.stringify(r)
    for (const secret of [
      jetons.accesId,
      jetons.accesApercu,
      jetons.accesEmpreinte,
      jetons.acces,
      jetons.cimd,
      jetons.dcr,
      jetons.clientCimd,
      CIMD,
      DCR,
    ]) {
      expect(texte).not.toContain(secret)
    }
    const { messages } = await construireExport(ids.org)
    const exporte = JSON.stringify(messages)
    for (const secret of [jetons.accesId, jetons.accesEmpreinte, jetons.cimd]) {
      expect(exporte).not.toContain(secret)
    }
    expect(messages.some(m => m.origine?.nom === 'Script d’annonces')).toBe(
      true
    )
  })

  it('compte dans le panneau « API » les messages en cours de chaque autorisation', async () => {
    const LISTE = `{ jetonsAccesOrganisation { jeton { id } messagesEnCours } }`
    const compte = async (id: string) => {
      const r = await executer(ids.admin, LISTE)
      expect(r.errors).toBeUndefined()
      return (
        r.data?.jetonsAccesOrganisation as {
          jeton: { id: string }
          messagesEnCours: number
        }[]
      ).find(l => l.jeton.id === id)?.messagesEnCours
    }
    const attendus = (jetonAccesId: string) =>
      prisma.message.count({ where: { jetonAccesId, statut: 'EN_COURS' } })
    const avant = await compte(jetons.cimd)
    expect(avant).toBe(await attendus(jetons.cimd))
    expect(avant).toBeGreaterThan(0)
    // Un message déclaré envoyé sort du compte.
    const ctx = await contexteDeJetonAcces(
      ip,
      await jetonApplication(jetons.cimd),
      null
    )
    const id = await creerAvec(ctx, 'Compté puis envoyé')
    expect(await compte(jetons.cimd)).toBe((avant ?? 0) + 1)
    await executer(ids.anna, STATUT, { id, s: 'ENVOYE' })
    expect(await compte(jetons.cimd)).toBe(avant)
    expect(await compte(jetons.accesId)).toBe(await attendus(jetons.accesId))
    // Le panneau reste aux admins de l'organisation.
    for (const userId of [null, ids.anna, ids.hors]) {
      expect((await executer(userId, LISTE)).errors).toBeDefined()
    }
  })

  it('garde la mention après la révocation de l’autorisation', async () => {
    const ctx = await contexteDeJetonAcces(
      ip,
      await jetonApplication(jetons.cimd),
      null
    )
    const id = await creerAvec(ctx, 'Avant la révocation')
    const avant = await lire(ids.anna, id)
    const r = await executer(
      ids.anna,
      'mutation ($id: ID!) { revoquerJetonAcces(id: $id) }',
      { id: jetons.cimd }
    )
    expect(r.errors).toBeUndefined()
    expect(
      (
        await prisma.jetonAcces.findUniqueOrThrow({
          where: { id: jetons.cimd },
        })
      ).revoqueLe
    ).not.toBeNull()
    expect((await lire(ids.anna, id))?.origine).toEqual(avant?.origine)
    const ligne = await prisma.message.findUniqueOrThrow({ where: { id } })
    expect(ligne.statut).toBe('EN_COURS')
    expect(ligne.jetonAccesId).toBe(jetons.cimd)
  })

  it('garde la mention après le refus de l’application par l’organisation', async () => {
    const ctx = await contexteDeJetonAcces(
      ip,
      await jetonApplication(jetons.dcr),
      null
    )
    const id = await creerAvec(ctx, 'Avant le refus')
    const avant = await lire(ids.anna, id)
    const r = await executer(
      ids.admin,
      'mutation ($c: String!) { refuserApplicationOrganisation(clientId: $c) }',
      { c: DCR }
    )
    expect(r.errors).toBeUndefined()
    expect(r.data?.refuserApplicationOrganisation).toBe(1)
    expect((await lire(ids.anna, id))?.origine).toEqual({
      sorte: 'APPLICATION',
      nom: 'Assistant libre',
      hote: null,
      nonVerifiee: true,
    })
    expect((await lire(ids.anna, id))?.origine).toEqual(avant?.origine)
  })

  it('garde la mention après l’oubli de l’application par la purge', async () => {
    const ids0 = await prisma.message.findMany({
      where: { clientApplicationId: jetons.clientCimd },
      select: { id: true },
    })
    expect(ids0.length).toBeGreaterThan(0)
    // L'autorisation est révoquée depuis 40 jours : la purge oublie l'application.
    const il_y_a_40_jours = new Date(Date.now() - 40 * 86_400_000)
    await prisma.jetonAcces.update({
      where: { id: jetons.cimd },
      data: { revoqueLe: il_y_a_40_jours },
    })
    await prisma.clientApplication.update({
      where: { id: jetons.clientCimd },
      data: { updatedAt: il_y_a_40_jours },
    })
    await purgerApplications(prisma)
    expect(
      await prisma.clientApplication.findUnique({
        where: { id: jetons.clientCimd },
      })
    ).toBeNull()
    for (const { id } of ids0) {
      const ligne = await prisma.message.findUniqueOrThrow({ where: { id } })
      expect(ligne.clientApplicationId).toBeNull()
      expect(ligne.jetonAccesId).toBeNull()
      expect((await lire(ids.anna, id))?.origine).toEqual({
        sorte: 'APPLICATION',
        nom: 'Outil de rédaction',
        hote: `outil-${s}.exemple.org`,
        nonVerifiee: false,
      })
    }
  })

  it('garde le libellé après la suppression du jeton d’accès', async () => {
    const id = (
      await prisma.message.findFirstOrThrow({
        where: { jetonAccesId: jetons.accesId },
        select: { id: true },
      })
    ).id
    await prisma.jetonAcces.delete({ where: { id: jetons.accesId } })
    const ligne = await prisma.message.findUniqueOrThrow({ where: { id } })
    expect(ligne.jetonAccesId).toBeNull()
    expect((await lire(ids.anna, id))?.origine).toEqual({
      sorte: 'JETON_ACCES',
      nom: 'Script d’annonces',
      hote: null,
      nonVerifiee: false,
    })
  })

  it('garde dans le compte d’une réautorisation les messages de l’autorisation remplacée', async () => {
    const client = await prisma.clientApplication.create({
      data: {
        clientId: `https://planning-${s}.exemple.org/client.json`,
        source: 'CIMD',
        nom: 'Planning partagé',
        redirectUris: ['https://planning.exemple.org/retour'],
        valideJusquau: new Date(Date.now() + 86_400_000),
      },
    })
    const autoriser = (userId: string) =>
      prisma.jetonAcces.create({
        data: {
          organisationId: ids.org,
          userId,
          nom: 'Planning partagé',
          empreinte: randomUUID().replaceAll('-', '').padEnd(64, '0'),
          apercu: randomUUID().slice(0, 8),
          portee: 'LECTURE_ECRITURE',
          expireLe: enUnAn(),
          clientApplicationId: client.id,
        },
      })
    const premiere = await autoriser(ids.anna)
    const ctx = await contexteDeJetonAcces(
      ip,
      await jetonApplication(premiere.id),
      null
    )
    await creerAvec(ctx, 'Préparé avant la réautorisation')
    await creerAvec(ctx, 'Préparé avant la réautorisation, bis')
    // Une réautorisation du même client remplace la ligne, comme
    // `autoriserApplication` : l'ancienne est révoquée, une nouvelle est créée.
    await prisma.jetonAcces.update({
      where: { id: premiere.id },
      data: { revoqueLe: new Date() },
    })
    const seconde = await autoriser(ids.anna)
    // La même application autorisée par une autre personne compte à part.
    const autre = await autoriser(ids.admin)

    const LISTE = `{ jetonsAccesOrganisation { jeton { id } messagesEnCours } }`
    const r = await executer(ids.admin, LISTE)
    expect(r.errors).toBeUndefined()
    const lignes = r.data?.jetonsAccesOrganisation as {
      jeton: { id: string }
      messagesEnCours: number
    }[]
    const compte = (id: string) =>
      lignes.find(l => l.jeton.id === id)?.messagesEnCours
    expect(compte(seconde.id)).toBe(2)
    expect(compte(premiere.id)).toBe(2)
    expect(compte(autre.id)).toBe(0)
  })
})
