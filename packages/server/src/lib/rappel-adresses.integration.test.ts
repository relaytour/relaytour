import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { composer } from '../courriel/messages.ts'
import { schema } from '../schema/index.ts'

import { invaliderConfigurationOrganisation } from './organisation.ts'
import { adresseDuRappel, rappelerAdresses } from './rappel-adresses.ts'

// Rappel des adresses d'un membre (ADR 0054) : un mail part seulement vers un membre
// actif d'une organisation ouverte, ou vers une fiche bénévole confirmée. La
// mutation répond toujours vrai, et seul le jeton de l'installation l'ouvre.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  ouverte: '',
  suspendue: '',
  activite: '',
  membre: '',
  archive: '',
  suspendu: '',
  confirmee: '',
  nonConfirmee: '',
}
const adresse = (nom: string) => `${nom}-${s}@exemple.org`

async function creerOrganisation(slug: string, statut: 'ACTIVE' | 'SUSPENDUE') {
  const configuration = {
    slug,
    nom: `Rappel ${slug}`,
    fuseauHoraire: 'Europe/Paris',
    domainesCourrielAutorises: ['exemple.org'],
    adressesRoleAutorisees: [],
  }
  return (
    await prisma.organisation.create({
      data: { slug, nom: configuration.nom, configuration, statut },
      select: { id: true },
    })
  ).id
}

async function creerMembre(
  nom: string,
  organisationId: string,
  archiveLe: Date | null = null
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      name: nom,
      email: adresse(nom),
      appartenances: { create: { organisationId, archiveLe } },
    },
  })
  return id
}

async function creerFiche(nom: string, confirmee: boolean) {
  return (
    await prisma.benevole.create({
      data: {
        organisationId: ids.ouverte,
        activiteId: ids.activite,
        nom,
        courriel: adresse(nom),
        accordLe: new Date(),
        lienEnvoyeLe: new Date(),
        courrielConfirmeLe: confirmee ? new Date() : null,
      },
      select: { id: true },
    })
  ).id
}

/** Le job mis en file pour cet identifiant à cet instant, retiré de la file. */
async function retirerJob(jobId: string) {
  const { courrielQueue } = await import('../jobs/queues.ts')
  const job = await courrielQueue.getJob(jobId)
  await job?.remove()
  return job?.data
}

beforeAll(async () => {
  await apollo.start()
  ids.ouverte = await creerOrganisation(`rappel-o-${s}`, 'ACTIVE')
  ids.suspendue = await creerOrganisation(`rappel-s-${s}`, 'SUSPENDUE')
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.ouverte,
        slug: `rappel-${s}`,
        nom: 'Activité du rappel',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
      select: { id: true },
    })
  ).id
  ids.membre = await creerMembre('membre', ids.ouverte)
  ids.archive = await creerMembre('archive', ids.ouverte, new Date())
  ids.suspendu = await creerMembre('suspendu', ids.suspendue)
  ids.confirmee = await creerFiche('confirmee', true)
  ids.nonConfirmee = await creerFiche('non-confirmee', false)
  invaliderConfigurationOrganisation()
})

afterAll(async () => {
  await prisma.benevole.deleteMany({
    where: { id: { in: [ids.confirmee, ids.nonConfirmee] } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: [ids.membre, ids.archive, ids.suspendu] } },
  })
  await prisma.activite.deleteMany({ where: { id: ids.activite } })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.ouverte, ids.suspendue] } },
  })
  invaliderConfigurationOrganisation()
  await apollo.stop()
})

describe('adresseDuRappel', () => {
  it('met l’adresse en minuscules et refuse ce qui n’en est pas une', () => {
    expect(adresseDuRappel(' Lea@Exemple.org ')).toBe('lea@exemple.org')
    expect(adresseDuRappel('lea')).toBeNull()
    expect(adresseDuRappel(`${'a'.repeat(250)}@exemple.org`)).toBeNull()
  })
})

describe('rappelerAdresses', () => {
  it('écrit à un membre actif d’une organisation ouverte', async () => {
    const maintenant = new Date()
    expect(
      await rappelerAdresses(prisma, adresse('MEMBRE').toUpperCase(), maintenant)
    ).toBe(1)
    expect(
      await retirerJob(`rappel-adresse-${ids.membre}-${maintenant.getTime()}`)
    ).toMatchObject({ sorte: 'rappel-adresse', userId: ids.membre })
  })

  it('n’écrit pas deux fois à la même adresse en dix minutes', async () => {
    expect(await rappelerAdresses(prisma, adresse('membre'))).toBe(0)
  })

  it('n’écrit ni à une adresse inconnue, ni à un membre archivé, ni à une organisation suspendue', async () => {
    expect(await rappelerAdresses(prisma, adresse('inconnue'))).toBe(0)
    expect(await rappelerAdresses(prisma, adresse('archive'))).toBe(0)
    expect(await rappelerAdresses(prisma, adresse('suspendu'))).toBe(0)
  })

  it('renvoie le lien d’une fiche bénévole confirmée, jamais d’une fiche non confirmée', async () => {
    const maintenant = new Date()
    expect(
      await rappelerAdresses(prisma, adresse('confirmee'), maintenant)
    ).toBe(1)
    expect(
      await retirerJob(
        `benevole-rappel-${ids.confirmee}-${maintenant.getTime()}`
      )
    ).toMatchObject({
      sorte: 'benevole-lien',
      benevoleId: ids.confirmee,
      organisationId: ids.ouverte,
      activiteId: ids.activite,
    })
    expect(await rappelerAdresses(prisma, adresse('non-confirmee'))).toBe(0)
  })
})

describe('mail « rappel-adresse »', () => {
  it('nomme les organisations du compte et mène à l’écran de connexion', async () => {
    const message = await composer(prisma, {
      sorte: 'rappel-adresse',
      userId: ids.membre,
    })
    expect(message?.sujet).toContain('l’adresse de votre espace')
    expect(message?.texte).toContain(`Rappel rappel-o-${s}`)
    expect(message?.texte).toMatch(/\/connexion/)
    expect(message?.repondreA).toBeUndefined()
  })

  it('ne part plus quand la personne n’a plus d’organisation ouverte', async () => {
    expect(
      await composer(prisma, { sorte: 'rappel-adresse', userId: ids.suspendu })
    ).toBeNull()
  })
})

describe('mutation rappelerAdresses', () => {
  const RAPPELER = `mutation ($courriel: String!) { rappelerAdresses(courriel: $courriel) }`

  it('répond vrai pour une adresse inconnue comme pour une adresse mal formée', async () => {
    const contextValue = await buildContext('127.0.0.1', null, null, true)
    for (const courriel of [adresse('personne'), 'pas-une-adresse']) {
      const reponse = await apollo.executeOperation(
        { query: RAPPELER, variables: { courriel } },
        { contextValue }
      )
      if (reponse.body.kind !== 'single') throw new Error('Réponse inattendue.')
      expect(reponse.body.singleResult.errors).toBeUndefined()
      expect(reponse.body.singleResult.data).toEqual({ rappelerAdresses: true })
    }
  })

  it('refuse une requête sans le jeton de l’installation', async () => {
    const reponse = await apollo.executeOperation(
      { query: RAPPELER, variables: { courriel: adresse('membre') } },
      { contextValue: await buildContext('127.0.0.1', null) }
    )
    if (reponse.body.kind !== 'single') throw new Error('Réponse inattendue.')
    expect(reponse.body.singleResult.data?.rappelerAdresses ?? null).toBeNull()
    expect(reponse.body.singleResult.errors?.length).toBeGreaterThan(0)
  })
})
