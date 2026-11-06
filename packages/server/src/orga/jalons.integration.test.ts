import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { creerOrganisation } from '../lib/installation.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { construireContenu } from './exporter.ts'
import { importerModeles, type RapportImport } from './importer.ts'
import { lireModeles } from './modeles.ts'

// Import des jalons (ADR 0062), sur une organisation créée pour le test. Une tâche
// type du pôle est un jalon qui lie une tâche de son périmètre et la déclinaison
// qu'un sport reçoit. Une autre tâche partagée marque ses déclinaisons comme jalons.
// L'import marque et lie sans jamais retirer, et l'export réécrit la clé.

const s = randomUUID().slice(0, 8)
const slug = `jal-${s}`
const ACTIVITE = `tournoi-${s}`
const racine = mkdtempSync(path.join(tmpdir(), 'relaytour-jalons-'))
let organisationId = ''
let editionId = ''

function ecrire(chemin: string, contenu: string) {
  const cible = path.join(racine, 'activites', ACTIVITE, chemin)
  mkdirSync(path.dirname(cible), { recursive: true })
  writeFileSync(cible, contenu)
}

const PERIMETRES = `perimetres:
  - slug: lieux
    nom: Lieux
    groupe: pole
  - slug: natation
    nom: Natation
    groupe: sport
    ordre: 1
  - slug: volley
    nom: Volley
    groupe: sport
    ordre: 2
`

const tachesDuPole = (avecJalon: boolean) =>
  `taches:
  - modele: besoins-de-lieux
    titre: Recenser les besoins de lieux
    echeance: J-300
    declinaison:
      groupe: sport
      titre: Transmettre les besoins de lieux
      jalon: true
  - modele: visite
    titre: Visiter les lieux
    echeance: J-60
  - modele: lieux-prets
    titre: Lieux prêts
    echeance: J-30
${avecJalon ? '    jalon: [lieux/visite, natation/besoins-de-lieux]\n' : ''}`

const importer = (simulation = false) =>
  importerModeles(prisma, lireModeles(racine), {
    organisation: slug,
    annee: 2027,
    simulation,
    forcer: true,
  })

const rapportTaches = (rapport: RapportImport) => rapport.activites[0]!.taches

async function jalons() {
  const lignes = await prisma.tache.findMany({
    where: { editionId, jalonLe: { not: null } },
    include: {
      perimetre: { select: { slug: true } },
      liensJalon: {
        select: {
          tache: {
            select: { modeleSlug: true, perimetre: { select: { slug: true } } },
          },
        },
      },
    },
  })
  return lignes
    .map(t => ({
      jalon: `${t.perimetre.slug}/${t.modeleSlug}`,
      lies: t.liensJalon
        .map(l => `${l.tache.perimetre.slug}/${l.tache.modeleSlug}`)
        .sort(),
    }))
    .sort((a, b) => a.jalon.localeCompare(b.jalon))
}

beforeAll(async () => {
  organisationId = await creerOrganisation({
    slug,
    nom: 'Association d’essai',
    domainesCourrielAutorises: ['exemple.org'],
  })
  writeFileSync(
    path.join(racine, 'organisation.yaml'),
    `slug: ${slug}\nnom: Association d'essai\ndomainesCourrielAutorises: [exemple.org]\n`
  )
  ecrire(
    'activite.yaml',
    `slug: ${ACTIVITE}\nnom: Tournoi\nnature: EVENEMENT\n`
  )
  ecrire('perimetres.yaml', PERIMETRES)
  ecrire('taches/lieux.yaml', tachesDuPole(true))
  // Un premier import crée l'activité ; la période se crée ensuite.
  await importerModeles(prisma, lireModeles(racine), { organisation: slug })
  const activite = await prisma.activite.findFirstOrThrow({
    where: { organisationId, slug: ACTIVITE },
  })
  const edition = await prisma.edition.create({
    data: {
      organisationId,
      activiteId: activite.id,
      annee: 2027,
      nom: 'Tournoi 2027',
      debut: new Date('2027-06-05'),
      fin: new Date('2027-06-06'),
    },
  })
  editionId = edition.id
})

afterAll(async () => {
  await prisma.lienJalon.deleteMany({
    where: { jalon: { perimetre: { organisationId } } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId }, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { perimetre: { organisationId } } })
  await prisma.effectifPerimetre.deleteMany({
    where: { perimetre: { organisationId } },
  })
  await prisma.edition.deleteMany({ where: { organisationId } })
  await prisma.perimetre.deleteMany({ where: { organisationId } })
  await prisma.activite.deleteMany({ where: { organisationId } })
  await prisma.media.deleteMany({ where: { organisationId } })
  await prisma.organisation.delete({ where: { id: organisationId } })
  invaliderConfigurationOrganisation()
  rmSync(racine, { recursive: true, force: true })
})

describe('import des jalons', () => {
  it('annonce en simulation les jalons et les liens, sans rien écrire', async () => {
    const rapport = rapportTaches(await importer(true))
    expect(rapport.jalons.sort()).toEqual([
      'lieux/lieux-prets',
      'natation/besoins-de-lieux',
      'volley/besoins-de-lieux',
    ])
    expect(rapport.liens.sort()).toEqual([
      'lieux/lieux-prets → lieux/visite',
      'lieux/lieux-prets → natation/besoins-de-lieux',
    ])
    expect(rapport.conflits).toEqual([])
    expect(await prisma.tache.count({ where: { editionId } })).toBe(0)
  })

  it('marque les jalons et crée leurs liens', async () => {
    const rapport = rapportTaches(await importer())
    expect(rapport.liens).toHaveLength(2)
    expect(await jalons()).toEqual([
      {
        jalon: 'lieux/lieux-prets',
        lies: ['lieux/visite', 'natation/besoins-de-lieux'],
      },
      { jalon: 'natation/besoins-de-lieux', lies: [] },
      { jalon: 'volley/besoins-de-lieux', lies: [] },
    ])
  })

  it('ne change rien à un second import', async () => {
    const rapport = rapportTaches(await importer())
    expect(rapport.jalons).toEqual([])
    expect(rapport.liens).toEqual([])
    expect(rapport.conflits).toEqual([])
  })

  it('réécrit la clé jalon à l’export, telle que le contenu la déclare', async () => {
    const contenu = await construireContenu(prisma, organisationId)
    const fichier = String(
      contenu.fichiers.get(`activites/${ACTIVITE}/taches/lieux.yaml`)
    )
    expect(fichier).toContain('jalon:')
    expect(fichier).toContain('lieux/visite')
    const retour = mkdtempSync(path.join(tmpdir(), 'relaytour-jalons-retour-'))
    try {
      for (const [chemin, donnees] of contenu.fichiers) {
        const cible = path.join(retour, chemin)
        mkdirSync(path.dirname(cible), { recursive: true })
        writeFileSync(cible, donnees)
      }
      const lire = (dossier: string) =>
        Object.fromEntries(lireModeles(dossier).activites[0]!.taches)
      expect(lire(retour)).toEqual(lire(racine))
    } finally {
      rmSync(retour, { recursive: true, force: true })
    }
  })

  it('ne retire ni le marqueur ni les liens quand le contenu ne les déclare plus', async () => {
    ecrire('taches/lieux.yaml', tachesDuPole(false))
    await importer()
    expect((await jalons())[0]).toEqual({
      jalon: 'lieux/lieux-prets',
      lies: ['lieux/visite', 'natation/besoins-de-lieux'],
    })
  })
})
