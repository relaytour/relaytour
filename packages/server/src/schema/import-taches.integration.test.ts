import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { empreinte } from '../lib/fiches.ts'

import { schema } from './index.ts'

// Import des tâches d'une période depuis un tableur (ADR 0049). La simulation
// n'écrit rien ; l'import retrouve le périmètre par son nom, la fiche par son titre
// ou son identifiant, la personne responsable par son adresse, écarte les lignes
// illisibles, crée les périmètres inconnus sur demande et ne recrée jamais une
// tâche déjà présente. Le fichier crée ses propres organisations.

const s = randomUUID().slice(0, 8)
const slug = `import-taches-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  natation: '',
  lieux: '',
  edition: '',
  archivee: '',
  plan: '',
  bassin: '',
  admin: '',
  referente: '',
  membre: '',
}

const RAPPORT = `lignes { ligne etat raison avertissements } perimetresCrees tachesTypesAjoutees`
const ARGS = `$e: ID!, $l: [LigneTacheImport!]!, $g: String, $t: Boolean`
const PASSER = `editionId: $e, lignes: $l, groupeNouveaux: $g, enregistrerTachesTypes: $t`
const SIMULER = `query (${ARGS}) { simulerImportTaches(${PASSER}) { ${RAPPORT} } }`
const IMPORTER = `mutation (${ARGS}) { importerTaches(${PASSER}) { ${RAPPORT} } }`

interface Ligne {
  ligne: number
  etat: string
  raison: string | null
  avertissements: string[]
}
interface Rapport {
  lignes: Ligne[]
  perimetresCrees: string[]
  tachesTypesAjoutees: number
}

const LIGNES = () => [
  {
    ligne: 2,
    perimetre: 'Natation',
    titre: 'Réserver le bassin',
    echeance: 'J-30',
    fiche: 'Consignes du bassin',
    responsable: `REFERENTE-${slug}@exemple.fr`,
  },
  {
    ligne: 3,
    perimetre: 'lieux',
    titre: 'Dessiner le plan',
    description: 'Avec les secours.',
    echeance: '2027-05-01',
    fiche: `plan-${s}`,
    responsable: 'inconnue@exemple.fr',
  },
  { ligne: 4, perimetre: 'Natation', titre: 'Sans date', fiche: 'Inexistante' },
  {
    ligne: 5,
    perimetre: 'Lieux',
    titre: 'Fiche ailleurs',
    fiche: 'Consignes du bassin',
  },
  {
    ligne: 6,
    perimetre: 'Escrime',
    titre: 'Réserver la salle',
    echeance: 'J-60',
  },
  { ligne: 7, perimetre: 'Natation', titre: '  ' },
  {
    ligne: 8,
    perimetre: 'Natation',
    titre: 'Mauvaise date',
    echeance: 'demain',
  },
  {
    ligne: 9,
    perimetre: 'natation',
    titre: 'réserver le bassin',
    echeance: 'J-30',
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

const etats = (r: Rapport) => r.lignes.map(l => [l.ligne, l.etat])

async function creerFiche(
  slugFiche: string,
  titre: string,
  perimetreId: string | null
) {
  const fiche = await prisma.fiche.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      perimetreId,
      slug: slugFiche,
    },
  })
  const version = await prisma.ficheVersion.create({
    data: {
      ficheId: fiche.id,
      titre,
      contenu: 'Contenu.',
      empreinte: empreinte(titre, 'Contenu.'),
      source: 'APP',
    },
  })
  await prisma.fiche.update({
    where: { id: fiche.id },
    data: { versionCouranteId: version.id },
  })
  return fiche.id
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
  ids.plan = await creerFiche(`plan-${s}`, 'Plan des lieux', null)
  ids.bassin = await creerFiche(
    `bassin-${s}`,
    'Consignes du bassin',
    ids.natation
  )
  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['referente', 'MEMBRE'],
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
  await prisma.affectation.create({
    data: {
      userId: ids.referente,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
})

afterAll(async () => {
  const dansLOrg = { organisationId: ids.org }
  await prisma.tacheAssignation.deleteMany({
    where: { tache: { edition: dansLOrg } },
  })
  await prisma.tache.deleteMany({ where: { edition: dansLOrg } })
  await prisma.affectation.deleteMany({ where: { edition: dansLOrg } })
  await prisma.edition.deleteMany({ where: dansLOrg })
  await prisma.fiche.updateMany({
    where: dansLOrg,
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: dansLOrg })
  await prisma.perimetre.deleteMany({ where: dansLOrg })
  await prisma.activite.deleteMany({ where: dansLOrg })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('import des tâches depuis un tableur', () => {
  it('est réservé aux admins de l’activité, dans une période ouverte et par lots', async () => {
    expect(
      code(await executer(ids.membre, SIMULER, { e: ids.edition, l: [] }))
    ).toBe('FORBIDDEN')
    expect(
      code(await executer(ids.admin, IMPORTER, { e: ids.archivee, l: [] }))
    ).toBe('SAISIE_INVALIDE')
    const trop = Array.from({ length: 501 }, (_, i) => ({
      ligne: i + 2,
      perimetre: 'Natation',
      titre: `Tâche ${i}`,
    }))
    expect(
      code(await executer(ids.admin, SIMULER, { e: ids.edition, l: trop }))
    ).toBe('SAISIE_INVALIDE')
  })

  it('simule sans rien écrire, ligne par ligne', async () => {
    const rapport = await rapportDe(SIMULER, { e: ids.edition, l: LIGNES() })
    expect(etats(rapport)).toEqual([
      [2, 'A_IMPORTER'],
      [3, 'A_IMPORTER'],
      [4, 'A_IMPORTER'],
      [5, 'A_IMPORTER'],
      [6, 'ECARTEE'],
      [7, 'ECARTEE'],
      [8, 'ECARTEE'],
      [9, 'DEJA_IMPORTEE'],
    ])
    const ligne = (n: number) => rapport.lignes.find(l => l.ligne === n)!
    expect(ligne(2).avertissements).toEqual([])
    expect(ligne(3).avertissements).toHaveLength(1)
    expect(ligne(4).avertissements).toEqual([
      'Fiche introuvable : « Inexistante ».',
    ])
    expect(ligne(5).avertissements).toEqual([
      'La fiche « Consignes du bassin » appartient à un autre périmètre.',
    ])
    expect(ligne(6).raison).toBe('Périmètre inconnu : « Escrime ».')
    expect(ligne(8).raison).toBe('Échéance illisible : « demain ».')
    expect(
      await prisma.tache.count({ where: { editionId: ids.edition } })
    ).toBe(0)
  })

  it('importe, crée les périmètres et les tâches types demandés, puis ne recrée rien', async () => {
    const variables = {
      e: ids.edition,
      l: LIGNES(),
      g: 'sport',
      t: true,
    }
    const rapport = await rapportDe(IMPORTER, variables)
    expect(rapport.perimetresCrees).toEqual(['Escrime'])
    expect(rapport.tachesTypesAjoutees).toBe(5)
    expect(
      rapport.lignes.filter(l => l.etat === 'IMPORTEE').map(l => l.ligne)
    ).toEqual([2, 3, 4, 5, 6])

    const bassin = await prisma.tache.findFirstOrThrow({
      where: { editionId: ids.edition, titre: 'Réserver le bassin' },
      include: { assignations: true },
    })
    expect(bassin).toMatchObject({
      perimetreId: ids.natation,
      ficheId: ids.bassin,
      creeParId: null,
      modeleSlug: 'reserver-le-bassin',
    })
    expect(bassin.echeance?.toISOString().slice(0, 10)).toBe('2027-05-13')
    expect(bassin.assignations.map(a => a.userId)).toEqual([ids.referente])
    const plan = await prisma.tache.findFirstOrThrow({
      where: { editionId: ids.edition, titre: 'Dessiner le plan' },
    })
    expect(plan).toMatchObject({
      perimetreId: ids.lieux,
      ficheId: ids.plan,
      description: 'Avec les secours.',
    })
    const lieux = await prisma.perimetre.findUniqueOrThrow({
      where: { id: ids.lieux },
      select: { tachesTypes: true },
    })
    expect(lieux.tachesTypes).toEqual([
      {
        modele: 'dessiner-le-plan',
        titre: 'Dessiner le plan',
        description: 'Avec les secours.',
        echeance: 'J-42',
        fiche: `plan-${s}`,
      },
      { modele: 'fiche-ailleurs', titre: 'Fiche ailleurs' },
    ])
    const escrime = await prisma.perimetre.findFirstOrThrow({
      where: { activiteId: ids.activite, slug: 'escrime' },
      select: { groupe: true, type: true },
    })
    expect(escrime).toEqual({ groupe: 'sport', type: 'SPORT' })

    const deuxieme = await rapportDe(IMPORTER, variables)
    expect(
      deuxieme.lignes.filter(l => l.etat === 'DEJA_IMPORTEE').map(l => l.ligne)
    ).toEqual([2, 3, 4, 5, 6, 9])
    expect(deuxieme.perimetresCrees).toEqual([])
    expect(deuxieme.tachesTypesAjoutees).toBe(0)
    expect(
      await prisma.tache.count({ where: { editionId: ids.edition } })
    ).toBe(5)
  })

  it('refuse un groupe que l’activité ne déclare pas', async () => {
    expect(
      code(
        await executer(ids.admin, SIMULER, {
          e: ids.edition,
          l: [],
          g: 'inexistant',
        })
      )
    ).toBe('SAISIE_INVALIDE')
  })

  it('retrouve d’un lot à l’autre le périmètre créé et la tâche importée, puis enregistre les tâches types au deuxième passage', async () => {
    const premier = await rapportDe(IMPORTER, {
      e: ids.edition,
      l: [{ ligne: 2, perimetre: 'Tir à l’arc', titre: 'Régler les cibles' }],
      g: 'sport',
    })
    expect(premier.perimetresCrees).toEqual(['Tir à l’arc'])
    const lotSuivant = {
      e: ids.edition,
      l: [
        { ligne: 3, perimetre: 'tir a l’arc', titre: 'Commander les flèches' },
        { ligne: 4, perimetre: 'Tir à l’arc', titre: 'Régler les cibles' },
      ],
      g: 'sport',
    }
    const second = await rapportDe(IMPORTER, lotSuivant)
    expect(second.perimetresCrees).toEqual([])
    expect(etats(second)).toEqual([
      [3, 'IMPORTEE'],
      [4, 'DEJA_IMPORTEE'],
    ])
    const avecTypes = await rapportDe(IMPORTER, { ...lotSuivant, t: true })
    expect(etats(avecTypes)).toEqual([
      [3, 'DEJA_IMPORTEE'],
      [4, 'DEJA_IMPORTEE'],
    ])
    expect(avecTypes.tachesTypesAjoutees).toBe(2)
  })

  it('ne remplace pas des tâches types illisibles', async () => {
    await prisma.perimetre.update({
      where: { id: ids.natation },
      data: { tachesTypes: { pas: 'valide' } },
    })
    const rapport = await rapportDe(IMPORTER, {
      e: ids.edition,
      l: [{ ligne: 2, perimetre: 'Natation', titre: 'Compter les bouées' }],
      t: true,
    })
    expect(rapport.lignes[0]!.avertissements).toEqual([
      'Les tâches types de ce périmètre sont illisibles : la tâche type n’est pas enregistrée.',
    ])
    expect(rapport.tachesTypesAjoutees).toBe(0)
    expect(
      (
        await prisma.perimetre.findUniqueOrThrow({
          where: { id: ids.natation },
          select: { tachesTypes: true },
        })
      ).tachesTypes
    ).toEqual({ pas: 'valide' })
  })
})
