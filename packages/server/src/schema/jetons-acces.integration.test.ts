import { randomUUID } from 'node:crypto'

import type { AddressInfo } from 'node:net'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import {
  contexteDeJetonAcces,
  creerRefusDeJetonAcces,
} from '../contexte-jeton.ts'
import { JETONS_ACTIFS_MAX } from '../lib/jetons-acces.ts'
import { journal } from '../lib/journal.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Jetons d'accès et module « API » (ADR 0064). Un jeton agit au nom d'une personne,
// dans une seule organisation, avec ses droits et jamais plus. Les contrôles se
// prouvent par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `jetons-${s}`
const slugB = `jetons-b-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
// Une adresse propre au fichier : les refus de jetons se comptent par adresse.
const ip = `10.64.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const ids = {
  org: '',
  orgB: '',
  tournoi: '',
  club: '',
  activiteB: '',
  editionTournoi: '',
  editionClub: '',
  natation: '',
  tennis: '',
  referente: '', // affectée à la natation (tournoi) et au tennis (club), membre de B
  admin: '', // admin de l'organisation
}

type Qui = { session: string } | { jeton: string }

async function contexte(qui: Qui): Promise<AppContext> {
  return 'session' in qui
    ? buildContext('127.0.0.1', qui.session, slug)
    : contexteDeJetonAcces(ip, qui.jeton, null)
}

async function executer(
  qui: Qui | AppContext,
  query: string,
  variables: Record<string, unknown> = {}
) {
  // Un contexte déjà construit porte son adresse ; une personne ou un jeton non.
  const contextValue = 'ip' in qui ? qui : await contexte(qui)
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const installation = () => buildContext('127.0.0.1', null, null, true)

const CREER = `mutation ($nom: String!, $p: PorteeJeton!, $a: [ID!], $f: DateTime) {
  creerJetonAcces(nom: $nom, portee: $p, activiteIds: $a, expireLe: $f) {
    jeton jetonAcces { id apercu portee activiteIds expireLe }
  }
}`
const ACTIVITES = `{ activites { id } }`
const CREER_TACHE = `mutation ($p: ID!, $e: ID!) { creerTache(perimetreId: $p, editionId: $e, titre: "Par un programme") { id } }`
const MODIFIER_API = `mutation ($slug: String!, $api: ApiInstallationInput) {
  modifierOrganisationInstallation(slug: $slug, api: $api) { api { etat autorisee imposee suspensionMotif jetonsActifs } }
}`

async function creerJeton(
  userId: string,
  portee: 'LECTURE' | 'LECTURE_ECRITURE',
  activiteIds: string[] | null = null
) {
  const r = await executer({ session: userId }, CREER, {
    nom: `jeton ${portee}`,
    p: portee,
    a: activiteIds,
  })
  expect(r.errors).toBeUndefined()
  return (
    r.data as { creerJetonAcces: { jeton: string; jetonAcces: { id: string } } }
  ).creerJetonAcces
}

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  ids.orgB = (
    await prisma.organisation.create({
      data: { slug: slugB, nom: `Organisation ${slugB}`, configuration: {} },
    })
  ).id
  const groupes = [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }]
  for (const [cle, organisationId, slugActivite] of [
    ['tournoi', ids.org, slug],
    ['club', ids.org, `${slug}-club`],
    ['activiteB', ids.orgB, slugB],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: { organisationId, slug: slugActivite, nom: cle, groupes },
      })
    ).id
  }
  const jour = new Date(Date.now() + 60 * 86_400_000)
  for (const [cle, activiteId] of [
    ['editionTournoi', ids.tournoi],
    ['editionClub', ids.club],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId,
          annee: 2027,
          nom: `${cle} 2027`,
          debut: jour,
          fin: jour,
        },
      })
    ).id
  }
  for (const [cle, activiteId] of [
    ['natation', ids.tournoi],
    ['tennis', ids.club],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId,
          slug: cle,
          nom: cle,
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    ).id
  }
  ids.referente = randomUUID()
  ids.admin = randomUUID()
  await prisma.user.create({
    data: {
      id: ids.referente,
      email: `referente-${slug}@exemple.fr`,
      name: `Référente ${s}`,
      appartenances: {
        create: [
          { organisationId: ids.org, role: 'MEMBRE' },
          { organisationId: ids.orgB, role: 'MEMBRE' },
        ],
      },
    },
  })
  await prisma.user.create({
    data: {
      id: ids.admin,
      email: `admin-${slug}@exemple.fr`,
      name: `Admin ${s}`,
      appartenances: { create: { organisationId: ids.org, role: 'ADMIN' } },
    },
  })
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.referente,
        perimetreId: ids.natation,
        editionId: ids.editionTournoi,
      },
      {
        userId: ids.referente,
        perimetreId: ids.tennis,
        editionId: ids.editionClub,
      },
    ],
  })
})

