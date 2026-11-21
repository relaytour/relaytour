import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ApolloServer } from '@apollo/server'
import { Prisma, prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { contexteDeJetonAcces } from '../contexte-jeton.ts'
import { composer } from '../courriel/messages.ts'
import { remplacerEspacePourLesTests } from '../espace-fichiers/index.ts'
import { espaceEnMemoire } from '../espace-fichiers/memoire.ts'
import { reglerExtractionPourLesTests } from '../espace-fichiers/texte.ts'
import type { EspaceFichiers } from '../espace-fichiers/types.ts'
import { creerJetonAcces, finDuJeton } from '../lib/jetons-acces.ts'
import { journal } from '../lib/journal.ts'
import { documentWord } from '../test/docx.ts'
import { documentPdf } from '../test/pdf.ts'

import { schema } from './index.ts'
import { TEXTES_PAR_HEURE } from './texte-document.ts'

// Les mails des jetons se gardent ici : rien ne part vers la file.
const enFile = vi.hoisted(
  () => [] as { sorte: string; cible: unknown; options: unknown }[]
)
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: unknown, options: unknown = {}) => {
    enFile.push({ sorte, cible, options })
    return Promise.resolve(true)
  },
}))

// Texte d'un document d'un dossier lié (ADR 0072). Chaque point de la revue de
// sécurité de l'ADR se prouve ici par le refus (invariant 11). Le fichier crée sa
// propre organisation et remplace le fournisseur par un espace en mémoire.

const s = randomUUID().slice(0, 8)
const slug = `texte-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
// Une adresse propre au fichier : les refus de jetons se comptent par adresse.
const ip = `10.72.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const ids = {
  org: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  admin: '',
  nageuse: '', // référente de la natation
  basketteur: '', // référent du basket
  lectrice: '', // référente de la natation, pour la limite de débit
  robot: '',
  dossierNatation: '',
  ficheNatation: '',
  ressourceCompteRendu: '',
}

const MO = 1024 * 1024
const TEXTE_SECRET = 'Contenu confidentiel du bassin'
const PDF = documentPdf(['Plan du bassin', 'Horaires des lignes'])

// Un téléchargement sans fin : le serveur doit le couper de lui-même.
const tire = { morceaux: 0 }
function fluxSansFin(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    pull(controleur) {
      tire.morceaux++
      controleur.enqueue(new Uint8Array(MO).fill(97))
    },
  })
}

const BASE = espaceEnMemoire([
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
            {
              id: 'f-notes',
              nom: 'Notes.txt',
              contenu: `${TEXTE_SECRET}  \r\nLigne\u0007 deux\u0000\n`,
            },
            { id: 'f-plan', nom: 'Plan.pdf', contenu: PDF },
            {
              id: 'f-cr',
              nom: 'CR.docx',
              contenu: documentWord('Compte rendu', ['Ordre du **jour**.']),
            },
            { id: 'f-budget', nom: 'Budget.xlsx', contenu: 'binaire' },
            { id: 'f-gros', nom: 'Gros.txt', contenu: 'petit en réalité' },
            { id: 'f-sans-taille', nom: 'Sans taille.txt', contenu: 'x' },
            { id: 'f-menteur', nom: 'Menteur.txt', contenu: 'x' },
            {
              id: 'f-long',
              nom: 'Long.md',
              contenu: 'a'.repeat(200_010),
            },
            {
              id: 'd-export',
              nom: 'Fiches Relaytour',
              enfants: [
                { id: 'f-exportee', nom: 'fiche.md', contenu: 'exportée' },
              ],
            },
          ],
        },
        {
          id: 'd-basket',
          nom: 'Basket',
          enfants: [{ id: 'f-basket', nom: 'Equipes.txt', contenu: 'basket' }],
        },
      ],
    },
  },
])

// Le fournisseur annonce une taille trop grande pour « Gros.txt », aucune taille
// pour « Sans taille.txt », et une taille fausse pour « Menteur.txt ».
const ESPACE: EspaceFichiers = {
  ...BASE,
  element: async p => {
    const e = await BASE.element(p)
    if (e === null) return null
    if (e.nom === 'Gros.txt') return { ...e, taille: 11 * MO }
    if (e.nom === 'Sans taille.txt') return { ...e, taille: null }
    if (e.nom === 'Menteur.txt') return { ...e, taille: 100 }
    return e
  },
  ouvrir: async (p, options) => {
    const nom = p.chemin[p.chemin.length - 1]
    if (nom === 'Sans taille.txt') return { flux: fluxSansFin(), taille: null }
    if (nom === 'Menteur.txt') return { flux: fluxSansFin(), taille: 100 }
    return BASE.ouvrir(p, options)
  },
}

