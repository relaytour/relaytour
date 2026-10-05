import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import express from 'express'
import type { ExecutionResult } from 'graphql'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { creerGestionnaireFlux } from '../flux-http.ts'
import {
  fermerLesFlux,
  FLUX_PAR_PERSONNE,
  nombreDeFlux,
  ouvrirLeFlux,
  peutRecevoir,
  publierChangement,
  RELECTURE_DROITS_MS,
  type Changement,
} from '../lib/flux.ts'

import { schema } from './index.ts'

// Flux des changements (ADR 0017). Un signal ne porte aucune donnée, mais il dit
// qu'une chose existe et vient de changer : il suit les droits de lecture, prouvés
// ici par le refus. Le fichier crée ses organisations : les signaux des autres tests,
// publiés dans le même Valkey, ne le concernent pas.

const s = randomUUID().slice(0, 8)
const slug = `flux-${s}`
const ids = {
  org: '',
  ailleurs: '',
  activite: '',
  autreActivite: '',
  natation: '',
  edition: '',
  admin: '',
  alice: '', // affectée à la natation
  emma: '', // membre sans affectation : aucune activité visible
  zoe: '', // membre d'une autre organisation
}

const contexte = (userId: string | null, organisation = slug) =>
  buildContext('127.0.0.1', userId, organisation)

// Le schéma est construit avec la bibliothèque graphql telle que Node la charge pour
// Pothos, Apollo et graphql-sse. Vitest en résout une autre copie pour les fichiers
// du dépôt : `subscribe` vient donc de la même copie que le schéma.
const { parse, subscribe } = createRequire(import.meta.url)(
  'graphql'
) as typeof import('graphql')

const ABONNEMENT = parse(
  'subscription { changements { entite id activiteId perimetreId editionId } }'
)
type Evenement = ExecutionResult<{ changements: Record<string, string | null> }>

/** Ouvre le flux d'une personne comme le fait le serveur. */
async function ouvrir(userId: string | null, organisation = slug) {
  const flux = await subscribe({
    schema,
    document: ABONNEMENT,
    contextValue: await contexte(userId, organisation),
  })
  return flux as AsyncGenerator<Evenement> | ExecutionResult
}
const estUnFlux = (
  flux: AsyncGenerator<Evenement> | ExecutionResult
): flux is AsyncGenerator<Evenement> => Symbol.asyncIterator in flux

const tache = (details: Partial<Changement> = {}): Changement => ({
  entite: 'TACHE',
  organisationId: ids.org,
  activiteId: ids.activite,
  perimetreId: ids.natation,
  editionId: ids.edition,
  id: `tache-${randomUUID().slice(0, 6)}`,
  ...details,
})

beforeAll(async () => {
  for (const [cle, slugOrg] of [
    ['org', slug],
    ['ailleurs', `${slug}-ailleurs`],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: { slug: slugOrg, nom: slugOrg, configuration: {} },
      })
    ).id
  }
  for (const cle of ['activite', 'autreActivite'] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: `${slug}-${cle}`,
          nom: cle,
          groupes: [],
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
        nom: 'Essai 2027',
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id
  ids.natation = (
    await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: 'natation',
        nom: 'Natation',
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
  for (const [cle, organisationId, role] of [
    ['admin', ids.org, 'ADMIN'],
    ['alice', ids.org, 'MEMBRE'],
    ['emma', ids.org, 'MEMBRE'],
    ['zoe', ids.ailleurs, 'MEMBRE'],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId, role } },
      },
    })
  }
  await prisma.affectation.create({
    data: {
      userId: ids.alice,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
})

afterEach(async () => {
  // Chaque test repart sans flux ouvert.
  await fermerLesFlux()
})

afterAll(async () => {
  const organisations = [ids.org, ids.ailleurs]
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: organisations } } })
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('droit de recevoir un signal', () => {
  it('suit l’organisation et les activités visibles', async () => {
    const changement = tache()
    expect(await peutRecevoir(await contexte(ids.alice), changement)).toBe(true)
    expect(await peutRecevoir(await contexte(ids.admin), changement)).toBe(true)
    // Sans affectation, l'activité n'existe pas pour la personne.
    expect(await peutRecevoir(await contexte(ids.emma), changement)).toBe(false)
    // Une autre organisation, une requête sans session.
    expect(
      await peutRecevoir(
        await contexte(ids.zoe, `${slug}-ailleurs`),
        changement
      )
    ).toBe(false)
    expect(await peutRecevoir(await contexte(null), changement)).toBe(false)
    // Une activité où Alice n'est pas affectée.
    expect(
      await peutRecevoir(
        await contexte(ids.alice),
        tache({ activiteId: ids.autreActivite })
      )
    ).toBe(false)
    // Un signal sans activité ne va à personne.
    expect(
      await peutRecevoir(await contexte(ids.admin), tache({ activiteId: null }))
    ).toBe(false)
  })

  it('réserve une demande aux admins et une notification à son destinataire', async () => {
    const demande = tache({ entite: 'DEMANDE' })
    expect(await peutRecevoir(await contexte(ids.admin), demande)).toBe(true)
    expect(await peutRecevoir(await contexte(ids.alice), demande)).toBe(false)

    const notification: Changement = {
      entite: 'NOTIFICATION',
      organisationId: ids.org,
      destinataireId: ids.alice,
    }
    expect(await peutRecevoir(await contexte(ids.alice), notification)).toBe(
      true
    )
    expect(await peutRecevoir(await contexte(ids.admin), notification)).toBe(
      false
    )
  })
})

