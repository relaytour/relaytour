import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { langueDuDestinataire } from './langue-destinataire.ts'
import { invaliderConfigurationOrganisation } from './organisation.ts'

// Langue d'un mail ou d'un push (ADR 0047) : le choix du compte, sinon la langue
// de l'organisation qui écrit, sinon le français.

const s = randomUUID().slice(0, 8)
const ids = { orgEn: '', orgSans: '', anglais: '', sansChoix: '' }

async function creerOrganisation(slug: string, langue?: string) {
  const configuration = {
    slug,
    nom: `Langue ${slug}`,
    fuseauHoraire: 'Europe/Paris',
    domainesCourrielAutorises: ['exemple.org'],
    adressesRoleAutorisees: [],
    ...(langue === undefined ? {} : { langue }),
  }
  return (
    await prisma.organisation.create({
      data: { slug, nom: configuration.nom, configuration },
      select: { id: true },
    })
  ).id
}

async function creerCompte(nom: string, langue: string | null) {
  return (
    await prisma.user.create({
      data: {
        id: randomUUID(),
        name: nom,
        email: `${nom}-${s}@exemple.org`,
        langue,
      },
      select: { id: true },
    })
  ).id
}

beforeAll(async () => {
  ids.orgEn = await creerOrganisation(`langue-en-${s}`, 'en')
  ids.orgSans = await creerOrganisation(`langue-sans-${s}`)
  ids.anglais = await creerCompte('anglais', 'en')
  ids.sansChoix = await creerCompte('sans-choix', null)
  invaliderConfigurationOrganisation()
})

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { id: { in: [ids.anglais, ids.sansChoix] } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.orgEn, ids.orgSans] } },
  })
  invaliderConfigurationOrganisation()
})

describe('langueDuDestinataire', () => {
  it('suit le choix du compte, quelle que soit l’organisation', async () => {
    expect(await langueDuDestinataire(prisma, ids.anglais, ids.orgSans)).toBe(
      'en'
    )
  })

  it('prend la langue de l’organisation pour un compte sans choix', async () => {
    expect(await langueDuDestinataire(prisma, ids.sansChoix, ids.orgEn)).toBe(
      'en'
    )
    expect(await langueDuDestinataire(prisma, ids.sansChoix, ids.orgSans)).toBe(
      'fr'
    )
  })

  it('prend la langue de l’organisation pour une fiche bénévole sans compte', async () => {
    expect(await langueDuDestinataire(prisma, undefined, ids.orgEn)).toBe('en')
  })
})
