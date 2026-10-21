import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { empreinteJeton } from '../lib/abonnements-agenda.ts'
import { purgerCandidatures } from '../lib/appels.ts'
import { nouveauSel } from '../lib/liens.ts'

import { schema } from './index.ts'

// Appels à bénévoles, candidatures et répartition (ADR 0041). Un admin de
// l'activité ouvre un appel de toute portée ; une personne qui écrit dans un
// périmètre ouvre un appel pour son périmètre. Une candidature se lit par les
// personnes qui peuvent la traiter. Les contrôles se prouvent par le refus
// (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `appels-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  // Séquences du samedi 5 juin 2027 (Paris, UTC+2).
  finales: '', // natation, 9 h à 12 h, besoin 2
  relais: '', // natation, 14 h à 16 h, besoin 1
  buvette: '', // basket, 10 h à 13 h, besoin 3
  accueil: '', // sans périmètre, 8 h à 10 h, besoin 2
  appelPeriode: '',
  appelNatation: '',
  appelBasket: '',
  saisie: '', // une fiche saisie à la main
  adminActivite: '',
  referent: '', // affecté à la natation
  basketteuse: '', // affectée au basket
  passante: '', // affectée à la natation l'an passé seulement
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const donnees = <T>(r: Awaited<ReturnType<typeof executer>>, champ: string) => {
  expect(r.errors).toBeUndefined()
  return (r.data as Record<string, T>)[champ]!
}

const h = (heure: string, jour = '2027-06-05') =>
  new Date(`${jour}T${heure}:00+02:00`)

/** Une candidature déposée, telle que la page publique l'écrira (étage suivant). */
async function deposer(entree: {
  appelId: string
  nom: string
  courriel?: string | null
  sequences?: string[]
  ouAilleurs?: boolean
  plages?: [Date, Date][]
  statut?: 'EN_ATTENTE' | 'LISTE_ATTENTE'
}) {
  const courriel =
    entree.courriel === undefined
      ? `${randomUUID()}@exemple.fr`
      : entree.courriel
  return prisma.candidature.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      editionId: ids.edition,
      appelId: entree.appelId,
      nom: entree.nom,
      courriel,
      courrielEnAttente: courriel,
      telephone: '0639980000',
      message: 'Je viens avec une amie.',
      precisionsDisponibilite: 'Plutôt le matin.',
      ouAilleurs: entree.ouAilleurs ?? false,
      accordLe: new Date(),
      choix: {
        create: (entree.sequences ?? []).map(sequenceId => ({
          sequenceId,
          statut: entree.statut ?? 'EN_ATTENTE',
        })),
      },
      plages: {
        create: (entree.plages ?? []).map(([debut, fin]) => ({
          editionId: ids.edition,
          debut,
          fin,
        })),
      },
    },
    include: { choix: true },
  })
}

const CANDIDATURES = `query ($e: ID!, $st: StatutCandidature) { candidatures(editionId: $e, statut: $st) { id nom courriel telephone ouAilleurs peutEcarter choix { id sequenceId statut peutTraiter } plages { jour heureDebut heureFin } } }`
const ACCEPTER = `mutation ($id: ID!) { accepterChoixCandidature(id: $id) { id statut benevoleId choix { sequenceId statut } } }`
const REFUSER = `mutation ($id: ID!) { refuserChoixCandidature(id: $id) { id statut choix { sequenceId statut } } }`
const CREER_APPEL = `mutation ($e: ID!, $po: PorteeAppel!, $p: ID, $sq: ID, $o: DateTime!, $f: DateTime!) {
  creerAppelBenevoles(editionId: $e, portee: $po, perimetreId: $p, sequenceId: $sq, nom: "Appel", ouvertLe: $o, fermeLe: $f) {
    adresse appel { id etat portee finAdresse version peutModifier perimetre { id } }
  }
}`
const PLACER = `mutation ($sq: ID!, $c: ID, $b: ID) { placerBenevole(sequenceId: $sq, candidatureId: $c, benevoleId: $b) { id version renforts places { id benevoleId etat } } }`
const A_REPARTIR = `query ($e: ID!, $sq: ID) { benevolesARepartir(editionId: $e, sequenceId: $sq) { cle candidatureId benevoleId nom adequation precisionsDisponibilite note choix { sequenceId } places { sequenceId } } }`

