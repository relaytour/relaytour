import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { construireExport } from '../lib/export.ts'

import { schema } from './index.ts'

// Jalons (ADR 0062) : une tâche marquée comme jalon lie d'autres tâches de sa
// période, dans son périmètre ou dans un autre périmètre de l'activité. Lier demande
// d'écrire dans le périmètre du jalon et de consulter celui de la tâche liée.
// Délier demande d'écrire dans l'un des deux. Les droits se prouvent par le refus
// (invariant 11). Le fichier crée sa propre organisation.

const s = randomUUID().slice(0, 8)
const slug = `jalons-${s}`
const apollo = new ApolloServer<AppContext>({ schema })

const ids = {
  organisation: '',
  activite: '',
  autreActivite: '',
  edition: '',
  suivante: '',
  archivee: '',
  autreEdition: '',
  // La coordination, deux pôles, un pôle archivé, et un périmètre d'une autre
  // activité.
  coordination: '',
  parcours: '',
  benevoles: '',
  archive: '',
  ailleurs: '',
  // Personnes : l'admin de l'organisation, la coordinatrice, deux référentes du
  // pôle parcours, le référent du pôle bénévoles, une personne d'une autre activité.
  admin: '',
  coralie: '',
  paula: '',
  pierre: '',
  benoit: '',
  etrangere: '',
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const RESUME =
  'resumeJalon { total ouvertes faites abandonnees enRetard assigneesAMoi }'

const CREER = `mutation ($p: ID!, $e: ID!, $t: String!, $j: Boolean, $m: Boolean, $ech: Date, $d: DeclinaisonInput) {
  creerTache(perimetreId: $p, editionId: $e, titre: $t, jalon: $j, mAssigner: $m, echeance: $ech, declinaison: $d) {
    id jalon declinaisons { id jalon perimetre { id } }
  }
}`
const MARQUER = `mutation ($id: ID!, $j: Boolean!) { marquerJalon(id: $id, jalon: $j) { id jalon ${RESUME} } }`
const LIER = `mutation ($id: ID!, $t: [ID!]!) { lierTaches(id: $id, tacheIds: $t) { id ${RESUME} } }`
const DELIER = `mutation ($id: ID!, $t: ID!) { delierTache(id: $id, tacheId: $t) { id ${RESUME} } }`
const STATUT = `mutation ($id: ID!, $s: StatutTache!) {
  changerStatutTache(id: $id, statut: $s, confirmer: true) { id statut }
}`
const LIRE = `query ($id: ID!) {
  tache(id: $id) {
    id jalon ${RESUME}
    tachesLiees { id }
    jalons { id }
    historiqueJalon { etape par { nom } tache { id } }
  }
}`

interface TacheLue {
  id: string
  jalon: boolean
  resumeJalon: {
    total: number
    ouvertes: number
    faites: number
    abandonnees: number
    enRetard: number
    assigneesAMoi: number
  }
  tachesLiees: { id: string }[]
  jalons: { id: string }[]
  historiqueJalon: {
    etape: string
    par: { nom: string }
    tache: { id: string } | null
  }[]
}

async function creer(
  userId: string,
  perimetreId: string,
  titre: string,
  options: {
    jalon?: boolean
    assigner?: boolean
    echeance?: string
    edition?: string
    declinaison?: Record<string, unknown>
  } = {}
) {
  const r = await executer(userId, CREER, {
    p: perimetreId,
    e: options.edition ?? ids.edition,
    t: titre,
    j: options.jalon ?? false,
    m: options.assigner ?? false,
    ech: options.echeance ?? '2027-03-01',
    d: options.declinaison ?? null,
  })
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      creerTache: {
        id: string
        jalon: boolean
        declinaisons: {
          id: string
          jalon: boolean
          perimetre: { id: string }
        }[]
      }
    }
  ).creerTache
}

async function lire(userId: string, id: string): Promise<TacheLue> {
  const r = await executer(userId, LIRE, { id })
  expect(r.errors).toBeUndefined()
  return (r.data as { tache: TacheLue }).tache
}

