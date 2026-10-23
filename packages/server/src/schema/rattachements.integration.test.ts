import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { construireExport } from '../lib/export.ts'

import { schema } from './index.ts'

// Rattachement à une activité (ADR 0045).
//
// Une organisation porte deux activités, A1 et A2, toutes deux ouvertes aux
// souhaits. Une personne ne voit que les activités auxquelles elle participe. Le
// rattachement la fait entrer dans l'équipe d'une activité sans périmètre, et
// naît à chaque entrée : affectation, invitation, demande acceptée, geste d'un
// admin. La table des refus croisés prouve les refus opération par opération ; ce
// fichier prouve les règles de chaque chemin.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slug = `rattachement-${s}`
const slugAilleurs = `rattachement-ailleurs-${s}`
const ids = {
  org: '',
  ailleurs: '',
  a1: '',
  a2: '',
  edition1: '',
  edition2: '',
  perimetre1: '',
  perimetre2: '',
  adminOrg: '',
  adminA1: '',
  membreA1: '',
  membreA2: '',
  sansActivite: '',
  externe: '',
}

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {},
  organisation = slug
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, organisation) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const adresse = (cle: string) => `${cle}-${s}@exemple.fr`

async function creerCompte(
  cle: string,
  role: 'ADMIN' | 'MEMBRE',
  organisationId = ids.org
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: adresse(cle),
      name: `${cle} ${s}`,
      appartenances: { create: { organisationId, role } },
    },
  })
  return id
}

async function creerActivite(cle: string, ordre: number) {
  const activite = await prisma.activite.create({
    data: {
      organisationId: ids.org,
      slug: `${cle}-${s}`,
      nom: `Activité ${cle}`,
      ordre,
      souhaitsOuverts: true,
      groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
    },
  })
  const edition = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: activite.id,
      annee: 2027,
      nom: `Période ${cle}`,
      debut: new Date('2027-06-01'),
      fin: new Date('2027-06-02'),
    },
  })
  const perimetre = await prisma.perimetre.create({
    data: {
      organisationId: ids.org,
      activiteId: activite.id,
      slug: 'natation',
      nom: `Natation ${cle}`,
      type: 'SPORT',
      groupe: 'sport',
    },
  })
  return { activite: activite.id, edition: edition.id, perimetre: perimetre.id }
}

const rattachements = (userId: string) =>
  prisma.rattachementActivite
    .findMany({
      where: { userId, organisationId: ids.org },
      select: { activiteId: true },
      orderBy: { activiteId: 'asc' },
    })
    .then(lignes => lignes.map(l => l.activiteId).sort())

const ACTIVITES = 'query { activites { id acces } }'
const TOUS = '{ tousLesPerimetres { edition { id } } }'
const AFFECTER =
  'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }'
const RETIRER_AFFECTATION =
  'mutation ($id: ID!) { retirerAffectation(id: $id) }'
const INVITER =
  'mutation ($email: String!, $a: ID, $e: ID, $p: [ID!]) { inviterPersonne(email: $email, nom: "Invitée", activiteId: $a, editionId: $e, perimetresSouhaites: $p) { enAttente personne { id } } }'
const RATTACHER =
  'mutation ($u: ID!, $a: ID!) { rattacherALActivite(userId: $u, activiteId: $a) }'
const RETIRER =
  'mutation ($u: ID!, $a: ID!) { retirerDeLActivite(userId: $u, activiteId: $a) }'
