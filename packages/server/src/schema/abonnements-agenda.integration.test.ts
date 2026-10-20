import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { lireAbonnement } from '../lib/abonnements-agenda.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Abonnements à l'agenda (ADR 0037). Une adresse secrète sert un agenda iCalendar
// en lecture seule. Le serveur ne garde que l'empreinte du jeton et relit les droits
// de la personne à chaque lecture. Les contrôles se prouvent par le refus
// (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `abonnements-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  autreActivite: '',
  edition: '',
  natation: '',
  basket: '',
  tennis: '',
  adminActivite: '',
  referent: '', // affecté à la natation et au basket
  etrangere: '', // référente de l'autre activité
  reunionNatation: '',
  reunionBasket: '',
  reunionGlobale: '',
  reunionTennis: '',
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

const sansLimite = () => Promise.resolve(true)

/** Le nom de fichier d'une adresse d'abonnement. */
const fichier = (adresse: string) => adresse.split('/agenda/')[1]!

async function lire(adresse: string) {
  const lecture = await lireAbonnement(
    fichier(adresse),
    '127.0.0.1',
    new Date(),
    sansLimite
  )
  return lecture
}

/** Le contenu d'un abonnement, lignes dépliées. */
async function contenu(adresse: string): Promise<string> {
  const lecture = await lire(adresse)
  expect(lecture.statut).toBe(200)
  return lecture.statut === 200 ? lecture.contenu.replace(/\r\n /g, '') : ''
}

const CREER = `mutation ($p: [ID!], $g: Boolean, $e: Boolean) {
  creerMonAbonnementAgenda(perimetreIds: $p, inclureGlobal: $g, inclureEcheances: $e) { adresse abonnement { id fin perimetreIds } }
}`
const REGLER = `mutation ($p: [ID!], $g: Boolean!, $e: Boolean!) {
  reglerMonAbonnementAgenda(perimetreIds: $p, inclureGlobal: $g, inclureEcheances: $e) { id perimetreIds inclureGlobal }
}`

async function creer(
  userId: string,
  variables: Record<string, unknown> = {}
): Promise<string> {
  const r = await executer(userId, CREER, variables)
  expect(r.errors).toBeUndefined()
  const { adresse, abonnement } = (
    r.data as {
      creerMonAbonnementAgenda: {
        adresse: string
        abonnement: { fin: string }
      }
    }
  ).creerMonAbonnementAgenda
  expect(adresse).toMatch(/\/agenda\/[A-Za-z0-9_-]{43}\.ics$/)
  expect(adresse.endsWith(`${abonnement.fin}.ics`)).toBe(true)
  return adresse
}

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  for (const [cle, slugActivite] of [
    ['activite', slug],
    ['autreActivite', `${slug}-b`],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: slugActivite,
          nom: cle === 'activite' ? 'Tournoi' : 'Club',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      })
    ).id
  }
  // Une période au cœur de la fenêtre servie (90 jours avant, 540 après).
  const debut = new Date(Date.now() + 120 * 24 * 3600 * 1000)
  const jour = debut.toISOString().slice(0, 10)
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: new Date(jour),
        fin: new Date(jour),
      },
    })
  ).id
  const autreEdition = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.autreActivite,
      annee: 2027,
      nom: 'Club 2027',
      debut: new Date(jour),
      fin: new Date(jour),
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
  for (const cle of ['adminActivite', 'referent', 'etrangere'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle.toLowerCase()}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: {
          create: { organisationId: ids.org, role: 'MEMBRE' },
        },
      },
    })
  }
  await prisma.adminActivite.create({
    data: {
      userId: ids.adminActivite,
      activiteId: ids.activite,
      organisationId: ids.org,
    },
  })
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.referent,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
      { userId: ids.referent, perimetreId: ids.basket, editionId: ids.edition },
      {
        userId: ids.etrangere,
        perimetreId: ids.tennis,
        editionId: autreEdition.id,
      },
    ],
  })
  await prisma.dateCle.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      editionId: ids.edition,
      titre: 'Dossier en préfecture',
      jour: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  })
  const reunion = (
    titre: string,
    activiteId: string,
    editionId: string,
    perimetreId: string | null
  ) =>
    prisma.reunion.create({
      data: {
        organisationId: ids.org,
        activiteId,
        editionId,
        perimetreId,
        titre,
        debut: new Date(Date.now() + 10 * 24 * 3600 * 1000),
        fin: new Date(Date.now() + 10 * 24 * 3600 * 1000 + 3600 * 1000),
        lieu: 'Salle 2',
        convocations: { create: { userId: ids.referent } },
      },
    })
  ids.reunionNatation = (
    await reunion('Point natation', ids.activite, ids.edition, ids.natation)
  ).id
  ids.reunionBasket = (
    await reunion('Point basket', ids.activite, ids.edition, ids.basket)
  ).id
  ids.reunionGlobale = (
    await reunion('Assemblée', ids.activite, ids.edition, null)
  ).id
  ids.reunionTennis = (
    await reunion(
      'Point tennis',
      ids.autreActivite,
      autreEdition.id,
      ids.tennis
    )
  ).id
  // Seule la natation convoque le référent : le basket et la réunion globale
  // figurent par le périmètre lu et par l'agenda global.
  await prisma.convocationReunion.deleteMany({
    where: {
      reunionId: {
        in: [ids.reunionBasket, ids.reunionGlobale, ids.reunionTennis],
      },
    },
  })
  const tache = await prisma.tache.create({
    data: {
      editionId: ids.edition,
      perimetreId: ids.natation,
      titre: 'Réserver le bassin',
      echeance: new Date(Date.now() + 20 * 24 * 3600 * 1000),
    },
  })
  await prisma.tacheAssignation.create({
    data: { tacheId: tache.id, userId: ids.referent },
  })
})

