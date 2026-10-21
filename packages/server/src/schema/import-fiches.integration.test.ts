import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { remplacerEspacePourLesTests } from '../espace-fichiers/index.ts'
import { espaceEnMemoire } from '../espace-fichiers/memoire.ts'
import { empreinte } from '../lib/fiches.ts'
import { documentWord } from '../test/docx.ts'

import { schema } from './index.ts'

// Import initial des fiches depuis l'espace de fichiers (ADR 0038). La simulation
// n'écrit rien ; l'import suit les règles de `orga:importer`, convertit un
// document Word, refuse une coordonnée personnelle et laisse entière une fiche
// modifiée dans Relaytour. Le fichier crée ses propres organisations.

const s = randomUUID().slice(0, 8)
const slug = `import-${s}`
const slugAutre = `import-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  autreActivite: '',
  natation: '',
  perimetreAutreActivite: '',
  admin: '',
  membre: '',
  externe: '',
}

const ESPACE = espaceEnMemoire([
  {
    id: 'bibliotheque',
    nom: 'Documents',
    site: null,
    racine: {
      id: 'racine',
      nom: 'Documents',
      enfants: [
        {
          id: 'd-fiches',
          nom: 'Fiches',
          enfants: [
            {
              id: 'd-communes',
              nom: 'communes',
              enfants: [
                {
                  id: 'f-accueil',
                  nom: 'autre-nom.md',
                  contenu:
                    '---\nslug: accueil\ntitre: Accueillir les bénévoles\n---\n\nArriver dix minutes avant.\n',
                },
                {
                  id: 'f-charte',
                  nom: 'Charte.txt',
                  contenu: '# La charte\n\nRespecter chaque personne.\n',
                },
                { id: 'f-image', nom: 'logo.png', contenu: 'png' },
                {
                  id: 'f-contacts',
                  nom: 'contacts.md',
                  contenu: 'Appeler Jeanne au 06 12 34 56 78.',
                },
                {
                  id: 'f-modifiee',
                  nom: 'modifiee.md',
                  contenu: 'Version du cloud.',
                },
                {
                  id: 'f-depot',
                  nom: 'depot.md',
                  contenu: 'Version du cloud, plus récente que le dépôt.',
                },
                {
                  id: 'f-ailleurs',
                  nom: 'ailleurs.md',
                  contenu:
                    'Une fiche de même slug vit dans une autre activité.',
                },
              ],
            },
            {
              id: 'd-natation',
              nom: 'natation',
              enfants: [
                {
                  id: 'f-plan',
                  nom: 'Plan du bassin.docx',
                  contenu: documentWord('Plan du bassin', [
                    'Réserver **deux lignes** pour les relais.',
                  ]),
                },
              ],
            },
          ],
        },
        {
          id: 'd-export',
          nom: 'Fiches Relaytour',
          enfants: [{ id: 'f-copie', nom: 'copie.md', contenu: 'Copie.' }],
        },
      ],
    },
  },
])

const SOURCES = () => [
  {
    perimetreId: null,
    emplacement: 'bibliotheque',
    chemin: ['Fiches', 'communes'],
  },
  {
    perimetreId: ids.natation,
    emplacement: 'bibliotheque',
    chemin: ['Fiches', 'natation'],
  },
]

const RAPPORT = `creees nouvellesVersions inchangees conflits { fiche raison } nonImportes { fichier raison } refusees { fichier raison } converties { fichier raison } incomplet`
const SIMULER = `query ($a: ID!, $s: [SourceImportFiches!]!) { simulerImportFiches(activiteId: $a, sources: $s) { ${RAPPORT} } }`
const IMPORTER = `mutation ($a: ID!, $s: [SourceImportFiches!]!) { importerFichesEspace(activiteId: $a, sources: $s) { ${RAPPORT} } }`

interface Rapport {
  creees: string[]
  nouvellesVersions: string[]
  inchangees: string[]
  conflits: { fiche: string; raison: string }[]
  nonImportes: { fichier: string; raison: string }[]
  refusees: { fichier: string; raison: string }[]
  converties: { fichier: string; raison: string }[]
  incomplet: boolean
}

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {},
  organisation = slug
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, organisation) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

async function creerFiche(
  activiteId: string,
  slugFiche: string,
  contenu: string,
  source: 'APP' | 'GIT'
) {
  const fiche = await prisma.fiche.create({
    data: { organisationId: ids.org, activiteId, slug: slugFiche },
  })
  const version = await prisma.ficheVersion.create({
    data: {
      ficheId: fiche.id,
      titre: slugFiche,
      contenu,
      empreinte: empreinte(slugFiche, contenu),
      source,
    },
  })
  await prisma.fiche.update({
    where: { id: fiche.id },
    data: { versionCouranteId: version.id },
  })
}

beforeAll(async () => {
  await apollo.start()
  remplacerEspacePourLesTests(() => ESPACE)
  for (const [cle, slugOrg] of [
    ['org', slug],
    ['orgAutre', slugAutre],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: {
          slug: slugOrg,
          nom: `Organisation ${slugOrg}`,
          configuration: {},
        },
      })
    ).id
  }
  for (const [cle, slugActivite] of [
    ['activite', 'rencontres'],
    ['autreActivite', 'club'],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: slugActivite,
          nom: slugActivite,
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      })
    ).id
  }
  for (const [cle, activiteId] of [
    ['natation', ids.activite],
    ['perimetreAutreActivite', ids.autreActivite],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId,
          slug: 'natation',
          nom: 'Natation',
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    ).id
  }
  for (const [cle, role, organisationId] of [
    ['admin', 'ADMIN', ids.org],
    ['membre', 'MEMBRE', ids.org],
    ['externe', 'ADMIN', ids.orgAutre],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: cle,
        appartenances: { create: { organisationId, role } },
      },
    })
  }
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
  await creerFiche(
    ids.activite,
    'modifiee',
    'Version écrite dans Relaytour.',
    'APP'
  )
  await creerFiche(ids.activite, 'depot', 'Version du dépôt.', 'GIT')
  await creerFiche(ids.autreActivite, 'ailleurs', 'Fiche du club.', 'APP')
})

afterAll(async () => {
  remplacerEspacePourLesTests(null)
  await prisma.connexionFichiers.deleteMany({
    where: { organisationId: { in: [ids.org, ids.orgAutre] } },
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
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.orgAutre] } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('import des fiches depuis l’espace de fichiers', () => {
  it('est réservé aux admins de l’organisation, dans leur organisation', async () => {
    expect(
      code(
        await executer(ids.membre, SIMULER, { a: ids.activite, s: SOURCES() })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          ids.externe,
          IMPORTER,
          { a: ids.activite, s: SOURCES() },
          slugAutre
        )
      )
    ).toBe('FORBIDDEN')
  })

  it('refuse un périmètre d’une autre activité et le dossier d’export comme source', async () => {
    expect(
      code(
        await executer(ids.admin, SIMULER, {
          a: ids.activite,
          s: [
            {
              perimetreId: ids.perimetreAutreActivite,
              emplacement: 'bibliotheque',
              chemin: ['Fiches', 'natation'],
            },
          ],
        })
      )
    ).toBe('SAISIE_INVALIDE')
    expect(
      code(
        await executer(ids.admin, SIMULER, {
          a: ids.activite,
          s: [
            {
              perimetreId: null,
              emplacement: 'bibliotheque',
              chemin: ['Fiches Relaytour'],
            },
          ],
        })
      )
    ).toBe('SAISIE_INVALIDE')
  })

  it('simule sans rien écrire', async () => {
    const avant = await prisma.ficheVersion.count({
      where: { fiche: { organisationId: ids.org } },
    })
    const r = await executer(ids.admin, SIMULER, {
      a: ids.activite,
      s: SOURCES(),
    })
    expect(r.errors).toBeUndefined()
    const rapport = (r.data as { simulerImportFiches: Rapport })
      .simulerImportFiches
    expect(rapport.creees.sort()).toEqual([
      'accueil',
      'charte',
      'plan-du-bassin',
    ])
    expect(rapport.nouvellesVersions).toEqual(['depot'])
    expect(rapport.conflits).toEqual([
      {
        fiche: 'ailleurs',
        raison: 'une fiche d’une autre activité porte ce slug',
      },
      { fiche: 'modifiee', raison: 'la fiche a été modifiée dans Relaytour' },
    ])
    expect(rapport.nonImportes).toEqual([
      {
        fichier: 'Fiches / communes / logo.png',
        raison: 'format que Relaytour n’importe pas',
      },
    ])
    expect(rapport.refusees.map(f => f.fichier)).toEqual([
      'Fiches / communes / contacts.md',
    ])
    expect(rapport.converties).toEqual([
      {
        fichier: 'Fiches / natation / Plan du bassin.docx',
        raison: 'converti en Markdown',
      },
    ])
    expect(
      await prisma.ficheVersion.count({
        where: { fiche: { organisationId: ids.org } },
      })
    ).toBe(avant)
  })

  it('importe les fiches, converties et rangées dans leur périmètre', async () => {
    const r = await executer(ids.admin, IMPORTER, {
      a: ids.activite,
      s: SOURCES(),
    })
    expect(r.errors).toBeUndefined()
    const plan = await prisma.fiche.findUniqueOrThrow({
      where: {
        organisationId_slug: {
          organisationId: ids.org,
          slug: 'plan-du-bassin',
        },
      },
      include: { versionCourante: true },
    })
    expect(plan.perimetreId).toBe(ids.natation)
    expect(plan.versionCourante).toMatchObject({
      titre: 'Plan du bassin',
      contenu: 'Réserver **deux lignes** pour les relais.\n',
      source: 'ESPACE_FICHIERS',
      auteurId: ids.admin,
    })
    const modifiee = await prisma.fiche.findUniqueOrThrow({
      where: {
        organisationId_slug: { organisationId: ids.org, slug: 'modifiee' },
      },
      include: { versionCourante: true },
    })
    expect(modifiee.versionCourante?.contenu).toBe(
      'Version écrite dans Relaytour.'
    )
    expect(
      await prisma.fiche.count({
        where: { organisationId: ids.org, slug: 'contacts' },
      })
    ).toBe(0)
  })

  it('ne crée aucune version au second passage', async () => {
    const r = await executer(ids.admin, IMPORTER, {
      a: ids.activite,
      s: SOURCES(),
    })
    const rapport = (r.data as { importerFichesEspace: Rapport })
      .importerFichesEspace
    expect(rapport.creees).toEqual([])
    expect(rapport.nouvellesVersions).toEqual([])
    expect(rapport.inchangees.sort()).toEqual([
      'accueil',
      'charte',
      'depot',
      'plan-du-bassin',
    ])
  })
})
