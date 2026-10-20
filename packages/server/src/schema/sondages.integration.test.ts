import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import {
  composerNotifications,
  SELECTION_NOTIFICATION,
} from '../lib/composition-notifications.ts'

import { schema } from './index.ts'

// Sondages de dates (ADR 0037). Les personnes qui écrivent dans un agenda créent,
// modifient, closent et suppriment ses sondages ; les personnes visées répondent.
// Un sondage de périmètre ne s'ouvre pas en consultation. Les contrôles se
// prouvent par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const slug = `sondages-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  autreActivite: '',
  edition: '',
  natation: '',
  basket: '',
  adminActivite: '',
  referent: '', // affecté à la natation
  nageuse: '', // affectée à la natation
  basketteuse: '', // affectée au basket : consulte la natation
  etrangere: '', // référente de l'autre activité
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

const CHAMPS = `id titre statut peutModifier estParticipant aRepondu participants repondants reunionId version
  creneaux { id jour heureDebut heureFin retenu oui siBesoin non monChoix reponses { personneId choix } }`
const CREER = `mutation ($e: ID!, $p: ID, $t: String!, $c: [CreneauSondageInput!]!, $cible: CibleConvocation!, $u: [ID!]) {
  creerSondage(editionId: $e, perimetreId: $p, titre: $t, creneaux: $c, cible: $cible, personneIds: $u) { ${CHAMPS} }
}`
const MODIFIER = `mutation ($id: ID!, $t: String!, $c: [CreneauSondageInput!]!, $v: Int!) {
  modifierSondage(id: $id, titre: $t, creneaux: $c, versionAttendue: $v) { ${CHAMPS} }
}`
const REPONDRE = `mutation ($id: ID!, $r: [ReponseSondageInput!]!) { repondreSondage(id: $id, reponses: $r) { ${CHAMPS} } }`
const CLORE = `mutation ($id: ID!, $c: ID!) { cloreSondage(id: $id, creneauId: $c) { ${CHAMPS} } }`
const SUPPRIMER = `mutation ($id: ID!) { supprimerSondage(id: $id) }`
const LIRE = `query ($id: ID!) { sondage(id: $id) { ${CHAMPS} } }`
const LISTE = `query ($e: ID!) { sondages(editionId: $e) { id titre } }`

interface Creneau {
  id: string
  jour: string
  heureDebut: string | null
  retenu: boolean
  oui: number
  siBesoin: number
  non: number
  monChoix: string | null
  reponses: { personneId: string; choix: string }[]
}
interface Sondage {
  id: string
  statut: string
  peutModifier: boolean
  estParticipant: boolean
  aRepondu: boolean
  participants: number
  repondants: number
  reunionId: string | null
  version: number
  creneaux: Creneau[]
}

const donnees = <T>(r: Awaited<ReturnType<typeof executer>>, champ: string) => {
  expect(r.errors).toBeUndefined()
  return (r.data as Record<string, T>)[champ]!
}

const CRENEAUX = [
  { jour: '2027-03-02', heureDebut: '18:30', heureFin: '20:00' },
  { jour: '2027-03-01', heureDebut: '18:30', heureFin: '20:00' },
  { jour: '2027-03-03' },
]

async function sondageNatation(): Promise<Sondage> {
  return donnees<Sondage>(
    await executer(ids.referent, CREER, {
      e: ids.edition,
      p: ids.natation,
      t: 'Date du point natation',
      c: CRENEAUX,
      cible: 'PERIMETRE',
    }),
    'creerSondage'
  )
}

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
  for (const [cle, slugActivite] of [
    ['activite', slug],
    ['autreActivite', `${slug}-b`],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.org,
          slug: slugActivite,
          nom: 'Tournoi',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      })
    ).id
  }
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
  const autreEdition = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.autreActivite,
      annee: 2027,
      nom: 'Autre',
      debut: new Date('2027-06-05'),
      fin: new Date('2027-06-06'),
    },
  })
  const tennis = await prisma.perimetre.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.autreActivite,
      slug: 'tennis',
      nom: 'Tennis',
      type: 'SPORT',
      groupe: 'sport',
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
  for (const cle of [
    'adminActivite',
    'referent',
    'nageuse',
    'basketteuse',
    'etrangere',
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
        userId: ids.nageuse,
        perimetreId: ids.natation,
        editionId: ids.edition,
      },
      {
        userId: ids.basketteuse,
        perimetreId: ids.basket,
        editionId: ids.edition,
      },
      {
        userId: ids.etrangere,
        perimetreId: tennis.id,
        editionId: autreEdition.id,
      },
    ],
  })
})

