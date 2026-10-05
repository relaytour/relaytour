import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'
import { activiteParDefaut, contexteDeTest } from '../test/contexte.ts'
import { exporterContenu } from '../orga/exporter.ts'
import { assurerOrganisationParDefaut } from '../lib/organisation.ts'
import {
  importerModeles,
  type RapportActivite,
  type RapportImport,
} from '../orga/importer.ts'
import { lireModeles } from '../orga/modeles.ts'

import { schema } from './index.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = { admin: '', redactrice: '', referent: '', autre: '', edition: '' }
const annee = 2900 + Math.floor(Math.random() * 90)
const racine = mkdtempSync(path.join(tmpdir(), 'relaytour-import-'))

function ecrire(chemin: string, contenu: string) {
  mkdirSync(path.dirname(path.join(racine, chemin)), { recursive: true })
  writeFileSync(path.join(racine, chemin), contenu)
}

function ecrirePerimetres(effectifs: { natation?: number; basket?: number }) {
  const ligne = (effectif: number | undefined) =>
    effectif === undefined ? '' : `    effectif: ${effectif}\n`
  ecrire(
    'perimetres.yaml',
    `perimetres:\n  - slug: natation-${s}\n    nom: Natation\n    type: SPORT\n${ligne(effectifs.natation)}  - slug: basket-${s}\n    nom: Basket\n    type: SPORT\n${ligne(effectifs.basket)}`
  )
}

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await contexteDeTest(userId) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}
const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

let ORGANISATION = ''
let SLUG_ORGANISATION = ''

/** Le rapport de l'unique activité du dossier, en disposition plate. */
const activite = (rapport: RapportImport): RapportActivite =>
  rapport.activites[0]!
let ACTIVITE = ''

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  ACTIVITE = await activiteParDefaut()
  await apollo.start()
  // Les tests partagent la base locale : l'organisation importée reprend l'identité
  // déjà en base, pour ne pas la renommer (l'import met la ligne à jour, slug compris).
  await assurerOrganisationParDefaut()
  const organisation = await prisma.organisation.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  })
  SLUG_ORGANISATION = organisation.slug
  ecrire(
    'organisation.yaml',
    `slug: ${organisation.slug}\nnom: ${JSON.stringify(organisation.nom)}\n${organisation.sigle ? `sigle: ${JSON.stringify(organisation.sigle)}\n` : ''}`
  )
  for (const [cle, estAdmin] of [
    ['admin', true],
    ['redactrice', false],
    ['referent', false],
    ['autre', false],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${s}@exemple.fr`,
        name: cle,
        isAdmin: estAdmin,
      },
    })
  }
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        annee,
        nom: `Essai ${s}`,
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id

  ecrirePerimetres({ natation: 2 })
  ecrire(
    `fiches/natation-${s}/piscine-${s}.md`,
    `---\nslug: piscine-${s}\ntitre: Réserver la piscine\n---\n\n## Objectif\n\nRéserver.\n`
  )
  ecrire(
    `fiches/communes/accueil-${s}.md`,
    `---\nslug: accueil-${s}\ntitre: Accueillir\n---\n\n## Objectif\n\nAccueillir.\n`
  )
  ecrire(
    `taches/natation-${s}.yaml`,
    `taches:\n  - modele: piscine\n    titre: Réserver les lignes\n    echeance: J-10\n    fiche: piscine-${s}\n`
  )
})