type Qui = { session: string } | { jeton: string }

async function executer(
  qui: Qui,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const contextValue =
    'session' in qui
      ? await buildContext('127.0.0.1', qui.session, slug)
      : await contexteDeJetonAcces(ip, qui.jeton, null)
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const TEXTE = `query ($d: ID!, $c: [String!]!, $r: ID) {
  texteDocument(dossierLieId: $d, chemin: $c, ressourceId: $r) { nom format texte caracteres tronque }
}`

interface Lu {
  nom: string
  format: string
  texte: string
  caracteres: number
  tronque: boolean
}

const lire = (qui: Qui, chemin: string[], ressourceId?: string) =>
  executer(qui, TEXTE, {
    d: ids.dossierNatation,
    c: chemin,
    r: ressourceId ?? null,
  })

const texteDe = (r: Awaited<ReturnType<typeof executer>>) =>
  (r.data as { texteDocument: Lu | null } | null | undefined)?.texteDocument

const CREER = `mutation ($nom: String!, $ld: Boolean) {
  creerJetonAcces(nom: $nom, portee: LECTURE, lectureDocuments: $ld) {
    jeton jetonAcces { id lectureDocuments }
  }
}`

async function creerJeton(userId: string, lectureDocuments: boolean | null) {
  const r = await executer({ session: userId }, CREER, {
    nom: `documents ${String(lectureDocuments)}`,
    ld: lectureDocuments,
  })
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      creerJetonAcces: {
        jeton: string
        jetonAcces: { id: string; lectureDocuments: boolean }
      }
    }
  ).creerJetonAcces
}

beforeAll(async () => {
  await apollo.start()
  remplacerEspacePourLesTests(() => ESPACE)
  ids.org = (
    await prisma.organisation.create({
      data: {
        slug,
        nom: `Organisation ${slug}`,
        configuration: {},
        apiActivee: true,
      },
    })
  ).id
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
  for (const [cle, role, robot] of [
    ['admin', 'ADMIN', false],
    ['nageuse', 'MEMBRE', false],
    ['basketteur', 'MEMBRE', false],
    ['lectrice', 'MEMBRE', false],
    ['robot', 'MEMBRE', true],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        robot,
        appartenances: { create: { organisationId: ids.org, role } },
      },
    })
  }
  for (const [userId, perimetreId] of [
    [ids.nageuse, ids.natation],
    [ids.lectrice, ids.natation],
    [ids.robot, ids.natation],
    [ids.basketteur, ids.basket],
  ] as const) {
    await prisma.affectation.create({
      data: { userId, perimetreId, editionId: ids.edition },
    })
  }
  await prisma.connexionFichiers.create({
    data: {
      organisationId: ids.org,
      fournisseur: 'SHAREPOINT',
      compte: 'Coordination',
      jeton: 'jeton-de-test',
      connecteParId: ids.admin,
    },
  })
  const lien = await executer(
    { session: ids.admin },
    `mutation ($a: ID!, $p: ID!) {
      lierDossier(activiteId: $a, lecteurs: { touteActivite: false, perimetreIds: [$p], groupes: [] }, emplacement: "bibliotheque", chemin: ["Natation"]) { id }
    }`,
    { a: ids.activite, p: ids.natation }
  )
  expect(lien.errors).toBeUndefined()
  ids.dossierNatation = (
    lien.data as { lierDossier: { id: string } }
  ).lierDossier.id
  // Le dossier d'export se trouve sous le dossier lié : il ne s'y lit jamais.
  await prisma.connexionFichiers.update({
    where: { organisationId: ids.org },
    data: { exportEmplacement: 'bibliotheque', exportElement: 'd-export' },
  })
  // La fiche de la natation concerne aussi le basket : son référent la lit.
  const fiche = await prisma.fiche.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      slug: `natation-${s}`,
      perimetreId: ids.natation,
    },
  })
  ids.ficheNatation = fiche.id
  const version = await prisma.ficheVersion.create({
    data: {
      ficheId: fiche.id,
      titre: 'Natation',
      contenu: 'Contenu.',
      empreinte: 'e'.repeat(64),
      source: 'APP',
    },
  })
  await prisma.fiche.update({
    where: { id: fiche.id },
    data: { versionCouranteId: version.id },
  })
  await prisma.ficheConnexe.create({
    data: { ficheId: fiche.id, perimetreId: ids.basket },
  })
  ids.ressourceCompteRendu = (
    await prisma.ressourceFiche.create({
      data: {
        organisationId: ids.org,
        ficheId: fiche.id,
        dossierLieId: ids.dossierNatation,
        chemin: ['CR.docx'],
        empreinteChemin: createHash('sha256').update('CR.docx').digest('hex'),
        type: 'FICHIER',
        nom: 'CR.docx',
        ouverteAuxLecteurs: true,
      },
    })
  ).id
})

