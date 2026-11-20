import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { contexteDeJetonAcces } from '../contexte-jeton.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Lecture d'une activité par un robot (ADR 0069). Chaque contrôle se prouve par
// le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `lecture-${s}`
const slugAutre = `lecture-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ip = `10.67.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const ids = {
  org: '',
  autreOrg: '',
  tournoi: '',
  club: '',
  edition: '',
  natation: '',
  admin: '',
  adminClub: '',
  adminAutre: '',
  membre: '',
  lecteur: '',
  decouverte: '',
}

type Qui = { session: string; organisation?: string } | { jeton: string }

async function executer(
  qui: Qui,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const contextValue =
    'session' in qui
      ? await buildContext('127.0.0.1', qui.session, qui.organisation ?? slug)
      : await contexteDeJetonAcces(ip, qui.jeton, null)
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

const CREER_ROBOT = `mutation ($nom: String!, $a: [ID!]!, $l: [ID!]) {
  creerRobot(nom: $nom, activiteIds: $a, lectureActiviteIds: $l) { id activites { id lecture } }
}`
const DONNER =
  'mutation ($r: ID!, $a: ID!) { donnerLectureActivite(robotId: $r, activiteId: $a) }'
const RETIRER =
  'mutation ($r: ID!, $a: ID!) { retirerLectureActivite(robotId: $r, activiteId: $a) }'
const EDITIONS = 'query ($a: ID) { editions(activiteId: $a) { id annee } }'
const LIEUX = 'query ($a: ID!) { lieux(activiteId: $a) { id } }'
const PROGRAMME = 'query ($e: ID!) { programme(editionId: $e) { id } }'

async function creerRobot(nom: string, lecture: string[]): Promise<string> {
  const r = await executer({ session: ids.admin }, CREER_ROBOT, {
    nom,
    a: [ids.tournoi],
    l: lecture,
  })
  expect(r.errors).toBeUndefined()
  return (r.data as { creerRobot: { id: string } }).creerRobot.id
}

beforeAll(async () => {
  await apollo.start()
  for (const [cle, s2] of [
    ['org', slug],
    ['autreOrg', slugAutre],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: {
          slug: s2,
          nom: `Organisation ${s2}`,
          configuration: {},
          apiActivee: true,
        },
      })
    ).id
  }
  const groupes = [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }]
  for (const [cle, s2] of [
    ['tournoi', slug],
    ['club', `${slug}-club`],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: { organisationId: ids.org, slug: s2, nom: cle, groupes },
      })
    ).id
  }
  const jour = new Date(Date.now() + 60 * 86_400_000)
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.tournoi,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: jour,
        fin: jour,
      },
    })
  ).id
  ids.natation = (
    await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.tournoi,
        slug: 'natation',
        nom: 'Natation',
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
  const comptes = [
    ['admin', ids.org, 'ADMIN'],
    ['adminClub', ids.org, 'MEMBRE'],
    ['membre', ids.org, 'MEMBRE'],
    ['adminAutre', ids.autreOrg, 'ADMIN'],
  ] as const
  for (const [cle, organisationId, role] of comptes) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle.toLowerCase()}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId, role } },
      },
    })
  }
  await prisma.adminActivite.create({
    data: {
      userId: ids.adminClub,
      activiteId: ids.club,
      organisationId: ids.org,
    },
  })
  await prisma.rattachementActivite.create({
    data: {
      userId: ids.membre,
      activiteId: ids.tournoi,
      organisationId: ids.org,
    },
  })
})

afterAll(async () => {
  const orgs = [ids.org, ids.autreOrg]
  const comptes = await prisma.appartenance.findMany({
    where: { organisationId: { in: orgs } },
    select: { userId: true },
  })
  await prisma.jetonAcces.deleteMany({
    where: { organisationId: { in: orgs } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.rattachementActivite.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.notification.deleteMany({
    where: { organisationId: { in: orgs } },
  })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { id: { in: comptes.map(c => c.userId) } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: orgs } } })
  invaliderConfigurationOrganisation()
  await apollo.stop()
})

