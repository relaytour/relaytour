import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { composer } from '../courriel/messages.ts'
import {
  composerNotifications,
  SELECTION_NOTIFICATION,
} from '../lib/composition-notifications.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Préférences par organisation (ADR 0032) et notifications d'admin rangées à part
// (ADR 0033). Deux organisations : A porte deux activités, B une seule. « Double »
// est référente dans A et dans B ; « Adèle » et « Arnaud » administrent l'activité
// A1 ; « Albane » administre l'activité A2 ; « Orga » est admin de l'organisation A.
// Un contrôle d'accès se prouve par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slugA = `niv-a-${s}`
const slugB = `niv-b-${s}`

const ids = {
  orgA: '',
  orgB: '',
  a1: '',
  a2: '',
  b: '',
  editionA1: '',
  editionA2: '',
  editionB: '',
  natationA1: '',
  basketA1: '',
  natationA2: '',
  natationB: '',
  orga: '',
  adele: '',
  arnaud: '',
  albane: '',
  double: '',
  hugo: '',
}

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {},
  organisation: string = slugA
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    {
      contextValue: await buildContext(
        '127.0.0.1',
        userId,
        organisation,
        false,
        null
      ),
    }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

async function creerActivite(
  organisationId: string,
  slug: string,
  nom: string
) {
  return (
    await prisma.activite.create({
      data: {
        organisationId,
        slug,
        nom,
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
}

async function creerEdition(organisationId: string, activiteId: string) {
  return (
    await prisma.edition.create({
      data: {
        organisationId,
        activiteId,
        annee: 2027,
        nom: `Période ${activiteId.slice(-4)}`,
        debut: new Date('2027-06-01'),
        fin: new Date('2027-06-02'),
      },
    })
  ).id
}

async function creerPerimetre(
  organisationId: string,
  activiteId: string,
  slug: string,
  nom: string
) {
  return (
    await prisma.perimetre.create({
      data: {
        organisationId,
        activiteId,
        slug: `${slug}-${s}`,
        nom,
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
}

async function creerCompte(
  cle: string,
  appartenances: { organisationId: string; role: 'ADMIN' | 'MEMBRE' }[]
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: `${cle}-${s}@exemple.fr`,
      name: cle,
      emailVerified: true,
      appartenances: { create: appartenances },
    },
  })
  return id
}

const NOTIFICATIONS = `query ($admin: Boolean) {
  notifications(admin: $admin) {
    type niveau message lien
    activite { id nom }
    perimetre { id nom }
  }
}`
const NOMBRES = `query {
  cloche: nombreNotificationsNonLues
  admin: nombreNotificationsNonLues(admin: true)
}`
const AFFECTER = `mutation ($u: ID!, $p: ID!, $e: ID!) {
  affecter(personneId: $u, perimetreId: $p, editionId: $e) { id }
}`

beforeAll(async () => {
  ids.orgA = (
    await prisma.organisation.create({
      data: { slug: slugA, nom: `Orga A ${s}`, configuration: {} },
    })
  ).id
  ids.orgB = (
    await prisma.organisation.create({
      data: { slug: slugB, nom: `Orga B ${s}`, configuration: {} },
    })
  ).id
  ids.a1 = await creerActivite(ids.orgA, `rencontres-${s}`, 'Rencontres')
  ids.a2 = await creerActivite(ids.orgA, `club-${s}`, 'Club')
  ids.b = await creerActivite(ids.orgB, `saison-${s}`, 'Saison')
  ids.editionA1 = await creerEdition(ids.orgA, ids.a1)
  ids.editionA2 = await creerEdition(ids.orgA, ids.a2)
  ids.editionB = await creerEdition(ids.orgB, ids.b)
  ids.natationA1 = await creerPerimetre(
    ids.orgA,
    ids.a1,
    'natation',
    'Natation'
  )
  ids.basketA1 = await creerPerimetre(ids.orgA, ids.a1, 'basket', 'Basket')
  ids.natationA2 = await creerPerimetre(ids.orgA, ids.a2, 'nage', 'Natation')
  ids.natationB = await creerPerimetre(ids.orgB, ids.b, 'piscine', 'Piscine')

  const membreA = { organisationId: ids.orgA, role: 'MEMBRE' as const }
  ids.orga = await creerCompte('Orga', [
    { organisationId: ids.orgA, role: 'ADMIN' },
  ])
  ids.adele = await creerCompte('Adèle', [membreA])
  ids.arnaud = await creerCompte('Arnaud', [membreA])
  ids.albane = await creerCompte('Albane', [membreA])
  ids.hugo = await creerCompte('Hugo', [membreA])
  ids.double = await creerCompte('Double', [
    membreA,
    { organisationId: ids.orgB, role: 'MEMBRE' },
  ])
  await prisma.adminActivite.createMany({
    data: [
      { userId: ids.adele, activiteId: ids.a1, organisationId: ids.orgA },
      { userId: ids.arnaud, activiteId: ids.a1, organisationId: ids.orgA },
      { userId: ids.albane, activiteId: ids.a2, organisationId: ids.orgA },
    ],
  })
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.double,
        perimetreId: ids.natationA1,
        editionId: ids.editionA1,
      },
      {
        userId: ids.double,
        perimetreId: ids.natationB,
        editionId: ids.editionB,
      },
      { userId: ids.hugo, perimetreId: ids.basketA1, editionId: ids.editionA1 },
    ],
  })
})

afterAll(async () => {
  const organisations = [ids.orgA, ids.orgB]
  await prisma.notification.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.journal.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.souhait.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.edition.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.perimetre.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.activite.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: organisations } } })
  invaliderConfigurationOrganisation()
  await apollo.stop()
})

