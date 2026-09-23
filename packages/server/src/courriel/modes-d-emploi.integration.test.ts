import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { composer } from './messages.ts'

// Le mail d'invitation lie le mode d'emploi du rôle de la personne, lu à l'envoi
// dans l'organisation du mail.

const s = randomUUID().slice(0, 8)
const BASE = 'https://relaytour.org/modes-d-emploi/'
const ids = { org: '', autre: '', activite: '' }

async function creerOrganisation(cle: string) {
  const slug = `${cle}-${s}`
  return (
    await prisma.organisation.create({
      data: {
        slug,
        nom: `Organisation ${cle} ${s}`,
        configuration: { slug, nom: `Organisation ${cle} ${s}` },
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
      name: `${cle} ${s}`,
      appartenances: { create: appartenances },
    },
  })
  return id
}

async function invitation(userId: string) {
  const message = await composer(prisma, {
    sorte: 'invitation',
    userId,
    organisationId: ids.org,
  })
  return message?.texte ?? ''
}

beforeAll(async () => {
  ids.org = await creerOrganisation('modes')
  ids.autre = await creerOrganisation('modes-autre')
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug: `activite-${s}`,
        nom: 'Activité',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
})

beforeEach(() => {
  invaliderConfigurationOrganisation()
})

afterAll(async () => {
  const organisations = { in: [ids.org, ids.autre] }
  await prisma.adminActivite.deleteMany({
    where: { organisationId: organisations },
  })
  await prisma.activite.deleteMany({ where: { organisationId: organisations } })
  await prisma.appartenance.deleteMany({
    where: { organisationId: organisations },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: organisations } })
  invaliderConfigurationOrganisation()
})

describe('mode d’emploi du mail d’invitation', () => {
  it('lie le mode d’emploi de l’admin de l’organisation', async () => {
    const admin = await creerCompte('admin', [
      { organisationId: ids.org, role: 'ADMIN' },
    ])
    await prisma.adminActivite.create({
      data: {
        userId: admin,
        activiteId: ids.activite,
        organisationId: ids.org,
      },
    })
    const texte = await invitation(admin)
    expect(texte).toContain(`${BASE}admin-organisation.html`)
    expect(texte).toContain('Le mode d’emploi de l’admin de l’organisation')
  })

  it('lie le mode d’emploi de l’admin d’activité', async () => {
    const adminActivite = await creerCompte('admin-activite', [
      { organisationId: ids.org, role: 'MEMBRE' },
    ])
    await prisma.adminActivite.create({
      data: {
        userId: adminActivite,
        activiteId: ids.activite,
        organisationId: ids.org,
      },
    })
    expect(await invitation(adminActivite)).toContain(
      `${BASE}admin-activite.html`
    )
  })

  it('lie le mode d’emploi des référentes et référents aux autres membres', async () => {
    // Un rôle d'admin dans une autre organisation ne compte pas ici.
    const membre = await creerCompte('membre', [
      { organisationId: ids.org, role: 'MEMBRE' },
      { organisationId: ids.autre, role: 'ADMIN' },
    ])
    const texte = await invitation(membre)
    expect(texte).toContain(`${BASE}referent.html`)
    expect(texte).toContain('Le mode d’emploi des référentes et référents')
  })

  it('lit le rôle à l’envoi : une invitation renvoyée suit la nomination', async () => {
    const nomme = await creerCompte('nomme', [
      { organisationId: ids.org, role: 'MEMBRE' },
    ])
    expect(await invitation(nomme)).toContain(`${BASE}referent.html`)
    await prisma.appartenance.updateMany({
      where: { userId: nomme, organisationId: ids.org },
      data: { role: 'ADMIN' },
    })
    expect(await invitation(nomme)).toContain(`${BASE}admin-organisation.html`)
  })
})
