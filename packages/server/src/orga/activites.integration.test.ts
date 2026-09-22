import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { empreinte } from '../lib/fiches.ts'
import { creerOrganisation } from '../lib/installation.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { exporterContenu } from './exporter.ts'
import { importerModeles } from './importer.ts'
import { lireModeles } from './modeles.ts'

// Import et export d'un dossier en disposition activites/ (ADR 0008), sur une
// organisation créée pour le test. L'organisation par défaut de la base de
// développement n'est pas touchée.

const s = randomUUID().slice(0, 8)
const slug = `imp-${s}`
const racine = mkdtempSync(path.join(tmpdir(), 'relaytour-activites-'))
let organisationId = ''

function ecrire(chemin: string, contenu: string) {
  mkdirSync(path.dirname(path.join(racine, chemin)), { recursive: true })
  writeFileSync(path.join(racine, chemin), contenu)
}

const fiche = (slugFiche: string, corps: string) =>
  `---\nslug: ${slugFiche}\ntitre: Titre ${slugFiche}\n---\n\n${corps}\n`

beforeAll(async () => {
  organisationId = await creerOrganisation({
    slug,
    nom: 'Association d’essai',
    domainesCourrielAutorises: ['exemple.org'],
  })
  ecrire(
    'organisation.yaml',
    `slug: ${slug}\nnom: Association d'essai\ndomainesCourrielAutorises: [exemple.org]\n`
  )
  ecrire(
    `activites/tournoi-${s}/activite.yaml`,
    `slug: tournoi-${s}\nnom: Tournoi\nnature: EVENEMENT\n`
  )
  ecrire(
    `activites/tournoi-${s}/perimetres.yaml`,
    'perimetres:\n  - slug: natation\n    nom: Natation\n    groupe: sport\n    effectif: 2\n'
  )
  ecrire(
    `activites/tournoi-${s}/fiches/natation/piscine-${s}.md`,
    fiche(`piscine-${s}`, '## Objectif\n\nRéserver la piscine.')
  )
  ecrire(
    `activites/tournoi-${s}/taches/natation.yaml`,
    `taches:\n  - modele: piscine\n    titre: Réserver la piscine\n    echeance: J-10\n    fiche: piscine-${s}\n`
  )
  ecrire(
    `activites/section-${s}/activite.yaml`,
    `slug: section-${s}\nnom: Section\nnature: SAISON\ngroupes:\n  - cle: equipe\n    libelle: Équipe\n    libellePluriel: Équipes\n`
  )
  ecrire(
    `activites/section-${s}/perimetres.yaml`,
    'perimetres:\n  - slug: natation\n    nom: Encadrement natation\n    groupe: equipe\n'
  )
  ecrire(
    `activites/section-${s}/fiches/communes/saison-${s}.md`,
    fiche(`saison-${s}`, '## Objectif\n\nPréparer la saison.')
  )
})

afterAll(async () => {
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

describe('import en disposition activites/', () => {
  it('exige --organisation quand plusieurs organisations existent', async () => {
    await expect(
      importerModeles(prisma, lireModeles(racine), { simulation: true })
    ).rejects.toThrow(/précisez --organisation/)
  })

  it('refuse une organisation qui ne correspond pas au dépôt', async () => {
    await expect(
      importerModeles(prisma, lireModeles(racine), {
        organisation: 'autre',
        simulation: true,
      })
    ).rejects.toThrow(/Import refusé/)
  })

  it('refuse d’ajouter des activités au-delà de la limite, sans rien écrire', async () => {
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { limites: { activites: 2 } },
    })
    try {
      await expect(
        importerModeles(prisma, lireModeles(racine), { organisation: slug })
      ).rejects.toThrow(/dépasserait sa limite de 2 activité/)
      expect(await prisma.activite.count({ where: { organisationId } })).toBe(1)
    } finally {
      await prisma.organisation.update({
        where: { id: organisationId },
        data: { limites: {} },
      })
    }
  })

  it('crée les activités et retire l’activité vide créée avec l’organisation', async () => {
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: slug,
    })
    expect(rapport.activites.map(a => [a.slug, a.etat])).toEqual([
      [`section-${s}`, 'creee'],
      [`tournoi-${s}`, 'creee'],
    ])
    // L'activité créée avec l'organisation, vide et absente du dépôt, disparaît :
    // elle deviendrait sinon l'activité affichée par défaut.
    expect(rapport.amorcageRetire).toBe(true)
    expect(rapport.activitesAbsentesDuDepot).toEqual([])
    expect(
      await prisma.activite.count({ where: { organisationId, slug } })
    ).toBe(0)
    const section = await prisma.activite.findFirstOrThrow({
      where: { organisationId, slug: `section-${s}` },
      include: { perimetres: true },
    })
    expect(section.nature).toBe('SAISON')
    expect(section.perimetres.map(p => [p.slug, p.groupe])).toEqual([
      ['natation', 'equipe'],
    ])
    // Deux périmètres de même slug vivent dans deux activités.
    expect(
      await prisma.perimetre.count({
        where: { organisationId, slug: 'natation' },
      })
    ).toBe(2)
  })

  it('importe les tâches de la période des seules activités qui en ont une', async () => {
    const tournoi = await prisma.activite.findFirstOrThrow({
      where: { organisationId, slug: `tournoi-${s}` },
    })
    await prisma.edition.create({
      data: {
        organisationId,
        activiteId: tournoi.id,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: new Date('2027-06-10'),
        fin: new Date('2027-06-11'),
      },
    })
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: slug,
      annee: 2027,
    })
    const [section, tournoiRapport] = rapport.activites
    expect(section?.periode).toBe('absente')
    expect(tournoiRapport?.periode).toBe('importee')
    expect(tournoiRapport?.taches.creees).toEqual(['natation/piscine'])
    expect(tournoiRapport?.effectifs.crees).toEqual(['natation (2)'])
    const tache = await prisma.tache.findFirstOrThrow({
      where: { perimetre: { activiteId: tournoi.id } },
      include: { fiche: true },
    })
    expect(tache.echeance?.toISOString().slice(0, 10)).toBe('2027-05-31')
    expect(tache.fiche?.slug).toBe(`piscine-${s}`)
  })

  it('refuse une année qu’aucune activité ne porte', async () => {
    await expect(
      importerModeles(prisma, lireModeles(racine), {
        organisation: slug,
        annee: 2031,
        simulation: true,
      })
    ).rejects.toThrow(/Aucune activité n'a de période 2031/)
  })

  it('restreint l’import à une activité', async () => {
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: slug,
      activite: `section-${s}`,
      simulation: true,
    })
    expect(rapport.activites.map(a => a.slug)).toEqual([`section-${s}`])
    expect(rapport.activitesAbsentesDuDepot).toEqual([])
  })
})