describe('préférences par organisation (ADR 0032)', () => {
  const MODIFIER = `mutation ($f: FrequenceResume!) {
    modifierPreferencesNotification(frequenceResume: $f, mailModification: true, mailEcheance: false, pushEquipe: true) {
      frequenceResume mailEcheance pushEquipe
    }
  }`
  const LIRE = `{ mesPreferencesNotification { frequenceResume mailEcheance pushEquipe resumeAdmin } }`

  it('règle une organisation sans toucher à l’autre', async () => {
    const r = await executer(ids.double, MODIFIER, { f: 'AUCUN' }, slugA)
    expect(r.errors).toBeUndefined()
    expect((await executer(ids.double, LIRE, {}, slugA)).data).toEqual({
      mesPreferencesNotification: {
        frequenceResume: 'AUCUN',
        mailEcheance: false,
        pushEquipe: true,
        resumeAdmin: true,
      },
    })
    // B garde les valeurs par défaut : rien ne passe d'une organisation à l'autre.
    expect((await executer(ids.double, LIRE, {}, slugB)).data).toEqual({
      mesPreferencesNotification: {
        frequenceResume: 'HEBDOMADAIRE',
        mailEcheance: true,
        pushEquipe: false,
        resumeAdmin: true,
      },
    })
  })

  it('applique le réglage de l’organisation du résumé', async () => {
    // Une nouvelle de B à résumer.
    await prisma.notification.create({
      data: {
        organisationId: ids.orgB,
        userId: ids.double,
        type: 'PLACE_MODIFIEE',
        activiteId: ids.b,
      },
    })
    await prisma.notification.create({
      data: {
        organisationId: ids.orgA,
        userId: ids.double,
        type: 'PLACE_MODIFIEE',
        activiteId: ids.a1,
      },
    })
    expect(
      await composer(prisma, {
        sorte: 'resume',
        userId: ids.double,
        organisationId: ids.orgA,
      })
    ).toBeNull()
    const resumeB = await composer(prisma, {
      sorte: 'resume',
      userId: ids.double,
      organisationId: ids.orgB,
    })
    expect(resumeB?.texte).toContain('Saison')
    expect(resumeB?.texte).toContain('Votre place dans l’équipe a changé.')
    expect(resumeB?.desabonnement).toContain(`organisation=${slugB}`)
  })
})