describe('abonnement aux changements', () => {
  it('refuse une requête sans session', async () => {
    const flux = await ouvrir(null)
    expect(estUnFlux(flux)).toBe(false)
    expect((flux as ExecutionResult).errors?.[0]?.extensions?.code).toBe(
      'FORBIDDEN'
    )
    expect(nombreDeFlux()).toBe(0)
  })

  it('ne livre que les signaux que la personne peut recevoir, sans donnée', async () => {
    const flux = await ouvrir(ids.alice)
    if (!estUnFlux(flux)) throw new Error('Le flux ne s’est pas ouvert.')
    const suivant = flux.next()
    // Une autre organisation, une autre activité, une demande : rien n'arrive.
    await publierChangement(tache({ organisationId: ids.ailleurs }))
    await publierChangement(tache({ activiteId: ids.autreActivite }))
    await publierChangement(tache({ entite: 'DEMANDE' }))
    await publierChangement(tache({ id: 'tache-visible' }))
    expect((await suivant).value).toEqual({
      data: {
        changements: {
          entite: 'TACHE',
          id: 'tache-visible',
          activiteId: ids.activite,
          perimetreId: ids.natation,
          editionId: ids.edition,
        },
      },
    })
    // Le signal n'expose ni l'organisation ni le destinataire.
    const champs = Object.keys(
      (
        schema.getType('Changement') as unknown as {
          getFields: () => Record<string, unknown>
        }
      ).getFields()
    )
    expect(champs.sort()).toEqual([
      'activiteId',
      'editionId',
      'entite',
      'id',
      'perimetreId',
    ])
    await flux.return(undefined)
  })

  it('limite les flux d’une personne, et libère la place dès la fermeture', async () => {
    const flux = []
    for (let i = 0; i < FLUX_PAR_PERSONNE; i++) {
      const ouvert = await ouvrir(ids.alice)
      if (!estUnFlux(ouvert)) throw new Error('Le flux ne s’est pas ouvert.')
      flux.push(ouvert)
    }
    const deTrop = await ouvrir(ids.alice)
    expect(estUnFlux(deTrop)).toBe(false)
    expect((deTrop as ExecutionResult).errors?.[0]?.extensions?.code).toBe(
      'TROP_DE_FLUX'
    )
    // Une autre personne garde ses propres places.
    const pourAdmin = await ouvrir(ids.admin)
    expect(estUnFlux(pourAdmin)).toBe(true)

    await flux[0]!.return(undefined)
    expect(nombreDeFlux()).toBe(FLUX_PAR_PERSONNE)
    expect(estUnFlux(await ouvrir(ids.alice))).toBe(true)
  })

  it('se ferme à l’arrêt du serveur et après sa durée', async () => {
    const flux = await ouvrir(ids.alice)
    if (!estUnFlux(flux)) throw new Error('Le flux ne s’est pas ouvert.')
    const enAttente = flux.next()
    await fermerLesFlux()
    expect((await enAttente).done).toBe(true)
    expect(nombreDeFlux()).toBe(0)

    const court = await ouvrirLeFlux(await contexte(ids.alice), {
      relireLeContexte: () => contexte(ids.alice),
      dureeMs: 30,
    })
    expect((await court!.next()).done).toBe(true)
    expect(nombreDeFlux()).toBe(0)
  })

  it('se ferme quand la session de sa requête n’est plus valide', async () => {
    // Le serveur HTTP donne au flux de quoi revalider sa session. Ici, la session
    // se ferme après l'ouverture : la relecture rend un contexte anonyme.
    let sessionOuverte = true
    const flux = (await subscribe({
      schema,
      document: ABONNEMENT,
      contextValue: {
        ...(await contexte(ids.alice)),
        relire: () => contexte(sessionOuverte ? ids.alice : null),
      },
    })) as AsyncGenerator<Evenement>
    await publierChangement(tache({ id: 'session-ouverte' }))
    const premier = (await flux.next()).value as Evenement
    expect(premier.data?.changements.id).toBe('session-ouverte')

    sessionOuverte = false
    // Une minute plus tard, le flux relit son contexte au signal suivant.
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + RELECTURE_DROITS_MS + 1_000)
      await publierChangement(tache({ id: 'session-fermee' }))
      expect((await flux.next()).done).toBe(true)
    } finally {
      vi.useRealTimers()
    }
    expect(nombreDeFlux()).toBe(0)
  })

  it('relit les droits de la personne pendant le flux', async () => {
    const flux = await ouvrirLeFlux(await contexte(ids.alice), {
      relireLeContexte: () => contexte(ids.alice),
      relectureMs: 0,
    })
    const lire = async () => (await flux!.next()).value as Changement
    await publierChangement(tache({ id: 'avant' }))
    expect((await lire()).id).toBe('avant')

    // Alice perd son affectation : l'activité n'existe plus pour elle. Sa cloche
    // lui reste.
    await prisma.affectation.deleteMany({ where: { userId: ids.alice } })
    await publierChangement(tache({ id: 'apres' }))
    await publierChangement({
      entite: 'NOTIFICATION',
      organisationId: ids.org,
      destinataireId: ids.alice,
    })
    expect((await lire()).entite).toBe('NOTIFICATION')

    // Son compte est archivé : le flux se ferme au signal suivant.
    await prisma.user.update({
      where: { id: ids.alice },
      data: { archivedAt: new Date() },
    })
    await publierChangement(tache({ id: 'archivee' }))
    expect((await flux!.next()).done).toBe(true)
    expect(nombreDeFlux()).toBe(0)
    await prisma.user.update({
      where: { id: ids.alice },
      data: { archivedAt: null },
    })
    await prisma.affectation.create({
      data: {
        userId: ids.alice,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
    })
  })
})

