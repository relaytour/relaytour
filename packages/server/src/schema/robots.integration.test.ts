import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { createTransport } from 'nodemailer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { contexteDeJetonAcces } from '../contexte-jeton.ts'
import { expedier } from '../courriel/transport.ts'
import { creerJetonAcces, finDuJeton } from '../lib/jetons-acces.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'
import { ROBOTS_MAX } from '../lib/robots.ts'

import { schema } from './index.ts'

// Robots (ADR 0064) : des membres sans connexion qui portent des jetons. Les
// contrôles se prouvent par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `robots-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ip = `10.66.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const ids = {
  org: '',
  tournoi: '',
  club: '',
  edition: '',
  natation: '',
  admin: '',
  referente: '',
  robot: '',
}

async function executer(
  qui: { session: string } | { jeton: string },
  query: string,
  variables: Record<string, unknown> = {}
) {
  const contextValue =
    'session' in qui
      ? await buildContext('127.0.0.1', qui.session, slug)
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

const CREER_ROBOT = `mutation ($nom: String!, $a: [ID!]!) { creerRobot(nom: $nom, activiteIds: $a) { id nom activites { id } } }`
const CREER_JETON = `mutation ($r: ID!, $p: PorteeJeton!, $a: [ID!]) {
  creerJetonRobot(robotId: $r, nom: "synchro", portee: $p, activiteIds: $a) { jeton jetonAcces { id } }
}`

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
  ids.admin = randomUUID()
  ids.referente = randomUUID()
  await prisma.user.create({
    data: {
      id: ids.admin,
      email: `admin-${slug}@exemple.fr`,
      name: `Admin ${s}`,
      appartenances: { create: { organisationId: ids.org, role: 'ADMIN' } },
    },
  })
  await prisma.user.create({
    data: {
      id: ids.referente,
      email: `referente-${slug}@exemple.fr`,
      name: `Référente ${s}`,
      appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
    },
  })
})

afterAll(async () => {
  const comptes = await prisma.appartenance.findMany({
    where: { organisationId: ids.org },
    select: { userId: true },
  })
  await prisma.jetonAcces.deleteMany({ where: { organisationId: ids.org } })
  await prisma.journal.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.rattachementActivite.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { id: { in: comptes.map(c => c.userId) } },
  })
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  invaliderConfigurationOrganisation()
  await apollo.stop()
})

