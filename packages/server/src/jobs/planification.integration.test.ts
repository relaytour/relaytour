import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { Queue } from 'bullmq'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { composer } from '../courriel/messages.ts'
import { GROUPES_PAR_DEFAUT } from '../lib/activites.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { genererRappels, personnesAResumer } from './planification.ts'
import { connection, type TachePlanifiee } from './queues.ts'
import { nomPlanification, synchroniserPlanification } from './synchro.ts'

// Worker par organisation (ADR 0008) : rappels, résumés et planifications se
// limitent à chaque organisation, dans son fuseau. Deux organisations sont créées
// pour le test ; celle de la base de développement n'est pas touchée.

const s = randomUUID().slice(0, 8)
const ids = {
  orgA: '',
  orgB: '',
  tacheA: '',
  tacheB: '',
  alice: '', // membre de A
  benoit: '', // membre de B
  double: '', // membre de A et de B
}
const fileDeTest = new Queue<Record<string, string>, unknown, TachePlanifiee>(
  `planification-test-${s}`,
  { connection }
)

async function creerOrganisation(cle: 'A' | 'B', fuseauHoraire: string) {
  const slug = `plan-${cle.toLowerCase()}-${s}`
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: `Organisation ${cle}`,
      sigle: `Orga ${cle}`,
      fuseauHoraire,
      configuration: {
        slug,
        nom: `Organisation ${cle}`,
        sigle: `Orga ${cle}`,
        fuseauHoraire,
        domainesCourrielAutorises: [],
      },
      activites: {
        create: { slug, nom: `Activité ${cle}`, groupes: GROUPES_PAR_DEFAUT },
      },
    },
    include: { activites: true },
  })
  const activiteId = organisation.activites[0]!.id
  const edition = await prisma.edition.create({
    data: {
      organisationId: organisation.id,
      activiteId,
      annee: 2027,
      nom: `Période ${cle}`,
      debut: new Date('2027-08-27'),
      fin: new Date('2027-08-29'),
    },
  })
  const perimetre = await prisma.perimetre.create({
    data: {
      organisationId: organisation.id,
      activiteId,
      slug: 'natation',
      nom: `Natation ${cle}`,
      type: 'SPORT',
      groupe: 'sport',
    },
  })
  return {
    id: organisation.id,
    editionId: edition.id,
    perimetreId: perimetre.id,
  }
}

async function creerCompte(cle: string, organisations: string[]) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: `${cle}-${s}@exemple.fr`,
      name: `${cle} ${s}`,
      appartenances: {
        create: organisations.map(organisationId => ({ organisationId })),
      },
      preferences: {
        create: {
          organisationId: organisations[0]!,
          frequenceResume: 'QUOTIDIEN',
        },
      },
    },
  })
  return id
}

// Un jeudi, 23 h 30 UTC : vendredi 1 h 30 à Paris, jeudi 19 h 30 à Montréal.
const maintenant = new Date('2027-08-26T23:30:00Z')

beforeAll(async () => {
  const a = await creerOrganisation('A', 'Europe/Paris')
  const b = await creerOrganisation('B', 'America/Montreal')
  ids.orgA = a.id
  ids.orgB = b.id
  ids.alice = await creerCompte('alice', [a.id])
  ids.benoit = await creerCompte('benoit', [b.id])
  ids.double = await creerCompte('double', [a.id, b.id])
  // Deux tâches à échéance du 28 août : à un jour à Paris, à deux jours à Montréal.
  for (const [cle, organisation, personne] of [
    ['tacheA', a, ids.alice],
    ['tacheB', b, ids.benoit],
  ] as const) {
    ids[cle] = (
      await prisma.tache.create({
        data: {
          editionId: organisation.editionId,
          perimetreId: organisation.perimetreId,
          titre: `Réserver la piscine ${cle} ${s}`,
          echeance: new Date('2027-08-28'),
          assignations: {
            create: [{ userId: personne }, { userId: ids.double }],
          },
        },
      })
    ).id
  }
})

afterAll(async () => {
  const organisations = [ids.orgA, ids.orgB]
  await prisma.notification.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
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
  await prisma.preferenceNotification.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: organisations } } })
  invaliderConfigurationOrganisation()
  await fileDeTest.obliterate({ force: true })
  await fileDeTest.close()
})