describe('signal d’une écriture', () => {
  const apollo = new ApolloServer<AppContext>({ schema })
  let tacheId = ''

  beforeAll(async () => {
    await apollo.start()
    tacheId = (
      await prisma.tache.create({
        data: {
          perimetreId: ids.natation,
          editionId: ids.edition,
          titre: 'Réserver la piscine',
        },
      })
    ).id
  })
  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
    await prisma.journal.deleteMany({ where: { tacheId } })
    await prisma.tache.deleteMany({ where: { id: tacheId } })
    await apollo.stop()
  })

  it('publie la tâche modifiée et la notification de sa référente', async () => {
    const flux = await ouvrirLeFlux(await contexte(ids.alice), {
      relireLeContexte: () => contexte(ids.alice),
    })
    const reponse = await apollo.executeOperation(
      {
        query: `mutation ($id: ID!) { changerStatutTache(id: $id, statut: EN_COURS) { id } }`,
        variables: { id: tacheId },
      },
      { contextValue: await contexte(ids.admin) }
    )
    expect(
      reponse.body.kind === 'single' && reponse.body.singleResult.errors
    ).toBeUndefined()
    // Alice, référente du périmètre, reçoit le signal de la tâche et celui de sa
    // cloche, dans un ordre libre.
    const recus = [
      (await flux!.next()).value as Changement,
      (await flux!.next()).value as Changement,
    ]
    expect(recus.map(c => c.entite).sort()).toEqual(['NOTIFICATION', 'TACHE'])
    expect(recus.find(c => c.entite === 'TACHE')).toMatchObject({
      id: tacheId,
      activiteId: ids.activite,
      perimetreId: ids.natation,
      editionId: ids.edition,
    })
    expect(recus.find(c => c.entite === 'NOTIFICATION')).toMatchObject({
      destinataireId: ids.alice,
    })
  })
})

