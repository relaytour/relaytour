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

// Import des tâches partagées (ADR 0026), sur une organisation créée pour le test :
// une tâche d'un pôle se décline dans les périmètres d'un groupe. L'import crée les
// déclinaisons, les lie à leur tâche partagée, et rattache une tâche déjà présente.

const s = randomUUID().slice(0, 8)
const slug = `part-${s}`
const ACTIVITE = `tournoi-${s}`
const racine = mkdtempSync(path.join(tmpdir(), 'relaytour-partagees-'))
let organisationId = ''
let editionId = ''

function ecrire(chemin: string, contenu: string) {
  const cible = path.join(racine, 'activites', ACTIVITE, chemin)
  mkdirSync(path.dirname(cible), { recursive: true })
  writeFileSync(cible, contenu)
}

const fiche = (slugFiche: string) =>
  `---\nslug: ${slugFiche}\ntitre: Titre ${slugFiche}\n---\n\n## Objectif\n\nRéserver.\n`

const perimetres = (sports: string[]) =>
  `perimetres:\n  - slug: lieux\n    nom: Lieux\n    groupe: pole\n${sports
    .map(
      (sport, rang) =>
        `  - slug: ${sport}\n    nom: ${sport}\n    groupe: sport\n    ordre: ${rang + 1}\n`
    )
    .join('')}`

// La tâche du pôle, ordinaire ou partagée avec les sports.
const tachesDuPole = (partagee: boolean) =>
  `taches:
  - modele: besoins-de-lieux
    titre: Recenser les besoins de lieux
    description: Le pôle réunit les besoins de chaque sport.
    echeance: J-300
    fiche: missions-${s}
${
  partagee
    ? `    declinaison:
      groupe: sport
      titre: Transmettre les besoins de lieux
      echeance: J-285
      fiche: reserver-${s}
`
    : ''
}  - modele: visite
    titre: Visiter les lieux
    echeance: J-30
`

const importer = (simulation = false) =>
  importerModeles(prisma, lireModeles(racine), {
    organisation: slug,
    annee: 2027,
    simulation,
    forcer: true,
  })

const rapportTaches = (rapport: RapportImport) => rapport.activites[0]!.taches

async function taches() {
  const lignes = await prisma.tache.findMany({
    where: { editionId },
    include: {
      perimetre: { select: { slug: true } },
      origine: { select: { perimetre: { select: { slug: true } } } },
      fiche: { select: { slug: true } },
    },
    orderBy: [{ perimetre: { slug: 'asc' } }, { modeleSlug: 'asc' }],
  })
  return lignes.map(t => ({
    perimetre: t.perimetre.slug,
    modele: t.modeleSlug,
    titre: t.titre,
    echeance: t.echeance?.toISOString().slice(0, 10) ?? null,
    fiche: t.fiche?.slug ?? null,
    origine: t.origine?.perimetre.slug ?? null,
    accord: t.accord,
  }))
}

beforeAll(async () => {
  organisationId = await creerOrganisation({
    slug,
    nom: 'Association d’essai',
    domainesCourrielAutorises: ['exemple.org'],
  })
  const organisation = path.join(racine, 'organisation.yaml')
  writeFileSync(
    organisation,
    `slug: ${slug}\nnom: Association d'essai\ndomainesCourrielAutorises: [exemple.org]\n`
  )
  ecrire(
    'activite.yaml',
    `slug: ${ACTIVITE}\nnom: Tournoi\nnature: EVENEMENT\n`
  )
  ecrire('perimetres.yaml', perimetres(['natation', 'volley']))
  ecrire(`fiches/communes/reserver-${s}.md`, fiche(`reserver-${s}`))
  ecrire(`fiches/lieux/missions-${s}.md`, fiche(`missions-${s}`))
  ecrire('taches/lieux.yaml', tachesDuPole(false))
  // Le volley porte déjà la tâche, écrite avant que le contenu ne la partage.
  ecrire(
    'taches/volley.yaml',
    'taches:\n  - modele: besoins-de-lieux\n    titre: Demander deux gymnases\n    echeance: J-280\n'
  )
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
  // Les déclinaisons partent avant leur tâche partagée.
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId }, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { perimetre: { organisationId } } })
  await prisma.effectifPerimetre.deleteMany({
    where: { perimetre: { organisationId } },
  })
  await prisma.fiche.updateMany({
    where: { organisationId },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: { organisationId } })
  await prisma.edition.deleteMany({ where: { organisationId } })
  await prisma.perimetre.deleteMany({ where: { organisationId } })
  await prisma.activite.deleteMany({ where: { organisationId } })
  await prisma.media.deleteMany({ where: { organisationId } })
  await prisma.organisation.delete({ where: { id: organisationId } })
  invaliderConfigurationOrganisation()
  rmSync(racine, { recursive: true, force: true })
})

