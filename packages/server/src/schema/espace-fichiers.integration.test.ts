import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { remplacerEspacePourLesTests } from '../espace-fichiers/index.ts'
import { espaceEnMemoire } from '../espace-fichiers/memoire.ts'
import { peutRecevoir } from '../lib/flux.ts'
import { routesEspaceFichiers } from '../espace-fichiers/routes.ts'

import { schema } from './index.ts'

// Espace de fichiers d'une organisation (ADR 0038). Un dossier lié se lit comme
// les fiches de son périmètre ; un chemin ne sort jamais du dossier lié ; la
// liseuse n'affiche jamais un document qui pourrait porter un script. Le fichier
// crée ses propres organisations et remplace le fournisseur par un espace en
// mémoire.

const s = randomUUID().slice(0, 8)
const slug = `fichiers-${s}`
const slugAutre = `fichiers-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  admin: '',
  adminActivite: '',
  nageuse: '', // référente de la natation
  basketteur: '', // référent du basket
  membre: '', // aucune affectation
  externe: '', // admin de l'autre organisation
  dossierNatation: '',
  dossierBasket: '',
  dossierCommun: '',
  ficheNatation: '',
  ficheCommune: '',
}

const ESPACE = espaceEnMemoire([
  {
    id: 'bibliotheque',
    nom: 'Documents',
    site: 'Association',
    racine: {
      id: 'racine',
      nom: 'Documents',
      enfants: [
        {
          id: 'd-natation',
          nom: 'Natation',
          enfants: [
            { id: 'f-plan', nom: 'Plan.pdf', contenu: '%PDF plan du bassin' },
            {
              id: 'd-archives',
              nom: 'Archives',
              enfants: [
                { id: 'f-ancien', nom: 'Ancien.docx', contenu: 'ancien' },
              ],
            },
          ],
        },
        {
          id: 'd-basket',
          nom: 'Basket',
          enfants: [{ id: 'f-basket', nom: 'Equipes.txt', contenu: 'basket' }],
        },
        {
          id: 'd-commun',
          nom: 'Commun',
          enfants: [
            { id: 'f-charte', nom: 'Charte.md', contenu: '# Charte' },
            { id: 'f-page', nom: 'page.html', contenu: '<script>1</script>' },
            { id: 'f-logo', nom: 'logo.svg', contenu: '<svg onload=1/>' },
          ],
        },
        {
          id: 'd-rh',
          nom: 'RH',
          enfants: [{ id: 'f-rh', nom: 'Salaires.txt', contenu: 'privé' }],
        },
      ],
    },
  },
])

async function executer(
  userId: string | null,
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

const ESPACE_FICHIERS = `{ espaceFichiers { fournisseursDisponibles connexion { fournisseur compte etat } } }`
const LIER = `mutation ($a: ID!, $p: ID, $c: [String!]!) {
  lierDossier(activiteId: $a, perimetreId: $p, emplacement: "bibliotheque", chemin: $c) { id nom disponible perimetre { slug } }
}`
const DOSSIERS = `query ($a: ID, $p: ID) { dossiersLies(activiteId: $a, perimetreId: $p) { id nom disponible } }`
const CONTENU = `query ($id: ID!, $c: [String!]!) {
  contenuDossierLie(id: $id, chemin: $c) { complet elements { elementId nom dossier taille apercu lienWeb } }
}`
const PARCOURIR = `query ($c: [String!]!) { parcourirEspaceFichiers(emplacement: "bibliotheque", chemin: $c) { complet elements { nom dossier } } }`

async function lier(chemin: string[], perimetreId: string | null) {
  const r = await executer(ids.admin, LIER, {
    a: ids.activite,
    p: perimetreId,
    c: chemin,
  })
  expect(r.errors).toBeUndefined()
  return (r.data as { lierDossier: { id: string } }).lierDossier.id
}

async function connecter() {
  await prisma.connexionFichiers.upsert({
    where: { organisationId: ids.org },
    create: {
      organisationId: ids.org,
      fournisseur: 'SHAREPOINT',
      compte: 'Coordination',
      jeton: 'jeton-de-test',
      connecteParId: ids.admin,
    },
    update: { etat: 'ACTIVE' },
  })
}

// ── Route d'aperçu ───────────────────────────────────────────────────────────

let serveur: Server
let origine = ''

/** Relaie l'aperçu avec la session désignée par un en-tête de test. */
async function apercu(
  userId: string | null,
  dossier: string,
  chemin: string,
  extra = ''
) {
  return fetch(
    `${origine}/medias/espace-fichiers/apercu?dossier=${dossier}&chemin=${encodeURIComponent(chemin)}${extra}`,
    { headers: userId === null ? {} : { 'x-test-personne': userId } }
  )
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
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug,
        nom: 'Rencontres',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Rencontres 2027',
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
        statut: 'PREPARATION',
      },
    })
  ).id
  for (const cle of ['natation', 'basket'] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom: cle,
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    ).id
  }
  for (const [cle, role, organisationId] of [
    ['admin', 'ADMIN', ids.org],
    ['adminActivite', 'MEMBRE', ids.org],
    ['nageuse', 'MEMBRE', ids.org],
    ['basketteur', 'MEMBRE', ids.org],
    ['membre', 'MEMBRE', ids.org],
    ['externe', 'ADMIN', ids.orgAutre],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle.toLowerCase()}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId, role } },
      },
    })
  }
  await prisma.adminActivite.create({
    data: {
      userId: ids.adminActivite,
      activiteId: ids.activite,
      organisationId: ids.org,
    },
  })
  for (const [userId, perimetreId] of [
    [ids.nageuse, ids.natation],
    [ids.basketteur, ids.basket],
  ] as const) {
    await prisma.affectation.create({
      data: { userId, perimetreId, editionId: ids.edition },
    })
  }

  const app = express()
  routesEspaceFichiers(
    app,
    req =>
      buildContext(
        '127.0.0.1',
        req.get('x-test-personne') ?? null,
        req.get('x-test-organisation') ?? slug
      ),
    'http://localhost:5305'
  )
  serveur = app.listen(0)
  origine = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`
})