interface CandidatureLue {
  id: string
  nom: string
  courriel: string | null
  telephone: string | null
  ouAilleurs: boolean
  peutEcarter: boolean
  choix: {
    id: string
    sequenceId: string
    statut: string
    peutTraiter: boolean
  }[]
  plages: { jour: string; heureDebut: string; heureFin: string }[]
}

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
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
  const anPasse = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      annee: 2025,
      nom: 'Tournoi 2025',
      debut: new Date('2025-06-07'),
      fin: new Date('2025-06-08'),
      statut: 'ARCHIVEE',
    },
  })
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
    ['accueil', null, '08:00', '10:00', 2],
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
  for (const cle of [
    'adminActivite',
    'referent',
    'basketteuse',
    'passante',
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle.toLowerCase()}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
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
      {
        userId: ids.passante,
        perimetreId: ids.natation,
        editionId: anPasse.id,
      },
    ],
  })
  const appel = (portee: 'PERIODE' | 'PERIMETRE', perimetreId: string | null) =>
    prisma.appelBenevoles.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        portee,
        perimetreId,
        nom: `Appel ${portee} ${perimetreId ?? ''}`,
        ouvertLe: new Date(),
        fermeLe: h('20:00', '2027-06-06'),
        sel: nouveauSel(),
        empreinte: empreinteJeton(randomUUID()),
        fin: 'abcdef',
      },
    })
  ids.appelPeriode = (await appel('PERIODE', null)).id
  ids.appelNatation = (await appel('PERIMETRE', ids.natation)).id
  ids.appelBasket = (await appel('PERIMETRE', ids.basket)).id
  ids.saisie = (
    await prisma.benevole.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        nom: 'Fiche saisie',
        note: 'Note réservée',
        accordLe: new Date(),
        creeParId: ids.adminActivite,
      },
    })
  ).id
})