describe('import des tâches partagées', () => {
  it('importe d’abord des tâches ordinaires, sans lien entre elles', async () => {
    const rapport = rapportTaches(await importer())
    expect(rapport.creees).toEqual([
      'lieux/besoins-de-lieux',
      'lieux/visite',
      'volley/besoins-de-lieux',
    ])
    expect(rapport.rattachees).toEqual([])
    expect((await taches()).every(t => t.origine === null)).toBe(true)
  })

  it('annonce en simulation les déclinaisons à créer et à rattacher, sans rien écrire', async () => {
    // Le contenu partage maintenant la tâche du pôle avec les sports : le volley
    // ne la déclare plus lui-même.
    ecrire('taches/lieux.yaml', tachesDuPole(true))
    rmSync(path.join(racine, 'activites', ACTIVITE, 'taches/volley.yaml'))
    const rapport = rapportTaches(await importer(true))
    expect(rapport.creees).toEqual([
      'natation/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
    ])
    expect(rapport.rattachees).toEqual([
      'volley/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
    ])
    expect(await prisma.tache.count({ where: { editionId } })).toBe(3)
    expect((await taches()).every(t => t.origine === null)).toBe(true)
  })

  it('crée la déclinaison absente et rattache la tâche déjà présente, sans la modifier', async () => {
    const rapport = rapportTaches(await importer())
    expect(rapport.creees).toEqual([
      'natation/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
    ])
    expect(rapport.rattachees).toEqual([
      'volley/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
    ])
    expect(rapport.dejaPresentes).toEqual([
      'lieux/besoins-de-lieux',
      'lieux/visite',
    ])
    expect(await taches()).toEqual([
      {
        perimetre: 'lieux',
        modele: 'besoins-de-lieux',
        titre: 'Recenser les besoins de lieux',
        echeance: '2026-08-09',
        fiche: `missions-${s}`,
        origine: null,
        accord: null,
      },
      {
        perimetre: 'lieux',
        modele: 'visite',
        titre: 'Visiter les lieux',
        echeance: '2027-05-06',
        fiche: null,
        origine: null,
        accord: null,
      },
      // La déclinaison créée porte ses textes, son échéance et sa fiche commune.
      {
        perimetre: 'natation',
        modele: 'besoins-de-lieux',
        titre: 'Transmettre les besoins de lieux',
        echeance: '2026-08-24',
        fiche: `reserver-${s}`,
        origine: 'lieux',
        accord: 'ACCEPTE',
      },
      // La tâche rattachée garde son titre et son échéance.
      {
        perimetre: 'volley',
        modele: 'besoins-de-lieux',
        titre: 'Demander deux gymnases',
        echeance: '2026-08-29',
        fiche: null,
        origine: 'lieux',
        accord: 'ACCEPTE',
      },
    ])
  })

  it('ne change rien à un second import', async () => {
    const rapport = rapportTaches(await importer())
    expect(rapport.creees).toEqual([])
    expect(rapport.rattachees).toEqual([])
    expect(rapport.dejaPresentes).toEqual([
      'lieux/besoins-de-lieux',
      'natation/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
      'volley/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
      'lieux/visite',
    ])
    expect(await prisma.tache.count({ where: { editionId } })).toBe(4)
  })

  it('crée la seule déclinaison d’un périmètre ajouté au groupe', async () => {
    ecrire('perimetres.yaml', perimetres(['natation', 'volley', 'escrime']))
    const rapport = rapportTaches(await importer())
    expect(rapport.creees).toEqual([
      'escrime/besoins-de-lieux (déclinaison de lieux/besoins-de-lieux)',
    ])
    const escrime = (await taches()).find(t => t.perimetre === 'escrime')
    expect(escrime).toMatchObject({ origine: 'lieux', accord: 'ACCEPTE' })
  })

  it('reprend la fiche commune de la tâche partagée, jamais la fiche de son périmètre', async () => {
    // La déclinaison ne déclare plus de fiche : la tâche partagée cite une fiche de
    // son pôle, que les sports ne lisent pas.
    ecrire(
      'taches/lieux.yaml',
      `taches:
  - modele: plan-des-lieux
    titre: Dresser le plan des lieux
    fiche: missions-${s}
    declinaison:
      perimetres: [natation]
  - modele: reservation
    titre: Réserver les lieux
    fiche: reserver-${s}
    declinaison:
      perimetres: [natation]
`
    )
    await importer()
    const natation = (await taches()).filter(t => t.perimetre === 'natation')
    expect(
      natation.map(t => [t.modele, t.titre, t.echeance, t.fiche, t.origine])
    ).toEqual([
      [
        'besoins-de-lieux',
        'Transmettre les besoins de lieux',
        '2026-08-24',
        `reserver-${s}`,
        'lieux',
      ],
      ['plan-des-lieux', 'Dresser le plan des lieux', null, null, 'lieux'],
      ['reservation', 'Réserver les lieux', null, `reserver-${s}`, 'lieux'],
    ])
  })

  it('réécrit la déclinaison à l’export, telle que le contenu la déclare', async () => {
    const contenu = await construireContenu(prisma, organisationId)
    const fichier = contenu.fichiers.get(
      `activites/${ACTIVITE}/taches/lieux.yaml`
    )
    expect(String(fichier)).toContain('declinaison:')
    expect(String(fichier)).toContain('perimetres:')
    // Le dossier exporté décrit les mêmes tâches types que le dossier importé.
    const retour = mkdtempSync(
      path.join(tmpdir(), 'relaytour-partagees-retour-')
    )
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
})