describe('création d’un robot avec la lecture', () => {
  it('ne donne la lecture que pour une activité où le robot est rattaché', async () => {
    const r = await executer({ session: ids.admin }, CREER_ROBOT, {
      nom: 'Hors rattachement',
      a: [ids.tournoi],
      l: [ids.club],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('rattache le robot et lui donne la lecture choisie', async () => {
    ids.lecteur = await creerRobot('Client en lecture', [ids.tournoi])
    ids.decouverte = await creerRobot('Découverte seule', [])
    const robots = await executer(
      { session: ids.admin },
      '{ robots { id activites { id lecture } } }'
    )
    const parId = new Map(
      (
        robots.data as {
          robots: {
            id: string
            activites: { id: string; lecture: boolean }[]
          }[]
        }
      ).robots.map(r => [r.id, r.activites])
    )
    expect(parId.get(ids.lecteur)).toEqual([{ id: ids.tournoi, lecture: true }])
    expect(parId.get(ids.decouverte)).toEqual([
      { id: ids.tournoi, lecture: false },
    ])
  })
})

describe('ce que lit un robot', () => {
  it('rattaché sans lecture, il ne lit ni éditions, ni lieux, ni programme', async () => {
    const qui = { session: ids.decouverte }
    expect(code(await executer(qui, EDITIONS, { a: ids.tournoi }))).toBe(
      'FORBIDDEN'
    )
    expect(code(await executer(qui, LIEUX, { a: ids.tournoi }))).toBe(
      'FORBIDDEN'
    )
    expect(code(await executer(qui, PROGRAMME, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
  })

  it('avec la lecture, il lit chaque période, y compris une période créée ensuite', async () => {
    const qui = { session: ids.lecteur }
    const jour = new Date(Date.now() + 400 * 86_400_000)
    const suivante = await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.tournoi,
        annee: 2028,
        nom: 'Tournoi 2028',
        debut: jour,
        fin: jour,
      },
    })
    const editions = await executer(qui, EDITIONS, { a: ids.tournoi })
    expect(editions.errors).toBeUndefined()
    expect(
      (editions.data as { editions: { id: string }[] }).editions.map(e => e.id)
    ).toEqual(expect.arrayContaining([ids.edition, suivante.id]))
    expect((await executer(qui, LIEUX, { a: ids.tournoi })).errors).toBe(
      undefined
    )
    for (const e of [ids.edition, suivante.id]) {
      expect((await executer(qui, PROGRAMME, { e })).errors).toBeUndefined()
    }
  })

  it('avec la lecture, il ne lit ni une autre activité, ni l’annuaire, ni les données personnelles', async () => {
    const qui = { session: ids.lecteur }
    expect(code(await executer(qui, EDITIONS, { a: ids.club }))).toBe(
      'FORBIDDEN'
    )
    expect(code(await executer(qui, '{ personnes { id } }'))).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          qui,
          '{ equipe(activiteId: "' + ids.tournoi + '") { id } }'
        )
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          qui,
          'query ($a: ID!) { benevoles(activiteId: $a) { id } }',
          {
            a: ids.tournoi,
          }
        )
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          qui,
          'query ($e: ID!) { candidatures(editionId: $e) { id } }',
          { e: ids.edition }
        )
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          qui,
          'query ($e: ID!) { demandes(editionId: $e) { id } }',
          { e: ids.edition }
        )
      )
    ).toBe('FORBIDDEN')
    const perimetres = await executer(
      qui,
      'query ($a: ID) { perimetres(activiteId: $a) { id fiches { id } } }',
      { a: ids.tournoi }
    )
    expect(code(perimetres)).toBe('FORBIDDEN')
  })

  it('avec la lecture et un jeton en écriture, il n’écrit rien dans l’activité', async () => {
    const r = await executer(
      { session: ids.admin },
      `mutation ($r: ID!, $a: [ID!]) {
        creerJetonRobot(robotId: $r, nom: "synchro", portee: LECTURE_ECRITURE, activiteIds: $a) { jeton }
      }`,
      { r: ids.lecteur, a: [ids.tournoi] }
    )
    expect(r.errors).toBeUndefined()
    const { jeton } = (r.data as { creerJetonRobot: { jeton: string } })
      .creerJetonRobot
    expect(
      (await executer({ jeton }, EDITIONS, { a: ids.tournoi })).errors
    ).toBeUndefined()
    const tache = await executer(
      { jeton },
      'mutation ($p: ID!, $e: ID!) { creerTache(perimetreId: $p, editionId: $e, titre: "Interdite") { id } }',
      { p: ids.natation, e: ids.edition }
    )
    expect(code(tache)).toBe('FORBIDDEN')
    const benevole = await executer(
      { jeton },
      'mutation ($a: ID!) { creerBenevole(activiteId: $a, nom: "X", accord: true) { id } }',
      { a: ids.tournoi }
    )
    expect(code(benevole)).toBe('FORBIDDEN')
    // L'activité s'ouvre aux souhaits : seul le refus de la lecture joue.
    await prisma.activite.update({
      where: { id: ids.tournoi },
      data: { souhaitsOuverts: true },
    })
    const souhait = await executer(
      { jeton },
      'mutation ($p: ID!, $e: ID!) { formulerSouhait(perimetreId: $p, editionId: $e) }',
      { p: ids.natation, e: ids.edition }
    )
    expect(code(souhait)).toBe('FORBIDDEN')
    expect(await prisma.souhait.count({ where: { userId: ids.lecteur } })).toBe(
      0
    )
  })

  it('n’apparaît que comme lecteur dans les attributions de l’équipe', async () => {
    const r = await executer(
      { session: ids.admin },
      '{ personnes { id attributions { activiteId rattachee affectee lecture } } }'
    )
    expect(r.errors).toBeUndefined()
    const robot = (
      r.data as {
        personnes: {
          id: string
          attributions: { activiteId: string; lecture: boolean }[]
        }[]
      }
    ).personnes.find(p => p.id === ids.lecteur)
    expect(robot?.attributions).toEqual([
      {
        activiteId: ids.tournoi,
        rattachee: true,
        affectee: false,
        lecture: true,
      },
    ])
  })
})

