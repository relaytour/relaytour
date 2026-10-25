import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

import { prisma } from '@relaytour/database'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { creerOrganisation } from '../lib/installation.ts'
import { archiveZip } from '../lib/zip.ts'
import { contexteDeTest } from '../test/contexte.ts'

import { deposerContenu, ErreurDepot } from './depot-contenu.ts'
import {
  ROUTE_DEPOT_CONTENU,
  routeDepotContenu,
} from './route-depot-contenu.ts'

// Dépôt d'un dossier de contenu depuis l'espace organisateur (ADR 0049). Le test
// dépose le contenu d'exemple dans une organisation créée pour lui.

const s = randomUUID().slice(0, 8)
const slug = `depot-${s}`
const EXEMPLE = path.resolve(import.meta.dirname, '../../../../content/exemple')
const ORIGINE = 'http://localhost:5305'
let organisationId = ''
let adminId = ''
let adminActiviteId = ''
let membreId = ''
let rencontresId = ''
let clubId = ''

/** Les fichiers d'un dossier, par chemin relatif. */
function fichiersDe(racine: string): Map<string, Buffer> {
  const resultat = new Map<string, Buffer>()
  const parcourir = (dossier: string) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name)
      if (e.isDirectory()) parcourir(chemin)
      else resultat.set(path.relative(racine, chemin), readFileSync(chemin))
    }
  }
  parcourir(racine)
  return resultat
}

/** Le contenu d'exemple, avec des remplacements de texte par fichier. */
function exemple(
  remplacements: Record<string, [RegExp, string]> = {}
): Map<string, Buffer> {
  const fichiers = fichiersDe(EXEMPLE)
  for (const [chemin, [motif, valeur]] of Object.entries(remplacements)) {
    const texte = fichiers.get(chemin)!.toString('utf8')
    expect(texte).toMatch(motif)
    fichiers.set(chemin, Buffer.from(texte.replace(motif, valeur)))
  }
  return fichiers
}

const demande = (
  archive: Buffer,
  autres: Partial<Parameters<typeof deposerContenu>[1]> = {}
) => ({
  organisationId,
  organisationSlug: slug,
  activite: null,
  archive,
  simulation: true,
  forcer: false,
  ...autres,
})

async function refus(promesse: Promise<unknown>): Promise<ErreurDepot> {
  const erreur = await promesse.then(
    () => null,
    (e: unknown) => e
  )
  expect(erreur).toBeInstanceOf(ErreurDepot)
  return erreur as ErreurDepot
}

async function creerCompte(
  nom: string,
  role: 'ADMIN' | 'MEMBRE'
): Promise<string> {
  const id = randomUUID()
  await prisma.user.create({
    data: { id, name: nom, email: `${nom}-${s}@exemple.org` },
  })
  await prisma.appartenance.create({
    data: { userId: id, organisationId, role },
  })
  return id
}

beforeAll(async () => {
  organisationId = await creerOrganisation({
    slug,
    nom: 'Dépôt',
    domainesCourrielAutorises: ['exemple.org'],
  })
  adminId = await creerCompte('admin', 'ADMIN')
  adminActiviteId = await creerCompte('admin-activite', 'MEMBRE')
  membreId = await creerCompte('membre', 'MEMBRE')
})

afterAll(async () => {
  await prisma.fiche.updateMany({
    where: { organisationId },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: { organisationId } })
  await prisma.perimetre.deleteMany({ where: { organisationId } })
  await prisma.adminActivite.deleteMany({ where: { organisationId } })
  await prisma.activite.deleteMany({ where: { organisationId } })
  await prisma.media.deleteMany({ where: { organisationId } })
  await prisma.appartenance.deleteMany({ where: { organisationId } })
  await prisma.user.deleteMany({
    where: { id: { in: [adminId, adminActiviteId, membreId] } },
  })
  await prisma.organisation.delete({ where: { id: organisationId } })
})