afterAll(async () => {
  await prisma.abonnementAgenda.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.reunion.deleteMany({ where: { organisationId: ids.org } })
  await prisma.dateCle.deleteMany({ where: { organisationId: ids.org } })
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
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  invaliderConfigurationOrganisation()
  await apollo.stop()
})

describe('abonnement personnel', () => {
  it('sert l’agenda global, les réunions lues et les convocations, sans liste de personnes', async () => {
    const ics = await contenu(await creer(ids.referent))
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Dossier en préfecture')
    expect(ics).toContain('SUMMARY:Tournoi · phase Lancement')
    expect(ics).toContain(`UID:reunion-${ids.reunionNatation}@`)
    expect(ics).toContain(`UID:reunion-${ids.reunionBasket}@`)
    expect(ics).toContain(`UID:reunion-${ids.reunionGlobale}@`)
    expect(ics).not.toContain(`UID:reunion-${ids.reunionTennis}@`)
    expect(ics).not.toContain('ATTENDEE')
    expect(ics).not.toContain('Réserver le bassin')
  })

  it('suit les périmètres choisis, l’agenda global et les échéances', async () => {
    const adresse = await creer(ids.referent, {
      p: [ids.basket],
      g: false,
      e: true,
    })
    const ics = await contenu(adresse)
    expect(ics).toContain(`UID:reunion-${ids.reunionBasket}@`)
    // Une convocation reste, même hors des périmètres choisis.
    expect(ics).toContain(`UID:reunion-${ids.reunionNatation}@`)
    expect(ics).not.toContain(`UID:reunion-${ids.reunionGlobale}@`)
    expect(ics).not.toContain('Dossier en préfecture')
    expect(ics).toContain('Échéance · Réserver le bassin')
    const r = await executer(ids.referent, REGLER, {
      p: null,
      g: true,
      e: false,
    })
    expect(r.errors).toBeUndefined()
    // L'adresse ne change pas : son contenu suit le réglage.
    expect(await contenu(adresse)).toContain('Dossier en préfecture')
  })

  it('refuse un périmètre que la personne ne lit pas', async () => {
    for (const requete of [CREER, REGLER]) {
      const r = await executer(ids.referent, requete, {
        p: [ids.tennis],
        g: true,
        e: false,
      })
      expect(code(r)).toBe('FORBIDDEN')
    }
  })

  it('cesse de servir une adresse régénérée ou révoquée', async () => {
    const premiere = await creer(ids.referent)
    const seconde = await creer(ids.referent)
    expect((await lire(premiere)).statut).toBe(404)
    expect((await lire(seconde)).statut).toBe(200)
    const r = await executer(
      ids.referent,
      'mutation { revoquerMonAbonnementAgenda }'
    )
    expect(r.data).toEqual({ revoquerMonAbonnementAgenda: true })
    expect((await lire(seconde)).statut).toBe(404)
  })

  it('suit les droits du moment : périmètre retiré, personne archivée', async () => {
    const adresse = await creer(ids.referent)
    await prisma.affectation.deleteMany({
      where: { userId: ids.referent, perimetreId: ids.basket },
    })
    expect(await contenu(adresse)).not.toContain(
      `UID:reunion-${ids.reunionBasket}@`
    )
    await prisma.appartenance.updateMany({
      where: { userId: ids.referent, organisationId: ids.org },
      data: { archiveLe: new Date() },
    })
    expect((await lire(adresse)).statut).toBe(404)
    await prisma.appartenance.updateMany({
      where: { userId: ids.referent, organisationId: ids.org },
      data: { archiveLe: null },
    })
  })
})

