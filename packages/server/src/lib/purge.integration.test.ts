import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { organisationParDefaut } from './organisation.ts'
import {
  MEDIAS_ORPHELINS_JOURS,
  NOTIFICATIONS_LUES_JOURS,
  purgerDonneesTechniques,
  purgerMedias,
} from './purge.ts'
import { activiteParDefaut } from '../test/contexte.ts'

// La purge nocturne ne retire que ce qui est échu : le refus de supprimer le reste
// se prouve autant que la suppression.

const suffixe = randomUUID().slice(0, 8)
const JOUR = 24 * 3600 * 1000
const maintenant = new Date()
const ids = { user: '', organisation: '', activite: '' }
const empreintes = { citee: '', orpheline: '', recente: '' }

const empreinte = () => randomUUID().replaceAll('-', '').padEnd(64, 'a')

beforeAll(async () => {
  ids.organisation = await organisationParDefaut()
  ids.activite = await activiteParDefaut()
  ids.user = randomUUID()
  await prisma.user.create({
    data: {
      id: ids.user,
      email: `purge-${suffixe}@exemple.fr`,
      name: `Purge ${suffixe}`,
      isAdmin: false,
    },
  })
  await prisma.session.createMany({
    data: [
      {
        id: `expiree-${suffixe}`,
        token: `expiree-${suffixe}`,
        userId: ids.user,
        expiresAt: new Date(maintenant.getTime() - JOUR),
      },
      {
        id: `vivante-${suffixe}`,
        token: `vivante-${suffixe}`,
        userId: ids.user,
        expiresAt: new Date(maintenant.getTime() + JOUR),
      },
    ],
  })
  await prisma.verification.createMany({
    data: [
      {
        id: `v-expiree-${suffixe}`,
        identifier: `sign-in-otp-purge-${suffixe}`,
        value: 'x',
        expiresAt: new Date(maintenant.getTime() - 1000),
      },
      {
        id: `v-vivante-${suffixe}`,
        identifier: `sign-in-otp-purge-vivante-${suffixe}`,
        value: 'x',
        expiresAt: new Date(maintenant.getTime() + 600_000),
      },
    ],
  })
  await prisma.rateLimit.createMany({
    data: [
      {
        id: `l-vieille-${suffixe}`,
        key: `vieille-${suffixe}`,
        count: 1,
        lastRequest: BigInt(maintenant.getTime() - 2 * JOUR),
      },
      {
        id: `l-recente-${suffixe}`,
        key: `recente-${suffixe}`,
        count: 1,
        lastRequest: BigInt(maintenant.getTime()),
      },
    ],
  })
  await prisma.notification.createMany({
    data: [
      {
        id: `n-vieille-${suffixe}`,
        organisationId: ids.organisation,
        userId: ids.user,
        type: 'TACHE_CREEE',
        lueLe: new Date(
          maintenant.getTime() - (NOTIFICATIONS_LUES_JOURS + 1) * JOUR
        ),
      },
      {
        id: `n-recente-${suffixe}`,
        organisationId: ids.organisation,
        userId: ids.user,
        type: 'TACHE_CREEE',
        lueLe: new Date(maintenant.getTime() - JOUR),
      },
      {
        id: `n-non-lue-${suffixe}`,
        organisationId: ids.organisation,
        userId: ids.user,
        type: 'TACHE_CREEE',
        createdAt: new Date(maintenant.getTime() - 400 * JOUR),
      },
    ],
  })
  empreintes.citee = empreinte()
  empreintes.orpheline = empreinte()
  empreintes.recente = empreinte()
  const ancien = new Date(
    maintenant.getTime() - (MEDIAS_ORPHELINS_JOURS + 1) * JOUR
  )
  const image = (
    id: string,
    empreinte: string,
    orphelinDepuis: Date | null
  ) => ({
    id: `${id}-${suffixe}`,
    organisationId: ids.organisation,
    empreinte,
    type: 'image/png',
    octets: 1,
    donnees: new Uint8Array([1]),
    createdAt: ancien,
    orphelinDepuis,
  })
  await prisma.media.createMany({
    data: [
      // Citée par l'identité, mais notée orpheline par erreur : la purge l'efface.
      image('m-citee', empreintes.citee, ancien),
      // Orpheline depuis longtemps : supprimée.
      image('m-orpheline', empreintes.orpheline, ancien),
      // Pas encore notée orpheline : la purge note la date, sans supprimer.
      image('m-recente', empreintes.recente, null),
    ],
  })
  // L'identité d'une activité cite l'image gardée.
  await prisma.activite.update({
    where: { id: ids.activite },
    data: { identite: { logo: empreintes.citee, essai: suffixe } },
  })
})

afterAll(async () => {
  await prisma.activite.update({
    where: { id: ids.activite },
    data: { identite: { essai: null } },
  })
  await prisma.media.deleteMany({
    where: { empreinte: { in: Object.values(empreintes) } },
  })
  await prisma.notification.deleteMany({ where: { userId: ids.user } })
  await prisma.rateLimit.deleteMany({ where: { key: { endsWith: suffixe } } })
  await prisma.verification.deleteMany({
    where: { identifier: { contains: suffixe } },
  })
  await prisma.session.deleteMany({ where: { userId: ids.user } })
  await prisma.user.deleteMany({ where: { id: ids.user } })
})

describe('purgerDonneesTechniques', () => {
  it('retire les sessions, vérifications, compteurs et notifications lues échus, et garde le reste', async () => {
    await purgerDonneesTechniques(prisma, maintenant)
    const sessions = await prisma.session.findMany({
      where: { userId: ids.user },
      select: { id: true },
    })
    expect(sessions.map(s => s.id)).toEqual([`vivante-${suffixe}`])
    const verifications = await prisma.verification.findMany({
      where: { identifier: { contains: suffixe } },
      select: { id: true },
    })
    expect(verifications.map(v => v.id)).toEqual([`v-vivante-${suffixe}`])
    const limites = await prisma.rateLimit.findMany({
      where: { key: { endsWith: suffixe } },
      select: { id: true },
    })
    expect(limites.map(l => l.id)).toEqual([`l-recente-${suffixe}`])
    const notifications = await prisma.notification.findMany({
      where: { userId: ids.user },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    expect(notifications.map(n => n.id)).toEqual([
      `n-non-lue-${suffixe}`,
      `n-recente-${suffixe}`,
    ])
  })
})

describe('purgerMedias', () => {
  it('retire une image orpheline depuis 30 jours, garde celle que l’identité cite et date celle qui vient de cesser de l’être', async () => {
    const supprimees = await purgerMedias(
      prisma,
      { organisationId: ids.organisation },
      maintenant
    )
    expect(supprimees).toBeGreaterThanOrEqual(1)
    const restantes = await prisma.media.findMany({
      where: { empreinte: { in: Object.values(empreintes) } },
      select: { empreinte: true },
    })
    expect(restantes.map(m => m.empreinte).sort()).toEqual(
      [empreintes.citee, empreintes.recente].sort()
    )
    const etats = await prisma.media.findMany({
      where: { empreinte: { in: [empreintes.citee, empreintes.recente] } },
      select: { empreinte: true, orphelinDepuis: true },
    })
    expect(
      etats.find(m => m.empreinte === empreintes.citee)?.orphelinDepuis
    ).toBeNull()
    expect(
      etats.find(m => m.empreinte === empreintes.recente)?.orphelinDepuis
    ).toEqual(maintenant)
  })
})
