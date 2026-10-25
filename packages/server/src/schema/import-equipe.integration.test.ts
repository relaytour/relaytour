import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Import de l'équipe depuis un tableur (ADR 0049). Chaque ligne se valide (nom,
// adresse, périmètres retrouvés par leur nom), puis les lignes valides passent par
// l'import d'équipe de la commande : comptes, rattachements, affectations et
// contacts principaux, sans mail par défaut. Le fichier crée sa propre organisation.

const s = randomUUID().slice(0, 8)
const slug = `import-equipe-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  natation: '',
  lieux: '',
  edition: '',
  archivee: '',
  admin: '',
  membre: '',
}
const adresse = (nom: string) => `${nom}-${slug}@exemple.fr`

const RAPPORT = `lignes { ligne etat raison avertissements } personnes invitationsEnAttente affectationsCreees contactsPrincipaux rattachements mailsInvitations mailsEquipe`
const SIMULER = `query ($e: ID!, $l: [LigneEquipeImport!]!) { simulerImportEquipe(editionId: $e, lignes: $l) { ${RAPPORT} } }`
const IMPORTER = `mutation ($e: ID!, $l: [LigneEquipeImport!]!) { importerEquipe(editionId: $e, lignes: $l) { ${RAPPORT} } }`

interface Rapport {
  lignes: {
    ligne: number
    etat: string
    raison: string | null
    avertissements: string[]
  }[]
  personnes: number
  invitationsEnAttente: number
  affectationsCreees: number
  contactsPrincipaux: number
  rattachements: number
  mailsInvitations: number
  mailsEquipe: number
}

const LIGNES = () => [
  {
    ligne: 2,
    nom: 'Camille Nouvelle',
    adresse: adresse('camille'),
    perimetres: ['Natation'],
    contactPrincipal: true,
  },
  {
    ligne: 3,
    nom: 'Membre déjà là',
    adresse: adresse('membre').toUpperCase(),
    perimetres: ['lieux'],
    contactPrincipal: false,
  },
  {
    ligne: 4,
    nom: 'Sans adresse',
    adresse: 'pas-une-adresse',
    perimetres: [],
    contactPrincipal: false,
  },
  {
    ligne: 5,
    nom: ' ',
    adresse: adresse('vide'),
    perimetres: [],
    contactPrincipal: false,
  },
  {
    ligne: 6,
    nom: 'Hors périmètre',
    adresse: adresse('escrime'),
    perimetres: ['Escrime'],
    contactPrincipal: false,
  },
  {
    ligne: 7,
    nom: 'Camille en double',
    adresse: adresse('camille'),
    perimetres: [],
    contactPrincipal: false,
  },
  {
    ligne: 8,
    nom: 'Dominique Seconde',
    adresse: adresse('dominique'),
    perimetres: ['natation'],
    contactPrincipal: true,
  },
  {
    ligne: 9,
    nom: 'Rattachée seule',
    adresse: adresse('rattachee'),
    perimetres: [],
    contactPrincipal: false,
  },
]

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown>
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

async function rapportDe(
  query: string,
  variables: Record<string, unknown>
): Promise<Rapport> {
  const r = await executer(ids.admin, query, variables)
  expect(r.errors).toBeUndefined()
  return Object.values(r.data as Record<string, Rapport>)[0]!
}

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug: 'rencontres',
        nom: 'Rencontres',
        groupes: [
          { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
        ],
      },
    })
  ).id
  for (const [cle, nom, groupe] of [
    ['natation', 'Natation', 'sport'],
    ['lieux', 'Lieux', 'pole'],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom,
          type: groupe === 'sport' ? 'SPORT' : 'POLE',
          groupe,
        },
      })
    ).id
  }
  for (const [cle, annee, statut] of [
    ['edition', 2027, 'PREPARATION'],
    ['archivee', 2026, 'ARCHIVEE'],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          annee,
          nom: `Rencontres ${annee}`,
          debut: new Date(`${annee}-06-12`),
          fin: new Date(`${annee}-06-13`),
          statut,
        },
      })
    ).id
  }
  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['membre', 'MEMBRE'],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: adresse(cle),
        name: cle,
        appartenances: { create: { organisationId: ids.org, role } },
      },
    })
  }
})

afterAll(async () => {
  const dansLOrg = { organisationId: ids.org }
  await prisma.affectation.deleteMany({ where: { edition: dansLOrg } })
  await prisma.rattachementActivite.deleteMany({ where: dansLOrg })
  await prisma.edition.deleteMany({ where: dansLOrg })
  await prisma.perimetre.deleteMany({ where: dansLOrg })
  await prisma.activite.deleteMany({ where: dansLOrg })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('import de l’équipe depuis un tableur', () => {
  it('est réservé aux admins de l’activité, dans une période ouverte', async () => {
    expect(
      code(await executer(ids.membre, SIMULER, { e: ids.edition, l: [] }))
    ).toBe('FORBIDDEN')
    expect(
      code(await executer(ids.admin, IMPORTER, { e: ids.archivee, l: [] }))
    ).toBe('SAISIE_INVALIDE')
  })

  it('valide chaque ligne et simule sans rien écrire', async () => {
    const rapport = await rapportDe(SIMULER, { e: ids.edition, l: LIGNES() })
    expect(rapport.lignes.map(l => [l.ligne, l.etat])).toEqual([
      [2, 'A_IMPORTER'],
      [3, 'A_IMPORTER'],
      [4, 'ECARTEE'],
      [5, 'ECARTEE'],
      [6, 'ECARTEE'],
      [7, 'ECARTEE'],
      [8, 'A_IMPORTER'],
      [9, 'A_IMPORTER'],
    ])
    const ligne = (n: number) => rapport.lignes.find(l => l.ligne === n)!
    expect(ligne(6).raison).toBe('Périmètre inconnu : « Escrime ».')
    expect(ligne(8).avertissements).toHaveLength(1)
    // Une personne nouvelle et une personne déjà membre se comptent ensemble.
    expect(rapport.personnes).toBe(4)
    expect(
      await prisma.user.count({ where: { email: adresse('camille') } })
    ).toBe(0)
  })

  it('crée les comptes, les rattachements, les affectations et le contact principal, sans mail', async () => {
    const rapport = await rapportDe(IMPORTER, {
      e: ids.edition,
      l: LIGNES(),
    })
    expect(rapport).toMatchObject({
      personnes: 4,
      affectationsCreees: 3,
      contactsPrincipaux: 1,
      rattachements: 4,
      mailsInvitations: 0,
      mailsEquipe: 0,
    })
    const affectations = await prisma.affectation.findMany({
      where: { editionId: ids.edition },
      select: {
        perimetreId: true,
        contactPrincipal: true,
        user: { select: { email: true } },
      },
      orderBy: { user: { email: 'asc' } },
    })
    expect(
      affectations.map(a => [a.user.email, a.perimetreId, a.contactPrincipal])
    ).toEqual([
      [adresse('camille'), ids.natation, true],
      [adresse('dominique'), ids.natation, false],
      [adresse('membre'), ids.lieux, false],
    ])
    expect(
      await prisma.rattachementActivite.count({
        where: {
          activiteId: ids.activite,
          user: { email: adresse('rattachee') },
        },
      })
    ).toBe(1)

    // Rejouer l'import ne crée rien de plus.
    const deuxieme = await rapportDe(IMPORTER, { e: ids.edition, l: LIGNES() })
    expect(deuxieme).toMatchObject({ affectationsCreees: 0, rattachements: 0 })
  })
})