afterAll(async () => {
  const perimetres = await prisma.perimetre.findMany({
    where: { slug: { endsWith: `-${s}` } },
  })
  const pids = perimetres.map(p => p.id)
  await prisma.tache.deleteMany({ where: { editionId: ids.edition } })
  await prisma.effectifPerimetre.deleteMany({
    where: { OR: [{ editionId: ids.edition }, { perimetreId: { in: pids } }] },
  })
  await prisma.journal.deleteMany({
    where: { acteurId: { in: Object.values(ids) } },
  })
  await prisma.affectation.deleteMany({ where: { editionId: ids.edition } })
  await prisma.fiche.updateMany({
    where: { slug: { endsWith: `-${s}` } },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({ where: { slug: { endsWith: `-${s}` } } })
  await prisma.droitRedaction.deleteMany({
    where: { perimetreId: { in: pids } },
  })
  await prisma.droitRedaction.deleteMany({
    where: { userId: { in: Object.values(ids) } },
  })
  await prisma.perimetre.deleteMany({ where: { id: { in: pids } } })
  await prisma.edition.delete({ where: { id: ids.edition } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('import des modèles', () => {
  it('ne touche à rien en simulation', async () => {
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: SLUG_ORGANISATION,
      annee,
      simulation: true,
    })
    expect(activite(rapport).fiches.creees).toHaveLength(2)
    expect(activite(rapport).effectifs.crees).toEqual([`natation-${s} (2)`])
    expect(
      await prisma.fiche.count({ where: { slug: { endsWith: `-${s}` } } })
    ).toBe(0)
    expect(
      await prisma.effectifPerimetre.count({
        where: { editionId: ids.edition },
      })
    ).toBe(0)
  })

  it('crée périmètres, fiches et tâches, avec l’échéance relative', async () => {
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: SLUG_ORGANISATION,
      annee,
    })
    expect(activite(rapport).perimetres.crees.sort()).toEqual([
      `basket-${s}`,
      `natation-${s}`,
    ])
    const tache = await prisma.tache.findFirstOrThrow({
      where: { editionId: ids.edition, modeleSlug: 'piscine' },
      include: { fiche: true },
    })
    expect(tache.echeance?.toISOString().slice(0, 10)).toBe('2027-08-17')
    expect(tache.fiche?.slug).toBe(`piscine-${s}`)
    const effectifs = await prisma.effectifPerimetre.findMany({
      where: { editionId: ids.edition },
      include: { perimetre: { select: { slug: true } } },
    })
    expect(effectifs.map(e => [e.perimetre.slug, e.effectif])).toEqual([
      [`natation-${s}`, 2],
    ])
  })

  it('ne recrée rien au second import', async () => {
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: SLUG_ORGANISATION,
      annee,
    })
    expect(activite(rapport).fiches.inchangees).toHaveLength(2)
    expect(activite(rapport).effectifs).toEqual({
      crees: [],
      dejaPresents: [`natation-${s}`],
    })
    expect(activite(rapport).taches.dejaPresentes).toEqual([
      `natation-${s}/piscine`,
    ])
  })

  it('ne remplace pas un effectif modifié dans l’application', async () => {
    // L'admin passe l'effectif à 4, puis le dépôt indique 3.
    await prisma.effectifPerimetre.updateMany({
      where: { editionId: ids.edition },
      data: { effectif: 4 },
    })
    ecrirePerimetres({ natation: 3 })
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: SLUG_ORGANISATION,
      annee,
    })
    expect(activite(rapport).effectifs.dejaPresents).toEqual([`natation-${s}`])
    const effectif = await prisma.effectifPerimetre.findFirstOrThrow({
      where: { editionId: ids.edition },
    })
    expect(effectif.effectif).toBe(4)
  })

  it('ne crée aucun effectif sans édition', async () => {
    ecrirePerimetres({ natation: 3, basket: 1 })
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: SLUG_ORGANISATION,
    })
    expect(activite(rapport).effectifs).toEqual({ crees: [], dejaPresents: [] })
    expect(
      await prisma.effectifPerimetre.count({
        where: { perimetre: { slug: `basket-${s}` } },
      })
    ).toBe(0)
  })

  it('ajoute une version quand le dépôt change', async () => {
    ecrire(
      `fiches/communes/accueil-${s}.md`,
      `---\nslug: accueil-${s}\ntitre: Accueillir\n---\n\n## Objectif\n\nAccueillir chaque personne.\n`
    )
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: SLUG_ORGANISATION,
    })
    expect(activite(rapport).fiches.nouvellesVersions).toEqual([`accueil-${s}`])
  })
})