describe('dépôt du dossier de l’organisation', () => {
  it('simule sans rien écrire et garde le slug de la base', async () => {
    const rapport = await deposerContenu(prisma, demande(archiveZip(exemple())))
    expect(rapport.slugIgnore).toBe('rencontres-de-la-vallee')
    expect(rapport.activites.map(a => [a.slug, a.etat])).toEqual([
      ['rencontres', 'creee'],
      ['club-de-course', 'creee'],
    ])
    expect(rapport.fichiersIgnores).toContain('README.md')
    expect(rapport.fichiersIgnores).not.toContain('organisation.yaml')
    expect(await prisma.perimetre.count({ where: { organisationId } })).toBe(0)
  })

  it('importe le dossier, même rangé dans un dossier englobant', async () => {
    const englobe = new Map([...exemple()].map(([c, d]) => [`contenu/${c}`, d]))
    await deposerContenu(
      prisma,
      demande(archiveZip(englobe), { simulation: false })
    )
    const organisation = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { slug: true, contenuSynchroniseLe: true },
    })
    expect(organisation.slug).toBe(slug)
    expect(organisation.contenuSynchroniseLe).not.toBeNull()
    const activites = await prisma.activite.findMany({
      where: { organisationId },
      select: { id: true, slug: true },
      orderBy: { slug: 'asc' },
    })
    expect(activites.map(a => a.slug)).toEqual(['club-de-course', 'rencontres'])
    clubId = activites[0]!.id
    rencontresId = activites[1]!.id
    expect(
      await prisma.perimetre.count({ where: { activiteId: rencontresId } })
    ).toBeGreaterThan(0)
    await prisma.adminActivite.create({
      data: {
        userId: adminActiviteId,
        activiteId: rencontresId,
        organisationId,
      },
    })
  })

  it('refuse un dossier invalide avec le détail des erreurs', async () => {
    const fichiers = exemple()
    fichiers.delete('organisation.yaml')
    const erreur = await refus(
      deposerContenu(prisma, demande(archiveZip(fichiers)))
    )
    expect(erreur.erreurs.join('\n')).toContain('organisation.yaml est absent')
  })

  it('refuse un chemin qui sort du dossier', async () => {
    const fichiers = exemple()
    fichiers.set('../hors.yaml', Buffer.from('x'))
    const erreur = await refus(
      deposerContenu(prisma, demande(archiveZip(fichiers)))
    )
    expect(erreur.message).toContain('../hors.yaml')
  })

  it('protège les modifications faites dans l’application, sauf confirmation', async () => {
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { contenuModifieLe: new Date(Date.now() + 60_000) },
    })
    const archive = archiveZip(exemple())
    const simulee = await deposerContenu(prisma, demande(archive))
    expect(simulee.modifieDansApplication).not.toBeNull()
    const erreur = await refus(
      deposerContenu(prisma, demande(archive, { simulation: false }))
    )
    expect(erreur.code).toBe('MODIFIE_DANS_APPLICATION')
    await deposerContenu(
      prisma,
      demande(archive, { simulation: false, forcer: true })
    )
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { contenuModifieLe: new Date(Date.now() - 60_000) },
    })
  })
})

describe('dépôt du dossier d’une activité', () => {
  it('importe la seule activité, sans toucher à l’organisation ni aux autres', async () => {
    const avant = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { nom: true, contenuSynchroniseLe: true },
    })
    const perimetreClub = await prisma.perimetre.findFirstOrThrow({
      where: { activiteId: clubId },
      select: { id: true, nom: true },
    })
    const perimetreRencontres = await prisma.perimetre.findFirstOrThrow({
      where: { activiteId: rencontresId },
      orderBy: { ordre: 'asc' },
      select: { id: true, nom: true },
    })
    const fichiers = exemple({
      'organisation.yaml': [/^nom: .*$/m, 'nom: Nom remplacé'],
      'activites/rencontres/perimetres.yaml': [
        new RegExp(`nom: ${perimetreRencontres.nom}$`, 'm'),
        'nom: Périmètre renommé',
      ],
      'activites/club-de-course/perimetres.yaml': [
        new RegExp(`nom: ${perimetreClub.nom}$`, 'm'),
        'nom: Ne doit pas changer',
      ],
    })
    const rapport = await deposerContenu(
      prisma,
      demande(archiveZip(fichiers), {
        activite: { id: rencontresId, slug: 'rencontres' },
        simulation: false,
      })
    )
    expect(rapport.activites.map(a => a.slug)).toEqual(['rencontres'])
    expect(rapport.fichiersIgnores).toContain('organisation.yaml')
    expect(rapport.fichiersIgnores).toContain(
      'activites/club-de-course/perimetres.yaml'
    )
    const apres = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { nom: true, contenuSynchroniseLe: true },
    })
    expect(apres).toEqual(avant)
    expect(
      (
        await prisma.perimetre.findUniqueOrThrow({
          where: { id: perimetreRencontres.id },
        })
      ).nom
    ).toBe('Périmètre renommé')
    expect(
      (
        await prisma.perimetre.findUniqueOrThrow({
          where: { id: perimetreClub.id },
        })
      ).nom
    ).toBe(perimetreClub.nom)
  })

  it('ne déplace ni ne remplace une fiche d’une autre activité', async () => {
    const avant = await prisma.fiche.findFirstOrThrow({
      where: { organisationId, slug: 'accueillir-une-nouvelle-personne' },
      select: { id: true, activiteId: true, versionCouranteId: true },
    })
    expect(avant.activiteId).toBe(clubId)
    const fichiers = exemple()
    fichiers.set(
      'activites/rencontres/fiches/communes/accueillir-une-nouvelle-personne.md',
      Buffer.from(
        '---\nslug: accueillir-une-nouvelle-personne\ntitre: Fiche détournée\n---\n\nUn autre texte.\n'
      )
    )
    const rapport = await deposerContenu(
      prisma,
      demande(archiveZip(fichiers), {
        activite: { id: rencontresId, slug: 'rencontres' },
        simulation: false,
      })
    )
    expect(rapport.activites[0]!.fiches.conflits).toContain(
      'accueillir-une-nouvelle-personne'
    )
    const apres = await prisma.fiche.findUniqueOrThrow({
      where: { id: avant.id },
      select: { activiteId: true, versionCouranteId: true },
    })
    expect(apres).toEqual({
      activiteId: clubId,
      versionCouranteId: avant.versionCouranteId,
    })
  })

  it('accepte le dossier de l’activité seul', async () => {
    const dossier = new Map(
      [...exemple()]
        .filter(([c]) => c.startsWith('activites/rencontres/'))
        .map(([c, d]) => [c.slice('activites/rencontres/'.length), d])
    )
    const rapport = await deposerContenu(
      prisma,
      demande(archiveZip(dossier), {
        activite: { id: rencontresId, slug: 'rencontres' },
      })
    )
    expect(rapport.activites.map(a => [a.slug, a.etat])).toEqual([
      ['rencontres', 'mise-a-jour'],
    ])
  })

  it('refuse une archive sans le dossier de l’activité', async () => {
    const fichiers = new Map(
      [...exemple()].filter(([c]) => !c.startsWith('activites/rencontres/'))
    )
    const erreur = await refus(
      deposerContenu(
        prisma,
        demande(archiveZip(fichiers), {
          activite: { id: rencontresId, slug: 'rencontres' },
        })
      )
    )
    expect(erreur.message).toContain('activites/rencontres/')
  })
})