afterAll(async () => {
  remplacerEspacePourLesTests(null)
  reglerExtractionPourLesTests(null)
  await prisma.jetonAcces.deleteMany({ where: { organisationId: ids.org } })
  await prisma.ressourceFiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.ficheConnexe.deleteMany({
    where: { ficheId: ids.ficheNatation },
  })
  await prisma.fiche.updateMany({
    where: { organisationId: ids.org },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: { organisationId: ids.org } })
  await prisma.dossierLie.deleteMany({ where: { organisationId: ids.org } })
  await prisma.connexionFichiers.deleteMany({
    where: { organisationId: ids.org },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('lecture par une session', () => {
  it('rend le texte normalisé d’un document que la personne lit', async () => {
    const r = await lire({ session: ids.nageuse }, ['Notes.txt'])
    expect(r.errors).toBeUndefined()
    expect(texteDe(r)).toEqual({
      nom: 'Notes.txt',
      format: 'TEXTE',
      texte: `${TEXTE_SECRET}\nLigne deux\n`,
      caracteres: TEXTE_SECRET.length + 12,
      tronque: false,
    })
  })

  it('convertit un document Word et lit un PDF', async () => {
    const word = texteDe(await lire({ session: ids.nageuse }, ['CR.docx']))
    expect(word?.format).toBe('WORD')
    expect(word?.texte).toContain('# Compte rendu')
    expect(word?.texte).toContain('Ordre du **jour**.')
    const pdf = texteDe(await lire({ session: ids.nageuse }, ['Plan.pdf']))
    expect(pdf).toMatchObject({
      format: 'PDF',
      texte: 'Plan du bassin\n\nHoraires des lignes\n',
      tronque: false,
    })
  })

  it('rend un texte de plus de 200 000 caractères tronqué', async () => {
    const long = texteDe(await lire({ session: ids.nageuse }, ['Long.md']))
    expect(long?.tronque).toBe(true)
    expect(long?.texte.length).toBe(200_000)
    // La longueur d'origine compte la fin de ligne que la normalisation ajoute.
    expect(long?.caracteres).toBe(200_011)
  })
})

describe('dimension du jeton', () => {
  it('se crée décochée par défaut, et se lit sur le jeton', async () => {
    const parDefaut = await creerJeton(ids.nageuse, null)
    expect(parDefaut.jetonAcces.lectureDocuments).toBe(false)
    const avec = await creerJeton(ids.nageuse, true)
    expect(avec.jetonAcces.lectureDocuments).toBe(true)
    const bornes = await executer(
      { jeton: avec.jeton },
      '{ jetonCourant { lectureDocuments } }'
    )
    expect(bornes.data).toEqual({ jetonCourant: { lectureDocuments: true } })
  })

  it('un jeton sans la dimension reçoit PORTEE_INSUFFISANTE, même pour un document qu’il nomme déjà', async () => {
    const { jeton } = await creerJeton(ids.nageuse, false)
    // Le jeton lit le nom du fichier dans le dossier lié.
    const contenu = await executer(
      { jeton },
      `query ($id: ID!) { contenuDossierLie(id: $id, chemin: []) { elements { nom } } }`,
      { id: ids.dossierNatation }
    )
    expect(contenu.errors).toBeUndefined()
    expect(JSON.stringify(contenu.data)).toContain('Notes.txt')
    const r = await lire({ jeton }, ['Notes.txt'])
    expect(code(r)).toBe('PORTEE_INSUFFISANTE')
    expect(r.data?.texteDocument ?? null).toBeNull()
    expect(JSON.stringify(r)).not.toContain(TEXTE_SECRET)
    // La réponse ne dit rien du fichier : un fichier absent reçoit la même.
    expect(code(await lire({ jeton }, ['Absent.txt']))).toBe(
      'PORTEE_INSUFFISANTE'
    )
  })

  it('un jeton avec la dimension lit le texte, avec les droits de sa personne', async () => {
    const { jeton } = await creerJeton(ids.nageuse, true)
    expect(texteDe(await lire({ jeton }, ['Notes.txt']))?.texte).toContain(
      TEXTE_SECRET
    )
    // La dimension ne crée aucun droit : le basketteur ne lit pas la natation.
    const autre = await creerJeton(ids.basketteur, true)
    const r = await lire({ jeton: autre.jeton }, ['Notes.txt'])
    expect(r.errors).toBeUndefined()
    expect(texteDe(r)).toBeNull()
  })

  it('le mail de création indique la dimension accordée', async () => {
    enFile.length = 0
    const { jetonAcces } = await creerJeton(ids.nageuse, true)
    const message = await composer(prisma, {
      sorte: 'jeton-cree',
      userId: ids.nageuse,
      organisationId: ids.org,
      jetonAccesId: jetonAcces.id,
    })
    expect(message?.texte).toContain('lecture du texte des documents')
    const sans = await creerJeton(ids.nageuse, false)
    const ordinaire = await composer(prisma, {
      sorte: 'jeton-cree',
      userId: ids.nageuse,
      organisationId: ids.org,
      jetonAccesId: sans.jetonAcces.id,
    })
    expect(ordinaire?.texte).not.toContain('lecture du texte des documents')
  })
})

describe('jeton de robot', () => {
  it('ne reçoit jamais la dimension à la création', async () => {
    // L'API ne propose pas la dimension pour un robot.
    const r = await executer(
      { session: ids.admin },
      `mutation ($r: ID!) { creerJetonRobot(robotId: $r, nom: "robot", portee: LECTURE, lectureDocuments: true) { jeton } }`,
      { r: ids.robot }
    )
    expect(code(r)).toBe('GRAPHQL_VALIDATION_FAILED')
    // Le serveur la refuse aussi en dessous de l'API.
    await expect(
      creerJetonAcces({
        organisationId: ids.org,
        userId: ids.robot,
        creeParId: ids.admin,
        nom: 'robot',
        portee: 'LECTURE',
        activiteIds: null,
        expireLe: finDuJeton(null),
        lectureDocuments: true,
      })
    ).rejects.toMatchObject({ extensions: { code: 'SAISIE_INVALIDE' } })
    expect(
      await prisma.jetonAcces.count({
        where: { userId: ids.robot, lectureDocuments: true },
      })
    ).toBe(0)
  })

  it('ne la reçoit pas non plus par une modification de sa ligne', async () => {
    const { jeton, ligne } = await creerJetonAcces({
      organisationId: ids.org,
      userId: ids.robot,
      creeParId: ids.admin,
      nom: 'robot',
      portee: 'LECTURE',
      activiteIds: null,
      expireLe: finDuJeton(null),
    })
    await prisma.jetonAcces.update({
      where: { id: ligne.id },
      data: { lectureDocuments: true },
    })
    const ctx = await contexteDeJetonAcces(ip, jeton, null)
    expect(ctx.jeton?.lectureDocuments).toBe(false)
    expect(code(await lire({ jeton }, ['Notes.txt']))).toBe(
      'PORTEE_INSUFFISANTE'
    )
  })
})

describe('droits de la liseuse', () => {
  it('une personne qui ne lit pas le dossier lié reçoit null, comme pour un fichier absent', async () => {
    const refus = await lire({ session: ids.basketteur }, ['Notes.txt'])
    const absent = await lire({ session: ids.nageuse }, ['Absent.txt'])
    for (const r of [refus, absent]) {
      expect(r.errors).toBeUndefined()
      expect(r.data).toEqual({ texteDocument: null })
    }
    // Un dossier ne rend pas de texte non plus.
    expect(
      (await lire({ session: ids.nageuse }, ['Fiches Relaytour'])).data
    ).toEqual({ texteDocument: null })
  })

  it('un document lié ouvert se lit par sa fiche, et un autre fichier du même dossier ne se lit pas', async () => {
    const ouvert = await lire(
      { session: ids.basketteur },
      ['CR.docx'],
      ids.ressourceCompteRendu
    )
    expect(texteDe(ouvert)?.texte).toContain('Compte rendu')
    const voisin = await lire(
      { session: ids.basketteur },
      ['Notes.txt'],
      ids.ressourceCompteRendu
    )
    expect(voisin.errors).toBeUndefined()
    expect(voisin.data).toEqual({ texteDocument: null })
    // Sans le document lié, le même fichier reste fermé.
    expect((await lire({ session: ids.basketteur }, ['CR.docx'])).data).toEqual(
      { texteDocument: null }
    )
  })

  it('un chemin qui sort du dossier lié, ou qui entre dans le dossier d’export, reçoit null', async () => {
    for (const chemin of [
      ['..', 'Basket', 'Equipes.txt'],
      ['.', 'Notes.txt'],
      ['Natation/Notes.txt'],
      [],
      ['Fiches Relaytour', 'fiche.md'],
      ['fiches relaytour', 'fiche.md'],
    ]) {
      const r = await lire({ session: ids.nageuse }, chemin)
      expect(r.errors, chemin.join('/')).toBeUndefined()
      expect(r.data, chemin.join('/')).toEqual({ texteDocument: null })
    }
  })

  it('une activité sans le module documents ne rend aucun texte', async () => {
    await prisma.activite.update({
      where: { id: ids.activite },
      data: { modules: ['AGENDA'] },
    })
    try {
      const r = await lire({ session: ids.nageuse }, ['Notes.txt'])
      expect(r.errors).toBeUndefined()
      expect(r.data).toEqual({ texteDocument: null })
    } finally {
      await prisma.activite.update({
        where: { id: ids.activite },
        data: { modules: Prisma.DbNull },
      })
    }
  })
})

describe('format, taille et extraction', () => {
  it('un fichier de plus de 10 Mo et un format non lu reçoivent leur code, sans texte', async () => {
    const gros = await lire({ session: ids.nageuse }, ['Gros.txt'])
    expect(code(gros)).toBe('FICHIER_TROP_LOURD')
    expect(gros.data?.texteDocument ?? null).toBeNull()
    expect(JSON.stringify(gros)).not.toContain('petit en réalité')
    const budget = await lire({ session: ids.nageuse }, ['Budget.xlsx'])
    expect(code(budget)).toBe('FORMAT_NON_LU')
    expect(budget.data?.texteDocument ?? null).toBeNull()
  })

  it('un fichier sans taille, ou à la taille fausse, se coupe à 10 Mo pendant le téléchargement', async () => {
    for (const nom of ['Sans taille.txt', 'Menteur.txt']) {
      tire.morceaux = 0
      const r = await lire({ session: ids.nageuse }, [nom])
      expect(code(r), nom).toBe('FICHIER_TROP_LOURD')
      expect(r.data?.texteDocument ?? null).toBeNull()
      // Le flux ne s'arrête jamais de lui-même : le serveur l'a coupé.
      expect(tire.morceaux).toBeGreaterThan(10)
      expect(tire.morceaux).toBeLessThanOrEqual(12)
    }
  })

  it('une personne sans droit reçoit null pour un fichier trop lourd ou d’un format non lu', async () => {
    for (const nom of ['Gros.txt', 'Budget.xlsx', 'Sans taille.txt']) {
      tire.morceaux = 0
      const r = await lire({ session: ids.basketteur }, [nom])
      expect(r.errors, nom).toBeUndefined()
      expect(r.data, nom).toEqual({ texteDocument: null })
    }
    expect(tire.morceaux).toBe(0)
  })

  it('une extraction trop longue reçoit EXTRACTION_IMPOSSIBLE, sans texte partiel', async () => {
    const dossier = await mkdtemp(join(tmpdir(), 'fil-'))
    const fichier = join(dossier, 'boucle.mjs')
    // Un fil qui commence à répondre, puis ne rend plus jamais la main.
    await writeFile(fichier, 'for (;;) {}\n')
    reglerExtractionPourLesTests({
      delaiMs: 300,
      fichier: pathToFileURL(fichier),
    })
    try {
      const r = await lire({ session: ids.nageuse }, ['Plan.pdf'])
      expect(code(r)).toBe('EXTRACTION_IMPOSSIBLE')
      expect(r.data?.texteDocument ?? null).toBeNull()
    } finally {
      reglerExtractionPourLesTests(null)
      await rm(dossier, { recursive: true, force: true })
    }
  })

  it('un fichier illisible reçoit EXTRACTION_IMPOSSIBLE', async () => {
    const r = await lire({ session: ids.nageuse }, ['Plan.pdf'])
    expect(r.errors).toBeUndefined()
    // Le même nom, avec un contenu qui n'est pas un PDF.
    const faux: EspaceFichiers = {
      ...ESPACE,
      ouvrir: () =>
        Promise.resolve({
          flux: new Blob(['pas un PDF']).stream(),
          taille: 10,
        }),
    }
    remplacerEspacePourLesTests(() => faux)
    try {
      expect(code(await lire({ session: ids.nageuse }, ['Plan.pdf']))).toBe(
        'EXTRACTION_IMPOSSIBLE'
      )
    } finally {
      remplacerEspacePourLesTests(() => ESPACE)
    }
  })
})

describe('limite de débit', () => {
  it('compte ensemble les sessions et les jetons d’une même personne', async () => {
    const { jeton } = await creerJeton(ids.lectrice, true)
    // Un format non lu passe la limite avant d'être refusé : il compte.
    const moitie = TEXTES_PAR_HEURE / 2
    for (let i = 0; i < moitie; i++) {
      expect(code(await lire({ session: ids.lectrice }, ['Budget.xlsx']))).toBe(
        'FORMAT_NON_LU'
      )
      expect(code(await lire({ jeton }, ['Budget.xlsx']))).toBe('FORMAT_NON_LU')
    }
    const session = await lire({ session: ids.lectrice }, ['Notes.txt'])
    expect(code(session)).toBe('LIMITE_DE_DEBIT')
    expect(JSON.stringify(session)).not.toContain(TEXTE_SECRET)
    expect(code(await lire({ jeton }, ['Notes.txt']))).toBe('LIMITE_DE_DEBIT')
    // Une autre personne garde sa propre limite.
    expect(
      texteDe(await lire({ session: ids.nageuse }, ['Notes.txt']))?.texte
    ).toContain(TEXTE_SECRET)
  })
})

describe('journal du serveur', () => {
  it('note chaque lecture par un jeton, sans nom de fichier, chemin ni texte', async () => {
    const { jeton, jetonAcces } = await creerJeton(ids.nageuse, true)
    const appels: unknown[][] = []
    const espions = (['info', 'warn', 'error', 'debug'] as const).map(niveau =>
      vi.spyOn(journal, niveau).mockImplementation((...args: unknown[]) => {
        appels.push(args)
      })
    )
    try {
      expect(texteDe(await lire({ jeton }, ['Notes.txt']))).not.toBeNull()
      expect(texteDe(await lire({ jeton }, ['CR.docx']))).not.toBeNull()
      // Un refus et une session ne notent rien de plus sur le fichier.
      await lire({ jeton }, ['Budget.xlsx'])
      await lire({ session: ids.nageuse }, ['Notes.txt'])
    } finally {
      for (const espion of espions) espion.mockRestore()
    }
    const lectures = appels
      .map(a => a[0] as { evenement?: string })
      .filter(o => o.evenement === 'texte-document-lu')
    expect(lectures).toEqual([
      {
        evenement: 'texte-document-lu',
        jetonId: jetonAcces.id,
        dossierLieId: ids.dossierNatation,
        format: 'TEXTE',
      },
      {
        evenement: 'texte-document-lu',
        jetonId: jetonAcces.id,
        dossierLieId: ids.dossierNatation,
        format: 'WORD',
      },
    ])
    const tout = JSON.stringify(appels)
    for (const interdit of [
      'Notes.txt',
      'CR.docx',
      'Budget.xlsx',
      'Natation',
      TEXTE_SECRET,
      'Compte rendu',
    ]) {
      expect(tout).not.toContain(interdit)
    }
  })
})
