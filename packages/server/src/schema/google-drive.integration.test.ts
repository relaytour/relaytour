import { generateKeyPairSync, randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { remplacerEspacePourLesTests } from '../espace-fichiers/index.ts'
import { espaceEnMemoire } from '../espace-fichiers/memoire.ts'

import { schema } from './index.ts'

// Google Drive par un compte de service (ADR 0038). L'organisation dépose la clé
// d'un compte de service ; Relaytour la garde chiffrée et ne la rend jamais. Un
// changement de fournisseur efface le dossier d'export de l'ancien espace. Un
// compte de service n'écrit que dans un Drive partagé.

const s = randomUUID().slice(0, 8)
const slug = `google-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = { org: '', admin: '', membre: '', fiche: '' }
const EMAIL = `relaytour-${s}@projet-asso.iam.gserviceaccount.com`
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const CLE = JSON.stringify({
  type: 'service_account',
  client_email: EMAIL,
  private_key: privateKey,
  token_uri: 'https://oauth2.googleapis.com/token',
})

const ESPACE = espaceEnMemoire([
  {
    id: 'partages',
    nom: 'Partagés avec moi',
    site: null,
    racine: {
      id: 'partages',
      nom: 'Partagés avec moi',
      enfants: [{ id: 'd-asso', nom: 'Association', enfants: [] }],
    },
  },
])

const CONNECTER = `mutation ($c: String!) { connecterCompteServiceGoogle(cle: $c) { fournisseur methode compte exportDossier } }`
const POSSIBLES = `{ espaceFichiers { connexionsPossibles { fournisseur methode } } }`

async function executer(
  userId: string,
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

beforeAll(async () => {
  await apollo.start()
  remplacerEspacePourLesTests(() => ESPACE)
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['membre', 'MEMBRE'],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: cle,
        appartenances: { create: { organisationId: ids.org, role } },
      },
    })
  }
  // L'organisation exportait ses fiches dans SharePoint.
  const activite = await prisma.activite.create({
    data: {
      organisationId: ids.org,
      slug: 'rencontres',
      nom: 'Rencontres',
      groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
    },
  })
  ids.fiche = (
    await prisma.fiche.create({
      data: {
        organisationId: ids.org,
        activiteId: activite.id,
        slug: 'accueil',
      },
    })
  ).id
  await prisma.connexionFichiers.create({
    data: {
      organisationId: ids.org,
      fournisseur: 'SHAREPOINT',
      compte: 'Coordination',
      jeton: 'jeton-de-test',
      exportEmplacement: 'bibliotheque',
      exportElement: 'd-export',
      exportNom: 'Fiches Relaytour',
    },
  })
  await prisma.ficheExportee.create({
    data: {
      organisationId: ids.org,
      ficheId: ids.fiche,
      chemin: ['rencontres', 'communes', 'accueil.md'],
      empreinte: 'e'.repeat(64),
    },
  })
})

afterAll(async () => {
  remplacerEspacePourLesTests(null)
  await prisma.ficheExportee.deleteMany({ where: { organisationId: ids.org } })
  await prisma.connexionFichiers.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.fiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('Google Drive par un compte de service', () => {
  it('se propose à côté des autres connexions', async () => {
    const r = await executer(ids.admin, POSSIBLES)
    expect(r.errors).toBeUndefined()
    expect(
      (
        r.data as {
          espaceFichiers: {
            connexionsPossibles: { fournisseur: string; methode: string }[]
          }
        }
      ).espaceFichiers.connexionsPossibles
    ).toContainEqual({ fournisseur: 'GOOGLE_DRIVE', methode: 'COMPTE_SERVICE' })
  })

  it('se connecte par un admin de l’organisation seulement', async () => {
    expect(code(await executer(ids.membre, CONNECTER, { c: CLE }))).toBe(
      'FORBIDDEN'
    )
  })

  it('refuse une clé qui n’est pas celle d’un compte de service', async () => {
    for (const c of [
      'pas du json',
      JSON.stringify({ type: 'authorized_user', client_email: EMAIL }),
    ]) {
      expect(code(await executer(ids.admin, CONNECTER, { c }))).toBe(
        'SAISIE_INVALIDE'
      )
    }
  })

  it('garde la clé chiffrée, montre l’adresse du compte et efface l’export de l’ancien espace', async () => {
    const r = await executer(ids.admin, CONNECTER, { c: CLE })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      connecterCompteServiceGoogle: {
        fournisseur: 'GOOGLE_DRIVE',
        methode: 'COMPTE_SERVICE',
        compte: EMAIL,
        exportDossier: null,
      },
    })
    const connexion = await prisma.connexionFichiers.findUniqueOrThrow({
      where: { organisationId: ids.org },
    })
    expect(connexion.jeton).toMatch(/^v1\./)
    expect(connexion.jeton).not.toContain('PRIVATE KEY')
    expect(connexion.exportElement).toBeNull()
    expect(
      await prisma.ficheExportee.count({ where: { organisationId: ids.org } })
    ).toBe(0)
  })

  it('n’exporte que dans un Drive partagé', async () => {
    const r = await executer(
      ids.admin,
      `mutation { choisirDossierExport(emplacement: "partages", chemin: ["Association"]) { exportDossier } }`
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toContain('Drive partagé')
  })
})