describe('flux SSE sur /graphql', () => {
  const app = express()
  app.use(
    '/graphql',
    express.json(),
    creerGestionnaireFlux({ contexte: () => contexte(ids.alice) }),
    // Ce qui n'entre pas dans le flux continue vers l'API.
    (_req, res) => {
      res.json({ suite: 'api' })
    }
  )
  let adresse = ''
  let serveur: ReturnType<typeof app.listen>

  beforeAll(async () => {
    await new Promise<void>(ok => {
      serveur = app.listen(0, '127.0.0.1', () => ok())
    })
    adresse = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/graphql`
  })
  afterAll(() => {
    serveur.closeAllConnections()
    serveur.close()
  })

  const demander = (
    query: string,
    options: { method?: string; entetes?: Record<string, string> } = {}
  ) =>
    fetch(adresse, {
      method: options.method ?? 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        ...options.entetes,
      },
      ...(options.method === 'GET' ? {} : { body: JSON.stringify({ query }) }),
    })

  it('n’exécute ni requête ni mutation', async () => {
    for (const query of [
      '{ __typename }',
      'mutation { marquerNotificationsLues }',
    ]) {
      const reponse = await demander(query)
      expect(reponse.status).toBe(400)
      expect(await reponse.json()).toMatchObject({
        errors: [{ extensions: { code: 'ABONNEMENT_ATTENDU' } }],
      })
    }
  })

  it('laisse à l’API ce qui n’est pas un abonnement en SSE', async () => {
    const SUB = 'subscription { changements { entite } }'
    // Une requête GET, et une requête qui ne demande pas de flux.
    expect(await (await demander(SUB, { method: 'GET' })).json()).toEqual({
      suite: 'api',
    })
    expect(
      await (
        await demander(SUB, { entetes: { accept: 'application/json' } })
      ).json()
    ).toEqual({ suite: 'api' })
    // Le mode « connexion unique » de la bibliothèque reste fermé.
    const jeton = await demander(SUB, {
      entetes: { 'x-graphql-event-stream-token': 'jeton' },
    })
    expect(jeton.status).toBe(400)
    expect(nombreDeFlux()).toBe(0)
  })

  it('pousse un signal, puis libère la place quand le client s’en va', async () => {
    const abandon = new AbortController()
    const reponse = await fetch(adresse, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: 'subscription { changements { entite id } }',
      }),
      signal: abandon.signal,
    })
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get('content-type')).toContain('text/event-stream')
    const lecteur = reponse.body!.getReader()
    const decodeur = new TextDecoder()
    // Le flux est ouvert quand la place est prise.
    for (let i = 0; i < 100 && nombreDeFlux() === 0; i++) {
      await new Promise(ok => setTimeout(ok, 20))
    }
    expect(nombreDeFlux()).toBe(1)
    await publierChangement(tache({ id: 'pousse' }))
    let recu = ''
    while (!recu.includes('pousse')) {
      const lu = (await lecteur.read()) as { value?: Uint8Array; done: boolean }
      if (lu.done) break
      recu += decodeur.decode(lu.value)
    }
    expect(recu).toContain('event: next')
    expect(recu).toContain('"entite":"TACHE"')
    expect(recu).toContain('"id":"pousse"')

    abandon.abort()
    for (let i = 0; i < 100 && nombreDeFlux() > 0; i++) {
      await new Promise(ok => setTimeout(ok, 20))
    }
    expect(nombreDeFlux()).toBe(0)
  })
})