describe('l’étiquette de l’écran Équipe', () => {
  it('montre la lecture aux seuls admins de l’activité', async () => {
    const LUES =
      'query ($a: ID) { equipe(activiteId: $a) { id activitesLues } }'
    const r = await executer({ session: ids.admin }, LUES, { a: ids.tournoi })
    expect(r.errors).toBeUndefined()
    const lignes = (
      r.data as { equipe: { id: string; activitesLues: string[] }[] }
    ).equipe
    expect(lignes.find(p => p.id === ids.lecteur)?.activitesLues).toEqual([
      ids.tournoi,
    ])
    expect(lignes.find(p => p.id === ids.decouverte)?.activitesLues).toEqual([])
    const membre = await executer({ session: ids.membre }, LUES, {
      a: ids.tournoi,
    })
    expect(code(membre)).toBe('FORBIDDEN')
  })
})

describe('qui donne et retire la lecture', () => {
  it('ni un admin d’une autre activité, ni un admin d’une autre organisation', async () => {
    for (const mutation of [DONNER, RETIRER]) {
      const autreActivite = await executer(
        { session: ids.adminClub },
        mutation,
        { r: ids.decouverte, a: ids.tournoi }
      )
      expect(code(autreActivite)).toBe('FORBIDDEN')
      const autreOrganisation = await executer(
        { session: ids.adminAutre, organisation: slugAutre },
        mutation,
        { r: ids.decouverte, a: ids.tournoi }
      )
      expect(code(autreOrganisation)).toBe('FORBIDDEN')
    }
  })

  it('ni par un jeton, même d’un admin', async () => {
    const r = await executer(
      { session: ids.admin },
      `mutation ($r: ID!) {
        creerJetonRobot(robotId: $r, nom: "lecture", portee: LECTURE_ECRITURE) { jeton }
      }`,
      { r: ids.lecteur }
    )
    const { jeton } = (r.data as { creerJetonRobot: { jeton: string } })
      .creerJetonRobot
    expect(
      code(
        await executer({ jeton }, DONNER, { r: ids.decouverte, a: ids.tournoi })
      )
    ).toBe('FORBIDDEN')
  })

  it('jamais à une personne qui n’est pas un robot', async () => {
    const r = await executer({ session: ids.admin }, DONNER, {
      r: ids.membre,
      a: ids.tournoi,
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.rattachementActivite.count({
        where: { userId: ids.membre, lecture: true },
      })
    ).toBe(0)
  })

  it('jamais pour une activité où le robot n’est pas rattaché', async () => {
    const r = await executer({ session: ids.admin }, DONNER, {
      r: ids.decouverte,
      a: ids.club,
    })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('un admin de l’activité la donne puis la retire, effet à la requête suivante', async () => {
    const qui = { session: ids.decouverte }
    const donnee = await executer({ session: ids.admin }, DONNER, {
      r: ids.decouverte,
      a: ids.tournoi,
    })
    expect(donnee.data).toEqual({ donnerLectureActivite: true })
    expect(
      (await executer(qui, EDITIONS, { a: ids.tournoi })).errors
    ).toBeUndefined()
    const encore = await executer({ session: ids.admin }, DONNER, {
      r: ids.decouverte,
      a: ids.tournoi,
    })
    expect(encore.data).toEqual({ donnerLectureActivite: false })
    const retiree = await executer({ session: ids.admin }, RETIRER, {
      r: ids.decouverte,
      a: ids.tournoi,
    })
    expect(retiree.data).toEqual({ retirerLectureActivite: true })
    expect(code(await executer(qui, EDITIONS, { a: ids.tournoi }))).toBe(
      'FORBIDDEN'
    )
    // Le rattachement reste : le robot découvre toujours l'activité.
    expect(
      await prisma.rattachementActivite.count({
        where: { userId: ids.decouverte, activiteId: ids.tournoi },
      })
    ).toBe(1)
  })
})

describe('ce qui coupe la lecture', () => {
  it('le retrait du rattachement', async () => {
    const robot = await creerRobot('Retiré', [ids.tournoi])
    expect(
      (await executer({ session: robot }, EDITIONS, { a: ids.tournoi })).errors
    ).toBeUndefined()
    const r = await executer(
      { session: ids.admin },
      'mutation ($u: ID!, $a: ID!) { retirerDeLActivite(userId: $u, activiteId: $a) }',
      { u: robot, a: ids.tournoi }
    )
    expect(r.data).toEqual({ retirerDeLActivite: true })
    expect(
      code(await executer({ session: robot }, EDITIONS, { a: ids.tournoi }))
    ).toBe('FORBIDDEN')
  })

  it('l’archivage du robot, qui empêche aussi de la redonner', async () => {
    const r = await executer(
      { session: ids.admin },
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }',
      { id: ids.lecteur }
    )
    expect(r.errors).toBeUndefined()
    expect(
      code(
        await executer({ session: ids.lecteur }, EDITIONS, { a: ids.tournoi })
      )
    ).toBe('FORBIDDEN')
    const redonnee = await executer({ session: ids.admin }, DONNER, {
      r: ids.lecteur,
      a: ids.tournoi,
    })
    expect(code(redonnee)).toBe('FORBIDDEN')
  })
})