beforeAll(async () => {
  await apollo.start()
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: `Organisation ${slug}`,
      configuration: {
        slug,
        nom: `Organisation ${slug}`,
        domainesCourrielAutorises: ['exemple.fr'],
      },
    },
  })
  ids.organisation = organisation.id
  const groupes = [{ cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' }]
  const activite = (cle: string) =>
    prisma.activite.create({
      data: {
        organisationId: ids.organisation,
        slug: `${cle}-${s}`,
        nom: cle,
        groupes,
      },
    })
  ids.activite = (await activite('rassemblement')).id
  ids.autreActivite = (await activite('section')).id
  const edition = (
    activiteId: string,
    annee: number,
    statut: 'PREPARATION' | 'ARCHIVEE' = 'PREPARATION'
  ) =>
    prisma.edition.create({
      data: {
        organisationId: ids.organisation,
        activiteId,
        annee,
        nom: `Période ${annee}`,
        debut: new Date(`${annee}-06-05`),
        fin: new Date(`${annee}-06-06`),
        statut,
      },
    })
  ids.edition = (await edition(ids.activite, 2027)).id
  ids.suivante = (await edition(ids.activite, 2028)).id
  ids.archivee = (await edition(ids.activite, 2025, 'ARCHIVEE')).id
  ids.autreEdition = (await edition(ids.autreActivite, 2027)).id
  const perimetre = (
    cle: string,
    ordre: number,
    options: { activiteId?: string; archive?: boolean } = {}
  ) =>
    prisma.perimetre.create({
      data: {
        organisationId: ids.organisation,
        activiteId: options.activiteId ?? ids.activite,
        slug: `${cle}-${s}`,
        nom: cle,
        groupe: 'pole',
        type: 'POLE',
        ordre,
        archivedAt: options.archive ? new Date() : null,
      },
    })
  ids.coordination = (await perimetre('coordination', 1)).id
  ids.parcours = (await perimetre('parcours', 2)).id
  ids.benevoles = (await perimetre('benevoles', 3)).id
  ids.archive = (await perimetre('archive', 4, { archive: true })).id
  ids.ailleurs = (
    await perimetre('ailleurs', 1, { activiteId: ids.autreActivite })
  ).id

  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['coralie', 'MEMBRE'],
    ['paula', 'MEMBRE'],
    ['pierre', 'MEMBRE'],
    ['benoit', 'MEMBRE'],
    ['etrangere', 'MEMBRE'],
  ] as const) {
    const id = randomUUID()
    await prisma.user.create({
      data: {
        id,
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId: ids.organisation, role } },
      },
    })
    ids[cle] = id
  }
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.coralie,
        perimetreId: ids.coordination,
        editionId: ids.edition,
      },
      {
        userId: ids.coralie,
        perimetreId: ids.coordination,
        editionId: ids.archivee,
      },
      { userId: ids.paula, perimetreId: ids.parcours, editionId: ids.edition },
      { userId: ids.pierre, perimetreId: ids.parcours, editionId: ids.edition },
      {
        userId: ids.benoit,
        perimetreId: ids.benevoles,
        editionId: ids.edition,
      },
      {
        userId: ids.etrangere,
        perimetreId: ids.ailleurs,
        editionId: ids.autreEdition,
      },
    ],
  })
})