describe('notifications d’admin (ADR 0033)', () => {
  it('prévient les autres admins de l’activité d’une affectation, hors de la cloche', async () => {
    const r = await executer(ids.adele, AFFECTER, {
      u: ids.hugo,
      p: ids.natationA1,
      e: ids.editionA1,
    })
    expect(r.errors).toBeUndefined()
    // Arnaud, l'autre admin de l'activité, la reçoit dans l'écran des admins.
    const lues = (await executer(ids.arnaud, NOTIFICATIONS, { admin: true }))
      .data as { notifications: Record<string, unknown>[] }
    expect(lues.notifications).toContainEqual({
      type: 'AFFECTATION_AJOUTEE',
      niveau: 'ADMIN_ACTIVITE',
      message: 'Adèle a affecté Hugo au périmètre Natation.',
      lien: `/rencontres-${s}/admin/personnes`,
      activite: { id: ids.a1, nom: 'Rencontres' },
      perimetre: { id: ids.natationA1, nom: 'Natation' },
    })
    // La cloche ne la compte pas : chaque niveau a son compteur.
    expect((await executer(ids.arnaud, NOMBRES)).data).toEqual({
      cloche: 0,
      admin: 1,
    })
    // L'auteur ne se prévient pas lui-même, et l'admin d'une autre activité ne
    // reçoit rien.
    for (const personne of [ids.adele, ids.albane]) {
      expect(
        await prisma.notification.count({
          where: { userId: personne, type: 'AFFECTATION_AJOUTEE' },
        })
      ).toBe(0)
    }
    // Un admin de l'organisation ne reçoit pas les nouvelles d'une activité qui a
    // ses propres admins.
    expect(
      await prisma.notification.count({
        where: { userId: ids.orga, type: 'AFFECTATION_AJOUTEE' },
      })
    ).toBe(0)
  })

  it('prévient la personne affectée dans sa cloche, avec le mail d’équipe', async () => {
    const lues = (await executer(ids.hugo, NOTIFICATIONS, { admin: false }))
      .data as { notifications: Record<string, unknown>[] }
    expect(lues.notifications).toContainEqual({
      type: 'PLACE_MODIFIEE',
      niveau: 'REFERENT',
      message: 'Votre place dans l’équipe a changé.',
      lien: `/rencontres-${s}`,
      activite: { id: ids.a1, nom: 'Rencontres' },
      perimetre: null,
    })
  })

  it('refuse l’écran des admins à une référente, et lui compte zéro', async () => {
    expect(code(await executer(ids.hugo, NOTIFICATIONS, { admin: true }))).toBe(
      'FORBIDDEN'
    )
    expect((await executer(ids.hugo, NOMBRES)).data).toMatchObject({ admin: 0 })
    expect(
      code(
        await executer(
          ids.hugo,
          `mutation { marquerNotificationsLues(admin: true) }`
        )
      )
    ).toBe('FORBIDDEN')
  })

  it('ne relit plus les notifications d’une activité que la personne n’administre plus', async () => {
    await prisma.adminActivite.deleteMany({
      where: { userId: ids.arnaud, activiteId: ids.a1 },
    })
    try {
      expect(
        code(await executer(ids.arnaud, NOTIFICATIONS, { admin: true }))
      ).toBe('FORBIDDEN')
    } finally {
      await prisma.adminActivite.create({
        data: {
          userId: ids.arnaud,
          activiteId: ids.a1,
          organisationId: ids.orgA,
        },
      })
    }
  })

  it('prévient les admins d’un souhait, et respecte le réglage « équipe »', async () => {
    await prisma.activite.update({
      where: { id: ids.a1 },
      data: { souhaitsOuverts: true },
    })
    // Arnaud coupe les nouvelles d'équipe dans A.
    await prisma.preferenceOrganisation.create({
      data: {
        userId: ids.arnaud,
        organisationId: ids.orgA,
        applicationEquipe: false,
      },
    })
    const r = await executer(
      ids.double,
      `mutation ($p: ID!, $e: ID!) { formulerSouhait(perimetreId: $p, editionId: $e) }`,
      { p: ids.basketA1, e: ids.editionA1 }
    )
    expect(r.errors).toBeUndefined()
    const pour = async (userId: string) =>
      prisma.notification.count({
        where: { userId, type: 'SOUHAIT_FORMULE', perimetreId: ids.basketA1 },
      })
    expect(await pour(ids.adele)).toBe(1)
    expect(await pour(ids.arnaud)).toBe(0)
    expect(await pour(ids.double)).toBe(0)
  })

  it('marque comme lu un seul périmètre de l’écran des admins', async () => {
    const avant = (await executer(ids.adele, NOMBRES)).data as {
      admin: number
    }
    expect(avant.admin).toBeGreaterThan(0)
    const r = await executer(
      ids.adele,
      `mutation ($p: ID!) { marquerNotificationsLues(admin: true, perimetreId: $p) }`,
      { p: ids.basketA1 }
    )
    expect(r.data).toEqual({ marquerNotificationsLues: 1 })
    expect(
      await prisma.notification.count({
        where: { userId: ids.adele, perimetreId: ids.basketA1, lueLe: null },
      })
    ).toBe(0)
  })

  it('prévient les autres admins de l’organisation d’un archivage', async () => {
    const autre = await creerCompte('Odile', [
      { organisationId: ids.orgA, role: 'ADMIN' },
    ])
    const r = await executer(
      ids.orga,
      `mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }`,
      { id: ids.hugo }
    )
    expect(r.errors).toBeUndefined()
    const lues = (await executer(autre, NOTIFICATIONS, { admin: true }))
      .data as {
      notifications: Record<string, unknown>[]
    }
    expect(lues.notifications).toContainEqual({
      type: 'PERSONNE_ARCHIVEE',
      niveau: 'ADMIN_ORGANISATION',
      message: 'Orga a archivé Hugo dans l’organisation.',
      lien: `/rencontres-${s}/admin/annuaire`,
      activite: null,
      perimetre: null,
    })
    await executer(
      ids.orga,
      `mutation ($id: ID!) { archiverPersonne(id: $id, archive: false) { id } }`,
      { id: ids.hugo }
    )
  })
})

