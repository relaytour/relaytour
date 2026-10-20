import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { DATES_CLES_MAX } from '../lib/agenda.ts'

import { schema } from './index.ts'

// Agenda d'une période et dates clés (ADR 0037). Toute personne qui voit
// l'activité lit l'agenda global ; seuls les admins de l'activité écrivent les dates
// clés, tant que la période n'est pas archivée. Les contrôles se prouvent par le
// refus (invariant 11). Le fichier crée ses propres organisations.

const s = randomUUID().slice(0, 8)
const slug = `agenda-${s}`
const slugAutre = `agenda-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  autreActivite: '',
  edition: '',
  archivee: '',
  natation: '',
  basket: '',
  tennis: '', // périmètre de l'autre activité
  adminActivite: '',
  adminAutre: '', // admin de l'autre activité seulement
  referent: '', // affecté à la natation
  basketteuse: '', // affectée au basket : consulte la natation
  membre: '', // aucune affectation
  archive: '', // affecté à la natation, archivé dans l'organisation (ADR 0031)
  externe: '', // membre de l'autre organisation seulement
  aFaire: '',
  faite: '',
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {},
  organisation = slug
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, organisation) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const AGENDA = `query ($e: ID!, $ech: Boolean, $p: [ID!]) {
  agenda(editionId: $e, echeances: $ech, perimetreIds: $p) {
    peutGerer
    elements { cle sorte titre jour jourFin dateCleId version tacheId faite }
  }
}`
const CREER = `mutation ($e: ID!, $t: String!, $j: Date!, $f: Date, $d: String) {
  creerDateCle(editionId: $e, titre: $t, jour: $j, jourFin: $f, description: $d) { id titre jour jourFin version }
}`
const MODIFIER = `mutation ($id: ID!, $t: String!, $j: Date!, $f: Date, $v: Int!) {
  modifierDateCle(id: $id, titre: $t, jour: $j, jourFin: $f, versionAttendue: $v) { id titre jour jourFin version }
}`
const SUPPRIMER = `mutation ($id: ID!) { supprimerDateCle(id: $id) }`

interface Element {
  cle: string
  sorte: string
  titre: string
  jour: string
  jourFin: string | null
  dateCleId: string | null
  version: number | null
  tacheId: string | null
  faite: boolean
}
interface Lu {
  agenda: { peutGerer: boolean; elements: Element[] }
}

async function lire(
  userId: string,
  variables: Record<string, unknown> = {}
): Promise<Lu['agenda']> {
  const r = await executer(userId, AGENDA, { e: ids.edition, ...variables })
  expect(r.errors).toBeUndefined()
  return (r.data as unknown as Lu).agenda
}

const adresseDe = (cle: string) => `${cle.toLowerCase()}-${slug}@exemple.fr`

beforeAll(async () => {
  await apollo.start()
  for (const [cle, slugOrg] of [
    ['org', slug],
    ['orgAutre', slugAutre],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: {
          slug: slugOrg,
          nom: `Organisation ${slugOrg}`,
          configuration: {},
        },
      })
    ).id
  }
  for (const [cle, slugActivite] of [
    ['activite', slug],
    ['autreActivite', `${slug}-b`],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: slugActivite,
          nom: 'Tournoi',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      })
    ).id
  }
  for (const [cle, annee, statut, activiteId] of [
    ['edition', 2027, 'PREPARATION', ids.activite],
    ['archivee', 2025, 'ARCHIVEE', ids.activite],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId,
          annee,
          nom: `Tournoi ${annee}`,
          debut: new Date(`${annee}-06-05`),
          fin: new Date(`${annee}-06-06`),
          statut,
          createdAt: new Date(`${annee - 1}-10-01T10:00:00.000Z`),
        },
      })
    ).id
  }
  const autreEdition = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.autreActivite,
      annee: 2027,
      nom: 'Autre 2027',
      debut: new Date('2027-09-01'),
      fin: new Date('2027-09-02'),
    },
  })
  for (const [cle, activiteId] of [
    ['natation', ids.activite],
    ['basket', ids.activite],
    ['tennis', ids.autreActivite],
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
  for (const cle of [
    'adminActivite',
    'adminAutre',
    'referent',
    'basketteuse',
    'membre',
    'archive',
    'externe',
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: adresseDe(cle),
        name: `${cle} ${s}`,
        appartenances: {
          create: {
            organisationId: cle === 'externe' ? ids.orgAutre : ids.org,
            role: 'MEMBRE',
            archiveLe: cle === 'archive' ? new Date() : null,
          },
        },
      },
    })
  }
  await prisma.adminActivite.createMany({
    data: [
      {
        userId: ids.adminActivite,
        activiteId: ids.activite,
        organisationId: ids.org,
      },
      {
        userId: ids.adminAutre,
        activiteId: ids.autreActivite,
        organisationId: ids.org,
      },
    ],
  })
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.referent,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
      {
        userId: ids.archive,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
      {
        userId: ids.basketteuse,
        perimetreId: ids.basket,
        editionId: ids.edition,
      },
      {
        userId: ids.adminAutre,
        perimetreId: ids.tennis,
        editionId: autreEdition.id,
      },
    ],
  })
  const tache = (titre: string, data: Record<string, unknown> = {}) =>
    prisma.tache.create({
      data: {
        editionId: ids.edition,
        perimetreId: ids.natation,
        titre,
        echeance: new Date('2027-05-01'),
        ...data,
      },
    })
  ids.aFaire = (await tache('Réserver le bassin')).id
  ids.faite = (await tache('Choisir la date', { statut: 'FAITE' })).id
  await tache('Ancienne idée', { statut: 'ABANDONNEE' })
  await tache('Sans échéance', { echeance: null })
  const partagee = await prisma.tache.create({
    data: {
      editionId: ids.edition,
      perimetreId: ids.basket,
      titre: 'Partagée',
    },
  })
  await tache('Proposée', { origineId: partagee.id, accord: 'EN_ATTENTE' })
  await prisma.tache.create({
    data: {
      editionId: ids.edition,
      perimetreId: ids.basket,
      titre: 'Tracer le terrain',
      echeance: new Date('2027-05-02'),
    },
  })
})

afterAll(async () => {
  await prisma.dateCle.deleteMany({ where: { organisationId: ids.org } })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: ids.org }, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
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
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.orgAutre] } },
  })
  await apollo.stop()
})

describe('lecture de l’agenda', () => {
  it('montre les phases, le premier et le dernier jour de la période', async () => {
    const agenda = await lire(ids.referent)
    expect(agenda.peutGerer).toBe(false)
    expect(
      agenda.elements.map(e => [e.sorte, e.titre, e.jour, e.jourFin])
    ).toEqual([
      ['PHASE', 'Lancement', '2026-10-01', '2027-02-05'],
      ['PHASE', 'Préparation', '2027-02-06', '2027-05-06'],
      ['PHASE', 'Derniers réglages', '2027-05-07', '2027-06-04'],
      ['PHASE', 'Déroulement et bilan', '2027-06-05', '2027-06-06'],
      ['DEBUT_PERIODE', 'Premier jour · Tournoi 2027', '2027-06-05', null],
      ['FIN_PERIODE', 'Dernier jour · Tournoi 2027', '2027-06-06', null],
    ])
  })

  it('ajoute les échéances actives des périmètres de la personne', async () => {
    const agenda = await lire(ids.referent, { ech: true })
    const echeances = agenda.elements.filter(e => e.sorte === 'ECHEANCE')
    expect(echeances.map(e => [e.titre, e.faite])).toEqual([
      ['Choisir la date', true],
      ['Réserver le bassin', false],
    ])
  })

  it('lit les échéances d’un périmètre consulté, à la demande', async () => {
    const agenda = await lire(ids.basketteuse, { ech: true, p: [ids.natation] })
    expect(
      agenda.elements.filter(e => e.sorte === 'ECHEANCE').map(e => e.titre)
    ).toEqual(['Choisir la date', 'Réserver le bassin'])
  })

  it('dit à l’admin de l’activité qu’il gère les dates clés', async () => {
    expect((await lire(ids.adminActivite)).peutGerer).toBe(true)
  })

  it('refuse une personne sans session, sans affectation, archivée ou extérieure', async () => {
    expect(code(await executer(null, AGENDA, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
    for (const qui of [ids.membre, ids.archive, ids.adminAutre]) {
      expect(code(await executer(qui, AGENDA, { e: ids.edition }))).toBe(
        'FORBIDDEN'
      )
    }
    expect(
      code(await executer(ids.externe, AGENDA, { e: ids.edition }, slugAutre))
    ).toBe('FORBIDDEN')
  })

  it('refuse les échéances d’un périmètre d’une autre activité', async () => {
    const r = await executer(ids.referent, AGENDA, {
      e: ids.edition,
      ech: true,
      p: [ids.tennis],
    })
    expect(code(r)).toBe('FORBIDDEN')
  })
})

describe('dates clés', () => {
  let id = ''

  it('se créent par un admin de l’activité et s’affichent dans l’agenda', async () => {
    const r = await executer(ids.adminActivite, CREER, {
      e: ids.edition,
      t: '  Dossier en préfecture ',
      j: '2027-03-01',
      f: '2027-03-03',
      d: 'Dépôt avant midi.',
    })
    expect(r.errors).toBeUndefined()
    const creee = (r.data as { creerDateCle: { id: string; titre: string } })
      .creerDateCle
    id = creee.id
    expect(creee).toMatchObject({
      titre: 'Dossier en préfecture',
      jour: '2027-03-01',
      jourFin: '2027-03-03',
      version: 0,
    })
    const element = (await lire(ids.referent)).elements.find(
      e => e.sorte === 'DATE_CLE'
    )
    expect(element).toMatchObject({
      cle: `date-cle-${id}`,
      titre: 'Dossier en préfecture',
      jour: '2027-03-01',
      jourFin: '2027-03-03',
      dateCleId: id,
      version: 0,
    })
  })

  it('se modifient avec la version lue, et refusent une version dépassée', async () => {
    const r = await executer(ids.adminActivite, MODIFIER, {
      id,
      t: 'Dossier déposé',
      j: '2027-03-02',
      f: null,
      v: 0,
    })
    expect(r.errors).toBeUndefined()
    expect(r.data).toMatchObject({
      modifierDateCle: { titre: 'Dossier déposé', jourFin: null, version: 1 },
    })
    const conflit = await executer(ids.adminActivite, MODIFIER, {
      id,
      t: 'Autre titre',
      j: '2027-03-02',
      v: 0,
    })
    expect(code(conflit)).toBe('CONFLIT_VERSION')
    expect(conflit.errors?.[0]?.extensions?.versionCourante).toBe(1)
  })

  it('refusent un dernier jour avant le premier', async () => {
    const r = await executer(ids.adminActivite, CREER, {
      e: ids.edition,
      t: 'À l’envers',
      j: '2027-03-03',
      f: '2027-03-01',
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('restent hors de portée des référents et des admins d’une autre activité', async () => {
    for (const qui of [
      ids.referent,
      ids.basketteuse,
      ids.adminAutre,
      ids.membre,
    ]) {
      expect(
        code(
          await executer(qui, CREER, {
            e: ids.edition,
            t: 'Intrusion',
            j: '2027-03-01',
          })
        )
      ).toBe('FORBIDDEN')
      expect(
        code(
          await executer(qui, MODIFIER, {
            id,
            t: 'Intrusion',
            j: '2027-03-01',
            v: 0,
          })
        )
      ).toBe('FORBIDDEN')
      expect(code(await executer(qui, SUPPRIMER, { id }))).toBe('FORBIDDEN')
    }
    expect(
      code(await executer(ids.externe, SUPPRIMER, { id }, slugAutre))
    ).toBe('FORBIDDEN')
    expect(
      await prisma.dateCle.findUniqueOrThrow({
        where: { id },
        select: { titre: true },
      })
    ).toEqual({ titre: 'Dossier déposé' })
  })

  it('ne s’écrivent pas dans une période archivée', async () => {
    const r = await executer(ids.adminActivite, CREER, {
      e: ids.archivee,
      t: 'Trop tard',
      j: '2025-03-01',
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    const agenda = await executer(ids.adminActivite, AGENDA, {
      e: ids.archivee,
    })
    expect((agenda.data as unknown as Lu).agenda.peutGerer).toBe(false)
  })

  it('se suppriment par un admin de l’activité', async () => {
    const r = await executer(ids.adminActivite, SUPPRIMER, { id })
    expect(r.errors).toBeUndefined()
    expect(await prisma.dateCle.count({ where: { id } })).toBe(0)
  })
})

describe('plafond des dates clés', () => {
  it('tient même pour deux créations simultanées', async () => {
    const deja = await prisma.dateCle.count({
      where: { editionId: ids.edition },
    })
    await prisma.dateCle.createMany({
      data: Array.from({ length: DATES_CLES_MAX - 1 - deja }, (_, i) => ({
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        titre: `Remplissage ${i}`,
        jour: new Date('2027-03-01T00:00:00.000Z'),
      })),
    })
    try {
      const reponses = await Promise.all(
        ['Première', 'Seconde'].map(titre =>
          executer(ids.adminActivite, CREER, {
            e: ids.edition,
            t: titre,
            j: '2027-03-02',
          })
        )
      )
      expect(reponses.map(code).sort()).toEqual(['SAISIE_INVALIDE', undefined])
      expect(
        await prisma.dateCle.count({ where: { editionId: ids.edition } })
      ).toBe(DATES_CLES_MAX)
    } finally {
      await prisma.dateCle.deleteMany({
        where: {
          editionId: ids.edition,
          titre: { in: ['Première', 'Seconde'] },
        },
      })
      await prisma.dateCle.deleteMany({
        where: {
          editionId: ids.edition,
          titre: { startsWith: 'Remplissage ' },
        },
      })
    }
  })
})