describe('séquences du programme (ADR 0040)', () => {
  it('ajoute les séquences où la personne est placée, avec son rôle', async () => {
    const sequence = await prisma.sequence.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        titre: 'Accueil des équipes',
        debut: new Date(Date.now() + 15 * 24 * 3600 * 1000),
        fin: new Date(Date.now() + 15 * 24 * 3600 * 1000 + 2 * 3600 * 1000),
        places: { create: { userId: ids.referent, role: 'RESPONSABLE' } },
      },
    })
    const ics = await contenu(await creer(ids.referent))
    expect(ics).toContain(`UID:sequence-${sequence.id}@`)
    expect(ics).toContain('SUMMARY:Accueil des équipes (responsable)')
    await prisma.sequence.delete({ where: { id: sequence.id } })
  })
})

describe('abonnement d’activité', () => {
  const CREER_ACTIVITE = `mutation ($a: ID!) { creerAbonnementAgendaActivite(activiteId: $a) { adresse } }`

  it('sert l’agenda global d’une activité à ses admins seulement', async () => {
    const r = await executer(ids.adminActivite, CREER_ACTIVITE, {
      a: ids.activite,
    })
    expect(r.errors).toBeUndefined()
    const adresse = (
      r.data as { creerAbonnementAgendaActivite: { adresse: string } }
    ).creerAbonnementAgendaActivite.adresse
    const ics = await contenu(adresse)
    expect(ics).toContain('X-WR-CALNAME:')
    expect(ics).toContain(`UID:reunion-${ids.reunionGlobale}@`)
    expect(ics).toContain('Dossier en préfecture')
    expect(ics).not.toContain(`UID:reunion-${ids.reunionNatation}@`)
    expect(ics).not.toContain('ATTENDEE')
    for (const qui of [ids.referent, ids.etrangere]) {
      expect(
        code(await executer(qui, CREER_ACTIVITE, { a: ids.activite }))
      ).toBe('FORBIDDEN')
      expect(
        code(
          await executer(
            qui,
            'query ($a: ID!) { abonnementAgendaActivite(activiteId: $a) { id } }',
            { a: ids.activite }
          )
        )
      ).toBe('FORBIDDEN')
    }
    // Une activité archivée ne sert plus rien.
    await prisma.activite.update({
      where: { id: ids.activite },
      data: { archivedAt: new Date() },
    })
    expect((await lire(adresse)).statut).toBe(404)
    await prisma.activite.update({
      where: { id: ids.activite },
      data: { archivedAt: null },
    })
  })
})

describe('adresse publique', () => {
  it('répond 404 à un nom mal formé, à un jeton inconnu et à une organisation suspendue', async () => {
    for (const nom of [
      'agenda.ics',
      '../etc/passwd',
      `${'A'.repeat(43)}.ics`,
    ]) {
      const lecture = await lireAbonnement(
        nom,
        '127.0.0.1',
        new Date(),
        sansLimite
      )
      expect(lecture.statut).toBe(404)
    }
    const adresse = await creer(ids.referent)
    await prisma.organisation.update({
      where: { id: ids.org },
      data: { statut: 'SUSPENDUE' },
    })
    expect((await lire(adresse)).statut).toBe(404)
    await prisma.organisation.update({
      where: { id: ids.org },
      data: { statut: 'ACTIVE' },
    })
  })

  it('répond 429 quand la limite est atteinte', async () => {
    const adresse = await creer(ids.referent)
    const lecture = await lireAbonnement(
      fichier(adresse),
      '127.0.0.1',
      new Date(),
      () => Promise.resolve(false)
    )
    expect(lecture.statut).toBe(429)
  })
})