afterAll(async () => {
  await prisma.candidature.deleteMany({ where: { organisationId: ids.org } })
  await prisma.appelBenevoles.deleteMany({ where: { organisationId: ids.org } })
  await prisma.sequence.deleteMany({ where: { organisationId: ids.org } })
  await prisma.benevole.deleteMany({ where: { organisationId: ids.org } })
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

describe('appels', () => {
  const dates = {
    o: new Date().toISOString(),
    f: h('20:00', '2027-06-06').toISOString(),
  }

  it('s’ouvrent par un admin sur la période, avec une adresse lisible une fois', async () => {
    const r = donnees<{
      adresse: string
      appel: { id: string; etat: string; finAdresse: string }
    }>(
      await executer(ids.adminActivite, CREER_APPEL, {
        e: ids.edition,
        po: 'PERIODE',
        ...dates,
      }),
      'creerAppelBenevoles'
    )
    const jeton = /\/benevoles\/([A-Za-z0-9_-]{43})$/.exec(r.adresse)?.[1]
    expect(jeton).toBeDefined()
    expect(r.appel.etat).toBe('OUVERT')
    expect(jeton!.endsWith(r.appel.finAdresse)).toBe(true)
    const enBase = await prisma.appelBenevoles.findUniqueOrThrow({
      where: { id: r.appel.id },
    })
    expect(enBase.empreinte).toBe(empreinteJeton(jeton!))
    // Le jeton lui-même n'est gardé nulle part.
    expect(JSON.stringify(enBase)).not.toContain(jeton)
  })

  it('s’ouvrent par une personne qui écrit dans un périmètre, pour ce périmètre seulement', async () => {
    const pourNatation = await executer(ids.referent, CREER_APPEL, {
      e: ids.edition,
      po: 'PERIMETRE',
      p: ids.natation,
      ...dates,
    })
    expect(pourNatation.errors).toBeUndefined()
    const pourSequence = await executer(ids.referent, CREER_APPEL, {
      e: ids.edition,
      po: 'SEQUENCE',
      sq: ids.relais,
      ...dates,
    })
    expect(pourSequence.errors).toBeUndefined()
    for (const variables of [
      { po: 'PERIODE' },
      { po: 'PERIMETRE', p: ids.basket },
      { po: 'SEQUENCE', sq: ids.buvette },
      // Une séquence sans périmètre relève des admins.
      { po: 'SEQUENCE', sq: ids.accueil },
    ]) {
      const r = await executer(ids.referent, CREER_APPEL, {
        e: ids.edition,
        ...dates,
        ...variables,
      })
      expect(code(r)).toBe('FORBIDDEN')
    }
    // Une personne affectée seulement à une période archivée n'écrit rien.
    expect(
      code(
        await executer(ids.passante, CREER_APPEL, {
          e: ids.edition,
          po: 'PERIMETRE',
          p: ids.natation,
          ...dates,
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('refusent une fermeture après la période', async () => {
    const r = await executer(ids.adminActivite, CREER_APPEL, {
      e: ids.edition,
      po: 'PERIODE',
      o: dates.o,
      f: h('00:30', '2027-06-07').toISOString(),
    })
    expect(r.errors?.[0]?.message).toMatch(/fin du dernier jour/)
  })

  it('se modifient avec la version lue, se ferment, se rouvrent et changent d’adresse', async () => {
    const { appel, adresse } = donnees<{
      adresse: string
      appel: { id: string; version: number }
    }>(
      await executer(ids.referent, CREER_APPEL, {
        e: ids.edition,
        po: 'PERIMETRE',
        p: ids.natation,
        ...dates,
      }),
      'creerAppelBenevoles'
    )
    // L'adresse se recopie à tout moment : le serveur la recalcule.
    const recopiee = donnees<{ id: string; adresse: string | null }[]>(
      await executer(
        ids.referent,
        `query ($e: ID!) { appelsBenevoles(editionId: $e) { id adresse } }`,
        { e: ids.edition }
      ),
      'appelsBenevoles'
    ).find(a => a.id === appel.id)
    expect(recopiee?.adresse).toBe(adresse)
    const MODIFIER = `mutation ($id: ID!, $o: DateTime!, $f: DateTime!, $v: Int!) { modifierAppelBenevoles(id: $id, nom: "Renfort natation", ouvertLe: $o, fermeLe: $f, versionAttendue: $v) { nom version } }`
    expect(
      donnees<{ version: number }>(
        await executer(ids.referent, MODIFIER, {
          id: appel.id,
          ...dates,
          v: 0,
        }),
        'modifierAppelBenevoles'
      ).version
    ).toBe(1)
    expect(
      code(
        await executer(ids.referent, MODIFIER, { id: appel.id, ...dates, v: 0 })
      )
    ).toBe('CONFLIT_VERSION')
    // Une autre référente ne touche pas à l'appel de la natation.
    expect(
      code(
        await executer(ids.basketteuse, MODIFIER, {
          id: appel.id,
          ...dates,
          v: 1,
        })
      )
    ).toBe('FORBIDDEN')

    const fermer = await executer(
      ids.referent,
      'mutation ($id: ID!) { fermerAppelBenevoles(id: $id) { etat } }',
      { id: appel.id }
    )
    expect(donnees<{ etat: string }>(fermer, 'fermerAppelBenevoles').etat).toBe(
      'FERME'
    )
    const rouvrir = await executer(
      ids.referent,
      'mutation ($id: ID!) { rouvrirAppelBenevoles(id: $id) { etat } }',
      { id: appel.id }
    )
    expect(
      donnees<{ etat: string }>(rouvrir, 'rouvrirAppelBenevoles').etat
    ).toBe('OUVERT')
    const avant = await prisma.appelBenevoles.findUniqueOrThrow({
      where: { id: appel.id },
    })
    const nouvelle = donnees<{ adresse: string }>(
      await executer(
        ids.referent,
        'mutation ($id: ID!) { renouvelerAdresseAppelBenevoles(id: $id) { adresse } }',
        { id: appel.id }
      ),
      'renouvelerAdresseAppelBenevoles'
    )
    const apres = await prisma.appelBenevoles.findUniqueOrThrow({
      where: { id: appel.id },
    })
    expect(apres.empreinte).not.toBe(avant.empreinte)
    expect(apres.empreinte).toBe(
      empreinteJeton(nouvelle.adresse.split('/').at(-1)!)
    )
  })

  it('se listent selon les droits de la personne', async () => {
    const LISTE = `query ($e: ID!) { appelsBenevoles(editionId: $e) { id portee peutModifier adresse perimetre { id } } }`
    const pourAdmin = donnees<{ id: string }[]>(
      await executer(ids.adminActivite, LISTE, { e: ids.edition }),
      'appelsBenevoles'
    )
    const pourBasket = donnees<
      {
        id: string
        portee: string
        peutModifier: boolean
        adresse: string | null
        perimetre: { id: string } | null
      }[]
    >(
      await executer(ids.basketteuse, LISTE, { e: ids.edition }),
      'appelsBenevoles'
    )
    expect(pourAdmin.map(a => a.id)).toContain(ids.appelNatation)
    expect(pourBasket.map(a => a.id)).not.toContain(ids.appelNatation)
    expect(pourBasket.find(a => a.id === ids.appelPeriode)).toMatchObject({
      peutModifier: false,
      // L'adresse ne se recopie que par les personnes qui gèrent l'appel.
      adresse: null,
    })
    const basket = pourBasket.find(a => a.id === ids.appelBasket)
    expect(basket?.peutModifier).toBe(true)
    expect(basket?.adresse).toMatch(/\/benevoles\/[A-Za-z0-9_-]{43}$/)
    expect(code(await executer(ids.passante, LISTE, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
    expect(code(await executer(null, LISTE, { e: ids.edition }))).toBeDefined()
  })
})

describe('candidatures', () => {
  it('se lisent par les personnes qui peuvent les traiter, et chacune ne voit que ses choix', async () => {
    const mixte = await deposer({
      appelId: ids.appelPeriode,
      nom: 'Camille Mixte',
      sequences: [ids.finales, ids.buvette],
      plages: [[h('08:00'), h('13:00')]],
    })
    const ailleurs = await deposer({
      appelId: ids.appelPeriode,
      nom: 'Sacha Ailleurs',
      ouAilleurs: true,
    })
    const basketSeul = await deposer({
      appelId: ids.appelBasket,
      nom: 'Noa Basket',
      ouAilleurs: true,
    })
    const lues = (qui: string) =>
      executer(qui, CANDIDATURES, { e: ids.edition }).then(r =>
        donnees<CandidatureLue[]>(r, 'candidatures')
      )
    const parReferent = await lues(ids.referent)
    const camille = parReferent.find(c => c.id === mixte.id)!
    expect(camille.choix.map(c => c.sequenceId)).toEqual([ids.finales])
    expect(camille.courriel).not.toBeNull()
    expect(camille.plages).toEqual([
      { jour: '2027-06-05', heureDebut: '08:00', heureFin: '13:00' },
    ])
    expect(camille.peutEcarter).toBe(false)
    expect(parReferent.map(c => c.id)).toContain(ailleurs.id)
    expect(parReferent.map(c => c.id)).not.toContain(basketSeul.id)

    const parAdmin = await lues(ids.adminActivite)
    expect(parAdmin.find(c => c.id === mixte.id)!.choix).toHaveLength(2)
    expect(parAdmin.map(c => c.id)).toContain(basketSeul.id)

    expect(
      code(await executer(ids.passante, CANDIDATURES, { e: ids.edition }))
    ).toBe('FORBIDDEN')
  })

  it('s’acceptent : la fiche naît avec une place à confirmer et les plages', async () => {
    const depot = await deposer({
      appelId: ids.appelNatation,
      nom: 'Lou Accepté',
      courriel: `lou-${s}@exemple.fr`,
      sequences: [ids.finales, ids.relais],
      plages: [[h('09:00'), h('16:00')]],
    })
    const choixFinales = depot.choix.find(c => c.sequenceId === ids.finales)!
    // Une autre référente ne traite pas ce choix.
    expect(
      code(await executer(ids.basketteuse, ACCEPTER, { id: choixFinales.id }))
    ).toBe('FORBIDDEN')
    const apres = donnees<{
      statut: string
      benevoleId: string
      choix: { sequenceId: string; statut: string }[]
    }>(
      await executer(ids.referent, ACCEPTER, { id: choixFinales.id }),
      'accepterChoixCandidature'
    )
    expect(apres.statut).toBe('EN_ATTENTE')
    const fiche = await prisma.benevole.findUniqueOrThrow({
      where: { id: apres.benevoleId },
      include: { places: true, plages: true },
    })
    expect(fiche).toMatchObject({
      nom: 'Lou Accepté',
      courriel: `lou-${s}@exemple.fr`,
      origine: 'CANDIDATURE',
      creeParId: ids.referent,
    })
    expect(fiche.places).toEqual([
      expect.objectContaining({
        sequenceId: ids.finales,
        role: 'RENFORT',
        confirmeeLe: null,
      }),
    ])
    expect(fiche.plages.map(p => [p.debut, p.fin])).toEqual([
      [h('09:00'), h('16:00')],
    ])
    // Le second choix accepté clôt la candidature et libère son adresse.
    const choixRelais = depot.choix.find(c => c.sequenceId === ids.relais)!
    const close = donnees<{ statut: string }>(
      await executer(ids.referent, ACCEPTER, { id: choixRelais.id }),
      'accepterChoixCandidature'
    )
    expect(close.statut).toBe('TRAITEE')
    const enBase = await prisma.candidature.findUniqueOrThrow({
      where: { id: depot.id },
    })
    expect(enBase.courrielEnAttente).toBeNull()

    // Une nouvelle candidature de la même adresse rejoint la même fiche.
    const encore = await deposer({
      appelId: ids.appelPeriode,
      nom: 'Lou Accepté',
      courriel: `lou-${s}@exemple.fr`,
      sequences: [ids.accueil],
    })
    const rattachee = donnees<{ benevoleId: string }>(
      await executer(ids.adminActivite, ACCEPTER, { id: encore.choix[0]!.id }),
      'accepterChoixCandidature'
    )
    expect(rattachee.benevoleId).toBe(fiche.id)
  })

  it('se refusent sans fiche, et une candidature entière par la personne qui gère l’appel', async () => {
    const depot = await deposer({
      appelId: ids.appelPeriode,
      nom: 'Eden Refusé',
      sequences: [ids.relais, ids.buvette],
      ouAilleurs: true,
    })
    const relais = depot.choix.find(c => c.sequenceId === ids.relais)!
    const r = donnees<{ choix: { statut: string }[] }>(
      await executer(ids.referent, REFUSER, { id: relais.id }),
      'refuserChoixCandidature'
    )
    expect(r.choix).toEqual([expect.objectContaining({ statut: 'REFUSE' })])
    expect(code(await executer(ids.referent, REFUSER, { id: relais.id }))).toBe(
      'SAISIE_INVALIDE'
    )
    const ECARTER = `mutation ($id: ID!) { refuserCandidature(id: $id) { statut } }`
    // Un appel de période se gère par les admins seulement.
    expect(code(await executer(ids.referent, ECARTER, { id: depot.id }))).toBe(
      'FORBIDDEN'
    )
    expect(
      donnees<{ statut: string }>(
        await executer(ids.adminActivite, ECARTER, { id: depot.id }),
        'refuserCandidature'
      ).statut
    ).toBe('TRAITEE')
    const enBase = await prisma.candidature.findUniqueOrThrow({
      where: { id: depot.id },
      include: { choix: true },
    })
    expect(enBase.benevoleId).toBeNull()
    expect(enBase.choix.every(c => c.statut === 'REFUSE')).toBe(true)
  })
})

describe('répartition', () => {
  it('place une candidature sans choix, et une fiche saisie naît confirmée', async () => {
    const ailleurs = await deposer({
      appelId: ids.appelPeriode,
      nom: 'Mia Disponible',
      ouAilleurs: true,
      plages: [[h('08:00'), h('12:00')]],
    })
    const versionAvant = (
      await prisma.sequence.findUniqueOrThrow({ where: { id: ids.finales } })
    ).version
    const placee = donnees<{
      version: number
      places: { benevoleId: string | null; etat: string }[]
    }>(
      await executer(ids.referent, PLACER, { sq: ids.finales, c: ailleurs.id }),
      'placerBenevole'
    )
    expect(placee.version).toBe(versionAvant + 1)
    const fiche = await prisma.candidature.findUniqueOrThrow({
      where: { id: ailleurs.id },
    })
    expect(placee.places).toContainEqual(
      expect.objectContaining({
        benevoleId: fiche.benevoleId,
        etat: 'A_CONFIRMER',
      })
    )
    expect(fiche.statut).toBe('TRAITEE')

    const saisie = donnees<{
      places: { benevoleId: string | null; etat: string }[]
    }>(
      await executer(ids.adminActivite, PLACER, {
        sq: ids.accueil,
        b: ids.saisie,
      }),
      'placerBenevole'
    )
    expect(saisie.places).toContainEqual(
      expect.objectContaining({ benevoleId: ids.saisie, etat: 'CONFIRMEE' })
    )
    expect(
      code(
        await executer(ids.adminActivite, PLACER, {
          sq: ids.accueil,
          b: ids.saisie,
        })
      )
    ).toBe('SAISIE_INVALIDE')
    // Une autre référente n'écrit pas la séquence de la natation.
    expect(
      code(
        await executer(ids.basketteuse, PLACER, {
          sq: ids.finales,
          b: ids.saisie,
        })
      )
    ).toBe('FORBIDDEN')
    // Une candidature d'un appel du basket ne se voit pas depuis la natation.
    const basket = await deposer({
      appelId: ids.appelBasket,
      nom: 'Ilan Basket',
      ouAilleurs: true,
    })
    expect(
      code(
        await executer(ids.referent, PLACER, { sq: ids.finales, c: basket.id })
      )
    ).toBe('FORBIDDEN')
  })

  it('lit les bénévoles à répartir, classés pour une séquence, sans coordonnée', async () => {
    const plages = await deposer({
      appelId: ids.appelPeriode,
      nom: 'Zoé Totale',
      ouAilleurs: true,
      plages: [[h('13:00'), h('17:00')]],
    })
    const partielle = await deposer({
      appelId: ids.appelPeriode,
      nom: 'Adam Partiel',
      ouAilleurs: true,
      plages: [[h('15:00'), h('18:00')]],
    })
    const liste = donnees<
      {
        candidatureId: string | null
        nom: string
        adequation: string
        note: string | null
      }[]
    >(
      await executer(ids.basketteuse, A_REPARTIR, {
        e: ids.edition,
        sq: ids.relais,
      }),
      'benevolesARepartir'
    )
    const rang = (id: string) => liste.findIndex(r => r.candidatureId === id)
    expect(rang(plages.id)).toBeGreaterThanOrEqual(0)
    expect(rang(plages.id)).toBeLessThan(rang(partielle.id))
    expect(liste[rang(plages.id)]!.adequation).toBe('TOTALE')
    expect(liste[rang(partielle.id)]!.adequation).toBe('PARTIELLE')
    // Le type n'a ni adresse ni téléphone ; la note reste à qui la lit.
    const fiche = await prisma.plageDisponibilite.create({
      data: {
        editionId: ids.edition,
        benevoleId: ids.saisie,
        debut: h('08:00'),
        fin: h('18:00'),
      },
    })
    const pourBasket = donnees<
      { benevoleId: string | null; note: string | null }[]
    >(
      await executer(ids.basketteuse, A_REPARTIR, { e: ids.edition }),
      'benevolesARepartir'
    )
    expect(pourBasket.find(r => r.benevoleId === ids.saisie)?.note).toBeNull()
    const pourAdmin = donnees<
      { benevoleId: string | null; note: string | null }[]
    >(
      await executer(ids.adminActivite, A_REPARTIR, { e: ids.edition }),
      'benevolesARepartir'
    )
    expect(pourAdmin.find(r => r.benevoleId === ids.saisie)?.note).toBe(
      'Note réservée'
    )
    await prisma.plageDisponibilite.delete({ where: { id: fiche.id } })
    expect(
      (
        await executer(
          ids.basketteuse,
          `query ($e: ID!) { benevolesARepartir(editionId: $e) { courriel } }`,
          { e: ids.edition }
        )
      ).errors
    ).toBeDefined()
    expect(
      code(await executer(ids.passante, A_REPARTIR, { e: ids.edition }))
    ).toBe('FORBIDDEN')
  })

  it('calcule la couverture du programme par tranches', async () => {
    const tranches = donnees<
      {
        debut: string
        besoin: number
        confirmees: number
        aConfirmer: number
      }[]
    >(
      await executer(
        ids.adminActivite,
        `query ($e: ID!, $p: [ID!]) { couvertureProgramme(editionId: $e, perimetreIds: $p) { debut jour heure besoin confirmees aConfirmer disponibles } }`,
        { e: ids.edition, p: [ids.natation] }
      ),
      'couvertureProgramme'
    )
    const debuts = tranches.map(t => new Date(t.debut).toISOString())
    expect(debuts[0]).toBe(h('09:00').toISOString())
    expect(debuts.at(-1)).toBe(h('15:30').toISOString())
    expect(tranches[debuts.indexOf(h('14:00').toISOString())]?.besoin).toBe(1)
    // Le jour et l'heure se lisent dans le fuseau de l'organisation.
    expect(tranches[0]).toMatchObject({ jour: '2027-06-05', heure: '09:00' })
  })

  it('remplace les plages d’une fiche par les personnes qui la modifient', async () => {
    const PLAGES = `mutation ($b: ID!, $e: ID!, $pl: [PlageDisponibiliteInput!]!) { modifierPlagesBenevole(benevoleId: $b, editionId: $e, plages: $pl) { jour heureDebut heureFin } }`
    const pl = [{ jour: '2027-06-05', heureDebut: '08:00', heureFin: '11:00' }]
    expect(
      donnees<unknown[]>(
        await executer(ids.adminActivite, PLAGES, {
          b: ids.saisie,
          e: ids.edition,
          pl,
        }),
        'modifierPlagesBenevole'
      )
    ).toEqual([{ jour: '2027-06-05', heureDebut: '08:00', heureFin: '11:00' }])
    expect(
      code(
        await executer(ids.referent, PLAGES, {
          b: ids.saisie,
          e: ids.edition,
          pl,
        })
      )
    ).toBe('FORBIDDEN')
    const r = await executer(ids.adminActivite, PLAGES, {
      b: ids.saisie,
      e: ids.edition,
      pl: [{ jour: '2027-06-10', heureDebut: '08:00', heureFin: '11:00' }],
    })
    expect(r.errors?.[0]?.message).toMatch(/jours de la période/)
  })
})

describe('séquences', () => {
  it('portent un besoin et des consignes, gardés par un client qui les ignore', async () => {
    const CREER = `mutation ($e: ID!, $p: ID) { creerSequence(editionId: $e, perimetreId: $p, titre: "Chronométrage", jour: "2027-06-05", heureDebut: "09:00", heureFin: "10:00", besoinBenevoles: 4, consignesBenevoles: "Rendez-vous au bord du bassin.") { id version besoinBenevoles consignesBenevoles renforts } }`
    const creee = donnees<{
      id: string
      besoinBenevoles: number
      consignesBenevoles: string
      renforts: number
    }>(
      await executer(ids.referent, CREER, { e: ids.edition, p: ids.natation }),
      'creerSequence'
    )
    expect(creee).toMatchObject({
      besoinBenevoles: 4,
      consignesBenevoles: 'Rendez-vous au bord du bassin.',
      renforts: 0,
    })
    const modifiee = donnees<{
      besoinBenevoles: number
      consignesBenevoles: string
    }>(
      await executer(
        ids.referent,
        `mutation ($id: ID!) { modifierSequence(id: $id, titre: "Chrono", jour: "2027-06-05", heureDebut: "09:00", heureFin: "10:00", versionAttendue: 0) { besoinBenevoles consignesBenevoles } }`,
        { id: creee.id }
      ),
      'modifierSequence'
    )
    expect(modifiee).toEqual({
      besoinBenevoles: 4,
      consignesBenevoles: 'Rendez-vous au bord du bassin.',
    })
  })

  it('signalent une place à confirmer depuis sept jours', async () => {
    const place = await prisma.placeSequence.findFirstOrThrow({
      where: { sequenceId: ids.finales, confirmeeLe: null },
    })
    await prisma.placeSequence.update({
      where: { id: place.id },
      data: { createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000) },
    })
    const programme = donnees<
      { id: string; places: { id: string; etat: string }[] }[]
    >(
      await executer(
        ids.referent,
        `query ($e: ID!) { programme(editionId: $e) { id places { id etat } } }`,
        { e: ids.edition }
      ),
      'programme'
    )
    expect(
      programme
        .find(sq => sq.id === ids.finales)!
        .places.find(p => p.id === place.id)?.etat
    ).toBe('NON_CONFIRMEE')
  })
})

describe('purge', () => {
  it('supprime les candidatures et les plages d’une période archivée', async () => {
    const depot = await deposer({
      appelId: ids.appelPeriode,
      nom: 'Purge',
      ouAilleurs: true,
      plages: [[h('08:00'), h('09:00')]],
    })
    await prisma.edition.update({
      where: { id: ids.edition },
      data: { statut: 'ARCHIVEE' },
    })
    try {
      const compte = await purgerCandidatures(prisma, {
        organisationId: ids.org,
      })
      expect(compte.candidatures).toBeGreaterThan(0)
      expect(await prisma.candidature.count({ where: { id: depot.id } })).toBe(
        0
      )
      expect(
        await prisma.plageDisponibilite.count({
          where: { editionId: ids.edition },
        })
      ).toBe(0)
    } finally {
      await prisma.edition.update({
        where: { id: ids.edition },
        data: { statut: 'PREPARATION' },
      })
    }
  })
})
