import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { empreinteJeton, nouveauJeton } from '../lib/abonnements-agenda.ts'

import { schema } from './index.ts'

// Page publique d'un appel à bénévoles (ADR 0041) : elle se lit et se remplit sans
// session, pour un appel ouvert seulement. Le dépôt n'envoie aucun mail, et la
// réponse ne dit jamais si l'adresse a déjà une candidature. Chaque dépôt part
// d'une adresse IP propre au fichier : les limites de débit ne débordent pas d'une
// exécution sur l'autre.

const enFile = vi.hoisted(() => [] as string[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string) => {
    enFile.push(sorte)
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `candidature-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  finales: '', // natation, besoin 2, une place en renfort
  relais: '', // natation, besoin 1, déjà complète
  buvette: '', // basket, besoin 3
  passee: '', // natation, commencée
  sansBesoin: '', // natation, sans besoin
  appelPeriode: '',
  appelNatation: '',
  appelFerme: '',
  admin: '',
  referent: '',
  basketteuse: '',
  benevole: '',
}
const jetons = { periode: '', natation: '', ferme: '' }
let ips = 0
const ipNeuve = () => `ip-${s}-${(ips += 1)}`

async function executer(
  query: string,
  variables: Record<string, unknown> = {},
  options: { userId?: string; ip?: string } = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    {
      contextValue: await buildContext(
        options.ip ?? ipNeuve(),
        options.userId ?? null,
        options.userId ? slug : null
      ),
    }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const LIRE = `query ($j: String!) {
  appelBenevolesPublic(jeton: $j) {
    organisation activite periode introduction contact ouAilleurs jours
    sequences { ref titre jour heureDebut heureFin lieu lieuDescription perimetre consignes placesRecherchees complete }
  }
}`

interface SequencePublique {
  ref: string
  titre: string
  consignes: string | null
  placesRecherchees: number
  complete: boolean
}

const lire = async (jeton: string) =>
  (
    (await executer(LIRE, { j: jeton })).data as {
      appelBenevolesPublic: {
        ouAilleurs: boolean
        jours: string[]
        sequences: SequencePublique[]
      } | null
    }
  ).appelBenevolesPublic

const DEPOSER = `mutation ($j: String!, $n: String!, $e: String!, $t: String, $sq: [String!]!, $oa: Boolean, $pl: [PlageDisponibiliteInput!], $pr: String, $m: String, $a: Boolean!, $sw: String) {
  deposerCandidature(jeton: $j, nom: $n, email: $e, telephone: $t, sequences: $sq, ouAilleurs: $oa, plages: $pl, precisions: $pr, message: $m, accord: $a, siteWeb: $sw)
}`

const h = (heure: string, jour = '2027-06-05') =>
  new Date(`${jour}T${heure}:00+02:00`)

async function refs(jeton: string) {
  const appel = await lire(jeton)
  return new Map(appel!.sequences.map(sq => [sq.titre, sq.ref]))
}

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
        identite: { contactRecrutement: 'benevoles@exemple.fr' },
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
          nom: cle === 'natation' ? 'Natation' : 'Basket',
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    ).id
  }
  const lieu = await prisma.lieu.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      nom: 'Bassin',
      description: 'Entrée par le parking nord.',
    },
  })
  ids.benevole = (
    await prisma.benevole.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        nom: 'Paul Placé',
        accordLe: new Date(),
      },
    })
  ).id
  for (const [cle, perimetreId, debut, fin, besoin, consignes] of [
    ['finales', ids.natation, h('09:00'), h('12:00'), 2, 'Tenue claire.'],
    [
      'relais',
      ids.natation,
      h('14:00'),
      h('16:00'),
      1,
      'Appeler le 06 39 98 12 34.',
    ],
    ['buvette', ids.basket, h('10:00'), h('13:00'), 3, null],
    [
      'passee',
      ids.natation,
      new Date(Date.now() - 3600_000),
      new Date(Date.now() + 3600_000),
      2,
      null,
    ],
    ['sansBesoin', ids.natation, h('17:00'), h('18:00'), null, null],
  ] as const) {
    ids[cle] = (
      await prisma.sequence.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          editionId: ids.edition,
          perimetreId,
          lieuId: lieu.id,
          titre: cle,
          debut,
          fin,
          besoinBenevoles: besoin,
          consignesBenevoles: consignes,
        },
      })
    ).id
  }
  await prisma.placeSequence.createMany({
    data: [
      {
        sequenceId: ids.finales,
        benevoleId: ids.benevole,
        role: 'RENFORT',
        confirmeeLe: new Date(),
      },
      {
        sequenceId: ids.relais,
        benevoleId: ids.benevole,
        role: 'RENFORT',
        confirmeeLe: null,
      },
    ],
  })
  for (const cle of ['admin', 'referent', 'basketteuse'] as const) {
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
        userId: ids.referent,
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
  for (const [cle, portee, perimetreId, ferme] of [
    ['periode', 'PERIODE', null, false],
    ['natation', 'PERIMETRE', ids.natation, false],
    ['ferme', 'PERIODE', null, true],
  ] as const) {
    jetons[cle] = nouveauJeton()
    const appel = await prisma.appelBenevoles.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        portee,
        perimetreId,
        nom: `Appel ${cle}`,
        introduction: 'Merci de votre aide.',
        ouvertLe: new Date(Date.now() - 3600_000),
        fermeLe: h('20:00', '2027-06-06'),
        fermeManuellementLe: ferme ? new Date() : null,
        empreinte: empreinteJeton(jetons[cle]),
        fin: jetons[cle].slice(-6),
      },
    })
    if (cle === 'periode') ids.appelPeriode = appel.id
    if (cle === 'natation') ids.appelNatation = appel.id
    if (cle === 'ferme') ids.appelFerme = appel.id
  }
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
  await prisma.candidature.deleteMany({ where: { organisationId: ids.org } })
  await prisma.appelBenevoles.deleteMany({ where: { organisationId: ids.org } })
  await prisma.sequence.deleteMany({ where: { organisationId: ids.org } })
  await prisma.benevole.deleteMany({ where: { organisationId: ids.org } })
  await prisma.lieu.deleteMany({ where: { organisationId: ids.org } })
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

describe('page publique', () => {
  it('sert les séquences qui cherchent des bénévoles, sans identifiant ni nom', async () => {
    const reponse = await executer(LIRE, { j: jetons.periode })
    expect(reponse.errors).toBeUndefined()
    const appel = (
      reponse.data as { appelBenevolesPublic: Record<string, unknown> }
    ).appelBenevolesPublic
    expect(appel).toMatchObject({
      organisation: 'Organisation',
      activite: 'Tournoi',
      periode: 'Tournoi 2027',
      introduction: 'Merci de votre aide.',
      contact: 'benevoles@exemple.fr',
      ouAilleurs: true,
    })
    // Les jours de la période, et celui de la séquence déjà commencée.
    expect((appel.jours as string[]).slice(-2)).toEqual([
      '2027-06-05',
      '2027-06-06',
    ])
    const sequences = appel.sequences as SequencePublique[]
    // Ni la séquence commencée, ni celle sans besoin.
    expect(sequences.map(sq => sq.titre)).toEqual([
      'finales',
      'buvette',
      'relais',
    ])
    expect(sequences.find(sq => sq.titre === 'finales')).toMatchObject({
      consignes: 'Tenue claire.',
      placesRecherchees: 1,
      complete: false,
    })
    // Une place à confirmer compte, et un numéro personnel n'est pas publié.
    expect(sequences.find(sq => sq.titre === 'relais')).toMatchObject({
      consignes: null,
      placesRecherchees: 0,
      complete: true,
    })
    const texte = JSON.stringify(reponse.data)
    for (const id of [ids.finales, ids.relais, ids.appelPeriode, ids.org]) {
      expect(texte).not.toContain(id)
    }
    expect(texte).not.toContain('Paul Placé')
  })

  it('limite un appel de périmètre à ses séquences, sans « là où il manque du monde »', async () => {
    const appel = await lire(jetons.natation)
    expect(appel!.ouAilleurs).toBe(false)
    expect(appel!.sequences.map(sq => sq.titre)).toEqual(['finales', 'relais'])
  })

  it('répond null pour un appel fermé, inconnu ou mal formé', async () => {
    expect(await lire(jetons.ferme)).toBeNull()
    expect(await lire(nouveauJeton())).toBeNull()
    expect(await lire('court')).toBeNull()
  })
})

describe('dépôt', () => {
  const base = (plus: Record<string, unknown> = {}) => ({
    j: jetons.periode,
    n: 'Camille Martin',
    e: `camille-${s}@exemple.fr`,
    t: '06 39 98 00 01',
    sq: [],
    a: true,
    ...plus,
  })

  it('enregistre une candidature sans mail, en attente ou en liste d’attente selon la jauge', async () => {
    const r = await refs(jetons.periode)
    const reponse = await executer(
      DEPOSER,
      base({
        sq: [r.get('finales'), r.get('relais')],
        pl: [{ jour: '2027-06-05', heureDebut: '08:00', heureFin: '17:00' }],
        pr: 'Disponible toute la journée.',
      })
    )
    expect(reponse.errors).toBeUndefined()
    expect(
      (reponse.data as { deposerCandidature: boolean }).deposerCandidature
    ).toBe(true)
    const candidature = await prisma.candidature.findFirstOrThrow({
      where: { appelId: ids.appelPeriode, courriel: `camille-${s}@exemple.fr` },
      include: { choix: true, plages: true },
    })
    expect(candidature).toMatchObject({
      statut: 'EN_ATTENTE',
      nom: 'Camille Martin',
      telephone: '06 39 98 00 01',
      precisionsDisponibilite: 'Disponible toute la journée.',
    })
    const statut = (id: string) =>
      candidature.choix.find(c => c.sequenceId === id)?.statut
    expect(statut(ids.finales)).toBe('EN_ATTENTE')
    expect(statut(ids.relais)).toBe('LISTE_ATTENTE')
    expect(candidature.plages.map(p => [p.debut, p.fin])).toEqual([
      [h('08:00'), h('17:00')],
    ])
    expect(enFile).toEqual([])
  })

  it('complète la première candidature au second dépôt, avec la même réponse', async () => {
    const r = await refs(jetons.periode)
    const e = `lou-${s}@exemple.fr`
    await executer(DEPOSER, base({ e, n: 'Lou', sq: [r.get('finales')] }))
    const reponse = await executer(
      DEPOSER,
      base({
        e,
        n: 'Autre nom',
        sq: [r.get('finales'), r.get('buvette')],
        oa: true,
        pl: [{ jour: '2027-06-06', heureDebut: '09:00', heureFin: '12:00' }],
      })
    )
    expect(
      (reponse.data as { deposerCandidature: boolean }).deposerCandidature
    ).toBe(true)
    const candidatures = await prisma.candidature.findMany({
      where: { appelId: ids.appelPeriode, courriel: e },
      include: { choix: true, plages: true },
    })
    expect(candidatures).toHaveLength(1)
    expect(candidatures[0]).toMatchObject({ nom: 'Lou', ouAilleurs: true })
    expect(candidatures[0]!.choix.map(c => c.sequenceId).sort()).toEqual(
      [ids.finales, ids.buvette].sort()
    )
    expect(candidatures[0]!.plages).toHaveLength(1)
  })

  it('accepte « là où il manque du monde » sans séquence, sur un appel de période seulement', async () => {
    const ok = await executer(
      DEPOSER,
      base({ e: `sacha-${s}@exemple.fr`, oa: true })
    )
    expect(ok.errors).toBeUndefined()
    const refus = await executer(
      DEPOSER,
      base({ j: jetons.natation, e: `sacha-${s}@exemple.fr`, oa: true })
    )
    expect(refus.errors?.[0]?.message).toMatch(/au moins une séquence/)
  })

  it('refuse sans accord, une séquence d’un autre appel, un lien ou une plage hors période', async () => {
    const r = await refs(jetons.periode)
    const message = async (plus: Record<string, unknown>) =>
      (
        await executer(
          DEPOSER,
          base({ e: `refus-${randomUUID()}@exemple.fr`, ...plus })
        )
      ).errors?.[0]?.message
    expect(await message({ a: false, sq: [r.get('finales')] })).toMatch(
      /accord/
    )
    // La référence d'une séquence dépend de l'appel.
    const autre = await refs(jetons.natation)
    expect(await message({ sq: [autre.get('finales')] })).toMatch(
      /plus proposée/
    )
    expect(
      await message({ sq: [r.get('finales')], m: 'Voir www.exemple.com' })
    ).toMatch(/liens/)
    expect(
      await message({
        sq: [r.get('finales')],
        pl: [{ jour: '2027-07-01', heureDebut: '08:00', heureFin: '09:00' }],
      })
    ).toMatch(/jours de la période/)
    expect(await message({ j: jetons.ferme, sq: [] })).toMatch(/pas ouvert/)
  })

  it('n’écrit rien quand le champ piège est rempli', async () => {
    const r = await refs(jetons.periode)
    const avant = await prisma.candidature.count({
      where: { organisationId: ids.org },
    })
    const reponse = await executer(
      DEPOSER,
      base({
        e: `robot-${s}@exemple.fr`,
        sq: [r.get('finales')],
        sw: 'http://spam',
      })
    )
    expect(
      (reponse.data as { deposerCandidature: boolean }).deposerCandidature
    ).toBe(true)
    expect(
      await prisma.candidature.count({ where: { organisationId: ids.org } })
    ).toBe(avant)
  })

  it('limite les dépôts d’une même adresse mail', async () => {
    const r = await refs(jetons.periode)
    const e = `insistant-${s}@exemple.fr`
    for (let i = 0; i < 3; i += 1) {
      const ok = await executer(DEPOSER, base({ e, sq: [r.get('buvette')] }))
      expect(ok.errors).toBeUndefined()
    }
    const trop = await executer(DEPOSER, base({ e, sq: [r.get('buvette')] }))
    expect(trop.errors?.[0]?.message).toMatch(/Trop de candidatures/)
  })

  it('prévient une fois par jour les admins et les personnes des périmètres choisis, sans nom', async () => {
    const notifications = await prisma.notification.findMany({
      where: { organisationId: ids.org, type: 'CANDIDATURE_RECUE' },
    })
    const pour = (userId: string) =>
      notifications.filter(n => n.userId === userId)
    expect(pour(ids.admin)).toHaveLength(1)
    expect(pour(ids.admin)[0]!.niveau).toBe('ADMIN_ACTIVITE')
    expect(pour(ids.referent)).toHaveLength(1)
    expect(pour(ids.referent)[0]!.niveau).toBe('REFERENT')
    // La buvette a été choisie : la référente du basket est prévenue aussi.
    expect(pour(ids.basketteuse)).toHaveLength(1)
    expect(
      notifications.every(n => n.acteurId === null && n.personneId === null)
    ).toBe(true)
  })
})