afterAll(async () => {
  const dans = { organisationId: ids.organisation }
  await prisma.notification.deleteMany({ where: dans })
  await prisma.journal.deleteMany({ where: { perimetre: dans } })
  await prisma.lienJalon.deleteMany({ where: { jalon: { perimetre: dans } } })
  await prisma.tache.deleteMany({
    where: { perimetre: dans, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { perimetre: dans } })
  await prisma.affectation.deleteMany({ where: { perimetre: dans } })
  await prisma.effectifPerimetre.deleteMany({ where: { perimetre: dans } })
  await prisma.edition.deleteMany({ where: dans })
  await prisma.perimetre.deleteMany({ where: dans })
  await prisma.rattachementActivite.deleteMany({ where: dans })
  await prisma.activite.deleteMany({ where: dans })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: ids.organisation } })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('la coordination suit les tâches d’un pôle par un jalon', () => {
  let jalon = ''
  let trace = ''
  let balisage = ''
  let envoi = ''

  it('crée un jalon dans son périmètre', async () => {
    const creee = await creer(ids.coralie, ids.coordination, 'Parcours prêt', {
      jalon: true,
    })
    expect(creee.jalon).toBe(true)
    jalon = creee.id
    const lu = await lire(ids.coralie, jalon)
    expect(lu.historiqueJalon.map(e => e.etape)).toEqual(['MARQUE'])
    expect(lu.resumeJalon.total).toBe(0)
  })

  it('lie les tâches d’un pôle où elle n’est pas affectée', async () => {
    trace = (
      await creer(ids.paula, ids.parcours, 'Tracer le parcours', {
        assigner: true,
        echeance: '2026-01-10',
      })
    ).id
    balisage = (await creer(ids.pierre, ids.parcours, 'Baliser le parcours')).id
    const r = await executer(ids.coralie, LIER, {
      id: jalon,
      t: [trace, balisage],
    })
    expect(r.errors).toBeUndefined()
    // Une tâche déjà liée est ignorée.
    await executer(ids.coralie, LIER, { id: jalon, t: [trace] })
    const lu = await lire(ids.coralie, jalon)
    expect(lu.tachesLiees.map(t => t.id).sort()).toEqual(
      [trace, balisage].sort()
    )
    expect(lu.resumeJalon).toEqual({
      total: 2,
      ouvertes: 2,
      faites: 0,
      abandonnees: 0,
      // L'échéance de « Tracer le parcours » est passée.
      enRetard: 1,
      assigneesAMoi: 0,
    })
    expect(
      lu.historiqueJalon.filter(e => e.etape === 'LIEE').map(e => e.tache?.id)
    ).toHaveLength(2)
  })

  it('ne change pas la tâche liée, qui indique son jalon', async () => {
    const tache = await prisma.tache.findUniqueOrThrow({
      where: { id: trace },
      select: { version: true, statut: true, jalonLe: true },
    })
    expect(tache).toEqual({ version: 0, statut: 'A_FAIRE', jalonLe: null })
    const lue = await lire(ids.paula, trace)
    expect(lue.jalons.map(j => j.id)).toEqual([jalon])
    // La personne assignée lit sa part du décompte sur le jalon.
    expect((await lire(ids.paula, jalon)).resumeJalon.assigneesAMoi).toBe(1)
  })

  it('compte le statut de chaque tâche liée, sans changer le jalon', async () => {
    const r = await executer(ids.paula, STATUT, { id: trace, s: 'FAITE' })
    expect(r.errors).toBeUndefined()
    const lu = await lire(ids.coralie, jalon)
    expect(lu.resumeJalon).toMatchObject({
      total: 2,
      ouvertes: 1,
      faites: 1,
      enRetard: 0,
    })
    const statut = await prisma.tache.findUniqueOrThrow({
      where: { id: jalon },
      select: { statut: true },
    })
    expect(statut.statut).toBe('A_FAIRE')
  })

  it('lie un autre jalon sans propager son décompte', async () => {
    envoi = (
      await creer(ids.paula, ids.parcours, 'Envoyer le parcours finalisé', {
        jalon: true,
      })
    ).id
    expect(
      (await executer(ids.paula, LIER, { id: envoi, t: [balisage] })).errors
    ).toBeUndefined()
    expect(
      (await executer(ids.coralie, LIER, { id: jalon, t: [envoi] })).errors
    ).toBeUndefined()
    // Deux jalons qui se lient l'un l'autre ne faussent aucun décompte.
    expect(
      (await executer(ids.paula, LIER, { id: envoi, t: [jalon] })).errors
    ).toBeUndefined()
    const lu = await lire(ids.coralie, jalon)
    expect(lu.resumeJalon).toMatchObject({ total: 3, ouvertes: 2, faites: 1 })
    expect((await lire(ids.paula, envoi)).resumeJalon.total).toBe(2)
  })

  it('laisse l’équipe de la tâche liée retirer le lien', async () => {
    const r = await executer(ids.pierre, DELIER, { id: jalon, t: balisage })
    expect(r.errors).toBeUndefined()
    const lu = await lire(ids.coralie, jalon)
    expect(lu.tachesLiees.map(t => t.id)).not.toContain(balisage)
    const delie = lu.historiqueJalon.find(e => e.etape === 'DELIEE')
    expect(delie?.par.nom).toBe(`pierre ${s}`)
    expect(delie?.tache?.id).toBe(balisage)
    // La tâche déliée ne change pas.
    const tache = await prisma.tache.findUniqueOrThrow({
      where: { id: balisage },
      select: { version: true, statut: true },
    })
    expect(tache).toEqual({ version: 0, statut: 'A_FAIRE' })
  })

  it('refuse le retrait à une personne qui n’écrit dans aucun des deux périmètres', async () => {
    const r = await executer(ids.benoit, DELIER, { id: jalon, t: trace })
    expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.lienJalon.count({
        where: { jalonId: jalon, tacheId: trace },
      })
    ).toBe(1)
  })

  it('retire le marqueur et tous les liens du jalon', async () => {
    const r = await executer(ids.coralie, MARQUER, { id: jalon, j: false })
    expect(r.errors).toBeUndefined()
    expect(await prisma.lienJalon.count({ where: { jalonId: jalon } })).toBe(0)
    const lu = await lire(ids.coralie, jalon)
    expect(lu.jalon).toBe(false)
    expect(lu.historiqueJalon.at(-1)?.etape).toBe('RETIRE')
    // Les liens des autres jalons restent, y compris celui qui le vise.
    expect(await prisma.lienJalon.count({ where: { jalonId: envoi } })).toBe(2)
  })

  it('transforme de nouveau la tâche en jalon', async () => {
    const r = await executer(ids.coralie, MARQUER, { id: jalon, j: true })
    expect(r.errors).toBeUndefined()
    expect(
      (r.data as { marquerJalon: { jalon: boolean } }).marquerJalon.jalon
    ).toBe(true)
    const version = await prisma.tache.findUniqueOrThrow({
      where: { id: jalon },
      select: { version: true },
    })
    expect(version.version).toBe(0)
  })
})

