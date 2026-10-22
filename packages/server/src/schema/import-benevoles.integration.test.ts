import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Import de listes de bénévoles, doublons et fusion des fiches (ADR 0042). Les
// données sont fictives. Un admin de l'activité importe pour le programme entier,
// une référente pour son périmètre ; les refus se prouvent (invariant 11).

const enFile = vi.hoisted(() => [] as { sorte: string; benevoleId: string }[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: { benevoleId?: string }) => {
    enFile.push({ sorte, benevoleId: cible.benevoleId ?? '' })
    return Promise.resolve(true)
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `import-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  finales: '', // natation, besoin 2
  relais: '', // natation, besoin 1
  buvette: '', // basket, besoin 3
  admin: '',
  referente: '', // affectée à la natation
  basketteuse: '', // affectée au basket
  membre: '', // compte de l'organisation, sans affectation
  existante: '', // fiche « Lou Roux », lou-<s>@exemple.fr
}

async function executer(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext(`ip-${s}`, userId, slug) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

function donnees<T>(r: Awaited<ReturnType<typeof executer>>, champ: string): T {
  expect(r.errors).toBeUndefined()
  return (r.data as Record<string, T>)[champ]!
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const h = (heure: string, jour = '2027-06-05') =>
  new Date(`${jour}T${heure}:00+02:00`)

interface Rapport {
  aImporter: number
  dejaImportees: number
  ecartees: number
  fichesCreees: number
  fichesRattachees: number
  places: number
  depassements: { sequenceId: string; renforts: number }[]
  lignes: {
    cle: string
    etat: string
    motif: string | null
    rapprochement: { benevoleId: string; niveau: string } | null
    rattacheeA: string | null
    compte: boolean
  }[]
}

const CHAMPS = `aImporter dejaImportees ecartees fichesCreees fichesRattachees places depassements { sequenceId renforts } lignes { cle etat motif rapprochement { benevoleId niveau } rattacheeA compte }`
const SIGNATURE = `$e: ID!, $p: ID, $src: String!, $m: ModeImport!, $pm: Boolean, $at: Boolean, $ok: Boolean!, $l: [PersonneImportInput!]!`
const APPEL = `editionId: $e, perimetreId: $p, source: $src, mode: $m, prevenirParMail: $pm, accepterTout: $at, accord: $ok, personnes: $l`
const SIMULER = `query (${SIGNATURE}) { simulerImportBenevoles(${APPEL}) { ${CHAMPS} } }`
const IMPORTER = `mutation (${SIGNATURE}) { importerBenevoles(${APPEL}) { ${CHAMPS} } }`

const variables = (plus: Record<string, unknown>) => ({
  e: ids.edition,
  src: `billetterie ${s}`,
  m: 'A_REPARTIR',
  ok: true,
  ...plus,
})

beforeEach(() => {
  enFile.length = 0
})

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: {
        slug,
        nom: 'Organisation',
        configuration: {
          slug,
          nom: 'Organisation',
          domainesCourrielAutorises: ['exemple.fr'],
        },
      },
    })
  ).id
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug,
        nom: 'Tournoi',
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
        nom: 'Tournoi 2027',
        debut: new Date('2027-06-05'),
        fin: new Date('2027-06-06'),
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
  for (const [cle, perimetreId, debut, fin, besoin] of [
    ['finales', ids.natation, '09:00', '12:00', 2],
    ['relais', ids.natation, '14:00', '16:00', 1],
    ['buvette', ids.basket, '10:00', '13:00', 3],
  ] as const) {
    ids[cle] = (
      await prisma.sequence.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          editionId: ids.edition,
          perimetreId,
          titre: cle,
          debut: h(debut),
          fin: h(fin),
          besoinBenevoles: besoin,
        },
      })
    ).id
  }
  for (const cle of ['admin', 'referente', 'basketteuse', 'membre'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
      },
    })
  }
  await prisma.adminActivite.create({
    data: {
      userId: ids.admin,
      activiteId: ids.activite,
      organisationId: ids.org,
    },
  })
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.referente,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
      {
        userId: ids.basketteuse,
        perimetreId: ids.basket,
        editionId: ids.edition,
      },
    ],
  })
  ids.existante = (
    await prisma.benevole.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        nom: 'Lou Roux',
        courriel: `lou-${s}@exemple.fr`,
        accordLe: new Date(),
      },
    })
  ).id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
  await prisma.candidature.deleteMany({ where: { organisationId: ids.org } })
  await prisma.appelBenevoles.deleteMany({ where: { organisationId: ids.org } })
  await prisma.sequence.deleteMany({ where: { organisationId: ids.org } })
  await prisma.benevole.deleteMany({ where: { organisationId: ids.org } })
  await prisma.correspondanceImport.deleteMany({
    where: { organisationId: ids.org },
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
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
})

describe('simulation', () => {
  it('rend le rapport sans rien écrire : écartées, rapprochements et comptes', async () => {
    const avant = await prisma.candidature.count({
      where: { organisationId: ids.org },
    })
    const rapport = donnees<Rapport>(
      await executer(
        ids.admin,
        SIMULER,
        variables({
          l: [
            { cle: '1', nom: '#12345' },
            {
              cle: '2',
              nom: 'Lou R.',
              courriel: `LOU-${s}@exemple.fr`,
              sequenceIds: [ids.finales],
            },
            { cle: '3', nom: 'Membre', courriel: `membre-${slug}@exemple.fr` },
            { cle: '4', nom: 'Roux Lou' },
          ],
        })
      ),
      'simulerImportBenevoles'
    )
    expect(rapport.lignes.map(l => [l.cle, l.etat])).toEqual([
      ['1', 'ECARTEE'],
      ['2', 'A_IMPORTER'],
      ['3', 'A_IMPORTER'],
      ['4', 'A_IMPORTER'],
    ])
    const [, lou, membre, roux] = rapport.lignes
    expect(lou!.rapprochement).toEqual({
      benevoleId: ids.existante,
      niveau: 'FORT',
    })
    // Une adresse identique rattache d'office ; un nom proche ne rattache pas.
    expect(lou!.rattacheeA).toBe(ids.existante)
    expect(roux!.rapprochement?.niveau).toBe('FAIBLE')
    expect(roux!.rattacheeA).toBeNull()
    expect(membre!.compte).toBe(true)
    expect(
      await prisma.candidature.count({ where: { organisationId: ids.org } })
    ).toBe(avant)
  })

  it('ne signale aucun compte à une personne qui n’administre pas l’activité', async () => {
    const rapport = donnees<Rapport>(
      await executer(
        ids.referente,
        SIMULER,
        variables({
          p: ids.natation,
          l: [
            { cle: '1', nom: 'Membre', courriel: `membre-${slug}@exemple.fr` },
          ],
        })
      ),
      'simulerImportBenevoles'
    )
    expect(rapport.lignes[0]!.compte).toBe(false)
  })

  it('écarte une séquence hors de la portée, et refuse le programme entier à une référente', async () => {
    const rapport = donnees<Rapport>(
      await executer(
        ids.referente,
        SIMULER,
        variables({
          p: ids.natation,
          l: [{ cle: '1', nom: 'Hors portée', sequenceIds: [ids.buvette] }],
        })
      ),
      'simulerImportBenevoles'
    )
    expect(rapport.lignes[0]).toMatchObject({ etat: 'ECARTEE' })
    expect(rapport.lignes[0]!.motif).toMatch(/portée/)
    expect(
      code(
        await executer(
          ids.referente,
          SIMULER,
          variables({ l: [{ cle: '1', nom: 'Personne' }] })
        )
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(
          ids.basketteuse,
          SIMULER,
          variables({ p: ids.natation, l: [{ cle: '1', nom: 'Personne' }] })
        )
      )
    ).toBe('FORBIDDEN')
  })

  it('refuse un import sans accord déclaré', async () => {
    expect(
      (
        await executer(
          ids.admin,
          SIMULER,
          variables({ ok: false, l: [{ cle: '1', nom: 'Personne' }] })
        )
      ).errors?.[0]?.message
    ).toMatch(/accord/)
  })
})

describe('import à répartir', () => {
  it('crée des candidatures dans un appel d’import sans adresse, sans mail, et se rejoue', async () => {
    const source = `formulaire ${s}`
    const personnes = [
      {
        cle: 'a',
        nom: 'Ana Diaz',
        courriel: `ana-${s}@exemple.fr`,
        refExterne: 'B-1',
        sequenceIds: [ids.relais],
        plages: [
          { jour: '2027-06-05', heureDebut: '13:00', heureFin: '17:00' },
        ],
        precisions: 'Pas avant 13 h.',
      },
      { cle: 'b', nom: 'Noa Petit', refExterne: 'B-2' },
    ]
    const rapport = donnees<Rapport>(
      await executer(
        ids.admin,
        IMPORTER,
        variables({ src: source, l: personnes })
      ),
      'importerBenevoles'
    )
    expect(rapport).toMatchObject({ aImporter: 2, fichesCreees: 0, places: 0 })
    expect(enFile).toEqual([])
    const appel = await prisma.appelBenevoles.findFirstOrThrow({
      where: { editionId: ids.edition, sourceImport: source },
      include: { candidatures: { include: { choix: true, plages: true } } },
    })
    expect(appel).toMatchObject({ sansAdresse: true, portee: 'PERIODE' })
    expect(appel.fermeManuellementLe).not.toBeNull()
    const ana = appel.candidatures.find(c => c.nom === 'Ana Diaz')!
    expect(ana).toMatchObject({
      origine: 'IMPORT',
      sourceImport: source,
      refExterne: 'B-1',
      statut: 'EN_ATTENTE',
      precisionsDisponibilite: 'Pas avant 13 h.',
    })
    expect(ana.choix.map(c => c.statut)).toEqual(['EN_ATTENTE'])
    expect(ana.plages).toHaveLength(1)

    // Un fichier mis à jour n'ajoute que les nouvelles personnes, dans le même appel.
    const rejoue = donnees<Rapport>(
      await executer(
        ids.admin,
        IMPORTER,
        variables({
          src: source,
          l: [...personnes, { cle: 'c', nom: 'Tom Leroy', refExterne: 'B-3' }],
        })
      ),
      'importerBenevoles'
    )
    expect(rejoue).toMatchObject({ aImporter: 1, dejaImportees: 2 })
    expect(
      await prisma.appelBenevoles.count({
        where: { editionId: ids.edition, sourceImport: source },
      })
    ).toBe(1)

    // L'appel d'import n'a pas d'adresse, et ne se rouvre pas.
    const lus = donnees<
      { id: string; adresse: string | null; sansAdresse: boolean }[]
    >(
      await executer(
        ids.admin,
        `query ($e: ID!) { appelsBenevoles(editionId: $e) { id adresse sansAdresse } }`,
        { e: ids.edition }
      ),
      'appelsBenevoles'
    )
    expect(lus.find(a => a.id === appel.id)).toEqual({
      id: appel.id,
      adresse: null,
      sansAdresse: true,
    })
    expect(
      (
        await executer(
          ids.admin,
          `mutation ($id: ID!) { rouvrirAppelBenevoles(id: $id) { id } }`,
          { id: appel.id }
        )
      ).errors?.[0]?.message
    ).toMatch(/pas d’adresse/)
  })
})

describe('places directes', () => {
  it('crée les fiches et leurs places, rattache par l’adresse, et envoie le premier lien', async () => {
    const rapport = donnees<Rapport>(
      await executer(
        ids.referente,
        IMPORTER,
        variables({
          p: ids.natation,
          m: 'PLACES_DIRECTES',
          src: `natation ${s}`,
          l: [
            {
              cle: '1',
              nom: 'Inès Roy',
              courriel: `ines-${s}@exemple.fr`,
              sequenceIds: [ids.finales],
            },
            {
              cle: '2',
              nom: 'Lou Roux',
              courriel: `lou-${s}@exemple.fr`,
              sequenceIds: [ids.relais],
            },
          ],
        })
      ),
      'importerBenevoles'
    )
    expect(rapport).toMatchObject({
      aImporter: 2,
      fichesCreees: 1,
      fichesRattachees: 1,
      places: 2,
    })
    const ines = await prisma.benevole.findFirstOrThrow({
      where: { activiteId: ids.activite, nom: 'Inès Roy' },
      include: { places: true },
    })
    expect(ines).toMatchObject({
      origine: 'IMPORT',
      sourceImport: `natation ${s}`,
      perimetreImportId: ids.natation,
      creeParId: ids.referente,
    })
    expect(ines.places).toHaveLength(1)
    expect(ines.places[0]!.confirmeeLe).toBeNull()
    expect(
      await prisma.placeSequence.count({
        where: { sequenceId: ids.relais, benevoleId: ids.existante },
      })
    ).toBe(1)
    expect(enFile.map(j => j.sorte)).toEqual(['benevole-lien', 'benevole-lien'])
  })

  it('confirme d’office les places sans « Prévenir par mail », sans envoyer de mail', async () => {
    donnees(
      await executer(
        ids.admin,
        IMPORTER,
        variables({
          m: 'PLACES_DIRECTES',
          pm: false,
          src: `sans mail ${s}`,
          l: [
            {
              cle: '1',
              nom: 'Mia Vidal',
              courriel: `mia-${s}@exemple.fr`,
              sequenceIds: [ids.buvette],
            },
          ],
        })
      ),
      'importerBenevoles'
    )
    const mia = await prisma.benevole.findFirstOrThrow({
      where: { activiteId: ids.activite, nom: 'Mia Vidal' },
      include: { places: true },
    })
    expect(mia.prevenirParMail).toBe(false)
    expect(mia.places[0]!.confirmeeLe).not.toBeNull()
    expect(enFile).toEqual([])
  })

  it('exige au moins une séquence associée', async () => {
    expect(
      (
        await executer(
          ids.admin,
          SIMULER,
          variables({
            m: 'PLACES_DIRECTES',
            l: [{ cle: '1', nom: 'Sans place' }],
          })
        )
      ).errors?.[0]?.message
    ).toMatch(/places directes/)
  })

  it('cache une fiche importée pour un périmètre aux autres périmètres, dans la répartition', async () => {
    await prisma.plageDisponibilite.create({
      data: {
        editionId: ids.edition,
        benevoleId: (
          await prisma.benevole.findFirstOrThrow({
            where: { activiteId: ids.activite, nom: 'Inès Roy' },
          })
        ).id,
        debut: h('08:00'),
        fin: h('18:00'),
      },
    })
    const A_REPARTIR = `query ($e: ID!) { benevolesARepartir(editionId: $e) { nom } }`
    const noms = async (userId: string) =>
      donnees<{ nom: string }[]>(
        await executer(userId, A_REPARTIR, { e: ids.edition }),
        'benevolesARepartir'
      ).map(r => r.nom)
    expect(await noms(ids.referente)).toContain('Inès Roy')
    expect(await noms(ids.admin)).toContain('Inès Roy')
    expect(await noms(ids.basketteuse)).not.toContain('Inès Roy')
  })
})

describe('correspondances d’import', () => {
  const ENREGISTRER = `mutation ($a: ID!, $n: String!, $en: [String!]!, $as: JSONObject!, $r: JSONObject!) { enregistrerCorrespondanceImport(activiteId: $a, nom: $n, entetes: $en, associations: $as, reglages: $r) { id nom entetes associations reglages peutSupprimer } }`

  it('s’enregistrent, se remplacent par leur nom et se suppriment par leur autrice ou un admin', async () => {
    const premiere = donnees<{ id: string }>(
      await executer(ids.referente, ENREGISTRER, {
        a: ids.activite,
        n: 'Billetterie',
        en: ['Prénom', 'Nom', 'Email'],
        as: { Email: { champ: 'courriel' } },
        r: { mode: 'A_REPARTIR' },
      }),
      'enregistrerCorrespondanceImport'
    )
    const remplacee = donnees<{ id: string; entetes: string[] }>(
      await executer(ids.referente, ENREGISTRER, {
        a: ids.activite,
        n: 'Billetterie',
        en: ['Prénom', 'Nom'],
        as: {},
        r: {},
      }),
      'enregistrerCorrespondanceImport'
    )
    expect(remplacee.id).toBe(premiere.id)
    expect(remplacee.entetes).toEqual(['Prénom', 'Nom'])
    // Une autre personne ne remplace pas la correspondance de la référente.
    expect(
      (
        await executer(ids.basketteuse, ENREGISTRER, {
          a: ids.activite,
          n: 'Billetterie',
          en: [],
          as: {},
          r: {},
        })
      ).errors?.[0]?.message
    ).toMatch(/déjà ce nom/)
    const liste = donnees<{ id: string; peutSupprimer: boolean }[]>(
      await executer(
        ids.basketteuse,
        `query ($a: ID!) { correspondancesImport(activiteId: $a) { id peutSupprimer } }`,
        { a: ids.activite }
      ),
      'correspondancesImport'
    )
    expect(liste).toEqual([{ id: premiere.id, peutSupprimer: false }])
    const SUPPRIMER = `mutation ($id: ID!) { supprimerCorrespondanceImport(id: $id) }`
    expect(
      code(await executer(ids.basketteuse, SUPPRIMER, { id: premiere.id }))
    ).toBe('FORBIDDEN')
    expect(
      donnees<boolean>(
        await executer(ids.admin, SUPPRIMER, { id: premiere.id }),
        'supprimerCorrespondanceImport'
      )
    ).toBe(true)
    expect(
      code(
        await executer(
          ids.membre,
          `query ($a: ID!) { correspondancesImport(activiteId: $a) { id } }`,
          { a: ids.activite }
        )
      )
    ).toBe('FORBIDDEN')
  })
})

describe('doublons et fusion', () => {
  const DOUBLONS = `query ($a: ID!) { doublonsBenevoles(activiteId: $a) { niveau a { id nom } b { id nom } } }`
  const FUSIONNER = `mutation ($g: ID!, $x: ID!, $n: CoteFusion!, $c: CoteFusion!, $t: CoteFusion!) { fusionnerBenevoles(gardeeId: $g, autreId: $x, nomDe: $n, courrielDe: $c, telephoneDe: $t) { id nom courriel telephone } }`

  it('propose les doublons aux admins seulement, et oublie une paire déclarée distincte', async () => {
    const [x, y] = await Promise.all(
      ['Sam Vidal', 'Sam Vidall'].map(nom =>
        prisma.benevole.create({
          data: {
            organisationId: ids.org,
            activiteId: ids.activite,
            nom,
            accordLe: new Date(),
          },
        })
      )
    )
    const paires = donnees<{ a: { id: string }; b: { id: string } }[]>(
      await executer(ids.admin, DOUBLONS, { a: ids.activite }),
      'doublonsBenevoles'
    )
    const cherchee = (liste: typeof paires) =>
      liste.some(
        p => [p.a.id, p.b.id].sort().join() === [x!.id, y!.id].sort().join()
      )
    expect(cherchee(paires)).toBe(true)
    expect(
      code(await executer(ids.referente, DOUBLONS, { a: ids.activite }))
    ).toBe('FORBIDDEN')
    const DISTINCTS = `mutation ($a: ID!, $b: ID!) { marquerBenevolesDistincts(aId: $a, bId: $b) }`
    expect(
      code(await executer(ids.referente, DISTINCTS, { a: x!.id, b: y!.id }))
    ).toBe('FORBIDDEN')
    donnees(
      await executer(ids.admin, DISTINCTS, { a: y!.id, b: x!.id }),
      'marquerBenevolesDistincts'
    )
    expect(
      cherchee(
        donnees(
          await executer(ids.admin, DOUBLONS, { a: ids.activite }),
          'doublonsBenevoles'
        )
      )
    ).toBe(false)
  })

  it('réunit places, plages et candidatures ; le lien suit l’adresse gardée', async () => {
    const creer = (nom: string, courriel: string, telephone: string | null) =>
      prisma.benevole.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          nom,
          courriel,
          telephone,
          accordLe: new Date(),
          note: `Note de ${nom}`,
        },
      })
    const gardee = await creer('Zoé Blanc', `zoe-${s}@exemple.fr`, null)
    const autre = await creer(
      'Zoe Blanc',
      `zoe.b-${s}@exemple.fr`,
      '0612345678'
    )
    await prisma.benevole.update({
      where: { id: autre.id },
      data: {
        espaceSel: 'y'.repeat(43),
        espaceEmpreinte: 'f'.repeat(64),
        courrielConfirmeLe: new Date(),
      },
    })
    await prisma.placeSequence.createMany({
      data: [
        { sequenceId: ids.finales, benevoleId: gardee.id, role: 'RENFORT' },
        {
          sequenceId: ids.finales,
          benevoleId: autre.id,
          role: 'RESPONSABLE',
          confirmeeLe: new Date(),
        },
        { sequenceId: ids.buvette, benevoleId: autre.id, role: 'RENFORT' },
      ],
    })
    await prisma.plageDisponibilite.createMany({
      data: [
        {
          editionId: ids.edition,
          benevoleId: gardee.id,
          debut: h('08:00'),
          fin: h('10:00'),
        },
        {
          editionId: ids.edition,
          benevoleId: autre.id,
          debut: h('09:00'),
          fin: h('12:00'),
        },
      ],
    })
    const appel = await prisma.appelBenevoles.findFirstOrThrow({
      where: { organisationId: ids.org, sansAdresse: true },
    })
    const candidature = await prisma.candidature.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        appelId: appel.id,
        nom: 'Zoe Blanc',
        accordLe: new Date(),
        benevoleId: autre.id,
      },
    })
    expect(
      code(
        await executer(ids.referente, FUSIONNER, {
          g: gardee.id,
          x: autre.id,
          n: 'GARDEE',
          c: 'AUTRE',
          t: 'AUTRE',
        })
      )
    ).toBe('FORBIDDEN')
    const fusion = donnees<{
      id: string
      nom: string
      courriel: string
      telephone: string
    }>(
      await executer(ids.admin, FUSIONNER, {
        g: gardee.id,
        x: autre.id,
        n: 'GARDEE',
        c: 'AUTRE',
        t: 'AUTRE',
      }),
      'fusionnerBenevoles'
    )
    expect(fusion).toEqual({
      id: gardee.id,
      nom: 'Zoé Blanc',
      courriel: `zoe.b-${s}@exemple.fr`,
      telephone: '0612345678',
    })
    expect(await prisma.benevole.count({ where: { id: autre.id } })).toBe(0)
    const relue = await prisma.benevole.findUniqueOrThrow({
      where: { id: gardee.id },
      include: { places: true, plages: true },
    })
    expect(
      relue.places
        .map(p => [p.sequenceId, p.role, p.confirmeeLe !== null])
        .sort()
    ).toEqual(
      [
        [ids.finales, 'RESPONSABLE', true],
        [ids.buvette, 'RENFORT', false],
      ].sort()
    )
    expect(relue.plages.map(p => [p.debut, p.fin])).toEqual([
      [h('08:00'), h('12:00')],
    ])
    expect(relue).toMatchObject({
      espaceEmpreinte: 'f'.repeat(64),
      note: 'Note de Zoé Blanc\n\nNote de Zoe Blanc',
    })
    expect(relue.courrielConfirmeLe).not.toBeNull()
    expect(
      (
        await prisma.candidature.findUniqueOrThrow({
          where: { id: candidature.id },
        })
      ).benevoleId
    ).toBe(gardee.id)
  })
})