describe('rappels par organisation', () => {
  it('ne crée des rappels que pour les tâches de l’organisation, dans son fuseau', async () => {
    const rappelsA = await genererRappels(
      prisma,
      { id: ids.orgA, fuseauHoraire: 'Europe/Paris' },
      maintenant
    )
    const notificationsA = await prisma.notification.findMany({
      where: { id: { in: rappelsA.flatMap(r => r.notificationIds) } },
    })
    expect(new Set(notificationsA.map(n => n.tacheId))).toEqual(
      new Set([ids.tacheA])
    )
    expect(new Set(notificationsA.map(n => n.organisationId))).toEqual(
      new Set([ids.orgA])
    )
    // À Paris, on est déjà le 27 : l'échéance du 28 est à un jour.
    expect(notificationsA.every(n => n.jours === 1)).toBe(true)

    const rappelsB = await genererRappels(
      prisma,
      { id: ids.orgB, fuseauHoraire: 'America/Montreal' },
      maintenant
    )
    const notificationsB = await prisma.notification.findMany({
      where: { id: { in: rappelsB.flatMap(r => r.notificationIds) } },
    })
    expect(new Set(notificationsB.map(n => n.tacheId))).toEqual(
      new Set([ids.tacheB])
    )
    // À Montréal, on est encore le 26 : l'échéance du 28 est à deux jours.
    expect(notificationsB.every(n => n.jours === 2)).toBe(true)
  })
})

describe('résumés par organisation', () => {
  it('ne retient que les membres de l’organisation', async () => {
    const a = await personnesAResumer(
      prisma,
      { id: ids.orgA, fuseauHoraire: 'Europe/Paris' },
      maintenant
    )
    expect(a).toEqual(expect.arrayContaining([ids.alice, ids.double]))
    expect(a).not.toContain(ids.benoit)
  })

  it('compose un résumé limité à l’organisation, à ses couleurs', async () => {
    const message = await composer(prisma, {
      sorte: 'resume',
      userId: ids.double,
      organisationId: ids.orgB,
    })
    expect(message?.sujet).toContain('Orga B')
    expect(message?.texte).toContain(`tacheB ${s}`)
    expect(message?.texte).not.toContain(`tacheA ${s}`)
  })

  it('envoie à une personne membre de deux organisations le résumé de chacune', async () => {
    const pourA = { id: ids.orgA, fuseauHoraire: 'Europe/Paris' }
    const pourB = { id: ids.orgB, fuseauHoraire: 'America/Montreal' }
    const resumeA = await composer(prisma, {
      sorte: 'resume',
      userId: ids.double,
      organisationId: ids.orgA,
    })
    await resumeA?.apresEnvoi?.()
    // Le résumé de A est noté pour A seulement : celui de B reste à envoyer.
    expect(await personnesAResumer(prisma, pourA)).not.toContain(ids.double)
    expect(await personnesAResumer(prisma, pourB)).toContain(ids.double)
  })

  it('prend l’unique organisation de la personne quand le job n’en porte pas', async () => {
    const message = await composer(prisma, {
      sorte: 'invitation',
      userId: ids.benoit,
    })
    expect(message?.sujet).toContain('Orga B')
  })
})

describe('planifications par organisation', () => {
  it('crée une planification par organisation active, dans son fuseau, et retire les autres', async () => {
    // Une planification globale d'avant l'ADR 0008 et celle d'une organisation disparue.
    await fileDeTest.upsertJobScheduler(
      'rappels',
      { pattern: '30 6 * * *', tz: 'Europe/Paris' },
      { name: 'rappels' }
    )
    await fileDeTest.upsertJobScheduler(
      'resumes-organisation-disparue' as TachePlanifiee,
      { pattern: '0 7 * * *' },
      { name: 'resumes' }
    )
    await prisma.organisation.update({
      where: { id: ids.orgB },
      data: { statut: 'SUSPENDUE' },
    })
    try {
      await synchroniserPlanification(fileDeTest)
      const planifications = await fileDeTest.getJobSchedulers()
      const cles = planifications.map(p => p.key)
      expect(cles).toEqual(
        expect.arrayContaining([
          nomPlanification('rappels', ids.orgA),
          nomPlanification('resumes', ids.orgA),
        ])
      )
      expect(cles).not.toContain(nomPlanification('rappels', ids.orgB))
      expect(cles).not.toContain('rappels')
      expect(cles).not.toContain('resumes-organisation-disparue')
      const rappelsA = planifications.find(
        p => p.key === nomPlanification('rappels', ids.orgA)
      )
      expect(rappelsA?.tz).toBe('Europe/Paris')
    } finally {
      await prisma.organisation.update({
        where: { id: ids.orgB },
        data: { statut: 'ACTIVE' },
      })
    }
  })
})