describe('droits sur les fiches', () => {
  const MODIFIER = `mutation ($id: ID!, $c: String!) { modifierFiche(id: $id, titre: "Réserver la piscine", contenu: $c) { id source } }`
  let piscine = ''
  let accueil = ''
  let natation = ''

  beforeAll(async () => {
    piscine = (
      await prisma.fiche.findUniqueOrThrow({
        where: {
          organisationId_slug: {
            organisationId: ORGANISATION,
            slug: `piscine-${s}`,
          },
        },
      })
    ).id
    accueil = (
      await prisma.fiche.findUniqueOrThrow({
        where: {
          organisationId_slug: {
            organisationId: ORGANISATION,
            slug: `accueil-${s}`,
          },
        },
      })
    ).id
    natation = (
      await prisma.perimetre.findUniqueOrThrow({
        where: {
          activiteId_slug: { activiteId: ACTIVITE, slug: `natation-${s}` },
        },
      })
    ).id
    await prisma.affectation.createMany({
      data: [
        {
          userId: ids.redactrice,
          perimetreId: natation,
          editionId: ids.edition,
        },
        { userId: ids.referent, perimetreId: natation, editionId: ids.edition },
      ],
    })
    await prisma.droitRedaction.create({
      data: {
        organisationId: ORGANISATION,
        userId: ids.redactrice,
        perimetreId: natation,
      },
    })
  })

  it('refuse la lecture d’une fiche de périmètre à une personne non affectée', async () => {
    const r = await executer(
      ids.autre,
      `query ($s: String!) { fiche(slug: $s) { contenu } }`,
      { s: `piscine-${s}` }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('ouvre les fiches communes à toute personne qui voit l’activité, et à elle seule', async () => {
    const requete = `query ($s: String!) { fiche(slug: $s) { titre } }`
    const affecte = await executer(ids.referent, requete, { s: `accueil-${s}` })
    expect(affecte.errors).toBeUndefined()
    // Sans affectation ni rôle d'admin, l'activité n'existe pas pour la personne.
    const autre = await executer(ids.autre, requete, { s: `accueil-${s}` })
    expect(code(autre)).toBe('FORBIDDEN')
  })

  it('refuse la modification à un référent sans droit de rédaction', async () => {
    expect(
      code(
        await executer(ids.referent, MODIFIER, {
          id: piscine,
          c: 'Autre texte',
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('refuse une fiche commune à une rédactrice limitée à son périmètre', async () => {
    expect(
      code(
        await executer(ids.redactrice, MODIFIER, {
          id: accueil,
          c: 'Autre texte',
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('refuse l’historique à une rédactrice', async () => {
    const r = await executer(
      ids.redactrice,
      `query ($s: String!) { fiche(slug: $s) { versions { id } } }`,
      {
        s: `piscine-${s}`,
      }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('crée une version APP, puis l’import signale le conflit sans remplacer', async () => {
    const r = await executer(ids.redactrice, MODIFIER, {
      id: piscine,
      c: '## Objectif\n\nRéserver tôt.',
    })
    expect(r.errors).toBeUndefined()
    ecrire(
      `fiches/natation-${s}/piscine-${s}.md`,
      `---\nslug: piscine-${s}\ntitre: Réserver la piscine\n---\n\n## Objectif\n\nVersion du dépôt.\n`
    )
    const rapport = await importerModeles(prisma, lireModeles(racine), {
      organisation: SLUG_ORGANISATION,
    })
    expect(activite(rapport).fiches.conflits).toEqual([`piscine-${s}`])
    const fiche = await prisma.fiche.findUniqueOrThrow({
      where: { id: piscine },
      include: { versionCourante: true },
    })
    expect(fiche.versionCourante?.contenu).toBe(
      '## Objectif\n\nRéserver tôt.\n'
    )
  })

  it('restaure une version en créant une nouvelle version', async () => {
    const versions = await prisma.ficheVersion.findMany({
      where: { ficheId: piscine },
      orderBy: { createdAt: 'asc' },
    })
    const r = await executer(
      ids.admin,
      `mutation ($v: ID!) { restaurerVersionFiche(versionId: $v) { contenu } }`,
      {
        v: versions[0]!.id,
      }
    )
    expect(r.errors).toBeUndefined()
    expect(
      await prisma.ficheVersion.count({ where: { ficheId: piscine } })
    ).toBe(versions.length + 1)
  })

  it('refuse d’exporter une fiche qui contient des données personnelles', async () => {
    await executer(ids.redactrice, MODIFIER, {
      id: piscine,
      c: 'Appeler le 06 12 34 56 78.',
    })
    const sortie = mkdtempSync(path.join(tmpdir(), 'relaytour-export-'))
    try {
      const rapport = await exporterContenu(prisma, sortie, SLUG_ORGANISATION)
      expect(rapport.refusees.map(r => r.fichier)).toContainEqual(
        expect.stringMatching(
          new RegExp(`fiches/natation-${s}/piscine-${s}\\.md$`)
        )
      )
      expect(rapport.ecrites.join(' ')).not.toContain(`piscine-${s}.md`)
    } finally {
      rmSync(sortie, { recursive: true, force: true })
    }
  })
  // Deux personnes qui rédigent la même fiche ne s'écrasent pas : un enregistrement
  // porte la version lue avant la rédaction.
  describe('travail à plusieurs', () => {
    const ENREGISTRER = `mutation ($id: ID!, $c: String!, $v: ID) {
      modifierFiche(id: $id, titre: "Réserver la piscine", contenu: $c, versionDeDepart: $v) { versionCouranteId }
    }`
    const RESTAURER = `mutation ($v: ID!, $d: ID) { restaurerVersionFiche(versionId: $v, versionDeDepart: $d) { versionCouranteId } }`
    const courante = async () =>
      (await prisma.fiche.findUniqueOrThrow({ where: { id: piscine } }))
        .versionCouranteId
    const versions = () =>
      prisma.ficheVersion.count({ where: { ficheId: piscine } })
    const nomDe = async (id: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { id } })).name
    const extensions = (r: Awaited<ReturnType<typeof executer>>) =>
      r.errors?.[0]?.extensions

    it('refuse d’enregistrer par-dessus une version écrite depuis la lecture', async () => {
      const depart = await courante()
      const avant = await versions()
      // L'admin et la rédactrice partent de la même version. L'admin enregistre.
      const parAdmin = await executer(ids.admin, ENREGISTRER, {
        id: piscine,
        c: 'Version de l’admin.',
        v: depart,
      })
      expect(parAdmin.errors).toBeUndefined()
      const ecrite = await courante()

      const parRedactrice = await executer(ids.redactrice, ENREGISTRER, {
        id: piscine,
        c: 'Version de la rédactrice.',
        v: depart,
      })
      expect(code(parRedactrice)).toBe('CONFLIT_VERSION')
      expect(extensions(parRedactrice)).toMatchObject({
        versionCourante: ecrite,
        modifieePar: await nomDe(ids.admin),
      })
      expect(
        Number.isNaN(Date.parse(String(extensions(parRedactrice)?.modifieeLe)))
      ).toBe(false)
      // Aucune version n'est créée pour l'enregistrement refusé.
      expect(await versions()).toBe(avant + 1)
      expect(await courante()).toBe(ecrite)

      // La rédactrice écrase en connaissance de cause.
      const ecrase = await executer(ids.redactrice, ENREGISTRER, {
        id: piscine,
        c: 'Version de la rédactrice.',
        v: ecrite,
      })
      expect(ecrase.errors).toBeUndefined()
      expect(await versions()).toBe(avant + 2)
    })

    it('ne garde qu’un de deux enregistrements simultanés de la même version', async () => {
      const depart = await courante()
      const avant = await versions()
      const auteurs = [ids.admin, ids.redactrice]
      const reponses = await Promise.all(
        auteurs.map((id, i) =>
          executer(id, ENREGISTRER, {
            id: piscine,
            c: `Enregistrement simultané ${i}.`,
            v: depart,
          })
        )
      )
      const gagnante = reponses.findIndex(r => r.errors === undefined)
      expect(reponses.filter(r => r.errors === undefined)).toHaveLength(1)
      expect(code(reponses[1 - gagnante]!)).toBe('CONFLIT_VERSION')
      expect(extensions(reponses[1 - gagnante]!)).toMatchObject({
        versionCourante: await courante(),
        modifieePar: await nomDe(auteurs[gagnante]!),
      })
      expect(await versions()).toBe(avant + 1)
    })

    it('laisse gagner le dernier enregistrement sans version de départ', async () => {
      const avant = await versions()
      const r = await executer(ids.redactrice, ENREGISTRER, {
        id: piscine,
        c: 'Sans version de départ.',
      })
      expect(r.errors).toBeUndefined()
      expect(await versions()).toBe(avant + 1)
    })

    it('refuse l’accès avant de dire un conflit', async () => {
      const avant = await versions()
      for (const personne of [ids.referent, ids.autre]) {
        const r = await executer(personne, ENREGISTRER, {
          id: piscine,
          c: 'Intrusion.',
          v: 'version-perimee',
        })
        expect(code(r)).toBe('FORBIDDEN')
      }
      // La restauration reste réservée aux admins, même avec une version périmée.
      const premiere = await prisma.ficheVersion.findFirstOrThrow({
        where: { ficheId: piscine },
        orderBy: { createdAt: 'asc' },
      })
      const r = await executer(ids.redactrice, RESTAURER, {
        v: premiere.id,
        d: 'version-perimee',
      })
      expect(code(r)).toBe('FORBIDDEN')
      expect(await versions()).toBe(avant)
    })

    it('accepte sans rien écrire un texte identique à la version actuelle', async () => {
      const actuelle = await prisma.fiche.findUniqueOrThrow({
        where: { id: piscine },
        include: { versionCourante: true },
      })
      const avant = await versions()
      // Parti d'une version plus ancienne, ce texte n'écrase rien : aucun conflit.
      const r = await executer(ids.redactrice, ENREGISTRER, {
        id: piscine,
        c: actuelle.versionCourante!.contenu,
        v: 'version-perimee',
      })
      expect(r.errors).toBeUndefined()
      expect(await versions()).toBe(avant)
      expect(await courante()).toBe(actuelle.versionCouranteId)
    })

    it('compte un import du contenu comme une modification du périmètre', async () => {
      const avant = await prisma.perimetre.findUniqueOrThrow({
        where: { id: natation },
      })
      ecrire(
        'perimetres.yaml',
        `perimetres:\n  - slug: natation-${s}\n    nom: Natation sportive\n    type: SPORT\n  - slug: basket-${s}\n    nom: Basket\n    type: SPORT\n`
      )
      const rapport = await importerModeles(prisma, lireModeles(racine), {
        organisation: SLUG_ORGANISATION,
      })
      expect(activite(rapport).perimetres.modifies).toContain(`natation-${s}`)
      expect(
        await prisma.perimetre.findUniqueOrThrow({ where: { id: natation } })
      ).toMatchObject({
        nom: 'Natation sportive',
        version: avant.version + 1,
      })
      // Un réglage ouvert avant l'import ne l'écrase pas sans le dire.
      const perime = await executer(
        ids.admin,
        `mutation ($id: ID!, $v: Int) {
          modifierPerimetre(id: $id, nom: "Natation", ordre: 0, archive: false, versionAttendue: $v) { nom }
        }`,
        { id: natation, v: avant.version }
      )
      expect(code(perime)).toBe('CONFLIT_VERSION')
      expect(extensions(perime)).toMatchObject({
        versionCourante: avant.version + 1,
      })
      expect(
        (await prisma.perimetre.findUniqueOrThrow({ where: { id: natation } }))
          .nom
      ).toBe('Natation sportive')
    })

    it('refuse de restaurer par-dessus une version écrite depuis l’historique', async () => {
      const premiere = await prisma.ficheVersion.findFirstOrThrow({
        where: { ficheId: piscine },
        orderBy: { createdAt: 'asc' },
      })
      const depart = await courante()
      await executer(ids.redactrice, ENREGISTRER, {
        id: piscine,
        c: 'Écrit pendant la lecture de l’historique.',
      })
      const avant = await versions()
      const perimee = await executer(ids.admin, RESTAURER, {
        v: premiere.id,
        d: depart,
      })
      expect(code(perimee)).toBe('CONFLIT_VERSION')
      expect(extensions(perimee)).toMatchObject({
        versionCourante: await courante(),
        modifieePar: await nomDe(ids.redactrice),
      })
      expect(await versions()).toBe(avant)

      const voulue = await executer(ids.admin, RESTAURER, {
        v: premiere.id,
        d: await courante(),
      })
      expect(voulue.errors).toBeUndefined()
      expect(await versions()).toBe(avant + 1)
    })
  })
})
