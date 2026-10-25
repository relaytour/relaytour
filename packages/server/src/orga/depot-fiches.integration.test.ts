import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'

import { prisma } from '@relaytour/database'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GROUPES_PAR_DEFAUT } from '../lib/activites.ts'
import { empreinte } from '../lib/fiches.ts'
import { creerOrganisation } from '../lib/installation.ts'
import { contexteDeTest } from '../test/contexte.ts'
import { documentWord } from '../test/docx.ts'

import { deposerFiches, type FichierDepose } from './depot-fiches.ts'
import { ROUTE_DEPOT_FICHES, routeDepotFiches } from './route-depot-fiches.ts'

// Dépôt direct de fiches depuis l'écran « Ressources » (ADR 0049).

const s = randomUUID().slice(0, 8)
const slug = `fiches-${s}`
const ORIGINE = 'http://localhost:5305'
const ids = {
  org: '',
  activite: '',
  autreActivite: '',
  perimetre: '',
  autrePerimetre: '',
  admin: '',
  adminAutre: '',
  membre: '',
}

const fichier = (nom: string, texte: string | Buffer): FichierDepose => ({
  nom,
  octets: typeof texte === 'string' ? Buffer.from(texte) : texte,
})

const LOT = [
  fichier(
    'accueil.md',
    '---\nslug: accueil\ntitre: Accueillir les équipes\n---\n\nOuvrir les vestiaires.'
  ),
  fichier(
    'Réserver la piscine.docx',
    documentWord('Réserver la piscine', ['Appeler la mairie.'])
  ),
  fichier('materiel.txt', 'Compter les ballons.'),
  fichier('plan.pdf', '%PDF-1.4'),
  fichier('accueil.markdown', '# Accueil bis\n\nUn doublon.'),
]

async function creerCompte(nom: string): Promise<string> {
  const id = randomUUID()
  await prisma.user.create({
    data: { id, name: nom, email: `${nom}-${s}@exemple.org` },
  })
  await prisma.appartenance.create({
    data: { userId: id, organisationId: ids.org, role: 'MEMBRE' },
  })
  return id
}

beforeAll(async () => {
  ids.org = await creerOrganisation({
    slug,
    nom: 'Dépôt de fiches',
    domainesCourrielAutorises: ['exemple.org'],
  })
  ids.activite = (
    await prisma.activite.findFirstOrThrow({
      where: { organisationId: ids.org },
    })
  ).id
  ids.autreActivite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug: 'autre',
        nom: 'Autre',
        groupes: GROUPES_PAR_DEFAUT,
      },
    })
  ).id
  for (const [cle, activiteId] of [
    ['perimetre', ids.activite],
    ['autrePerimetre', ids.autreActivite],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId,
          slug: `natation-${cle}`,
          nom: 'Natation',
          groupe: 'sports',
          type: 'SPORT',
        },
      })
    ).id
  }
  ids.admin = await creerCompte('admin')
  ids.adminAutre = await creerCompte('admin-autre')
  ids.membre = await creerCompte('membre')
  await prisma.adminActivite.createMany({
    data: [
      { userId: ids.admin, activiteId: ids.activite, organisationId: ids.org },
      {
        userId: ids.adminAutre,
        activiteId: ids.autreActivite,
        organisationId: ids.org,
      },
    ],
  })
})