describe('contexte des notifications (ADR 0032)', () => {
  it('nomme l’activité et le périmètre hors de l’application', async () => {
    const [ligne] = await prisma.notification.findMany({
      where: { userId: ids.arnaud, type: 'AFFECTATION_AJOUTEE' },
      select: SELECTION_NOTIFICATION,
    })
    const [composee] = await composerNotifications(prisma, [ligne!], ids.arnaud)
    expect(composee?.messageAvecContexte).toBe(
      'Adèle a affecté Hugo au périmètre Natation (Rencontres).'
    )
  })

  it('liste les autres organisations qui ont des nouvelles, et seulement celles-là', async () => {
    const LISTE = `{ notificationsAutresOrganisations { slug nonLues } }`
    // Double a une notification non lue dans B, et lit depuis A.
    const depuisA = (await executer(ids.double, LISTE, {}, slugA)).data as {
      notificationsAutresOrganisations: { slug: string; nonLues: number }[]
    }
    expect(depuisA.notificationsAutresOrganisations).toEqual([
      { slug: slugB, nonLues: 1 },
    ])
    // Archivée dans B, la personne n'en voit plus le compteur (ADR 0031).
    await prisma.appartenance.update({
      where: {
        userId_organisationId: { userId: ids.double, organisationId: ids.orgB },
      },
      data: { archiveLe: new Date() },
    })
    try {
      const archivee = (await executer(ids.double, LISTE, {}, slugA)).data as {
        notificationsAutresOrganisations: unknown[]
      }
      expect(archivee.notificationsAutresOrganisations).toEqual([])
    } finally {
      await prisma.appartenance.update({
        where: {
          userId_organisationId: {
            userId: ids.double,
            organisationId: ids.orgB,
          },
        },
        data: { archiveLe: null },
      })
    }
  })
})