const EQUIPE = 'query ($a: ID) { equipe(activiteId: $a) { id } }'

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${s}`, configuration: {} },
    })
  ).id
  ids.ailleurs = (
    await prisma.organisation.create({
      data: {
        slug: slugAilleurs,
        nom: `Ailleurs ${s}`,
        configuration: {},
      },
    })
  ).id
  // A2 passe avant A1 dans l'ordre des activités.
  const a1 = await creerActivite('a1', 2)
  const a2 = await creerActivite('a2', 1)
  Object.assign(ids, {
    a1: a1.activite,
    a2: a2.activite,
    edition1: a1.edition,
    edition2: a2.edition,
    perimetre1: a1.perimetre,
    perimetre2: a2.perimetre,
  })
  ids.adminOrg = await creerCompte('admin-org', 'ADMIN')
  ids.adminA1 = await creerCompte('admin-a1', 'MEMBRE')
  ids.membreA1 = await creerCompte('membre-a1', 'MEMBRE')
  ids.membreA2 = await creerCompte('membre-a2', 'MEMBRE')
  ids.sansActivite = await creerCompte('sans-activite', 'MEMBRE')
  ids.externe = await creerCompte('externe', 'MEMBRE', ids.ailleurs)
  await prisma.adminActivite.create({
    data: { userId: ids.adminA1, activiteId: ids.a1, organisationId: ids.org },
  })
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.membreA1,
        perimetreId: ids.perimetre1,
        editionId: ids.edition1,
      },
      {
        userId: ids.membreA2,
        perimetreId: ids.perimetre2,
        editionId: ids.edition2,
      },
    ],
  })
})

// Chaque test part de la préparation : aucun rattachement, aucun souhait.
afterEach(async () => {
  await prisma.rattachementActivite.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.souhait.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
})

afterAll(async () => {
  await prisma.invitationOrganisation.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
  await prisma.demande.deleteMany({ where: { organisationId: ids.org } })
  await prisma.rattachementActivite.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.ailleurs] } },
  })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('visibilité limitée aux activités de la personne', () => {
  it('ne montre pas une autre activité ouverte aux souhaits', async () => {
    const r = await executer(ids.membreA1, ACTIVITES)
    expect(r.data?.activites).toEqual([{ id: ids.a1, acces: 'COMPLET' }])
    const ailleurs = await executer(
      ids.membreA1,
      'query ($a: ID) { tousLesPerimetres(activiteId: $a) { edition { id } } }',
      { a: ids.a2 }
    )
    expect(code(ailleurs)).toBe('FORBIDDEN')
  })

  it('ne montre aucune activité à un membre sans lien', async () => {
    const r = await executer(ids.sansActivite, ACTIVITES)
    expect(r.data?.activites).toEqual([])
    expect(code(await executer(ids.sansActivite, TOUS))).toBe('FORBIDDEN')
  })

  it('affiche par défaut une activité vue avant une activité découverte', async () => {
    await prisma.rattachementActivite.create({
      data: { userId: ids.membreA1, activiteId: ids.a2, organisationId: ids.org },
    })
    const r = await executer(ids.membreA1, ACTIVITES)
    expect(r.data?.activites).toEqual(
      expect.arrayContaining([
        { id: ids.a1, acces: 'COMPLET' },
        { id: ids.a2, acces: 'DECOUVERTE' },
      ])
    )
    // A2 passe avant A1 dans l'ordre, mais la personne ne fait que la découvrir.
    const tous = await executer(ids.membreA1, TOUS)
    expect(tous.data?.tousLesPerimetres).toEqual({
      edition: { id: ids.edition1 },
    })
  })
})

describe('naissance du rattachement', () => {
  it('suit chaque affectation et survit à son retrait', async () => {
    const nouvelle = await executer(ids.adminOrg, AFFECTER, {
      u: ids.sansActivite,
      p: ids.perimetre2,
      e: ids.edition2,
    })
    expect(nouvelle.errors).toBeUndefined()
    expect(await rattachements(ids.sansActivite)).toEqual([ids.a2])
    const affectation = (nouvelle.data?.affecter as { id: string }).id
    const retrait = await executer(ids.adminOrg, RETIRER_AFFECTATION, {
      id: affectation,
    })
    expect(retrait.data?.retirerAffectation).toBe(true)
    expect(await rattachements(ids.sansActivite)).toEqual([ids.a2])
    const vues = await executer(ids.sansActivite, ACTIVITES)
    expect(vues.data?.activites).toEqual([{ id: ids.a2, acces: 'DECOUVERTE' }])
  })

  it('suit une invitation dans une activité, sans périmètre', async () => {
    const r = await executer(ids.adminA1, INVITER, {
      email: adresse('nouvelle'),
      a: ids.a1,
    })
    expect(r.errors).toBeUndefined()
    const personne = (
      r.data?.inviterPersonne as { personne: { id: string } | null }
    ).personne
    expect(await rattachements(personne!.id)).toEqual([ids.a1])
    const equipe = await executer(ids.adminA1, EQUIPE, { a: ids.a1 })
    expect(equipe.data?.equipe).toEqual(
      expect.arrayContaining([{ id: personne!.id }])
    )
    const vues = await executer(personne!.id, ACTIVITES)
    expect(vues.data?.activites).toEqual([{ id: ids.a1, acces: 'DECOUVERTE' }])
  })

  it('rattache un membre déjà connu sans le distinguer d’un compte créé', async () => {
    const r = await executer(ids.adminA1, INVITER, {
      email: adresse('membre-a2'),
      a: ids.a1,
    })
    expect(r.errors).toBeUndefined()
    expect(r.data?.inviterPersonne).toEqual({
      enAttente: false,
      personne: { id: ids.membreA2 },
    })
    expect(await rattachements(ids.membreA2)).toEqual([ids.a1])
  })

  it('refuse à un admin d’activité une invitation sans activité', async () => {
    const r = await executer(ids.adminA1, INVITER, {
      email: adresse('sans-activite-invitee'),
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(
      await prisma.user.count({
        where: { email: adresse('sans-activite-invitee') },
      })
    ).toBe(0)
  })

  it('refuse des périmètres d’une autre activité que celle choisie', async () => {
    const r = await executer(ids.adminOrg, INVITER, {
      email: adresse('melange'),
      a: ids.a1,
      e: ids.edition2,
      p: [ids.perimetre2],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('garde l’activité d’un compte extérieur jusqu’à son accord', async () => {
    const r = await executer(ids.adminA1, INVITER, {
      email: adresse('externe'),
      a: ids.a1,
    })
    expect(r.data?.inviterPersonne).toEqual({ enAttente: true, personne: null })
    expect(await rattachements(ids.externe)).toEqual([])
    const enAttente = await executer(
      ids.adminA1,
      'query ($a: ID) { invitationsEnAttente(activiteId: $a) { id activitesRattachees } }',
      { a: ids.a1 }
    )
    const [invitation] = enAttente.data?.invitationsEnAttente as {
      id: string
      activitesRattachees: string[]
    }[]
    expect(invitation?.activitesRattachees).toEqual([ids.a1])
    const accord = await executer(
      ids.externe,
      'mutation ($id: ID!) { accepterInvitation(id: $id) }',
      { id: invitation!.id },
      slugAilleurs
    )
    expect(accord.errors).toBeUndefined()
    expect(await rattachements(ids.externe)).toEqual([ids.a1])
  })
})

describe('rattacher et retirer depuis l’espace organisateur', () => {
  it('laisse l’admin de l’organisation rattacher tout membre', async () => {
    const r = await executer(ids.adminOrg, RATTACHER, {
      u: ids.sansActivite,
      a: ids.a1,
    })
    expect(r.data?.rattacherALActivite).toBe(true)
    expect(await rattachements(ids.sansActivite)).toEqual([ids.a1])
    // Rattacher deux fois ne crée pas de doublon.
    await executer(ids.adminOrg, RATTACHER, { u: ids.sansActivite, a: ids.a1 })
    expect(await rattachements(ids.sansActivite)).toEqual([ids.a1])
  })

  it('refuse à un admin d’activité une personne hors de ses équipes', async () => {
    const r = await executer(ids.adminA1, RATTACHER, {
      u: ids.sansActivite,
      a: ids.a1,
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await rattachements(ids.sansActivite)).toEqual([])
  })

  it('refuse une personne archivée dans l’organisation', async () => {
    await prisma.appartenance.update({
      where: {
        userId_organisationId: {
          userId: ids.sansActivite,
          organisationId: ids.org,
        },
      },
      data: { archiveLe: new Date() },
    })
    try {
      const r = await executer(ids.adminOrg, RATTACHER, {
        u: ids.sansActivite,
        a: ids.a1,
      })
      expect(code(r)).toBe('SAISIE_INVALIDE')
    } finally {
      await prisma.appartenance.update({
        where: {
          userId_organisationId: {
            userId: ids.sansActivite,
            organisationId: ids.org,
          },
        },
        data: { archiveLe: null },
      })
    }
  })

  it('retire le rattachement et les souhaits en cours', async () => {
    await prisma.rattachementActivite.create({
      data: {
        userId: ids.sansActivite,
        activiteId: ids.a1,
        organisationId: ids.org,
      },
    })
    await prisma.souhait.create({
      data: {
        userId: ids.sansActivite,
        perimetreId: ids.perimetre1,
        editionId: ids.edition1,
      },
    })
    const r = await executer(ids.adminA1, RETIRER, {
      u: ids.sansActivite,
      a: ids.a1,
    })
    expect(r.data?.retirerDeLActivite).toBe(true)
    expect(await rattachements(ids.sansActivite)).toEqual([])
    expect(
      await prisma.souhait.count({ where: { userId: ids.sansActivite } })
    ).toBe(0)
    expect(code(await executer(ids.sansActivite, TOUS))).toBe('FORBIDDEN')
  })

  it('refuse le retrait d’une personne affectée dans une période en cours', async () => {
    await prisma.rattachementActivite.create({
      data: { userId: ids.membreA1, activiteId: ids.a1, organisationId: ids.org },
    })
    const r = await executer(ids.adminA1, RETIRER, {
      u: ids.membreA1,
      a: ids.a1,
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await rattachements(ids.membreA1)).toEqual([ids.a1])
  })

  it('retire le rattachement sans effacer une affectation archivée, qui garde l’accès', async () => {
    const archivee = await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.a1,
        annee: 2025,
        nom: 'Période a1 archivée',
        debut: new Date('2025-06-01'),
        fin: new Date('2025-06-02'),
        statut: 'ARCHIVEE',
      },
    })
    try {
      await prisma.affectation.create({
        data: {
          userId: ids.sansActivite,
          perimetreId: ids.perimetre1,
          editionId: archivee.id,
        },
      })
      await prisma.rattachementActivite.create({
        data: {
          userId: ids.sansActivite,
          activiteId: ids.a1,
          organisationId: ids.org,
        },
      })
      const r = await executer(ids.adminA1, RETIRER, {
        u: ids.sansActivite,
        a: ids.a1,
      })
      expect(r.data?.retirerDeLActivite).toBe(true)
      expect(await rattachements(ids.sansActivite)).toEqual([])
      // L'affectation archivée garde la personne dans l'équipe (ADR 0010).
      const vues = await executer(ids.sansActivite, ACTIVITES)
      expect(vues.data?.activites).toEqual([{ id: ids.a1, acces: 'COMPLET' }])
    } finally {
      await prisma.affectation.deleteMany({ where: { editionId: archivee.id } })
      await prisma.edition.delete({ where: { id: archivee.id } })
    }
  })

  it('refuse le retrait d’un admin de l’activité', async () => {
    const r = await executer(ids.adminOrg, RETIRER, {
      u: ids.adminA1,
      a: ids.a1,
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('ne change rien hors des activités administrées', async () => {
    await prisma.rattachementActivite.create({
      data: { userId: ids.membreA2, activiteId: ids.a2, organisationId: ids.org },
    })
    const r = await executer(ids.adminA1, RETIRER, {
      u: ids.membreA2,
      a: ids.a2,
    })
    expect(r.data?.retirerDeLActivite).toBe(false)
    expect(await rattachements(ids.membreA2)).toEqual([ids.a2])
  })
})

describe('annuaire et export', () => {
  it('indique le rattachement dans les activités de chaque personne', async () => {
    await prisma.rattachementActivite.create({
      data: {
        userId: ids.sansActivite,
        activiteId: ids.a2,
        organisationId: ids.org,
      },
    })
    const r = await executer(
      ids.adminOrg,
      '{ personnes { id attributions { activiteId rattachee affectee } } }'
    )
    const personne = (
      r.data?.personnes as {
        id: string
        attributions: unknown[]
      }[]
    ).find(p => p.id === ids.sansActivite)
    expect(personne?.attributions).toEqual([
      { activiteId: ids.a2, rattachee: true, affectee: false },
    ])
  })

  it('exporte les rattachements de l’organisation', async () => {
    await prisma.rattachementActivite.create({
      data: {
        userId: ids.sansActivite,
        activiteId: ids.a1,
        organisationId: ids.org,
      },
    })
    const contenu = await construireExport(ids.org)
    expect(contenu.rattachements).toEqual([
      expect.objectContaining({
        email: adresse('sans-activite'),
        activite: `a1-${s}`,
      }),
    ])
  })
})