afterAll(async () => {
  await prisma.sondage.deleteMany({ where: { organisationId: ids.org } })
  await prisma.reunion.deleteMany({ where: { organisationId: ids.org } })
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
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

describe('sondage d’un périmètre', () => {
  it('se crée par un référent, vise le périmètre et prévient les autres personnes', async () => {
    const sondage = await sondageNatation()
    expect(sondage).toMatchObject({
      statut: 'OUVERT',
      peutModifier: true,
      estParticipant: true,
      participants: 2,
      repondants: 0,
    })
    expect(sondage.creneaux.map(c => [c.jour, c.heureDebut])).toEqual([
      ['2027-03-01', '18:30'],
      ['2027-03-02', '18:30'],
      ['2027-03-03', null],
    ])
    const notifications = await prisma.notification.findMany({
      where: { sondageId: sondage.id },
      select: SELECTION_NOTIFICATION,
    })
    expect(notifications.map(n => n.type)).toEqual(['SONDAGE_OUVERT'])
    const [composee] = await composerNotifications(
      prisma,
      notifications,
      ids.nageuse
    )
    expect(composee?.message).toBe(
      `referent ${s} vous demande vos disponibilités : « Date du point natation ».`
    )
    expect(composee?.lien).toBe(
      `/${slug}/agenda?edition=${ids.edition}&sondage=${sondage.id}`
    )
  })

  it('recueille les réponses des personnes visées, et refuse les autres', async () => {
    const sondage = await sondageNatation()
    const [premier, second, troisieme] = sondage.creneaux
    const repondu = donnees<Sondage>(
      await executer(ids.nageuse, REPONDRE, {
        id: sondage.id,
        r: [
          { creneauId: premier!.id, choix: 'OUI' },
          { creneauId: second!.id, choix: 'SI_BESOIN' },
          { creneauId: troisieme!.id, choix: 'NON' },
        ],
      }),
      'repondreSondage'
    )
    expect(repondu.aRepondu).toBe(true)
    expect(repondu.repondants).toBe(1)
    expect(
      repondu.creneaux.map(c => [c.oui, c.siBesoin, c.non, c.monChoix])
    ).toEqual([
      [1, 0, 0, 'OUI'],
      [0, 1, 0, 'SI_BESOIN'],
      [0, 0, 1, 'NON'],
    ])
    // La basketteuse consulte la natation : elle ne lit pas ce sondage.
    for (const requete of [LIRE, REPONDRE]) {
      expect(
        code(
          await executer(ids.basketteuse, requete, {
            id: sondage.id,
            r: [{ creneauId: premier!.id, choix: 'OUI' }],
          })
        )
      ).toBe('FORBIDDEN')
    }
    const liste = donnees<{ id: string }[]>(
      await executer(ids.basketteuse, LISTE, { e: ids.edition }),
      'sondages'
    )
    expect(liste.map(l => l.id)).not.toContain(sondage.id)
    // Un créneau d'un autre sondage vaut un créneau inconnu.
    const autre = await sondageNatation()
    expect(
      code(
        await executer(ids.nageuse, REPONDRE, {
          id: autre.id,
          r: [{ creneauId: premier!.id, choix: 'OUI' }],
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('se modifie avec la version lue : un créneau retiré perd ses réponses', async () => {
    const sondage = await sondageNatation()
    const [premier, second] = sondage.creneaux
    donnees(
      await executer(ids.nageuse, REPONDRE, {
        id: sondage.id,
        r: [{ creneauId: premier!.id, choix: 'OUI' }],
      }),
      'repondreSondage'
    )
    const modifie = donnees<Sondage>(
      await executer(ids.referent, MODIFIER, {
        id: sondage.id,
        t: 'Date du point',
        c: [
          {
            id: second!.id,
            jour: second!.jour,
            heureDebut: '18:30',
            heureFin: '20:00',
          },
          { jour: '2027-03-04' },
        ],
        v: 0,
      }),
      'modifierSondage'
    )
    expect(modifie.creneaux.map(c => c.jour)).toEqual([
      '2027-03-02',
      '2027-03-04',
    ])
    expect(modifie.repondants).toBe(0)
    expect(
      code(
        await executer(ids.referent, MODIFIER, {
          id: sondage.id,
          t: 'Conflit',
          c: [{ jour: '2027-03-04' }],
          v: 0,
        })
      )
    ).toBe('CONFLIT_VERSION')
    expect(
      code(
        await executer(ids.nageuse, MODIFIER, {
          id: sondage.id,
          t: 'Date du point',
          c: [{ id: premier!.id, jour: '2027-03-01' }],
          v: 0,
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('se clôt sur un créneau, puis donne sa réunion', async () => {
    const sondage = await sondageNatation()
    const retenu = sondage.creneaux[0]!
    const clos = donnees<Sondage>(
      await executer(ids.referent, CLORE, { id: sondage.id, c: retenu.id }),
      'cloreSondage'
    )
    expect(clos.statut).toBe('CLOS')
    expect(clos.creneaux[0]!.retenu).toBe(true)
    expect(
      code(
        await executer(ids.nageuse, REPONDRE, {
          id: sondage.id,
          r: [{ creneauId: retenu.id, choix: 'NON' }],
        })
      )
    ).toBe('SAISIE_INVALIDE')
    const CREER_REUNION = `mutation ($e: ID!, $p: ID, $s: ID) { creerReunion(editionId: $e, perimetreId: $p, sondageId: $s, titre: "Point natation", jour: "2027-03-01", heureDebut: "18:30", heureFin: "20:00", cible: PERIMETRE) { id } }`
    const reunion = donnees<{ id: string }>(
      await executer(ids.referent, CREER_REUNION, {
        e: ids.edition,
        p: ids.natation,
        s: sondage.id,
      }),
      'creerReunion'
    )
    expect(
      donnees<Sondage>(
        await executer(ids.referent, LIRE, { id: sondage.id }),
        'sondage'
      ).reunionId
    ).toBe(reunion.id)
    // Un sondage ne donne qu'une réunion, et seulement dans son agenda.
    expect(
      code(
        await executer(ids.referent, CREER_REUNION, {
          e: ids.edition,
          p: ids.natation,
          s: sondage.id,
        })
      )
    ).toBe('SAISIE_INVALIDE')
    const ouvert = await sondageNatation()
    expect(
      code(
        await executer(ids.adminActivite, CREER_REUNION, {
          e: ids.edition,
          p: null,
          s: ouvert.id,
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('efface les réponses d’un créneau qui change de jour, pas d’un créneau déplacé', async () => {
    const sondage = await sondageNatation()
    const [premier, second, troisieme] = sondage.creneaux
    donnees(
      await executer(ids.nageuse, REPONDRE, {
        id: sondage.id,
        r: [
          { creneauId: premier!.id, choix: 'OUI' },
          { creneauId: second!.id, choix: 'OUI' },
        ],
      }),
      'repondreSondage'
    )
    const modifie = donnees<Sondage>(
      await executer(ids.referent, MODIFIER, {
        id: sondage.id,
        t: 'Date du point',
        c: [
          // Le premier créneau passe au 5 mars : une nouvelle proposition.
          {
            id: premier!.id,
            jour: '2027-03-05',
            heureDebut: '18:30',
            heureFin: '20:00',
          },
          // Le second garde son jour et ses heures.
          {
            id: second!.id,
            jour: second!.jour,
            heureDebut: '18:30',
            heureFin: '20:00',
          },
          { id: troisieme!.id, jour: troisieme!.jour },
        ],
        v: 0,
      }),
      'modifierSondage'
    )
    const parId = new Map(modifie.creneaux.map(c => [c.id, c]))
    expect(parId.get(premier!.id)?.oui).toBe(0)
    expect(parId.get(second!.id)?.oui).toBe(1)
  })

  it('ne se clôt qu’une fois, même sur deux demandes simultanées', async () => {
    const sondage = await sondageNatation()
    const [premier, second] = sondage.creneaux
    const reponses = await Promise.all([
      executer(ids.referent, CLORE, { id: sondage.id, c: premier!.id }),
      executer(ids.referent, CLORE, { id: sondage.id, c: second!.id }),
    ])
    expect(reponses.map(code).sort()).toEqual(['CONFLIT_VERSION', undefined])
    const lu = await prisma.sondage.findUniqueOrThrow({
      where: { id: sondage.id },
      select: { creneauRetenuId: true },
    })
    const gagnant = reponses.findIndex(r => code(r) === undefined)
    expect(lu.creneauRetenuId).toBe([premier!.id, second!.id][gagnant])
  })

  it('refuse les réponses quand la période est archivée', async () => {
    const sondage = await sondageNatation()
    const { statut } = await prisma.edition.findUniqueOrThrow({
      where: { id: ids.edition },
      select: { statut: true },
    })
    await prisma.edition.update({
      where: { id: ids.edition },
      data: { statut: 'ARCHIVEE' },
    })
    try {
      expect(
        code(
          await executer(ids.nageuse, REPONDRE, {
            id: sondage.id,
            r: [{ creneauId: sondage.creneaux[0]!.id, choix: 'OUI' }],
          })
        )
      ).toBe('SAISIE_INVALIDE')
    } finally {
      await prisma.edition.update({
        where: { id: ids.edition },
        data: { statut },
      })
    }
  })

  it('se supprime par une personne qui écrit dans le périmètre', async () => {
    const sondage = await sondageNatation()
    expect(
      code(await executer(ids.nageuse, SUPPRIMER, { id: sondage.id }))
    ).toBeUndefined()
    expect(await prisma.sondage.count({ where: { id: sondage.id } })).toBe(0)
  })
})

describe('sondage de l’agenda global', () => {
  it('se crée par un admin de l’activité, pour toute l’équipe', async () => {
    const sondage = donnees<Sondage>(
      await executer(ids.adminActivite, CREER, {
        e: ids.edition,
        t: 'Date de l’assemblée',
        c: [{ jour: '2027-02-01' }, { jour: '2027-02-08' }],
        cible: 'EQUIPE',
      }),
      'creerSondage'
    )
    expect(sondage.participants).toBe(4)
    const lu = donnees<Sondage>(
      await executer(ids.basketteuse, LIRE, { id: sondage.id }),
      'sondage'
    )
    expect(lu).toMatchObject({ estParticipant: true, peutModifier: false })
    const LIRE_IDS = `query ($id: ID!) { sondage(id: $id) { participantIds } }`
    expect(
      (await executer(ids.basketteuse, LIRE_IDS, { id: sondage.id })).data
    ).toEqual({ sondage: { participantIds: null } })
    expect(
      (
        (await executer(ids.adminActivite, LIRE_IDS, { id: sondage.id }))
          .data as { sondage: { participantIds: string[] } }
      ).sondage.participantIds
    ).toHaveLength(4)
  })

  it('réserve les réponses nominatives aux personnes visées', async () => {
    const sondage = donnees<Sondage>(
      await executer(ids.adminActivite, CREER, {
        e: ids.edition,
        t: 'Date du bureau',
        c: [{ jour: '2027-02-01' }],
        cible: 'CHOIX',
        u: [ids.referent],
      }),
      'creerSondage'
    )
    donnees(
      await executer(ids.referent, REPONDRE, {
        id: sondage.id,
        r: [{ creneauId: sondage.creneaux[0]!.id, choix: 'OUI' }],
      }),
      'repondreSondage'
    )
    // La nageuse voit l'activité sans être visée : elle lit les décomptes, pas
    // les noms.
    const lu = donnees<Sondage>(
      await executer(ids.nageuse, LIRE, { id: sondage.id }),
      'sondage'
    )
    expect(lu.creneaux[0]).toMatchObject({ oui: 1, reponses: [] })
    const vise = donnees<Sondage>(
      await executer(ids.referent, LIRE, { id: sondage.id }),
      'sondage'
    )
    expect(vise.creneaux[0]!.reponses).toEqual([
      { personneId: ids.referent, choix: 'OUI' },
    ])
  })

  it('reste fermé aux référents en écriture et aux personnes extérieures', async () => {
    const commun = {
      e: ids.edition,
      t: 'Intrusion',
      c: [{ jour: '2027-02-01' }],
      cible: 'EQUIPE',
    }
    expect(code(await executer(ids.referent, CREER, commun))).toBe('FORBIDDEN')
    expect(code(await executer(ids.etrangere, CREER, commun))).toBe('FORBIDDEN')
    expect(code(await executer(null, LISTE, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
    expect(
      code(
        await executer(ids.adminActivite, CREER, {
          ...commun,
          cible: 'CHOIX',
          u: [ids.etrangere],
        })
      )
    ).toBe('FORBIDDEN')
  })
})
