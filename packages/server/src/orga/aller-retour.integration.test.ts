import { randomUUID } from 'node:crypto'
import {
  cpSync,
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

import { creerOrganisation } from '../lib/installation.ts'
import {
  configurationActivite,
  configurationOrganisation,
  invaliderConfigurationOrganisation,
} from '../lib/organisation.ts'

import { construireContenu, exporterContenu } from './exporter.ts'
import { importerModeles } from './importer.ts'
import { lireModeles, type Modeles } from './modeles.ts'

// Aller-retour du contenu (ADR 0009) : importer un export ne change rien, et
// exporter un import redonne le même dossier. Le test part du contenu d'exemple,
// sur une organisation créée pour lui.

const s = randomUUID().slice(0, 8)
const slug = `ar-${s}`
const EXEMPLE = path.join(import.meta.dirname, '../../../../content/exemple')
const source = mkdtempSync(path.join(tmpdir(), 'relaytour-aller-'))
const retour = mkdtempSync(path.join(tmpdir(), 'relaytour-retour-'))
let organisationId = ''

/** Les modèles d'un dossier, sous une forme comparable. */
function comparable(modeles: Modeles): unknown {
  const texte = JSON.stringify(modeles, (_cle, valeur: unknown) => {
    if (valeur instanceof Map) {
      return Object.fromEntries(valeur as Map<string, unknown>) as unknown
    }
    if (
      valeur !== null &&
      typeof valeur === 'object' &&
      'empreinte' in valeur &&
      'donnees' in valeur
    ) {
      return (valeur as { empreinte: string }).empreinte
    }
    return valeur
  })
  return JSON.parse(texte) as unknown
}

beforeAll(async () => {
  cpSync(EXEMPLE, source, { recursive: true })
  const organisation = path.join(source, 'organisation.yaml')
  writeFileSync(
    organisation,
    readFileSync(organisation, 'utf8').replace(/^slug: .*$/m, `slug: ${slug}`)
  )
  organisationId = await creerOrganisation({
    slug,
    nom: 'Aller-retour',
    domainesCourrielAutorises: ['exemple.org'],
  })
})

afterAll(async () => {
  await prisma.fiche.updateMany({
    where: { organisationId },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: { organisationId } })
  await prisma.perimetre.deleteMany({ where: { organisationId } })
  await prisma.activite.deleteMany({ where: { organisationId } })
  await prisma.media.deleteMany({ where: { organisationId } })
  await prisma.organisation.delete({ where: { id: organisationId } })
  invaliderConfigurationOrganisation()
  rmSync(source, { recursive: true, force: true })
  rmSync(retour, { recursive: true, force: true })
})

describe('aller-retour du contenu', () => {
  it('importe le contenu, ses images et l’identité des activités', async () => {
    const rapport = await importerModeles(prisma, lireModeles(source), {
      organisation: slug,
    })
    expect(rapport.amorcageRetire).toBe(true)
    expect(rapport.medias.enregistrees).toHaveLength(4)
    invaliderConfigurationOrganisation()

    const organisation = await configurationOrganisation(organisationId)
    expect(organisation.logoUrl).toMatch(/^\/medias\/[0-9a-f]{64}\.svg$/)
    expect(organisation.faviconUrl).toMatch(/^\/medias\/[0-9a-f]{64}\.png$/)
    expect(organisation.logoMailUrl).toMatch(
      /^http.*\/medias\/[0-9a-f]{64}\.png$/
    )

    const club = await prisma.activite.findFirstOrThrow({
      where: { organisationId, slug: 'club-de-course' },
    })
    const configuration = await configurationActivite(club.id)
    expect(configuration.contactRecrutement).toBe(
      'club.course.rencontres@messagerie.example'
    )
    expect(configuration.theme.couleurs.primaire).toBe('#2E5B3B')
    expect(configuration.logoUrl).not.toBe(organisation.logoUrl)
    // Les polices restent celles de l'organisation.
    expect(configuration.theme.polices).toEqual(organisation.theme.polices)

    const rencontres = await prisma.activite.findFirstOrThrow({
      where: { organisationId, slug: 'rencontres' },
    })
    const heritee = await configurationActivite(rencontres.id)
    expect(heritee.contactRecrutement).toBe(organisation.contactRecrutement)
    expect(heritee.logoUrl).toBe(organisation.logoUrl)
    expect(heritee.theme).toEqual(organisation.theme)
  })

  it('exporte un dossier qui décrit exactement le même contenu', async () => {
    const contenu = await construireContenu(prisma, organisationId)
    expect(contenu.disposition).toBe('activites')
    expect(contenu.refusees).toEqual([])
    for (const [chemin, donnees] of contenu.fichiers) {
      const cible = path.join(retour, chemin)
      mkdirSync(path.dirname(cible), { recursive: true })
      writeFileSync(cible, donnees)
    }
    expect(comparable(lireModeles(retour))).toEqual(
      comparable(lireModeles(source))
    )
  })

  it('réimporte l’export sans rien changer', async () => {
    const rapport = await importerModeles(prisma, lireModeles(retour), {
      organisation: slug,
      simulation: true,
    })
    expect(rapport.medias.enregistrees).toEqual([])
    for (const activite of rapport.activites) {
      expect(activite.etat).toBe('mise-a-jour')
      expect(activite.perimetres.crees).toEqual([])
      expect(activite.perimetres.modifies).toEqual([])
      expect(activite.fiches.creees).toEqual([])
      expect(activite.fiches.nouvellesVersions).toEqual([])
    }
    expect(rapport.activitesAbsentesDuDepot).toEqual([])
  })

  it('garde intact un fichier écrit à la main dont le sens ne change pas', async () => {
    const rapport = await exporterContenu(prisma, source, slug)
    expect(rapport.ecrites).toEqual([])
    expect(
      readFileSync(path.join(source, 'organisation.yaml'), 'utf8')
    ).toContain('# Identité de l’organisation d’exemple'.replace(/’/g, "'"))
  })

  it('protège une modification faite dans l’application jusqu’au prochain export', async () => {
    const modifiee = new Date(Date.now() + 1000)
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { contenuModifieLe: modifiee },
    })
    const simulation = await importerModeles(prisma, lireModeles(source), {
      organisation: slug,
      simulation: true,
    })
    expect(simulation.modifieDansApplication).toEqual(modifiee)
    await expect(
      importerModeles(prisma, lireModeles(source), { organisation: slug })
    ).rejects.toThrow(/--forcer/)

    const forcee = await importerModeles(prisma, lireModeles(source), {
      organisation: slug,
      forcer: true,
    })
    expect(forcee.modifieDansApplication).toEqual(modifiee)
    const apres = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { contenuSynchroniseLe: true },
    })
    expect(apres.contenuSynchroniseLe!.getTime()).toBeGreaterThanOrEqual(
      Date.now() - 60_000
    )
  })
})