describe('activité d’amorçage', () => {
  it('retire l’activité « defaut » vide qu’un dépôt en activites/ ne décrit pas', async () => {
    await prisma.activite.create({
      data: {
        organisationId,
        slug: 'defaut',
        nom: 'Amorçage',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: slug,
    })
    expect(rapport.amorcageRetire).toBe(true)
    expect(rapport.activitesAbsentesDuDepot).not.toContain('defaut')
    expect(
      await prisma.activite.count({ where: { organisationId, slug: 'defaut' } })
    ).toBe(0)
  })
})

describe('export en disposition activites/', () => {
  it('réécrit seulement la fiche modifiée, dans le dossier de son activité', async () => {
    const saison = await prisma.fiche.findFirstOrThrow({
      where: { organisationId, slug: `saison-${s}` },
    })
    const contenu = '## Objectif\n\nPréparer la saison avec les équipes.'
    const version = await prisma.ficheVersion.create({
      data: {
        ficheId: saison.id,
        titre: `Titre saison-${s}`,
        contenu,
        empreinte: empreinte(`Titre saison-${s}`, contenu),
        source: 'APP',
      },
    })
    await prisma.fiche.update({
      where: { id: saison.id },
      data: { versionCouranteId: version.id },
    })
    const rapport = await exporterContenu(prisma, racine, slug)
    const attendu = `activites/section-${s}/fiches/communes/saison-${s}.md`
    // Les fichiers du dossier disent la même chose, sauf la fiche : ils restent
    // intacts.
    expect(rapport.ecrites).toEqual([attendu])
    expect(rapport.inchangees).toContain('organisation.yaml')
    expect(rapport.inchangees).toContain(
      `activites/tournoi-${s}/taches/natation.yaml`
    )
    expect(readFileSync(path.join(racine, attendu), 'utf8')).toContain(
      'avec les équipes'
    )
    // Le dossier exporté reste valide.
    expect(() => lireModeles(racine)).not.toThrow()
  })

  it('refuse un dossier plat quand l’organisation porte plusieurs activités', async () => {
    const piscine = await prisma.fiche.findFirstOrThrow({
      where: { organisationId, slug: `piscine-${s}` },
    })
    const contenu = '## Objectif\n\nRéserver tôt.'
    const version = await prisma.ficheVersion.create({
      data: {
        ficheId: piscine.id,
        titre: `Titre piscine-${s}`,
        contenu,
        empreinte: empreinte(`Titre piscine-${s}`, contenu),
        source: 'APP',
      },
    })
    await prisma.fiche.update({
      where: { id: piscine.id },
      data: { versionCouranteId: version.id },
    })
    const plat = mkdtempSync(path.join(tmpdir(), 'relaytour-plat-'))
    writeFileSync(path.join(plat, 'perimetres.yaml'), 'perimetres: []\n')
    try {
      await expect(exporterContenu(prisma, plat, slug)).rejects.toThrow(
        /disposition activites/
      )
      expect(existsSync(path.join(plat, 'fiches'))).toBe(false)
    } finally {
      rmSync(plat, { recursive: true, force: true })
    }
  })
})