describe('route du dépôt', () => {
  let adresse = ''
  let serveur: ReturnType<express.Express['listen']> | undefined

  beforeAll(async () => {
    const app = express()
    routeDepotContenu(
      app,
      req => contexteDeTest(req.get('x-test-personne') ?? null, slug),
      [ORIGINE]
    )
    await new Promise<void>(resoudre => {
      serveur = app.listen(0, '127.0.0.1', () => resoudre())
    })
    adresse = `http://127.0.0.1:${(serveur!.address() as AddressInfo).port}`
  })

  afterAll(() => {
    serveur?.close()
  })

  const deposer = (
    personne: string | null,
    requete: string,
    corps: Buffer = archiveZip(exemple()),
    origine: string | null = ORIGINE
  ) =>
    fetch(`${adresse}${ROUTE_DEPOT_CONTENU}?simulation=1${requete}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/zip',
        ...(origine === null ? {} : { origin: origine }),
        ...(personne === null ? {} : { 'x-test-personne': personne }),
      },
      body: corps,
    })

  it('refuse une autre origine et une personne non connectée', async () => {
    expect(
      (await deposer(adminId, '', undefined, 'https://ailleurs.example')).status
    ).toBe(403)
    expect((await deposer(adminId, '', undefined, null)).status).toBe(403)
    expect((await deposer(null, '')).status).toBe(401)
  })

  it('réserve le dossier entier aux admins de l’organisation', async () => {
    expect((await deposer(membreId, '')).status).toBe(403)
    expect((await deposer(adminActiviteId, '')).status).toBe(403)
    const reponse = await deposer(adminId, '')
    expect(reponse.status).toBe(200)
    const rapport = (await reponse.json()) as { activites: unknown[] }
    expect(rapport.activites).toHaveLength(2)
  })

  it('ouvre le dossier d’une activité à ses seuls admins', async () => {
    expect(
      (await deposer(adminActiviteId, `&activite=${rencontresId}`)).status
    ).toBe(200)
    // Une autre activité et une activité inconnue donnent le même refus.
    expect((await deposer(adminActiviteId, `&activite=${clubId}`)).status).toBe(
      403
    )
    expect(
      (await deposer(adminActiviteId, `&activite=${randomUUID()}`)).status
    ).toBe(403)
    expect((await deposer(membreId, `&activite=${rencontresId}`)).status).toBe(
      403
    )
  })

  it('renvoie le détail d’une archive refusée', async () => {
    const reponse = await deposer(adminId, '', Buffer.from('pas un zip'))
    expect(reponse.status).toBe(422)
    expect(((await reponse.json()) as { code: string }).code).toBe(
      'SAISIE_INVALIDE'
    )
  })

  it('refuse une archive de plus de 20 Mo', async () => {
    const reponse = await deposer(
      adminId,
      '',
      Buffer.alloc(20 * 1024 * 1024 + 1)
    )
    expect(reponse.status).toBe(413)
  })
})
