import { randomUUID } from 'node:crypto'
import { request as requeteHttp, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import express from 'express'
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
import { env } from '../env.ts'
import { schema } from '../schema/index.ts'

import {
  purgerApplications,
  rappelerFinDesAutorisations,
  revoquerApplicationsRefusees,
} from './entretien.ts'
import { defiS256 } from './jetons.ts'
import { emetteur } from './metadonnees.ts'
import { routesOAuth } from './routes.ts'

// Serveur d'autorisation des applications tierces (ADR 0067). Les contrôles se
// prouvent par le refus (invariant 11) : PKCE, adresse de retour, ressource, rejeu
// d'un code ou d'un jeton de renouvellement, bornes de l'ADR 0064, refus de
// l'installation et module « API » fermé.

const enFile = vi.hoisted(() => [] as { sorte: string; options: unknown }[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, _cible: unknown, options: unknown = {}) => {
    enFile.push({ sorte, options })
    return Promise.resolve(true)
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `oauth-${s}`
const ip = `10.66.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const CLIENT = `https://app-${s}.exemple/client.json`
const AUTRE = `https://autre-${s}.exemple/client.json`
const RETOUR = `https://app-${s}.exemple/retour`
const VERIFICATEUR = `verificateur-${'x'.repeat(40)}-${s}`

const ids = {
  org: '',
  activite: '',
  autreActivite: '',
  perimetre: '',
  edition: '',
  personne: '',
}
const apollo = new ApolloServer<AppContext>({ schema })
let serveur: Server
let base = ''

// Documents CIMD servis par le faux Internet du test. Le vrai fetch reste pour
// l'API du test, sur la boucle locale.
const documents = new Map<string, () => Response>()
const vraiFetch = globalThis.fetch
vi.stubGlobal('fetch', (adresse: string | URL, init?: RequestInit) => {
  const cle = String(adresse)
  const document = documents.get(cle)
  if (document !== undefined) return Promise.resolve(document())
  if (cle.startsWith('http://127.0.0.1')) return vraiFetch(adresse, init)
  return Promise.reject(new TypeError('fetch failed'))
})

const documentDe =
  (clientId: string, extra: Record<string, unknown> = {}) =>
  () =>
    new Response(
      JSON.stringify({
        client_id: clientId,
        client_name: 'Automate de test',
        redirect_uris: [RETOUR],
        ...extra,
      }),
      { status: 200, headers: { 'cache-control': 'max-age=60' } }
    )

/** Une requête vers l'API du test, sans suivre de redirection. */
function appeler(
  chemin: string,
  options: { methode?: string; corps?: Record<string, string> } = {}
): Promise<{
  statut: number
  entetes: Record<string, string | string[] | undefined>
  texte: string
}> {
  return new Promise((resoudre, rejeter) => {
    const corps =
      options.corps === undefined
        ? undefined
        : new URLSearchParams(options.corps).toString()
    const r = requeteHttp(
      `${base}${chemin}`,
      {
        method: options.methode ?? (corps === undefined ? 'GET' : 'POST'),
        headers: {
          'x-relaytour-ip': ip,
          ...(corps === undefined
            ? {}
            : { 'content-type': 'application/x-www-form-urlencoded' }),
        },
      },
      reponse => {
        let texte = ''
        reponse.setEncoding('utf8')
        reponse.on('data', (m: string) => (texte += m))
        reponse.on('end', () =>
          resoudre({
            statut: reponse.statusCode ?? 0,
            entetes: reponse.headers,
            texte,
          })
        )
      }
    )
    r.on('error', rejeter)
    if (corps !== undefined) r.write(corps)
    r.end()
  })
}

function adresseAutoriser(parametres: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams()
  const valeurs: Record<string, string | undefined> = {
    response_type: 'code',
    client_id: CLIENT,
    redirect_uri: RETOUR,
    code_challenge: defiS256(VERIFICATEUR),
    code_challenge_method: 'S256',
    scope: 'lecture ecriture',
    state: 'etat-du-client',
    resource: emetteur(),
    ...parametres,
  }
  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (valeur !== undefined) p.set(cle, valeur)
  }
  return `/oauth/autoriser?${p.toString()}`
}

async function executer(
  ctx: AppContext | Promise<AppContext>,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await ctx }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const session = () => buildContext('127.0.0.1', ids.personne, slug)

const ACCORDER = `mutation ($id: ID!, $p: PorteeJeton!, $a: [ID!]) {
  accorderDemandeAutorisation(id: $id, portee: $p, activiteIds: $a)
}`

/** Une demande ouverte par /oauth/autoriser : rend son identifiant. */
async function nouvelleDemande(
  parametres: Record<string, string | undefined> = {}
) {
  const r = await appeler(adresseAutoriser(parametres))
  expect(r.statut).toBe(303)
  const lieu = String(r.entetes.location)
  expect(lieu.startsWith(`${emetteur()}/autoriser/`)).toBe(true)
  return lieu.slice(`${emetteur()}/autoriser/`.length)
}

/** Une demande accordée : rend le code. */
async function codeAccorde(
  portee: 'LECTURE' | 'LECTURE_ECRITURE' = 'LECTURE',
  activites: string[] | null = null
) {
  const id = await nouvelleDemande()
  const r = await executer(session(), ACCORDER, { id, p: portee, a: activites })
  expect(r.errors).toBeUndefined()
  const retour = new URL(
    (r.data as { accorderDemandeAutorisation: string })
      .accorderDemandeAutorisation
  )
  expect(retour.origin + retour.pathname).toBe(RETOUR)
  expect(retour.searchParams.get('state')).toBe('etat-du-client')
  expect(retour.searchParams.get('iss')).toBe(emetteur())
  return retour.searchParams.get('code')!
}

async function echanger(code: string, extra: Record<string, string> = {}) {
  return appeler('/oauth/jeton', {
    corps: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: RETOUR,
      client_id: CLIENT,
      code_verifier: VERIFICATEUR,
      resource: emetteur(),
      ...extra,
    },
  })
}

interface Jetons {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
}

async function jetonsAccordes(
  portee: 'LECTURE' | 'LECTURE_ECRITURE' = 'LECTURE',
  activites: string[] | null = null
): Promise<Jetons> {
  const r = await echanger(await codeAccorde(portee, activites))
  expect(r.statut).toBe(200)
  expect(r.entetes['cache-control']).toBe('no-store')
  return JSON.parse(r.texte) as Jetons
}

const renouveler = (jeton: string, client = CLIENT) =>
  appeler('/oauth/jeton', {
    corps: {
      grant_type: 'refresh_token',
      refresh_token: jeton,
      client_id: client,
    },
  })

const erreurDe = (r: { texte: string }) =>
  (JSON.parse(r.texte) as { error: string }).error

beforeAll(async () => {
  await apollo.start()
  const app = express()
  app.set('trust proxy', 1)
  routesOAuth(app)
  serveur = app.listen(0, '127.0.0.1')
  await new Promise(r => serveur.once('listening', r))
  base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`

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
  const groupes = [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }]
  ids.activite = (
    await prisma.activite.create({
      data: { organisationId: ids.org, slug, nom: 'Tournoi', groupes },
    })
  ).id
  ids.autreActivite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug: `${slug}-club`,
        nom: 'Club',
        groupes,
      },
    })
  ).id
  const jour = new Date(Date.now() + 60 * 86_400_000)
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: jour,
        fin: jour,
      },
    })
  ).id
  ids.perimetre = (
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
  ids.personne = randomUUID()
  await prisma.user.create({
    data: {
      id: ids.personne,
      email: `personne-${slug}@exemple.fr`,
      name: `Personne ${s}`,
      appartenances: { create: { organisationId: ids.org, role: 'ADMIN' } },
    },
  })
})

beforeEach(() => {
  documents.clear()
  documents.set(CLIENT, documentDe(CLIENT))
  enFile.length = 0
  env.APPLICATIONS_REFUSEES = []
})

afterAll(async () => {
  await prisma.jetonAcces.deleteMany({ where: { organisationId: ids.org } })
  await prisma.clientApplication.deleteMany({
    where: { clientId: { in: [CLIENT, AUTRE] } },
  })
  await prisma.journal.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.appartenance.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({ where: { id: ids.personne } })
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
  await new Promise(r => serveur.close(r))
  vi.unstubAllGlobals()
})

describe('métadonnées', () => {
  it('publie le serveur d’autorisation et la ressource', async () => {
    const serveurAut = JSON.parse(
      (await appeler('/.well-known/oauth-authorization-server')).texte
    ) as Record<string, unknown>
    expect(serveurAut.issuer).toBe(emetteur())
    expect(serveurAut.code_challenge_methods_supported).toEqual(['S256'])
    expect(serveurAut.client_id_metadata_document_supported).toBe(true)
    expect(serveurAut.registration_endpoint).toBeUndefined()
    const ressource = JSON.parse(
      (await appeler('/.well-known/oauth-protected-resource')).texte
    ) as Record<string, unknown>
    expect(ressource.resource).toBe(emetteur())
    expect(ressource.authorization_servers).toEqual([emetteur()])
  })

  it('ferme l’enregistrement dynamique par défaut', async () => {
    const r = await appeler('/oauth/enregistrement', {
      corps: { client_name: 'x' },
    })
    expect(r.statut).toBe(404)
  })
})

describe('demande d’autorisation', () => {
  it('affiche l’erreur sur l’installation avant de connaître l’adresse de retour', async () => {
    const sansClient = await appeler(adresseAutoriser({ client_id: undefined }))
    expect(sansClient.statut).toBe(400)
    expect(sansClient.entetes.location).toBeUndefined()
    expect(sansClient.entetes['content-security-policy']).toContain(
      "frame-ancestors 'none'"
    )
    const autreRetour = await appeler(
      adresseAutoriser({ redirect_uri: 'https://pirate.exemple/retour' })
    )
    expect(autreRetour.statut).toBe(400)
    expect(autreRetour.entetes.location).toBeUndefined()
  })

  it('signale une installation qui ne peut pas lire le document', async () => {
    documents.delete(CLIENT)
    await prisma.clientApplication.deleteMany({ where: { clientId: CLIENT } })
    const r = await appeler(adresseAutoriser())
    expect(r.statut).toBe(502)
    expect(r.texte).toContain('ne peut pas vérifier l’application')
  })

  it('refuse un document qui ne répète pas son adresse', async () => {
    documents.set(AUTRE, documentDe(CLIENT))
    const r = await appeler(adresseAutoriser({ client_id: AUTRE }))
    expect(r.statut).toBe(400)
  })

  it('renvoie les autres erreurs vers l’application, avec state et iss', async () => {
    for (const [parametres, attendue] of [
      [{ code_challenge_method: 'plain' }, 'invalid_request'],
      [{ code_challenge: undefined }, 'invalid_request'],
      [{ response_type: 'token' }, 'unsupported_response_type'],
      [{ scope: 'openid' }, 'invalid_scope'],
      [{ resource: 'https://autre.exemple' }, 'invalid_target'],
      [{ resource: undefined }, 'invalid_target'],
    ] as const) {
      const r = await appeler(adresseAutoriser(parametres))
      expect(r.statut).toBe(303)
      const retour = new URL(String(r.entetes.location))
      expect(retour.searchParams.get('error')).toBe(attendue)
      expect(retour.searchParams.get('state')).toBe('etat-du-client')
      expect(retour.searchParams.get('iss')).toBe(emetteur())
    }
  })

  it('refuse une application refusée par l’installation', async () => {
    env.APPLICATIONS_REFUSEES = [new URL(CLIENT).host]
    const r = await appeler(adresseAutoriser())
    expect(r.statut).toBe(403)
  })
})

describe('consentement', () => {
  it('présente la demande, puis ne la laisse répondre qu’une fois', async () => {
    const id = await nouvelleDemande()
    const lue = await executer(
      session(),
      `query ($id: ID!) {
      demandeAutorisation(id: $id) { hoteRetour ecritureDemandee application { nom hote verifiee } }
    }`,
      { id }
    )
    expect(lue.data).toEqual({
      demandeAutorisation: {
        hoteRetour: new URL(RETOUR).host,
        ecritureDemandee: true,
        application: {
          nom: 'Automate de test',
          hote: new URL(CLIENT).host,
          verifiee: true,
        },
      },
    })
    const refus = await executer(
      session(),
      'mutation ($id: ID!) { refuserDemandeAutorisation(id: $id) }',
      { id }
    )
    const retour = new URL(
      (refus.data as { refuserDemandeAutorisation: string })
        .refuserDemandeAutorisation
    )
    expect(retour.searchParams.get('error')).toBe('access_denied')
    const encore = await executer(session(), ACCORDER, { id, p: 'LECTURE' })
    expect(encore.errors?.[0]?.extensions?.code).toBe('SAISIE_INVALIDE')
  })

  it('ne laisse pas étendre la portée demandée', async () => {
    const id = await nouvelleDemande({ scope: 'lecture' })
    const r = await executer(session(), ACCORDER, { id, p: 'LECTURE_ECRITURE' })
    expect(r.errors?.[0]?.extensions?.code).toBe('SAISIE_INVALIDE')
  })

  it('refuse l’accord d’un jeton : seule une session consent', async () => {
    const jetons = await jetonsAccordes('LECTURE_ECRITURE')
    const id = await nouvelleDemande()
    const ctx = await contexteDeJetonAcces(ip, jetons.access_token, null)
    const r = await executer(ctx, ACCORDER, { id, p: 'LECTURE' })
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN')
  })

  it('signale l’autorisation par mail', async () => {
    await codeAccorde()
    expect(enFile.map(e => e.sorte)).toContain('application-autorisee')
  })
})

describe('échange du code', () => {
  it('rend des jetons bornés : lecture seule, une heure', async () => {
    const jetons = await jetonsAccordes('LECTURE', [ids.activite])
    expect(jetons.access_token).toMatch(/^rto_/)
    expect(jetons.refresh_token).toMatch(/^rtr_/)
    expect(jetons.expires_in).toBe(3600)
    expect(jetons.scope).toBe('lecture')
    const ctx = await contexteDeJetonAcces(ip, jetons.access_token, null)
    expect(ctx.refus).toBeNull()
    expect(ctx.jeton?.application?.nom).toBe('Automate de test')
    expect(ctx.jeton?.gestionMembres).toBe(false)
    expect([...(ctx.jeton?.activites ?? [])]).toEqual([ids.activite])
    const ecriture = await executer(
      ctx,
      `mutation ($p: ID!, $e: ID!) {
      creerTache(perimetreId: $p, editionId: $e, titre: "Par une application") { id }
    }`,
      { p: ids.perimetre, e: ids.edition }
    )
    expect(ecriture.errors?.[0]?.extensions?.code).toBe('PORTEE_INSUFFISANTE')
    const jetonsAcces = await executer(ctx, '{ mesJetonsAcces { id } }')
    expect(jetonsAcces.errors?.[0]?.extensions?.code).toBe('FORBIDDEN')
  })

  it('refuse un autre vérificateur, une autre adresse de retour ou un autre client', async () => {
    for (const extra of <Record<string, string>[]>[
      { code_verifier: `autre-${'y'.repeat(43)}` },
      { redirect_uri: `${RETOUR}/autre` },
      { client_id: AUTRE },
      { resource: 'https://autre.exemple' },
    ]) {
      const r = await echanger(await codeAccorde(), extra)
      expect(r.statut).toBe(400)
    }
  })

  it('révoque l’autorisation quand un code revient', async () => {
    const code = await codeAccorde()
    const premier = await echanger(code)
    expect(premier.statut).toBe(200)
    const jetons = JSON.parse(premier.texte) as Jetons
    const second = await echanger(code)
    expect(erreurDe(second)).toBe('invalid_grant')
    const ctx = await contexteDeJetonAcces(ip, jetons.access_token, null)
    expect(ctx.refus?.extensions.code).toBe('JETON_INVALIDE')
  })
})

describe('renouvellement', () => {
  it('fait tourner le jeton, et révoque tout quand l’ancien revient', async () => {
    const jetons = await jetonsAccordes()
    const premier = await renouveler(jetons.refresh_token)
    expect(premier.statut).toBe(200)
    const suivants = JSON.parse(premier.texte) as Jetons
    expect(suivants.refresh_token).not.toBe(jetons.refresh_token)
    const rejeu = await renouveler(jetons.refresh_token)
    expect(erreurDe(rejeu)).toBe('invalid_grant')
    expect(erreurDe(await renouveler(suivants.refresh_token))).toBe(
      'invalid_grant'
    )
    const ctx = await contexteDeJetonAcces(ip, suivants.access_token, null)
    expect(ctx.refus?.extensions.code).toBe('JETON_INVALIDE')
  })

  it('refuse un autre client', async () => {
    const jetons = await jetonsAccordes()
    expect(erreurDe(await renouveler(jetons.refresh_token, AUTRE))).toBe(
      'invalid_grant'
    )
  })

  it('refuse sans consommer quand le module est fermé, puis reprend', async () => {
    const jetons = await jetonsAccordes()
    await prisma.organisation.update({
      where: { id: ids.org },
      data: { apiActivee: false },
    })
    try {
      const ferme = await renouveler(jetons.refresh_token)
      expect(ferme.statut).toBe(403)
      expect(erreurDe(ferme)).toBe('access_denied')
      const ctx = await contexteDeJetonAcces(ip, jetons.access_token, null)
      expect(ctx.refus?.extensions.code).toBe('API_INACTIVE')
    } finally {
      await prisma.organisation.update({
        where: { id: ids.org },
        data: { apiActivee: true },
      })
    }
    expect((await renouveler(jetons.refresh_token)).statut).toBe(200)
  })

  it('coupe une application refusée après son autorisation', async () => {
    const jetons = await jetonsAccordes()
    env.APPLICATIONS_REFUSEES = [CLIENT]
    const ctx = await contexteDeJetonAcces(ip, jetons.access_token, null)
    expect(ctx.refus?.extensions.code).toBe('JETON_INVALIDE')
    expect(erreurDe(await renouveler(jetons.refresh_token))).toBe(
      'invalid_grant'
    )
  })
})

describe('révocation', () => {
  it('révoque toute l’autorisation par /oauth/revocation', async () => {
    const jetons = await jetonsAccordes()
    const r = await appeler('/oauth/revocation', {
      corps: { token: jetons.refresh_token, client_id: CLIENT },
    })
    expect(r.statut).toBe(200)
    const ctx = await contexteDeJetonAcces(ip, jetons.access_token, null)
    expect(ctx.refus?.extensions.code).toBe('JETON_INVALIDE')
    // Un jeton inconnu reçoit la même réponse (RFC 7009).
    expect(
      (await appeler('/oauth/revocation', { corps: { token: 'inconnu' } }))
        .statut
    ).toBe(200)
  })

  it('remplace l’autorisation précédente du même client', async () => {
    const avant = await jetonsAccordes()
    const apres = await jetonsAccordes()
    expect(
      (await contexteDeJetonAcces(ip, avant.access_token, null)).refus
        ?.extensions.code
    ).toBe('JETON_INVALIDE')
    expect(
      (await contexteDeJetonAcces(ip, apres.access_token, null)).refus
    ).toBeNull()
  })

  it('liste les autorisations à part des jetons d’accès, et les révoque', async () => {
    const jetons = await jetonsAccordes()
    const liste = await executer(
      session(),
      '{ mesAutorisationsApplications { id revoqueLe application { nom } } mesJetonsAcces { id } }'
    )
    const donnees = liste.data as {
      mesAutorisationsApplications: {
        id: string
        revoqueLe: string | null
        application: { nom: string }
      }[]
      mesJetonsAcces: { id: string }[]
    }
    const active = donnees.mesAutorisationsApplications.find(
      a => a.revoqueLe === null
    )!
    expect(active.application.nom).toBe('Automate de test')
    expect(donnees.mesJetonsAcces).toEqual([])
    const r = await executer(
      session(),
      'mutation ($id: ID!) { revoquerJetonAcces(id: $id) }',
      { id: active.id }
    )
    expect(r.data).toEqual({ revoquerJetonAcces: true })
    expect(
      (await contexteDeJetonAcces(ip, jetons.access_token, null)).refus
        ?.extensions.code
    ).toBe('JETON_INVALIDE')
  })
})

describe('refus par l’organisation et par l’installation', () => {
  const REFUSER =
    'mutation ($c: String!) { refuserApplicationOrganisation(clientId: $c) }'
  const LEVER =
    'mutation ($c: String!) { autoriserApplicationOrganisation(clientId: $c) }'

  it('un admin refuse une application : ses autorisations tombent, les demandes aussi', async () => {
    const jetons = await jetonsAccordes()
    const r = await executer(session(), REFUSER, { c: CLIENT })
    expect(r.data).toEqual({ refuserApplicationOrganisation: 1 })
    expect(
      (await contexteDeJetonAcces(ip, jetons.access_token, null)).refus
        ?.extensions.code
    ).toBe('JETON_INVALIDE')
    const liste = await executer(
      session(),
      '{ applicationsRefuseesOrganisation { clientId nom hote } }'
    )
    expect(liste.data).toEqual({
      applicationsRefuseesOrganisation: [
        {
          clientId: CLIENT,
          nom: 'Automate de test',
          hote: new URL(CLIENT).host,
        },
      ],
    })
    const id = await nouvelleDemande()
    const accord = await executer(session(), ACCORDER, { id, p: 'LECTURE' })
    expect(accord.errors?.[0]?.extensions?.code).toBe('SAISIE_INVALIDE')
    expect((await executer(session(), LEVER, { c: CLIENT })).data).toEqual({
      autoriserApplicationOrganisation: true,
    })
    await jetonsAccordes()
  })

  it('l’installation ferme les applications d’une organisation sans toucher aux jetons d’accès', async () => {
    const jetons = await jetonsAccordes()
    const installation = buildContext('127.0.0.1', null, null, true)
    const fermeture = await executer(
      installation,
      'mutation ($s: String!) { modifierOrganisationInstallation(slug: $s, api: { applications: false }) { api { applications } } }',
      { s: slug }
    )
    expect(fermeture.data).toEqual({
      modifierOrganisationInstallation: { api: { applications: false } },
    })
    try {
      expect(
        (await contexteDeJetonAcces(ip, jetons.access_token, null)).refus
          ?.extensions.code
      ).toBe('JETON_INVALIDE')
      expect(erreurDe(await renouveler(jetons.refresh_token))).toBe(
        'invalid_grant'
      )
      const id = await nouvelleDemande()
      const accord = await executer(session(), ACCORDER, { id, p: 'LECTURE' })
      expect(accord.errors?.[0]?.extensions?.code).toBe('SAISIE_INVALIDE')
    } finally {
      await prisma.organisation.update({
        where: { id: ids.org },
        data: { applicationsAutorisees: true },
      })
    }
    expect(
      (await contexteDeJetonAcces(ip, jetons.access_token, null)).refus
    ).toBeNull()
  })

  it('révoque les autorisations d’une application refusée par l’installation', async () => {
    await jetonsAccordes()
    env.APPLICATIONS_REFUSEES = [CLIENT]
    expect(await revoquerApplicationsRefusees(prisma)).toBeGreaterThan(0)
    env.APPLICATIONS_REFUSEES = []
    const actives = await prisma.jetonAcces.count({
      where: {
        organisationId: ids.org,
        revoqueLe: null,
        clientApplication: { clientId: CLIENT },
      },
    })
    expect(actives).toBe(0)
  })
})

describe('mails et entretien', () => {
  it('signale un rejeu par mail', async () => {
    const jetons = await jetonsAccordes()
    expect((await renouveler(jetons.refresh_token)).statut).toBe(200)
    enFile.length = 0
    await renouveler(jetons.refresh_token)
    expect(enFile.map(e => e.sorte)).toEqual(['autorisation-rejouee'])
  })

  it('rappelle une fois la fin proche d’une autorisation', async () => {
    const jetons = await jetonsAccordes()
    const ctx = await contexteDeJetonAcces(ip, jetons.access_token, null)
    const id = ctx.jeton!.id
    await prisma.jetonAcces.update({
      where: { id },
      data: { expireLe: new Date(Date.now() + 10 * 86_400_000) },
    })
    enFile.length = 0
    expect(await rappelerFinDesAutorisations(prisma)).toBeGreaterThan(0)
    expect(
      enFile.some(
        e =>
          e.sorte === 'autorisation-fin-proche' &&
          (e.options as { jetonAccesId: string }).jetonAccesId === id
      )
    ).toBe(true)
    enFile.length = 0
    await rappelerFinDesAutorisations(prisma)
    expect(
      enFile.some(
        e => (e.options as { jetonAccesId: string }).jetonAccesId === id
      )
    ).toBe(false)
  })

  it('efface les demandes expirées, les jetons échus et les applications oubliées', async () => {
    const demande = await nouvelleDemande()
    await prisma.demandeAutorisation.update({
      where: { id: demande },
      data: { expireLe: new Date(Date.now() - 2 * 86_400_000) },
    })
    documents.set(AUTRE, documentDe(AUTRE))
    await appeler(adresseAutoriser({ client_id: AUTRE }))
    const autre = await prisma.clientApplication.findUniqueOrThrow({
      where: { clientId: AUTRE },
    })
    await prisma.demandeAutorisation.deleteMany({
      where: { clientApplicationId: autre.id },
    })
    await prisma.clientApplication.update({
      where: { id: autre.id },
      data: { updatedAt: new Date(Date.now() - 40 * 86_400_000) },
    })
    await purgerApplications(prisma)
    expect(
      await prisma.demandeAutorisation.findUnique({ where: { id: demande } })
    ).toBeNull()
    expect(
      await prisma.clientApplication.findUnique({ where: { clientId: AUTRE } })
    ).toBeNull()
    // L'application qui porte des autorisations reste.
    expect(
      await prisma.clientApplication.findUnique({ where: { clientId: CLIENT } })
    ).not.toBeNull()
  })
})
