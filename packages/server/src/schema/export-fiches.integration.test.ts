import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { exporterFiches, README_EXPORT } from '../espace-fichiers/export.ts'
import { remplacerEspacePourLesTests } from '../espace-fichiers/index.ts'
import {
  espaceEnMemoire,
  type NoeudMemoire,
} from '../espace-fichiers/memoire.ts'
import { empreinte } from '../lib/fiches.ts'

import { schema } from './index.ts'

// Export des fiches vers l'espace de fichiers (ADR 0038). L'export va toujours de
// Relaytour vers le cloud, ne réécrit pas une fiche inchangée, suit les
// déplacements et les archivages, et refuse une coordonnée personnelle. Le
// dossier d'export ne se lie jamais à un périmètre. Le fichier crée ses propres
// organisations et remplace le fournisseur par un espace en mémoire.

const s = randomUUID().slice(0, 8)
const slug = `export-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  natation: '',
  admin: '',
  membre: '',
  accueil: '',
  bassin: '',
  contacts: '',
  archivee: '',
}

const racine: NoeudMemoire = {
  id: 'racine',
  nom: 'Documents',
  enfants: [
    { id: 'd-partage', nom: 'Partage', enfants: [] },
    {
      id: 'd-commun',
      nom: 'Commun',
      enfants: [{ id: 'd-sous', nom: 'Sous-dossier', enfants: [] }],
    },
  ],
}
const ESPACE = espaceEnMemoire([
  { id: 'bibliotheque', nom: 'Documents', site: null, racine },
])

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

const CHOISIR = `mutation ($c: [String!]!) {
  choisirDossierExport(emplacement: "bibliotheque", chemin: $c) { exportDossier }
}`
const LIER = `mutation ($a: ID!, $c: [String!]!) {
  lierDossier(activiteId: $a, emplacement: "bibliotheque", chemin: $c) { id }
}`
const CONNEXION = `{ espaceFichiers { connexion { exportDossier exportRapport { ecrites inchangees supprimees refusees { fiche } modifieesALaMain erreur } } } }`

/** Le texte d'un fichier du dossier d'export, ou null s'il n'existe pas. */
async function lire(...chemin: string[]): Promise<string | null> {
  const position = {
    emplacement: 'bibliotheque',
    base: null,
    chemin: ['Partage', 'Fiches Relaytour', ...chemin],
  }
  if ((await ESPACE.element(position)) === null) return null
  const contenu = await ESPACE.ouvrir(position, { pdf: false })
  return new Response(contenu.flux).text()
}

async function creerFiche(
  slugFiche: string,
  perimetreId: string | null,
  contenu: string
) {
  const fiche = await prisma.fiche.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      slug: slugFiche,
      perimetreId,
    },
  })
  await nouvelleVersion(fiche.id, slugFiche, contenu)
  return fiche.id
}

async function nouvelleVersion(
  ficheId: string,
  titre: string,
  contenu: string
) {
  const version = await prisma.ficheVersion.create({
    data: {
      ficheId,
      titre,
      contenu,
      empreinte: empreinte(titre, contenu),
      source: 'APP',
    },
  })
  await prisma.fiche.update({
    where: { id: ficheId },
    data: { versionCouranteId: version.id },
  })
}

beforeAll(async () => {
  await apollo.start()
  remplacerEspacePourLesTests(() => ESPACE)
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
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
  ids.natation = (
    await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: 'natation',
        nom: 'Natation',
        type: 'SPORT',
        groupe: 'sport',
      },
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
  await prisma.connexionFichiers.create({
    data: {
      organisationId: ids.org,
      fournisseur: 'SHAREPOINT',
      compte: 'Coordination',
      jeton: 'jeton-de-test',
    },
  })
  await prisma.dossierLie.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      fournisseur: 'SHAREPOINT',
      emplacement: 'bibliotheque',
      element: 'd-commun',
      nom: 'Commun',
    },
  })
  ids.accueil = await creerFiche('accueil', null, 'Accueillir les bénévoles.')
  ids.bassin = await creerFiche('bassin', ids.natation, 'Réserver le bassin.')
  ids.contacts = await creerFiche(
    'contacts',
    null,
    'Appeler Jeanne au 06 12 34 56 78.'
  )
  ids.archivee = await creerFiche('ancienne', null, 'Une fiche ancienne.')
  await prisma.fiche.update({
    where: { id: ids.archivee },
    data: { archivedAt: new Date() },
  })
})

afterAll(async () => {
  remplacerEspacePourLesTests(null)
  await prisma.ficheExportee.deleteMany({ where: { organisationId: ids.org } })
  await prisma.dossierLie.deleteMany({ where: { organisationId: ids.org } })
  await prisma.connexionFichiers.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.fiche.updateMany({
    where: { organisationId: ids.org },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('dossier d’export', () => {
  it('se choisit par un admin de l’organisation seulement', async () => {
    expect(code(await executer(ids.membre, CHOISIR, { c: ['Partage'] }))).toBe(
      'FORBIDDEN'
    )
  })

  it('ne se crée ni dans un dossier lié, ni dans un dossier qui en contient un', async () => {
    for (const c of [['Commun'], ['Commun', 'Sous-dossier']]) {
      expect(code(await executer(ids.admin, CHOISIR, { c }))).toBe(
        'SAISIE_INVALIDE'
      )
    }
  })

  it('se crée dans le dossier choisi', async () => {
    const r = await executer(ids.admin, CHOISIR, { c: ['Partage'] })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      choisirDossierExport: { exportDossier: 'Partage / Fiches Relaytour' },
    })
  })

  it('ne se lie jamais, pas plus qu’un dossier qui le contient', async () => {
    for (const c of [['Partage'], ['Partage', 'Fiches Relaytour']]) {
      expect(
        code(await executer(ids.admin, LIER, { a: ids.activite, c }))
      ).toBe('SAISIE_INVALIDE')
    }
  })
})

describe('export des fiches', () => {
  it('écrit le README et les fiches non archivées, sans coordonnée personnelle', async () => {
    const rapport = await exporterFiches(ids.org, { verifier: false })
    expect(rapport).toMatchObject({
      ecrites: 2,
      inchangees: 0,
      supprimees: 0,
      refusees: [{ fiche: 'contacts' }],
      erreur: null,
    })
    expect(await lire('README.md')).toBe(README_EXPORT)
    expect(await lire('rencontres', 'communes', 'accueil.md')).toBe(
      '---\nslug: accueil\ntitre: accueil\n---\n\nAccueillir les bénévoles.\n'
    )
    expect(await lire('rencontres', 'natation', 'bassin.md')).toContain(
      'Réserver le bassin.'
    )
    expect(await lire('rencontres', 'communes', 'contacts.md')).toBeNull()
    expect(await lire('rencontres', 'communes', 'ancienne.md')).toBeNull()
  })

  it('ne réécrit pas une fiche inchangée', async () => {
    expect(await exporterFiches(ids.org, { verifier: false })).toMatchObject({
      ecrites: 0,
      inchangees: 2,
    })
  })

  it('réécrit une fiche modifiée, et suit un déplacement', async () => {
    await nouvelleVersion(ids.accueil, 'accueil', 'Accueillir chaque personne.')
    await prisma.fiche.update({
      where: { id: ids.bassin },
      data: { perimetreId: null },
    })
    expect(await exporterFiches(ids.org, { verifier: false })).toMatchObject({
      ecrites: 2,
      inchangees: 0,
    })
    expect(await lire('rencontres', 'communes', 'accueil.md')).toContain(
      'Accueillir chaque personne.'
    )
    expect(await lire('rencontres', 'natation', 'bassin.md')).toBeNull()
    expect(await lire('rencontres', 'communes', 'bassin.md')).toContain(
      'Réserver le bassin.'
    )
  })

  it('réécrit chaque nuit une fiche modifiée à la main, et la nomme', async () => {
    await ESPACE.ecrire(
      {
        emplacement: 'bibliotheque',
        base: null,
        chemin: [
          'Partage',
          'Fiches Relaytour',
          'rencontres',
          'communes',
          'accueil.md',
        ],
      },
      'Modifié à la main.'
    )
    // L'export d'après une modification ne relit pas le fournisseur.
    expect(await exporterFiches(ids.org, { verifier: false })).toMatchObject({
      ecrites: 0,
      modifieesALaMain: [],
    })
    expect(await exporterFiches(ids.org, { verifier: true })).toMatchObject({
      ecrites: 1,
      modifieesALaMain: ['accueil'],
    })
    expect(await lire('rencontres', 'communes', 'accueil.md')).toContain(
      'Accueillir chaque personne.'
    )
  })

  it('retire une fiche archivée', async () => {
    await prisma.fiche.update({
      where: { id: ids.bassin },
      data: { archivedAt: new Date() },
    })
    expect(await exporterFiches(ids.org, { verifier: false })).toMatchObject({
      supprimees: 1,
    })
    expect(await lire('rencontres', 'communes', 'bassin.md')).toBeNull()
  })

  it('se lit dans le rapport de la connexion', async () => {
    const r = await executer(ids.admin, CONNEXION)
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      espaceFichiers: {
        connexion: {
          exportDossier: 'Partage / Fiches Relaytour',
          exportRapport: {
            ecrites: 0,
            inchangees: 1,
            supprimees: 1,
            refusees: [{ fiche: 'contacts' }],
            modifieesALaMain: [],
            erreur: null,
          },
        },
      },
    })
  })

  it('s’arrête quand l’admin retire le dossier d’export', async () => {
    const r = await executer(ids.admin, 'mutation { retirerDossierExport }')
    expect(r.errors).toBeUndefined()
    expect(await exporterFiches(ids.org, { verifier: false })).toBeNull()
    expect(
      await prisma.ficheExportee.count({ where: { organisationId: ids.org } })
    ).toBe(0)
    // Les fichiers déjà écrits restent.
    expect(await lire('rencontres', 'communes', 'accueil.md')).not.toBeNull()
  })
})