afterAll(async () => {
  remplacerEspacePourLesTests(null)
  serveur.close()
  await prisma.droitRedaction.deleteMany({ where: { organisationId: ids.org } })
  await prisma.fiche.updateMany({
    where: { organisationId: ids.org },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.dossierLie.deleteMany({
    where: { organisationId: { in: [ids.org, ids.orgAutre] } },
  })
  await prisma.connexionFichiers.deleteMany({
    where: { organisationId: { in: [ids.org, ids.orgAutre] } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
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

describe('connexion', () => {
  it('se lit par les admins de l’organisation seulement', async () => {
    const r = await executer(ids.admin, ESPACE_FICHIERS)
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      espaceFichiers: {
        fournisseursDisponibles: ['SHAREPOINT'],
        connexion: null,
      },
    })
    for (const qui of [ids.adminActivite, ids.nageuse]) {
      expect(code(await executer(qui, ESPACE_FICHIERS))).toBe('FORBIDDEN')
    }
  })

  it('refuse de lier un dossier sans espace connecté', async () => {
    const r = await executer(ids.admin, LIER, {
      a: ids.activite,
      p: ids.natation,
      c: ['Natation'],
    })
    expect(code(r)).toBe('ESPACE_FICHIERS_INDISPONIBLE')
  })

  it('ne propose que les dossiers pour choisir un lien', async () => {
    await connecter()
    const r = await executer(ids.admin, PARCOURIR, { c: [] })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      parcourirEspaceFichiers: {
        complet: true,
        elements: ['Basket', 'Commun', 'Natation', 'RH'].map(nom => ({
          nom,
          dossier: true,
        })),
      },
    })
    const fichiers = await executer(ids.admin, PARCOURIR, { c: ['Natation'] })
    expect(fichiers.data).toEqual({
      parcourirEspaceFichiers: {
        complet: true,
        elements: [{ nom: 'Archives', dossier: true }],
      },
    })
  })
})

describe('dossiers liés', () => {
  beforeAll(async () => {
    await connecter()
    ids.dossierNatation = await lier(['Natation'], ids.natation)
    ids.dossierBasket = await lier(['Basket'], ids.basket)
    ids.dossierCommun = await lier(['Commun'], null)
  })

  it('ne se lient que par un admin de l’organisation, dans son organisation', async () => {
    const variables = { a: ids.activite, p: ids.natation, c: ['RH'] }
    for (const [qui, organisation] of [
      [ids.adminActivite, slug],
      [ids.nageuse, slug],
      [ids.externe, slugAutre],
    ] as const) {
      expect(code(await executer(qui, LIER, variables, organisation))).toBe(
        'FORBIDDEN'
      )
    }
    expect(await prisma.dossierLie.count({ where: { element: 'd-rh' } })).toBe(
      0
    )
  })

  it('refuse une bibliothèque entière, un fichier ou un chemin qui sort de sa base', async () => {
    const racine = await executer(ids.admin, LIER, {
      a: ids.activite,
      p: null,
      c: [],
    })
    expect(code(racine)).toBe('SAISIE_INVALIDE')
    const fichier = await executer(ids.admin, LIER, {
      a: ids.activite,
      p: null,
      c: ['Natation', 'Plan.pdf'],
    })
    expect(code(fichier)).toBe('SAISIE_INVALIDE')
    const sortie = await executer(ids.admin, LIER, {
      a: ids.activite,
      p: null,
      c: ['Natation', '..', 'RH'],
    })
    expect(code(sortie)).toBe('SAISIE_INVALIDE')
  })

  it('garde un seul lien pour le même dossier et le même périmètre', async () => {
    expect(await lier(['Natation'], ids.natation)).toBe(ids.dossierNatation)
  })

  it('ne crée qu’un lien pour deux demandes simultanées, même sans périmètre', async () => {
    const [a, b] = await Promise.all([lier(['RH'], null), lier(['RH'], null)])
    expect(a).toBe(b)
    expect(await prisma.dossierLie.count({ where: { element: 'd-rh' } })).toBe(
      1
    )
    await prisma.dossierLie.deleteMany({ where: { element: 'd-rh' } })
  })

  it('signale un dossier lié aux seules personnes qui le lisent', async () => {
    const changement = (perimetreId: string | null) => ({
      entite: 'FICHIERS' as const,
      organisationId: ids.org,
      activiteId: ids.activite,
      perimetreId,
    })
    const recoit = async (qui: string, c: Parameters<typeof peutRecevoir>[1]) =>
      peutRecevoir(await buildContext('127.0.0.1', qui, slug), c)
    expect(await recoit(ids.nageuse, changement(ids.natation))).toBe(true)
    expect(await recoit(ids.basketteur, changement(ids.natation))).toBe(false)
    expect(await recoit(ids.basketteur, changement(null))).toBe(true)
    // La connexion, sans activité, ne va qu'aux admins de l'organisation.
    const connexion = { entite: 'FICHIERS' as const, organisationId: ids.org }
    expect(await recoit(ids.admin, connexion)).toBe(true)
    expect(await recoit(ids.adminActivite, connexion)).toBe(false)
  })

  it('se lisent comme les fiches du périmètre', async () => {
    const lus = async (qui: string, p: string | null = null) => {
      const r = await executer(qui, DOSSIERS, { a: ids.activite, p })
      expect(r.errors).toBeUndefined()
      return (r.data as { dossiersLies: { nom: string }[] }).dossiersLies
        .map(d => d.nom)
        .sort()
    }
    expect(await lus(ids.nageuse)).toEqual(['Commun', 'Natation'])
    expect(await lus(ids.basketteur)).toEqual(['Basket', 'Commun'])
    expect(await lus(ids.adminActivite)).toEqual([
      'Basket',
      'Commun',
      'Natation',
    ])
    expect(await lus(ids.adminActivite, ids.basket)).toEqual([
      'Basket',
      'Commun',
    ])
    // Une personne qui ne voit pas l'activité reçoit un refus.
    expect(
      code(await executer(ids.membre, DOSSIERS, { a: ids.activite }))
    ).toBe('FORBIDDEN')
  })

  it('listent leur contenu, dossiers d’abord, avec le format de la liseuse', async () => {
    const r = await executer(ids.nageuse, CONTENU, {
      id: ids.dossierNatation,
      c: [],
    })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({
      contenuDossierLie: {
        complet: true,
        elements: [
          {
            elementId: 'd-archives',
            nom: 'Archives',
            dossier: true,
            taille: null,
            apercu: 'AUCUN',
            lienWeb: 'https://exemple.invalid/d-archives',
          },
          {
            elementId: 'f-plan',
            nom: 'Plan.pdf',
            dossier: false,
            taille: 19,
            apercu: 'PDF',
            lienWeb: 'https://exemple.invalid/f-plan',
          },
        ],
      },
    })
    const sous = await executer(ids.nageuse, CONTENU, {
      id: ids.dossierNatation,
      c: ['Archives'],
    })
    expect(
      (sous.data as { contenuDossierLie: { elements: { apercu: string }[] } })
        .contenuDossierLie.elements[0]?.apercu
    ).toBe('PDF_CONVERTI')
    const commun = await executer(ids.basketteur, CONTENU, {
      id: ids.dossierCommun,
      c: [],
    })
    expect(
      (
        commun.data as {
          contenuDossierLie: { elements: { nom: string; apercu: string }[] }
        }
      ).contenuDossierLie.elements.map(e => [e.nom, e.apercu])
    ).toEqual([
      ['Charte.md', 'MARKDOWN'],
      ['logo.svg', 'AUCUN'],
      ['page.html', 'AUCUN'],
    ])
  })

  it('refusent un dossier d’un autre périmètre, d’une autre organisation, ou un chemin qui en sort', async () => {
    expect(
      code(
        await executer(ids.nageuse, CONTENU, { id: ids.dossierBasket, c: [] })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          ids.externe,
          CONTENU,
          { id: ids.dossierNatation, c: [] },
          slugAutre
        )
      )
    ).toBe('FORBIDDEN')
    for (const c of [['..'], ['..', 'RH'], ['Archives/..'], ['.']]) {
      expect(
        code(
          await executer(ids.nageuse, CONTENU, { id: ids.dossierNatation, c })
        )
      ).toBe('SAISIE_INVALIDE')
    }
  })
})

describe('aperçu d’un document', () => {
  it('relaie un fichier du dossier lié, sans cache et sans script', async () => {
    const r = await apercu(ids.nageuse, ids.dossierNatation, 'Plan.pdf')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(r.headers.get('content-disposition')).toMatch(/^inline;/)
    expect(r.headers.get('cache-control')).toBe('private, no-store')
    expect(r.headers.get('content-security-policy')).toContain('sandbox')
    expect(await r.text()).toBe('%PDF plan du bassin')
  })

  it('convertit un document bureautique en PDF', async () => {
    const r = await apercu(
      ids.nageuse,
      ids.dossierNatation,
      'Archives/Ancien.docx'
    )
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(r.headers.get('content-disposition')).toContain('Ancien.docx.pdf')
    expect(await r.text()).toBe('%PDF converti : ancien')
  })

  it('sert le HTML et le SVG en pièce à télécharger, jamais à afficher', async () => {
    for (const nom of ['page.html', 'logo.svg']) {
      const r = await apercu(ids.nageuse, ids.dossierCommun, nom)
      expect(r.status).toBe(200)
      expect(r.headers.get('content-type')).toBe('application/octet-stream')
      expect(r.headers.get('content-disposition')).toMatch(/^attachment;/)
      await r.body?.cancel()
    }
    const md = await apercu(ids.nageuse, ids.dossierCommun, 'Charte.md')
    expect(md.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    await md.body?.cancel()
  })

  it('refuse de la même façon un fichier absent, illisible ou hors du dossier', async () => {
    const refus = [
      await apercu(ids.nageuse, ids.dossierBasket, 'Equipes.txt'),
      await apercu(ids.nageuse, ids.dossierNatation, 'Absent.pdf'),
      await apercu(ids.nageuse, ids.dossierNatation, '../RH/Salaires.txt'),
      await apercu(ids.nageuse, ids.dossierNatation, 'Archives'),
      await apercu(ids.membre, ids.dossierCommun, 'Charte.md'),
    ]
    for (const r of refus) {
      expect(r.status).toBe(404)
      await r.body?.cancel()
    }
    const anonyme = await apercu(null, ids.dossierNatation, 'Plan.pdf')
    expect(anonyme.status).toBe(401)
    await anonyme.body?.cancel()
  })
})

// ── Ressources liées à une fiche ─────────────────────────────────────────────

const LIER_RESSOURCE = `mutation ($f: ID!, $d: ID!, $c: [String!]!) {
  lierRessourceFiche(ficheId: $f, dossierLieId: $d, chemin: $c) { id nom type apercu existe lienWeb chemin dossierLie { nom } }
}`
const DELIER_RESSOURCE = `mutation ($id: ID!) { delierRessourceFiche(id: $id) }`
const RESSOURCES = `query ($s: String!, $a: ID) { fiche(slug: $s, activiteId: $a) { ressources { id nom type existe } } }`

interface Ressource {
  id: string
  nom: string
  type: string
  apercu: string
  existe: boolean | null
  lienWeb: string | null
  chemin: string[]
  dossierLie: { nom: string }
}

const lue = (r: Awaited<ReturnType<typeof executer>>) =>
  (r.data as { lierRessourceFiche: Ressource }).lierRessourceFiche

async function creerFiche(slugFiche: string, perimetreId: string | null) {
  const fiche = await prisma.fiche.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      slug: slugFiche,
      perimetreId,
    },
  })
  const version = await prisma.ficheVersion.create({
    data: {
      ficheId: fiche.id,
      titre: slugFiche,
      contenu: 'Contenu.',
      empreinte: 'e'.repeat(64),
      source: 'APP',
    },
  })
  await prisma.fiche.update({
    where: { id: fiche.id },
    data: { versionCouranteId: version.id },
  })
  return fiche.id
}