describe('les règles du lien', () => {
  let jalon = ''
  let ordinaire = ''

  beforeAll(async () => {
    jalon = (
      await creer(ids.coralie, ids.coordination, 'Bénévoles recrutés', {
        jalon: true,
      })
    ).id
    ordinaire = (
      await creer(ids.coralie, ids.coordination, 'Réserver la salle')
    ).id
  })

  it('refuse de lier sans session', async () => {
    const r = await executer(null, LIER, { id: jalon, t: [ordinaire] })
    expect(r.errors).toBeDefined()
    expect(await prisma.lienJalon.count({ where: { jalonId: jalon } })).toBe(0)
  })

  it('refuse de lier à une personne en consultation du jalon', async () => {
    const tache = (
      await creer(ids.benoit, ids.benevoles, 'Appel aux bénévoles')
    ).id
    const r = await executer(ids.benoit, LIER, { id: jalon, t: [tache] })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse de marquer à une personne en consultation', async () => {
    const r = await executer(ids.benoit, MARQUER, { id: ordinaire, j: true })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse une tâche qui n’est pas un jalon', async () => {
    const autre = (await creer(ids.coralie, ids.coordination, 'Commander')).id
    const r = await executer(ids.coralie, LIER, { id: ordinaire, t: [autre] })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('refuse de lier le jalon à lui-même', async () => {
    const r = await executer(ids.coralie, LIER, { id: jalon, t: [jalon] })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('refuse une tâche d’une autre activité comme une tâche inconnue', async () => {
    const etrangere = (
      await creer(ids.etrangere, ids.ailleurs, 'Tâche de la section', {
        edition: ids.autreEdition,
      })
    ).id
    const r = await executer(ids.coralie, LIER, { id: jalon, t: [etrangere] })
    expect(code(r)).toBe('FORBIDDEN')
    const inconnue = await executer(ids.coralie, LIER, {
      id: jalon,
      t: [randomUUID()],
    })
    expect(code(inconnue)).toBe('FORBIDDEN')
  })

  it('refuse une tâche d’une autre période de la même activité', async () => {
    const tache = await prisma.tache.create({
      data: {
        editionId: ids.suivante,
        perimetreId: ids.parcours,
        titre: 'Tâche de 2028',
      },
    })
    const r = await executer(ids.coralie, LIER, { id: jalon, t: [tache.id] })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse une tâche d’un périmètre archivé', async () => {
    const tache = await prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.archive,
        titre: 'Tâche archivée',
      },
    })
    const r = await executer(ids.admin, LIER, { id: jalon, t: [tache.id] })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('refuse une déclinaison qui attend l’accord de son périmètre', async () => {
    const partagee = await creer(ids.coralie, ids.coordination, 'Partagée', {
      declinaison: { perimetreIds: [ids.parcours] },
    })
    const attente = partagee.declinaisons[0]!.id
    const accord = await prisma.tache.findUniqueOrThrow({
      where: { id: attente },
      select: { accord: true },
    })
    expect(accord.accord).toBe('EN_ATTENTE')
    const lier = await executer(ids.coralie, LIER, { id: jalon, t: [attente] })
    expect(code(lier)).toBe('SAISIE_INVALIDE')
    const marquer = await executer(ids.paula, MARQUER, { id: attente, j: true })
    expect(code(marquer)).toBe('SAISIE_INVALIDE')
  })

  it('refuse toute écriture sur une période archivée', async () => {
    const ancien = await prisma.tache.create({
      data: {
        editionId: ids.archivee,
        perimetreId: ids.coordination,
        titre: 'Jalon de 2025',
        jalonLe: new Date(),
      },
    })
    const autre = await prisma.tache.create({
      data: {
        editionId: ids.archivee,
        perimetreId: ids.coordination,
        titre: 'Tâche de 2025',
      },
    })
    const r = await executer(ids.coralie, LIER, {
      id: ancien.id,
      t: [autre.id],
    })
    expect(r.errors).toBeDefined()
    expect(
      await prisma.lienJalon.count({ where: { jalonId: ancien.id } })
    ).toBe(0)
  })

  it('refuse plus de 100 tâches liées', async () => {
    const r = await executer(ids.coralie, LIER, {
      id: jalon,
      t: Array.from({ length: 101 }, () => randomUUID()),
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })
})

describe('jalons et tâches partagées', () => {
  it('marque les déclinaisons comme jalons à la demande', async () => {
    const partagee = await creer(ids.admin, ids.coordination, 'Pôles prêts', {
      declinaison: {
        perimetreIds: [ids.parcours, ids.benevoles],
        jalons: true,
      },
    })
    expect(partagee.jalon).toBe(false)
    expect(partagee.declinaisons.map(d => d.jalon)).toEqual([true, true])
    // Le pôle lie ses propres tâches à sa déclinaison.
    const declinaison = partagee.declinaisons.find(
      d => d.perimetre.id === ids.parcours
    )!.id
    const tache = (await creer(ids.paula, ids.parcours, 'Repérer le parcours'))
      .id
    const r = await executer(ids.paula, LIER, { id: declinaison, t: [tache] })
    expect(r.errors).toBeUndefined()
    const lue = await lire(ids.coralie, declinaison)
    expect(lue.resumeJalon.total).toBe(1)
    // Le journal garde le marquage de chaque déclinaison, avec son auteur.
    expect(lue.historiqueJalon.map(e => [e.etape, e.par.nom])).toEqual([
      ['MARQUE', `admin ${s}`],
      ['LIEE', `paula ${s}`],
    ])
  })
})

describe('reconduction et export', () => {
  it('reprend le marqueur et les liens dont les deux tâches sont reprises', async () => {
    const jalon = (
      await creer(ids.coralie, ids.coordination, 'Jalon repris', {
        jalon: true,
      })
    ).id
    const liee = (await creer(ids.paula, ids.parcours, 'Tâche reprise')).id
    await executer(ids.coralie, LIER, { id: jalon, t: [liee] })
    const r = await executer(
      ids.admin,
      `mutation ($s: ID!, $c: ID!, $t: [ID!]) {
        reconduireEdition(sourceId: $s, cibleId: $c, tacheIds: $t) { lignes { etat } }
      }`,
      { s: ids.edition, c: ids.suivante, t: [jalon, liee] }
    )
    expect(r.errors).toBeUndefined()
    const repris = await prisma.tache.findFirstOrThrow({
      where: { editionId: ids.suivante, titre: 'Jalon repris' },
      select: { jalonLe: true, liensJalon: { select: { tache: true } } },
    })
    expect(repris.jalonLe).not.toBeNull()
    expect(repris.liensJalon.map(l => l.tache.titre)).toEqual(['Tâche reprise'])
    expect(repris.liensJalon[0]!.tache.editionId).toBe(ids.suivante)
  })

  it('écrit le marqueur et les tâches liées dans l’export complet', async () => {
    const lu = await construireExport(ids.organisation)
    const activite = lu.activites.find(a => a.slug === `rassemblement-${s}`)!
    const jalon = activite.taches.find(
      t => t.titre === 'Envoyer le parcours finalisé'
    )!
    expect(jalon.jalon).toBe(true)
    expect(jalon.tachesLiees).toEqual([
      { perimetre: `parcours-${s}`, titre: 'Baliser le parcours' },
      { perimetre: `coordination-${s}`, titre: 'Parcours prêt' },
    ])
  })
})