describe('création d’un robot', () => {
  it('n’est ouverte qu’à un admin de l’organisation, avec sa session', async () => {
    const referente = await executer({ session: ids.referente }, CREER_ROBOT, {
      nom: 'Interdit',
      a: [ids.tournoi],
    })
    expect(code(referente)).toBe('FORBIDDEN')
    const { jeton } = await creerJetonAcces({
      organisationId: ids.org,
      userId: ids.admin,
      creeParId: ids.admin,
      nom: 'admin',
      portee: 'LECTURE_ECRITURE',
      activiteIds: null,
      expireLe: finDuJeton(null),
    })
    const parJeton = await executer({ jeton }, CREER_ROBOT, {
      nom: 'Interdit',
      a: [ids.tournoi],
    })
    expect(code(parJeton)).toBe('FORBIDDEN')
  })

  it('crée un membre sans connexion, rattaché à ses activités', async () => {
    const r = await executer({ session: ids.admin }, CREER_ROBOT, {
      nom: 'Synchronisation',
      a: [ids.tournoi],
    })
    expect(r.errors).toBeUndefined()
    const robot = (
      r.data as { creerRobot: { id: string; activites: { id: string }[] } }
    ).creerRobot
    expect(robot.activites.map(a => a.id)).toEqual([ids.tournoi])
    ids.robot = robot.id
    const compte = await prisma.user.findUniqueOrThrow({
      where: { id: robot.id },
      select: { robot: true, email: true, appartenances: true },
    })
    expect(compte.robot).toBe(true)
    expect(compte.email).toMatch(/@robot\.invalid$/)
    expect(compte.appartenances[0]?.role).toBe('MEMBRE')
    const annuaire = await executer(
      { session: ids.admin },
      '{ personnes { id robot } }'
    )
    expect(
      (annuaire.data as { personnes: { id: string; robot: boolean }[] })
        .personnes
    ).toContainEqual({ id: robot.id, robot: true })
  })

  it('prend une place de membre', async () => {
    const places = await prisma.appartenance.count({
      where: { organisationId: ids.org, archiveLe: null },
    })
    await prisma.organisation.update({
      where: { id: ids.org },
      data: { limiteMembres: places },
    })
    const r = await executer({ session: ids.admin }, CREER_ROBOT, {
      nom: 'De trop',
      a: [ids.tournoi],
    })
    expect(code(r)).toBe('LIMITE_ATTEINTE')
    await prisma.organisation.update({
      where: { id: ids.org },
      data: { limiteMembres: null },
    })
  })

  it(`plafonne les robots actifs à ${ROBOTS_MAX}`, async () => {
    const actifs = await prisma.appartenance.count({
      where: {
        organisationId: ids.org,
        archiveLe: null,
        user: { robot: true },
      },
    })
    for (let i = actifs; i < ROBOTS_MAX; i++) {
      const r = await executer({ session: ids.admin }, CREER_ROBOT, {
        nom: `Robot ${i}`,
        a: [ids.club],
      })
      expect(r.errors).toBeUndefined()
    }
    const r = await executer({ session: ids.admin }, CREER_ROBOT, {
      nom: 'Un de trop',
      a: [ids.club],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })
})

describe('ce qu’un robot ne fait pas', () => {
  it('ne devient pas admin de l’organisation', async () => {
    const r = await executer(
      { session: ids.admin },
      'mutation ($id: ID!) { modifierPersonne(id: $id, nom: "Synchronisation", estAdmin: true) { id } }',
      { id: ids.robot }
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('n’entre jamais par son adresse', async () => {
    const { email } = await prisma.user.findUniqueOrThrow({
      where: { id: ids.robot },
      select: { email: true },
    })
    const r = await executer(
      { session: ids.admin },
      'mutation ($e: String!, $a: ID) { inviterPersonne(email: $e, nom: "X", activiteId: $a) { enAttente } }',
      { e: email, a: ids.tournoi }
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('ne reçoit pas d’invitation', async () => {
    const r = await executer(
      { session: ids.admin },
      'mutation ($id: ID!) { renvoyerInvitation(id: $id) }',
      { id: ids.robot }
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('ne reçoit aucun mail', async () => {
    const envois: string[] = []
    const transport = createTransport({ jsonTransport: true })
    const issue = await expedier(
      {
        destinataire: 'robot-x@robot.invalid',
        sujet: 'Essai',
        html: '<p>Essai</p>',
        texte: 'Essai',
      },
      {
        ...transport,
        sendMail: (m: { to: string }) => {
          envois.push(m.to)
          return transport.sendMail(m)
        },
      } as unknown as typeof transport
    )
    expect(issue).toBe('tu')
    expect(envois).toEqual([])
  })
})

describe('jetons d’un robot', () => {
  it('se vérifient contre les activités du robot, pas celles de l’admin', async () => {
    const r = await executer({ session: ids.admin }, CREER_JETON, {
      r: ids.robot,
      p: 'LECTURE',
      a: [ids.club],
    })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('agissent au nom du robot, qui signe ses tâches', async () => {
    await prisma.affectation.create({
      data: {
        userId: ids.robot,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
    })
    const r = await executer({ session: ids.admin }, CREER_JETON, {
      r: ids.robot,
      p: 'LECTURE_ECRITURE',
      a: [ids.tournoi],
    })
    expect(r.errors).toBeUndefined()
    const { jeton } = (r.data as { creerJetonRobot: { jeton: string } })
      .creerJetonRobot
    const moi = await executer({ jeton }, '{ moi { id robot } }')
    expect(moi.data).toEqual({ moi: { id: ids.robot, robot: true } })
    const tache = await executer(
      { jeton },
      'mutation ($p: ID!, $e: ID!) { creerTache(perimetreId: $p, editionId: $e, titre: "Importée") { id } }',
      { p: ids.natation, e: ids.edition }
    )
    expect(tache.errors).toBeUndefined()
    const id = (tache.data as { creerTache: { id: string } }).creerTache.id
    const journal = await prisma.journal.findFirst({
      where: { tacheId: id, type: 'TACHE_CREEE' },
      select: { acteurId: true },
    })
    expect(journal?.acteurId).toBe(ids.robot)
  })

  it('ne se gèrent ni par la référente ni pour une personne', async () => {
    const refus = await executer({ session: ids.referente }, CREER_JETON, {
      r: ids.robot,
      p: 'LECTURE',
    })
    expect(code(refus)).toBe('FORBIDDEN')
    const pourUnePersonne = await executer(
      { session: ids.admin },
      CREER_JETON,
      {
        r: ids.referente,
        p: 'LECTURE',
      }
    )
    expect(code(pourUnePersonne)).toBe('FORBIDDEN')
    const personnel = (
      await creerJetonAcces({
        organisationId: ids.org,
        userId: ids.referente,
        creeParId: ids.referente,
        nom: 'personnel',
        portee: 'LECTURE',
        activiteIds: null,
        expireLe: finDuJeton(null),
      })
    ).ligne
    const r = await executer(
      { session: ids.admin },
      'mutation ($id: ID!) { revoquerJetonRobot(id: $id) }',
      { id: personnel.id }
    )
    expect(r.data).toEqual({ revoquerJetonRobot: false })
  })

  it('sont révoqués à l’archivage du robot', async () => {
    const r = await executer(
      { session: ids.admin },
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }',
      { id: ids.robot }
    )
    expect(r.errors).toBeUndefined()
    const actifs = await prisma.jetonAcces.count({
      where: { userId: ids.robot, revoqueLe: null },
    })
    expect(actifs).toBe(0)
    const nouveau = await executer({ session: ids.admin }, CREER_JETON, {
      r: ids.robot,
      p: 'LECTURE',
    })
    expect(code(nouveau)).toBe('SAISIE_INVALIDE')
  })
})