afterAll(async () => {
  await prisma.fiche.updateMany({
    where: { organisationId: ids.org },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.appartenance.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { id: { in: [ids.admin, ids.adminAutre, ids.membre] } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
})

const deposer = (fichiers: FichierDepose[], ecrire: boolean) =>
  deposerFiches(ids.org, ids.activite, ids.perimetre, fichiers, {
    ecrire,
    auteurId: ids.admin,
  })

describe('dépôt de fiches', () => {
  it('simule la conversion et les contrôles sans rien écrire', async () => {
    const rapport = await deposer(LOT, false)
    expect(rapport.creees.sort()).toEqual([
      'accueil',
      'materiel',
      'reserver-la-piscine',
    ])
    expect(rapport.converties.map(c => c.fichier)).toEqual([
      'Réserver la piscine.docx',
    ])
    expect(rapport.nonImportes.map(n => n.fichier).sort()).toEqual([
      'accueil.md',
      'plan.pdf',
    ])
    expect(
      await prisma.fiche.count({ where: { organisationId: ids.org } })
    ).toBe(0)
  })

  it('crée les fiches du périmètre avec la source DEPOT', async () => {
    await deposer(LOT, true)
    const fiches = await prisma.fiche.findMany({
      where: { organisationId: ids.org },
      select: {
        slug: true,
        perimetreId: true,
        activiteId: true,
        versionCourante: {
          select: { source: true, auteurId: true, titre: true },
        },
      },
      orderBy: { slug: 'asc' },
    })
    expect(fiches.map(f => f.slug)).toEqual([
      'accueil',
      'materiel',
      'reserver-la-piscine',
    ])
    for (const f of fiches) {
      expect(f.perimetreId).toBe(ids.perimetre)
      expect(f.activiteId).toBe(ids.activite)
      expect(f.versionCourante?.source).toBe('DEPOT')
      expect(f.versionCourante?.auteurId).toBe(ids.admin)
    }
    // Les fichiers se lisent par nom : accueil.markdown passe avant accueil.md.
    expect(fiches[0]!.versionCourante?.titre).toBe('Accueil bis')
  })

  it('ne crée une version que si le texte change', async () => {
    const rapport = await deposer(
      [
        fichier('materiel.txt', 'Compter les ballons.'),
        fichier(
          'accueil.md',
          '---\nslug: accueil\ntitre: Accueillir les équipes\n---\n\nOuvrir les vestiaires à 8 h.'
        ),
      ],
      true
    )
    expect(rapport.inchangees).toEqual(['materiel'])
    expect(rapport.nouvellesVersions).toEqual(['accueil'])
  })

  it('garde une fiche modifiée dans Relaytour et refuse les coordonnées personnelles', async () => {
    const fiche = await prisma.fiche.findFirstOrThrow({
      where: { organisationId: ids.org, slug: 'materiel' },
    })
    const version = await prisma.ficheVersion.create({
      data: {
        ficheId: fiche.id,
        titre: 'materiel',
        contenu: 'Écrit dans l’application.',
        empreinte: empreinte('materiel', 'Écrit dans l’application.'),
        source: 'APP',
      },
    })
    await prisma.fiche.update({
      where: { id: fiche.id },
      data: { versionCouranteId: version.id },
    })
    const rapport = await deposer(
      [
        fichier('materiel.txt', 'Une autre version.'),
        fichier('contacts.md', 'Appeler Dominique au 06 12 34 56 78.'),
      ],
      true
    )
    expect(rapport.conflits.map(c => c.fiche)).toEqual(['materiel'])
    expect(rapport.refusees.map(r => r.fichier)).toEqual(['contacts.md'])
  })
})

describe('route du dépôt de fiches', () => {
  let adresse = ''
  let serveur: ReturnType<express.Express['listen']> | undefined

  beforeAll(async () => {
    const app = express()
    routeDepotFiches(
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

  const envoyer = (
    personne: string,
    activite: string,
    perimetre: string | null,
    origine: string | null = ORIGINE,
    simulation = true
  ) =>
    fetch(
      `${adresse}${ROUTE_DEPOT_FICHES}?${simulation ? 'simulation=1&' : ''}activite=${activite}${perimetre === null ? '' : `&perimetre=${perimetre}`}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-personne': personne,
          ...(origine === null ? {} : { origin: origine }),
        },
        body: JSON.stringify({
          fichiers: [
            {
              nom: 'consignes.md',
              donnees: Buffer.from('# Consignes\n\nArriver tôt.').toString(
                'base64'
              ),
            },
          ],
        }),
      }
    )

  it('accepte un admin de l’activité, pour un périmètre ou les fiches communes', async () => {
    const reponse = await envoyer(ids.admin, ids.activite, ids.perimetre)
    expect(reponse.status).toBe(200)
    expect(((await reponse.json()) as { creees: string[] }).creees).toEqual([
      'consignes',
    ])
    expect((await envoyer(ids.admin, ids.activite, null)).status).toBe(200)
  })

  it('refuse une autre activité, un périmètre d’une autre activité, un membre et une autre origine', async () => {
    expect((await envoyer(ids.admin, ids.autreActivite, null)).status).toBe(403)
    expect(
      (await envoyer(ids.admin, ids.activite, ids.autrePerimetre)).status
    ).toBe(403)
    expect(
      (await envoyer(ids.adminAutre, ids.activite, ids.perimetre)).status
    ).toBe(403)
    expect((await envoyer(ids.membre, ids.activite, null)).status).toBe(403)
    expect(
      (await envoyer(ids.admin, ids.activite, null, 'https://ailleurs.example'))
        .status
    ).toBe(403)
  })

  it('écrit les fiches déposées par la route, au nom de la personne', async () => {
    const reponse = await envoyer(
      ids.admin,
      ids.activite,
      ids.perimetre,
      ORIGINE,
      false
    )
    expect(reponse.status).toBe(200)
    const fiche = await prisma.fiche.findFirstOrThrow({
      where: { organisationId: ids.org, slug: 'consignes' },
      select: {
        perimetreId: true,
        versionCourante: { select: { source: true, auteurId: true } },
      },
    })
    expect(fiche).toEqual({
      perimetreId: ids.perimetre,
      versionCourante: { source: 'DEPOT', auteurId: ids.admin },
    })
  })
})