async function ressourcesLues(qui: string, slugFiche: string) {
  const r = await executer(qui, RESSOURCES, { s: slugFiche, a: ids.activite })
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      fiche: { ressources: { nom: string; existe: boolean | null }[] }
    }
  ).fiche.ressources
}

describe('ressources liées à une fiche', () => {
  const ficheNatation = `natation-${s}`
  const ficheCommune = `commune-${s}`

  beforeAll(async () => {
    ids.ficheNatation = await creerFiche(ficheNatation, ids.natation)
    ids.ficheCommune = await creerFiche(ficheCommune, null)
    await prisma.droitRedaction.create({
      data: {
        organisationId: ids.org,
        userId: ids.nageuse,
        perimetreId: ids.natation,
      },
    })
  })

  it('se lient depuis un dossier du périmètre ou de toute l’activité', async () => {
    const plan = await executer(ids.nageuse, LIER_RESSOURCE, {
      f: ids.ficheNatation,
      d: ids.dossierNatation,
      c: ['Plan.pdf'],
    })
    expect(plan.errors).toBeUndefined()
    expect(lue(plan)).toMatchObject({
      nom: 'Plan.pdf',
      type: 'FICHIER',
      apercu: 'PDF',
      existe: true,
      lienWeb: 'https://exemple.invalid/f-plan',
      chemin: ['Plan.pdf'],
      dossierLie: { nom: 'Natation' },
    })
    const charte = await executer(ids.nageuse, LIER_RESSOURCE, {
      f: ids.ficheNatation,
      d: ids.dossierCommun,
      c: ['Charte.md'],
    })
    expect(charte.errors).toBeUndefined()
    const dossier = await executer(ids.nageuse, LIER_RESSOURCE, {
      f: ids.ficheNatation,
      d: ids.dossierNatation,
      c: [],
    })
    expect(lue(dossier)).toMatchObject({
      nom: 'Natation',
      type: 'DOSSIER',
      apercu: 'AUCUN',
    })
  })

  it('garde un seul lien pour la même ressource', async () => {
    const lier = () =>
      executer(ids.nageuse, LIER_RESSOURCE, {
        f: ids.ficheNatation,
        d: ids.dossierNatation,
        c: ['Plan.pdf'],
      })
    const premier = await lier()
    const second = await lier()
    expect(lue(second).id).toBe(lue(premier).id)
    expect(
      await prisma.ressourceFiche.count({
        where: { ficheId: ids.ficheNatation },
      })
    ).toBe(3)
  })

  it('ne crée qu’une ressource pour deux demandes simultanées', async () => {
    const lier = () =>
      executer(ids.nageuse, LIER_RESSOURCE, {
        f: ids.ficheNatation,
        d: ids.dossierNatation,
        c: ['Archives'],
      })
    const [a, b] = await Promise.all([lier(), lier()])
    expect(a.errors).toBeUndefined()
    expect(b.errors).toBeUndefined()
    expect(lue(a).id).toBe(lue(b).id)
    await prisma.ressourceFiche.delete({ where: { id: lue(a).id } })
  })

  it('refuse un dossier que les lecteurs de la fiche ne lisent pas', async () => {
    // Le dossier du basket n'est pas lisible par les lecteurs de la natation.
    expect(
      code(
        await executer(ids.adminActivite, LIER_RESSOURCE, {
          f: ids.ficheNatation,
          d: ids.dossierBasket,
          c: ['Equipes.txt'],
        })
      )
    ).toBe('FORBIDDEN')
    // Une fiche commune n'admet que les dossiers de toute l'activité.
    expect(
      code(
        await executer(ids.adminActivite, LIER_RESSOURCE, {
          f: ids.ficheCommune,
          d: ids.dossierNatation,
          c: ['Plan.pdf'],
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('refuse une personne sans droit de rédaction, un chemin invalide ou un élément absent', async () => {
    expect(
      code(
        await executer(ids.basketteur, LIER_RESSOURCE, {
          f: ids.ficheNatation,
          d: ids.dossierCommun,
          c: ['Charte.md'],
        })
      )
    ).toBe('FORBIDDEN')
    for (const c of [['..', 'RH'], ['Absent.pdf']]) {
      expect(
        code(
          await executer(ids.nageuse, LIER_RESSOURCE, {
            f: ids.ficheNatation,
            d: ids.dossierNatation,
            c,
          })
        )
      ).toBe('SAISIE_INVALIDE')
    }
    const ressource = await prisma.ressourceFiche.findFirstOrThrow({
      where: { ficheId: ids.ficheNatation },
    })
    expect(
      code(
        await executer(ids.basketteur, DELIER_RESSOURCE, { id: ressource.id })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          ids.externe,
          DELIER_RESSOURCE,
          { id: ressource.id },
          slugAutre
        )
      )
    ).toBe('FORBIDDEN')
  })

  it('se lisent avec la fiche, et suivent son périmètre', async () => {
    expect(
      (await ressourcesLues(ids.nageuse, ficheNatation)).map(r => r.nom)
    ).toEqual(['Plan.pdf', 'Charte.md', 'Natation'])
    // Déplacée au basket, la fiche ne montre plus les ressources du dossier de la natation.
    await prisma.fiche.update({
      where: { id: ids.ficheNatation },
      data: { perimetreId: ids.basket },
    })
    expect(
      (await ressourcesLues(ids.adminActivite, ficheNatation)).map(r => r.nom)
    ).toEqual(['Charte.md'])
    await prisma.fiche.update({
      where: { id: ids.ficheNatation },
      data: { perimetreId: ids.natation },
    })
  })

  it('se retirent par une personne qui rédige la fiche', async () => {
    const charte = await prisma.ressourceFiche.findFirstOrThrow({
      where: { ficheId: ids.ficheNatation, nom: 'Charte.md' },
    })
    const r = await executer(ids.nageuse, DELIER_RESSOURCE, { id: charte.id })
    expect(r.errors).toBeUndefined()
    expect(
      (await ressourcesLues(ids.nageuse, ficheNatation)).map(r => r.nom)
    ).toEqual(['Plan.pdf', 'Natation'])
  })
})

describe('déconnexion', () => {
  it('efface la connexion et garde les dossiers liés, indisponibles', async () => {
    const r = await executer(
      ids.admin,
      'mutation { deconnecterEspaceFichiers }'
    )
    expect(r.errors).toBeUndefined()
    expect(
      await prisma.connexionFichiers.count({
        where: { organisationId: ids.org },
      })
    ).toBe(0)
    const lus = await executer(ids.nageuse, DOSSIERS, { a: ids.activite })
    expect(lus.data).toEqual({
      dossiersLies: [
        { id: ids.dossierCommun, nom: 'Commun', disponible: false },
        { id: ids.dossierNatation, nom: 'Natation', disponible: false },
      ],
    })
    expect(
      code(
        await executer(ids.nageuse, CONTENU, {
          id: ids.dossierNatation,
          c: [],
        })
      )
    ).toBe('ESPACE_FICHIERS_INDISPONIBLE')
    const r2 = await apercu(ids.nageuse, ids.dossierNatation, 'Plan.pdf')
    expect(r2.status).toBe(409)
    await r2.body?.cancel()
    // Une ressource liée reste, avec un état inconnu.
    expect(await ressourcesLues(ids.nageuse, `natation-${s}`)).toMatchObject([
      {
        nom: 'Plan.pdf',
        type: 'FICHIER',
        existe: null,
      },
      {
        nom: 'Natation',
        type: 'DOSSIER',
        existe: null,
      },
    ])
  })

  it('retire un dossier lié', async () => {
    const r = await executer(
      ids.admin,
      'mutation ($id: ID!) { delierDossier(id: $id) }',
      {
        id: ids.dossierBasket,
      }
    )
    expect(r.errors).toBeUndefined()
    expect(
      await prisma.dossierLie.count({ where: { id: ids.dossierBasket } })
    ).toBe(0)
  })
})
