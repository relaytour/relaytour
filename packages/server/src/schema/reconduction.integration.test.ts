import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Reconduction d'une période (ADR 0048). La simulation n'écrit rien et propose les
// tâches qui n'ont pas été abandonnées. La reconduction garde l'écart en jours
// depuis le premier jour, repart de « à faire », recrée les déclinaisons non
// refusées et les effectifs, puis ne recrée rien. Le fichier crée ses propres
// organisations.

const s = randomUUID().slice(0, 8)
const slug = `reconduction-${s}`
const slugAutre = `reconduction-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  autreActivite: '',
  lieux: '',
  natation: '',
  volley: '',
  escrime: '',
  archive: '',
  source: '',
  cible: '',
  archivee: '',
  autrePeriode: '',
  fiche: '',
  ficheArchivee: '',
  ficheLieux: '',
  ficheLieuxRevue: '',
  ficheNatation: '',
  ficheAilleurs: '',
  plan: '',
  salles: '',
  besoins: '',
  perimetreArchive: '',
  ancienneFiche: '',
  admin: '',
  membre: '',
  externe: '',
}

const LIGNES = `lignes { tacheId perimetreId perimetre titre statutSource echeance declinaisons parDefaut retenue etat raison }`
const RAPPORT = `${LIGNES} effectifsCrees effectifsDejaPresents ignorees`
const SIMULER = `query ($s: ID!, $c: ID!, $t: [ID!]) { simulerReconduction(sourceId: $s, cibleId: $c, tacheIds: $t) { ${RAPPORT} } }`
const RECONDUIRE = `mutation ($s: ID!, $c: ID!, $t: [ID!]) { reconduireEdition(sourceId: $s, cibleId: $c, tacheIds: $t) { ${RAPPORT} } }`

interface Ligne {
  tacheId: string
  perimetreId: string
  perimetre: string
  titre: string
  statutSource: string
  echeance: string | null
  declinaisons: number
  parDefaut: boolean
  retenue: boolean
  etat: string
  raison: string | null
}
interface Rapport {
  lignes: Ligne[]
  effectifsCrees: string[]
  effectifsDejaPresents: string[]
  ignorees: number
}

async function executer(
  userId: string,
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

async function rapportDe(
  query: string,
  variables: Record<string, unknown>
): Promise<Rapport> {
  const r = await executer(ids.admin, query, variables)
  expect(r.errors).toBeUndefined()
  return Object.values(r.data as Record<string, Rapport>)[0]!
}

const ligne = (rapport: Rapport, tacheId: string) =>
  rapport.lignes.find(l => l.tacheId === tacheId)!

const tachesCible = () =>
  prisma.tache.findMany({
    where: { editionId: ids.cible },
    include: { assignations: true },
    orderBy: { titre: 'asc' },
  })

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
    ['activite', 'rencontres'],
    ['autreActivite', 'club'],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: slugActivite,
          nom: slugActivite,
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      })
    ).id
  }
  for (const [ordre, cle] of (
    ['lieux', 'natation', 'volley', 'escrime', 'archive'] as const
  ).entries()) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom: cle,
          type: 'SPORT',
          groupe: 'sport',
          ordre,
          archivedAt: cle === 'archive' ? new Date() : null,
        },
      })
    ).id
  }
  for (const [cle, archivedAt, perimetreId] of [
    ['fiche', null, null],
    ['ficheArchivee', new Date(), null],
    ['ficheLieux', null, ids.lieux],
    ['ficheLieuxRevue', null, ids.lieux],
    ['ficheNatation', null, ids.natation],
  ] as const) {
    ids[cle] = (
      await prisma.fiche.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          perimetreId,
          slug: `${cle}-${s}`,
          archivedAt,
        },
      })
    ).id
  }
  for (const [cle, activiteId, annee, debut, statut] of [
    ['source', ids.activite, 2026, '2026-06-13', 'ARCHIVEE'],
    ['cible', ids.activite, 2027, '2027-06-12', 'PREPARATION'],
    ['archivee', ids.activite, 2025, '2025-06-14', 'ARCHIVEE'],
    ['autrePeriode', ids.autreActivite, 2027, '2027-06-12', 'PREPARATION'],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId,
          annee,
          nom: `Édition ${annee}`,
          debut: new Date(debut),
          fin: new Date(debut),
          statut,
        },
      })
    ).id
  }
  for (const [cle, role, organisationId] of [
    ['admin', 'ADMIN', ids.org],
    ['membre', 'MEMBRE', ids.org],
    ['externe', 'ADMIN', ids.orgAutre],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: cle,
        appartenances: { create: { organisationId, role } },
      },
    })
  }

  const tache = async (
    perimetreId: string,
    titre: string,
    autres: Record<string, unknown> = {}
  ) =>
    (
      await prisma.tache.create({
        data: { editionId: ids.source, perimetreId, titre, ...autres },
      })
    ).id
  ids.plan = await tache(ids.lieux, 'Dessiner le plan', {
    description: 'Avec les secours.',
    echeance: new Date('2026-05-14'),
    statut: 'FAITE',
    modeleSlug: 'plan',
    ficheId: ids.fiche,
    assignations: { create: { userId: ids.admin } },
  })
  ids.salles = await tache(ids.lieux, 'Réserver les salles', {
    statut: 'ABANDONNEE',
  })
  // La tâche partagée est passée de la fiche de lieux à sa version revue : seule
  // la déclinaison qui cite la fiche actuelle de l'origine la garde.
  ids.besoins = await tache(ids.lieux, 'Recenser les besoins', {
    echeance: new Date('2026-04-14'),
    ficheId: ids.ficheLieuxRevue,
  })
  for (const [perimetreId, accord, ficheId] of [
    [ids.natation, 'ACCEPTE', ids.ficheLieux],
    [ids.volley, 'EN_ATTENTE', ids.ficheLieuxRevue],
    [ids.escrime, 'REFUSE', null],
    [ids.archive, 'ACCEPTE', null],
  ] as const) {
    await tache(perimetreId, 'Besoins du périmètre', {
      echeance: new Date('2026-04-29'),
      origineId: ids.besoins,
      accord,
      ficheId,
    })
  }
  ids.ficheAilleurs = await tache(ids.lieux, 'Lire la fiche du bassin', {
    ficheId: ids.ficheNatation,
  })
  ids.perimetreArchive = await tache(
    ids.archive,
    'Tâche d’un périmètre archivé'
  )
  ids.ancienneFiche = await tache(ids.natation, 'Lire l’ancienne fiche', {
    ficheId: ids.ficheArchivee,
  })
  await prisma.effectifPerimetre.createMany({
    data: [
      { editionId: ids.source, perimetreId: ids.lieux, effectif: 2 },
      { editionId: ids.source, perimetreId: ids.archive, effectif: 1 },
    ],
  })
})

afterAll(async () => {
  const editions = { edition: { organisationId: ids.org } }
  await prisma.tacheAssignation.deleteMany({ where: { tache: editions } })
  await prisma.tache.deleteMany({
    where: { ...editions, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: editions })
  await prisma.effectifPerimetre.deleteMany({ where: editions })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.fiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.orgAutre] } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('reconduction d’une période', () => {
  it('est réservée aux admins de l’activité, entre deux périodes de la même activité', async () => {
    const periodes = { s: ids.source, c: ids.cible }
    expect(code(await executer(ids.membre, SIMULER, periodes))).toBe(
      'FORBIDDEN'
    )
    expect(
      code(await executer(ids.externe, RECONDUIRE, periodes, slugAutre))
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(ids.admin, SIMULER, {
          s: ids.source,
          c: ids.autrePeriode,
        })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(await executer(ids.admin, SIMULER, { s: ids.cible, c: ids.cible }))
    ).toBe('SAISIE_INVALIDE')
    expect(
      code(
        await executer(ids.admin, RECONDUIRE, {
          s: ids.source,
          c: ids.archivee,
        })
      )
    ).toBe('SAISIE_INVALIDE')
  })

  it('simule sans rien écrire et écarte les tâches abandonnées par défaut', async () => {
    const rapport = await rapportDe(SIMULER, { s: ids.source, c: ids.cible })
    expect(rapport.lignes).toHaveLength(6)
    expect(ligne(rapport, ids.plan)).toMatchObject({
      perimetre: 'lieux',
      statutSource: 'FAITE',
      echeance: '2027-05-13',
      parDefaut: true,
      retenue: true,
      etat: 'A_CREER',
    })
    expect(ligne(rapport, ids.salles)).toMatchObject({
      echeance: null,
      parDefaut: false,
      retenue: false,
    })
    // Les déclinaisons refusées ou d'un périmètre archivé ne reviennent pas.
    expect(ligne(rapport, ids.besoins).declinaisons).toBe(2)
    expect(ligne(rapport, ids.perimetreArchive)).toMatchObject({
      etat: 'ECARTEE',
      raison: 'Le périmètre est archivé.',
    })
    expect(rapport.effectifsCrees).toEqual(['lieux (2)'])
    expect(await tachesCible()).toEqual([])
  })

  it('compte les identifiants étrangers et s’en tient aux tâches choisies', async () => {
    const rapport = await rapportDe(SIMULER, {
      s: ids.source,
      c: ids.cible,
      t: [ids.salles, 'inconnue', ids.autrePeriode],
    })
    expect(rapport.ignorees).toBe(2)
    expect(rapport.lignes.filter(l => l.retenue).map(l => l.tacheId)).toEqual([
      ids.salles,
    ])
  })

  it('recrée les tâches à faire, leurs déclinaisons et les effectifs, puis ne recrée rien', async () => {
    await rapportDe(RECONDUIRE, { s: ids.source, c: ids.cible })
    const taches = await tachesCible()
    expect(taches.map(t => t.titre)).toEqual([
      'Besoins du périmètre',
      'Besoins du périmètre',
      'Dessiner le plan',
      'Lire l’ancienne fiche',
      'Lire la fiche du bassin',
      'Recenser les besoins',
    ])
    const plan = taches.find(t => t.titre === 'Dessiner le plan')!
    expect(plan).toMatchObject({
      perimetreId: ids.lieux,
      description: 'Avec les secours.',
      statut: 'A_FAIRE',
      modeleSlug: 'plan',
      ficheId: ids.fiche,
      creeParId: null,
      termineeLe: null,
      assignations: [],
    })
    expect(plan.echeance?.toISOString().slice(0, 10)).toBe('2027-05-13')
    expect(
      taches.find(t => t.titre === 'Lire l’ancienne fiche')!.ficheId
    ).toBeNull()

    const partagee = taches.find(t => t.titre === 'Recenser les besoins')!
    const declinaisons = taches.filter(t => t.origineId === partagee.id)
    expect(declinaisons.map(t => t.perimetreId).sort()).toEqual(
      [ids.natation, ids.volley].sort()
    )
    expect(partagee.ficheId).toBe(ids.ficheLieuxRevue)
    expect(
      Object.fromEntries(declinaisons.map(d => [d.perimetreId, d.ficheId]))
    ).toEqual({ [ids.natation]: null, [ids.volley]: ids.ficheLieuxRevue })
    expect(
      taches.find(t => t.titre === 'Lire la fiche du bassin')!.ficheId
    ).toBeNull()
    for (const declinaison of declinaisons) {
      expect(declinaison.accord).toBe('ACCEPTE')
      expect(declinaison.echeance?.toISOString().slice(0, 10)).toBe(
        '2027-04-28'
      )
    }
    expect(
      await prisma.effectifPerimetre.findMany({
        where: { editionId: ids.cible },
        select: { perimetreId: true, effectif: true },
      })
    ).toEqual([{ perimetreId: ids.lieux, effectif: 2 }])

    const deuxieme = await rapportDe(RECONDUIRE, {
      s: ids.source,
      c: ids.cible,
      t: [ids.plan, ids.besoins, ids.salles],
    })
    expect(ligne(deuxieme, ids.plan).etat).toBe('DEJA_PRESENTE')
    expect(ligne(deuxieme, ids.besoins).etat).toBe('DEJA_PRESENTE')
    expect(ligne(deuxieme, ids.salles).etat).toBe('A_CREER')
    expect(deuxieme.effectifsDejaPresents).toEqual(['lieux'])
    expect(await tachesCible()).toHaveLength(7)
  })
})