afterAll(async () => {
  const organisations = [ids.org, ids.orgB]
  await prisma.jetonAcces.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.journal.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.edition.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.perimetre.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.activite.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: organisations } } })
  invaliderConfigurationOrganisation()
  await apollo.stop()
})

describe('module « API » de l’organisation', () => {
  it('est inactif par défaut : aucun jeton ne se crée', async () => {
    const r = await executer({ session: ids.referente }, CREER, {
      nom: 'trop tôt',
      p: 'LECTURE',
    })
    expect(code(r)).toBe('API_INACTIVE')
    const etat = await executer(
      { session: ids.referente },
      '{ apiOrganisation { etat } }'
    )
    expect(etat.data).toEqual({ apiOrganisation: { etat: 'INACTIVE' } })
  })

  it('ne s’active que par un admin de l’organisation', async () => {
    const refus = await executer(
      { session: ids.referente },
      'mutation { activerApi { etat } }'
    )
    expect(code(refus)).toBe('FORBIDDEN')
    const r = await executer(
      { session: ids.admin },
      'mutation { activerApi { etat } }'
    )
    expect(r.data).toEqual({ activerApi: { etat: 'ACTIVE' } })
  })
})

describe('jeton d’accès', () => {
  it('se crée une fois, avec sa valeur, et hérite des droits de la personne', async () => {
    const { jeton, jetonAcces } = await creerJeton(
      ids.referente,
      'LECTURE_ECRITURE'
    )
    expect(jeton).toMatch(/^rt_[A-Za-z0-9_-]{43}$/)
    expect(jeton.slice(3, 11)).toBe(
      (jetonAcces as unknown as { apercu: string }).apercu
    )
    const ligne = await prisma.jetonAcces.findUniqueOrThrow({
      where: { id: jetonAcces.id },
    })
    // Le serveur ne garde que l'empreinte.
    expect(JSON.stringify(ligne)).not.toContain(jeton.slice(3))
    const r = await executer(
      { jeton },
      '{ moi { id } jetonCourant { portee activiteIds } activites { id } }'
    )
    expect(r.errors).toBeUndefined()
    const data = r.data as {
      moi: { id: string }
      jetonCourant: { portee: string; activiteIds: string[] | null }
      activites: { id: string }[]
    }
    expect(data.moi.id).toBe(ids.referente)
    expect(data.jetonCourant).toEqual({
      portee: 'LECTURE_ECRITURE',
      activiteIds: null,
    })
    expect(data.activites.map(a => a.id).sort()).toEqual(
      [ids.tournoi, ids.club].sort()
    )
    const tache = await executer({ jeton }, CREER_TACHE, {
      p: ids.natation,
      e: ids.editionTournoi,
    })
    expect(tache.errors).toBeUndefined()
  })

  it('en lecture, refuse toute mutation', async () => {
    const { jeton } = await creerJeton(ids.referente, 'LECTURE')
    const lecture = await executer({ jeton }, ACTIVITES)
    expect(lecture.errors).toBeUndefined()
    const r = await executer({ jeton }, CREER_TACHE, {
      p: ids.natation,
      e: ids.editionTournoi,
    })
    expect(code(r)).toBe('PORTEE_INSUFFISANTE')
    // Une mutation qui passe outre la lecture seule de l'organisation reste
    // fermée au jeton : elle demande la session.
    const nom = await executer(
      { jeton },
      'mutation { modifierMonNom(nom: "X") { id } }'
    )
    expect(nom.errors?.[0]?.extensions?.code).toMatch(
      /FORBIDDEN|PORTEE_INSUFFISANTE/
    )
  })

  it('limité à une activité, ne voit ni n’écrit dans les autres', async () => {
    const { jeton } = await creerJeton(ids.referente, 'LECTURE_ECRITURE', [
      ids.tournoi,
    ])
    const r = await executer({ jeton }, ACTIVITES)
    expect(r.data).toEqual({ activites: [{ id: ids.tournoi }] })
    const editions = await executer(
      { jeton },
      'query ($a: ID) { editions(activiteId: $a) { id } }',
      { a: ids.club }
    )
    expect(code(editions)).toBe('FORBIDDEN')
    const taches = await executer(
      { jeton },
      'query ($e: ID!) { mesTaches(editionId: $e) { id } }',
      { e: ids.editionClub }
    )
    expect(code(taches)).toBe('FORBIDDEN')
    const ecriture = await executer({ jeton }, CREER_TACHE, {
      p: ids.tennis,
      e: ids.editionClub,
    })
    expect(code(ecriture)).toBe('FORBIDDEN')
    const permise = await executer({ jeton }, CREER_TACHE, {
      p: ids.natation,
      e: ids.editionTournoi,
    })
    expect(permise.errors).toBeUndefined()
    // Les notifications de toute l'organisation ne passent pas par les activités.
    const cloche = await executer({ jeton }, '{ nombreNotificationsNonLues }')
    expect(code(cloche)).toBe('FORBIDDEN')
  })

  it('d’un admin limité à une activité, perd le rôle d’admin de l’organisation', async () => {
    const libre = await creerJeton(ids.admin, 'LECTURE')
    const annuaire = await executer(
      { jeton: libre.jeton },
      '{ personnes { id } }'
    )
    expect(annuaire.errors).toBeUndefined()
    const limite = await creerJeton(ids.admin, 'LECTURE', [ids.tournoi])
    const refus = await executer(
      { jeton: limite.jeton },
      '{ personnes { id } }'
    )
    expect(code(refus)).toBe('FORBIDDEN')
    // Il administre encore l'activité de sa liste.
    const editions = await executer(
      { jeton: limite.jeton },
      'query ($a: ID) { editions(activiteId: $a) { id } }',
      { a: ids.tournoi }
    )
    expect(editions.errors).toBeUndefined()
  })

  it('refuse à la création une activité que la personne ne voit pas', async () => {
    const r = await executer({ session: ids.referente }, CREER, {
      nom: 'autre organisation',
      p: 'LECTURE',
      a: [ids.activiteB],
    })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse une date de fin au-delà d’un an', async () => {
    const r = await executer({ session: ids.referente }, CREER, {
      nom: 'trop long',
      p: 'LECTURE',
      f: new Date(Date.now() + 400 * 86_400_000).toISOString(),
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('n’ouvre pas les opérations du compte ni les secrets', async () => {
    const { jeton } = await creerJeton(ids.admin, 'LECTURE_ECRITURE')
    for (const query of [
      '{ mesJetonsAcces { id } }',
      '{ mesOrganisations { slug } }',
      '{ monAbonnementAgenda { id } }',
      '{ notificationsAutresOrganisations { slug } }',
      'mutation { creerJetonAcces(nom: "x", portee: LECTURE) { jeton } }',
      'mutation { modifierMonNom(nom: "Programme") { id } }',
      'mutation { desactiverApi { etat } }',
      'mutation { creerMonAbonnementAgenda { adresse } }',
      // Le lien personnel d'une fiche bénévole identifie une autre personne.
      'mutation { lienEspaceBenevole(benevoleId: "x", nouveau: true) }',
      'mutation { renvoyerLienBenevole(benevoleId: "x") }',
    ]) {
      const r = await executer({ jeton }, query)
      expect(code(r), query).toBe('FORBIDDEN')
    }
  })

  it('ne vaut que pour son organisation', async () => {
    const { jeton } = await creerJeton(ids.referente, 'LECTURE')
    const ctx = await contexteDeJetonAcces(ip, jeton, null)
    expect(ctx.organisation?.slug).toBe(slug)
  })

  it('se révoque par sa porteuse seule', async () => {
    const { jeton, jetonAcces } = await creerJeton(ids.referente, 'LECTURE')
    const REVOQUER = 'mutation ($id: ID!) { revoquerJetonAcces(id: $id) }'
    const autre = await executer({ session: ids.admin }, REVOQUER, {
      id: jetonAcces.id,
    })
    expect(autre.data).toEqual({ revoquerJetonAcces: false })
    expect((await executer({ jeton }, ACTIVITES)).errors).toBeUndefined()
    const r = await executer({ session: ids.referente }, REVOQUER, {
      id: jetonAcces.id,
    })
    expect(r.data).toEqual({ revoquerJetonAcces: true })
    expect(code(await executer({ jeton }, ACTIVITES))).toBe('JETON_INVALIDE')
  })

  it('expiré ou inconnu, reçoit le même refus', async () => {
    const { jeton, jetonAcces } = await creerJeton(ids.referente, 'LECTURE')
    await prisma.jetonAcces.update({
      where: { id: jetonAcces.id },
      data: { expireLe: new Date(Date.now() - 1000) },
    })
    expect(code(await executer({ jeton }, ACTIVITES))).toBe('JETON_INVALIDE')
    const inconnu = `rt_${'A'.repeat(43)}`
    expect(code(await executer({ jeton: inconnu }, ACTIVITES))).toBe(
      'JETON_INVALIDE'
    )
    expect(code(await executer({ jeton: 'rt_court' }, ACTIVITES))).toBe(
      'JETON_INVALIDE'
    )
  })

  it('n’entre jamais au journal', async () => {
    const espions = [
      vi.spyOn(journal, 'info'),
      vi.spyOn(journal, 'warn'),
      vi.spyOn(journal, 'error'),
    ]
    const { jeton } = await creerJeton(ids.referente, 'LECTURE')
    await executer({ jeton }, ACTIVITES)
    await executer({ jeton: `${jeton.slice(0, -1)}x` }, ACTIVITES)
    const ecrit = JSON.stringify(espions.flatMap(e => e.mock.calls))
    expect(ecrit).not.toContain(jeton.slice(3))
    expect(ecrit).not.toContain(jeton.slice(3, -1))
    for (const e of espions) e.mockRestore()
  })

  it(`plafonne les jetons actifs à ${JETONS_ACTIFS_MAX} par personne`, async () => {
    const actifs = await prisma.jetonAcces.count({
      where: {
        organisationId: ids.org,
        userId: ids.referente,
        revoqueLe: null,
        expireLe: { gt: new Date() },
      },
    })
    for (let i = actifs; i < JETONS_ACTIFS_MAX; i++) {
      await creerJeton(ids.referente, 'LECTURE')
    }
    const r = await executer({ session: ids.referente }, CREER, {
      nom: 'un de trop',
      p: 'LECTURE',
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    // Les jetons de cette personne ne servent plus aux tests suivants.
    await prisma.jetonAcces.updateMany({
      where: { organisationId: ids.org, userId: ids.referente },
      data: { revoqueLe: new Date() },
    })
  })
})

describe('désactivation et administration de l’installation', () => {
  it('une désactivation ferme les jetons sans les révoquer', async () => {
    const { jeton } = await creerJeton(ids.admin, 'LECTURE')
    await executer(
      { session: ids.admin },
      'mutation { desactiverApi { etat } }'
    )
    const r = await executer({ jeton }, ACTIVITES)
    expect(code(r)).toBe('API_INACTIVE')
    expect(r.errors?.[0]?.extensions?.cause).toBe('organisation')
    await executer({ session: ids.admin }, 'mutation { activerApi { etat } }')
    expect((await executer({ jeton }, ACTIVITES)).errors).toBeUndefined()
  })

  it('le réglage de l’installation n’est ouvert qu’au jeton d’administration', async () => {
    const r = await executer({ session: ids.admin }, MODIFIER_API, {
      slug,
      api: { imposee: true },
    })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('une suspension exige un motif, révoque tous les jetons et se lit', async () => {
    const { jeton } = await creerJeton(ids.admin, 'LECTURE')
    const sansMotif = await executer(await installation(), MODIFIER_API, {
      slug,
      api: { suspendue: true },
    })
    expect(code(sansMotif)).toBe('SAISIE_INVALIDE')
    const r = await executer(await installation(), MODIFIER_API, {
      slug,
      api: { suspendue: true, suspensionMotif: 'Usage anormal constaté' },
    })
    expect(r.data).toEqual({
      modifierOrganisationInstallation: {
        api: {
          etat: 'SUSPENDUE',
          autorisee: true,
          imposee: false,
          suspensionMotif: 'Usage anormal constaté',
          jetonsActifs: 0,
        },
      },
    })
    const actifs = await prisma.jetonAcces.count({
      where: { organisationId: ids.org, revoqueLe: null },
    })
    expect(actifs).toBe(0)
    expect(code(await executer({ jeton }, ACTIVITES))).toBe('JETON_INVALIDE')
    const etat = await executer(
      { session: ids.referente },
      '{ apiOrganisation { etat suspensionMotif } }'
    )
    expect(etat.data).toEqual({
      apiOrganisation: {
        etat: 'SUSPENDUE',
        suspensionMotif: 'Usage anormal constaté',
      },
    })
    const activer = await executer(
      { session: ids.admin },
      'mutation { activerApi { etat } }'
    )
    expect(code(activer)).toBe('API_INACTIVE')
    await executer(await installation(), MODIFIER_API, {
      slug,
      api: { suspendue: false },
    })
  })

  it('une activation imposée vaut sans le choix de l’organisation', async () => {
    await executer(
      { session: ids.admin },
      'mutation { desactiverApi { etat } }'
    )
    const r = await executer(await installation(), MODIFIER_API, {
      slug,
      api: { imposee: true },
    })
    expect(
      (
        r.data as {
          modifierOrganisationInstallation: { api: { etat: string } }
        }
      ).modifierOrganisationInstallation.api.etat
    ).toBe('IMPOSEE')
    const { jeton } = await creerJeton(ids.admin, 'LECTURE')
    expect((await executer({ jeton }, ACTIVITES)).errors).toBeUndefined()
    const interdite = await executer(await installation(), MODIFIER_API, {
      slug,
      api: { imposee: false, autorisee: false },
    })
    expect(
      (
        interdite.data as {
          modifierOrganisationInstallation: { api: { etat: string } }
        }
      ).modifierOrganisationInstallation.api.etat
    ).toBe('INTERDITE')
    const refus = await executer({ jeton }, ACTIVITES)
    expect(code(refus)).toBe('API_INACTIVE')
    expect(refus.errors?.[0]?.extensions?.cause).toBe('hebergeur')
    await executer(await installation(), MODIFIER_API, {
      slug,
      api: { autorisee: true },
    })
    await executer({ session: ids.admin }, 'mutation { activerApi { etat } }')
  })

  it('l’archivage d’une personne révoque ses jetons', async () => {
    const { jeton } = await creerJeton(ids.referente, 'LECTURE')
    const r = await executer(
      { session: ids.admin },
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }',
      { id: ids.referente }
    )
    expect(r.errors).toBeUndefined()
    expect(code(await executer({ jeton }, ACTIVITES))).toBe('JETON_INVALIDE')
    const actifs = await prisma.jetonAcces.count({
      where: {
        organisationId: ids.org,
        userId: ids.referente,
        revoqueLe: null,
      },
    })
    expect(actifs).toBe(0)
    await executer(
      { session: ids.admin },
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: false) { id } }',
      { id: ids.referente }
    )
  })
})

describe('route GraphQL', () => {
  it('répond le statut HTTP d’un jeton refusé, avant toute exécution', async () => {
    const app = express()
    const calcules = new WeakMap<express.Request, AppContext>()
    app.use(
      '/graphql',
      creerRefusDeJetonAcces(req => {
        const jeton = /^Bearer\s+(\S+)/.exec(req.get('authorization') ?? '')
        return contexteDeJetonAcces(ip, jeton?.[1] ?? '', null)
      }, calcules),
      (req, res) => {
        res.json({ calcule: calcules.get(req)?.personne?.id ?? null })
      }
    )
    const serveur = app.listen(0, '127.0.0.1')
    await new Promise(r => serveur.once('listening', r))
    const { port } = serveur.address() as AddressInfo
    const appeler = (jeton?: string) =>
      fetch(`http://127.0.0.1:${port}/graphql`, {
        method: 'POST',
        headers:
          jeton === undefined ? {} : { authorization: `Bearer ${jeton}` },
      })
    try {
      const invalide = await appeler(`rt_${'B'.repeat(43)}`)
      expect(invalide.status).toBe(401)
      expect(invalide.headers.get('www-authenticate')).toContain(
        'invalid_token'
      )
      expect(
        (
          (await invalide.json()) as {
            errors: { extensions: { code: string } }[]
          }
        ).errors[0]?.extensions.code
      ).toBe('JETON_INVALIDE')

      const { jeton } = await creerJeton(ids.admin, 'LECTURE')
      const accepte = await appeler(jeton)
      expect(accepte.status).toBe(200)
      expect(await accepte.json()).toEqual({ calcule: ids.admin })

      await executer(
        { session: ids.admin },
        'mutation { desactiverApi { etat } }'
      )
      const fermee = await appeler(jeton)
      expect(fermee.status).toBe(403)
      await executer({ session: ids.admin }, 'mutation { activerApi { etat } }')

      // Sans jeton d'accès, la requête continue : la session ou le jeton
      // d'administration se traitent plus loin.
      const sans = await appeler()
      expect(sans.status).toBe(200)
      expect(await sans.json()).toEqual({ calcule: null })
    } finally {
      await new Promise(r => serveur.close(r))
    }
  })
})
