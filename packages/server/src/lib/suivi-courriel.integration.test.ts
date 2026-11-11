import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { composer } from '../courriel/messages.ts'
import { env } from '../env.ts'
import {
  genererRappels,
  personnesAResumer,
  prioritesAEnvoyer,
} from '../jobs/planification.ts'
import { activiteParDefaut } from '../test/contexte.ts'

import {
  composerNotifications,
  SELECTION_NOTIFICATION,
} from './composition-notifications.ts'
import { lireJetonDesabonnement } from './desabonnement.ts'
import { organisationParDefaut } from './organisation.ts'

// Mails de suivi hiérarchisés (ADR 0063) : alerte de retard d'une déclinaison,
// mail de rappel rangé par périmètre, mail des priorités.

const s = randomUUID().slice(0, 8)
const JOUR = 24 * 3600 * 1000
const maintenant = new Date()
/** Minuit UTC, à n jours d'aujourd'hui : le format des colonnes @db.Date. */
const jourA = (n: number) =>
  new Date(
    `${new Date(maintenant.getTime() + n * JOUR).toISOString().slice(0, 10)}T00:00:00Z`
  )

let ORGANISATION = ''
let ACTIVITE = ''
const planifiee = () => ({ id: ORGANISATION, fuseauHoraire: 'Europe/Paris' })

const personnes = [
  'coord',
  'pole',
  'double',
  'archivee',
  'membre',
  'sansPlace',
] as const
const ids: Record<(typeof personnes)[number], string> & {
  edition: string
  coordination: string
  ville: string
  logistique: string
  parent: string
  declinaison: string
  enAttente: string
  parentFait: string
  declinaisonOrpheline: string
  priorite: string
} = {
  coord: '',
  pole: '',
  double: '',
  archivee: '',
  membre: '',
  sansPlace: '',
  edition: '',
  coordination: '',
  ville: '',
  logistique: '',
  parent: '',
  declinaison: '',
  enAttente: '',
  parentFait: '',
  declinaisonOrpheline: '',
  priorite: '',
}

const filtre = () => ({ editionId: ids.edition })

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  ACTIVITE = await activiteParDefaut()
  for (const cle of personnes) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${s}@exemple.fr`,
        name: cle.charAt(0).toUpperCase() + cle.slice(1),
        appartenances: {
          create: {
            organisationId: ORGANISATION,
            ...(cle === 'archivee' ? { archiveLe: new Date() } : {}),
          },
        },
      },
    })
  }
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        annee: 4000 + Math.floor(Math.random() * 900),
        nom: `Suivi ${s}`,
        debut: jourA(60),
        fin: jourA(62),
      },
    })
  ).id
  const perimetre = async (slug: string, nom: string, ordre: number) =>
    (
      await prisma.perimetre.create({
        data: {
          organisationId: ORGANISATION,
          activiteId: ACTIVITE,
          groupe: 'pole',
          slug: `${slug}-${s}`,
          nom,
          type: 'POLE',
          ordre,
        },
      })
    ).id
  ids.coordination = await perimetre('coordination', 'Coordination', 1)
  ids.ville = await perimetre('ville', 'Ville et lieux', 2)
  ids.logistique = await perimetre('logistique', 'Logistique', 3)
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.coord,
        perimetreId: ids.coordination,
        editionId: ids.edition,
      },
      {
        userId: ids.double,
        perimetreId: ids.coordination,
        editionId: ids.edition,
      },
      {
        userId: ids.archivee,
        perimetreId: ids.coordination,
        editionId: ids.edition,
      },
      { userId: ids.pole, perimetreId: ids.ville, editionId: ids.edition },
      { userId: ids.membre, perimetreId: ids.ville, editionId: ids.edition },
    ],
  })
  const tache = (data: {
    perimetreId: string
    titre: string
    echeance: Date | null
    statut?: 'A_FAIRE' | 'EN_COURS' | 'FAITE'
    origineId?: string
    accord?: 'ACCEPTE' | 'EN_ATTENTE'
    assignes: string[]
  }) =>
    prisma.tache
      .create({
        data: {
          editionId: ids.edition,
          perimetreId: data.perimetreId,
          titre: data.titre,
          echeance: data.echeance,
          statut: data.statut ?? 'A_FAIRE',
          origineId: data.origineId ?? null,
          accord: data.accord ?? null,
          assignations: {
            create: data.assignes.map(userId => ({ userId })),
          },
        },
      })
      .then(t => t.id)
  ids.parent = await tache({
    perimetreId: ids.coordination,
    titre: 'Vérifier les tâches des pôles',
    echeance: jourA(20),
    assignes: [ids.coord, ids.double, ids.archivee],
  })
  ids.declinaison = await tache({
    perimetreId: ids.ville,
    titre: 'Réservation piscine',
    echeance: jourA(-3),
    origineId: ids.parent,
    accord: 'ACCEPTE',
    assignes: [ids.pole, ids.double],
  })
  ids.enAttente = await tache({
    perimetreId: ids.logistique,
    titre: 'Proposition en attente',
    echeance: jourA(-3),
    origineId: ids.parent,
    accord: 'EN_ATTENTE',
    assignes: [],
  })
  ids.parentFait = await tache({
    perimetreId: ids.coordination,
    titre: 'Suivi déjà fait',
    echeance: jourA(-10),
    statut: 'FAITE',
    assignes: [ids.coord],
  })
  ids.declinaisonOrpheline = await tache({
    perimetreId: ids.logistique,
    titre: 'Retard d’un suivi fait',
    echeance: jourA(-3),
    origineId: ids.parentFait,
    accord: 'ACCEPTE',
    assignes: [],
  })
  ids.priorite = await tache({
    perimetreId: ids.ville,
    titre: 'Signer la convention',
    echeance: jourA(2),
    assignes: [ids.pole],
  })
})

afterAll(async () => {
  const users = personnes.map(p => ids[p])
  await prisma.notification.deleteMany({ where: { userId: { in: users } } })
  await prisma.reunion.deleteMany({ where: { editionId: ids.edition } })
  await prisma.tache.deleteMany({
    where: { editionId: ids.edition, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { editionId: ids.edition } })
  await prisma.affectation.deleteMany({ where: { editionId: ids.edition } })
  await prisma.edition.deleteMany({ where: { id: ids.edition } })
  await prisma.perimetre.deleteMany({
    where: { id: { in: [ids.coordination, ids.ville, ids.logistique] } },
  })
  await prisma.preferenceOrganisation.deleteMany({
    where: { userId: { in: users } },
  })
  await prisma.appartenance.deleteMany({ where: { userId: { in: users } } })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('alerte de retard d’une déclinaison', () => {
  it('prévient les personnes assignées à la tâche partagée, une seule fois', async () => {
    await genererRappels(prisma, planifiee(), maintenant, filtre())
    const second = await genererRappels(
      prisma,
      planifiee(),
      maintenant,
      filtre()
    )
    expect(second.flatMap(r => r.notificationIds)).toEqual([])
    const alertes = await prisma.notification.findMany({
      where: {
        type: 'DECLINAISON_EN_RETARD',
        tache: { editionId: ids.edition },
      },
      select: { userId: true, tacheId: true, perimetreId: true },
    })
    // Seule la coordination est prévenue : la personne aussi assignée à la
    // déclinaison reçoit son propre rappel, la personne archivée rien. Une
    // déclinaison en attente ou d'une tâche partagée faite ne prévient personne.
    expect(alertes).toEqual([
      {
        userId: ids.coord,
        tacheId: ids.declinaison,
        perimetreId: ids.coordination,
      },
    ])
    expect(
      await prisma.notification.count({
        where: { userId: ids.double, tacheId: ids.declinaison },
      })
    ).toBe(1)
    expect(
      await prisma.notification.findFirst({
        where: { userId: ids.double, tacheId: ids.declinaison },
        select: { type: true },
      })
    ).toEqual({ type: 'TACHE_EN_RETARD' })
  })

  it('nomme la déclinaison, son périmètre et la tâche partagée dans la cloche', async () => {
    const notifications = await prisma.notification.findMany({
      where: { userId: ids.coord, type: 'DECLINAISON_EN_RETARD' },
      select: SELECTION_NOTIFICATION,
    })
    const [composee] = await composerNotifications(
      prisma,
      notifications,
      ids.coord
    )
    expect(composee?.message).toMatch(
      /^La déclinaison « Réservation piscine » \(Ville et lieux\) de votre tâche « Vérifier les tâches des pôles » est en retard depuis le /
    )
    expect(composee?.lien).toContain(`tache=${ids.declinaison}`)
  })

  it('range l’alerte sous le périmètre suivi, avec la déclinaison en retrait', async () => {
    const notificationIds = (
      await prisma.notification.findMany({
        where: { userId: ids.coord, tache: { editionId: ids.edition } },
        select: { id: true },
      })
    ).map(n => n.id)
    const message = await composer(prisma, {
      sorte: 'rappels-echeance',
      userId: ids.coord,
      organisationId: ORGANISATION,
      notificationIds,
    })
    expect(message?.texte).toMatch(
      /\n {2}Coordination\n {4}Déclinaisons en retard\n {4}- « Vérifier les tâches des pôles »\n {8}· Ville et lieux : « Réservation piscine », en retard depuis le [^\n]+\n {8}· Déclinaisons : 1 en retard sur 1/
    )
    expect(message?.html).toContain('Déclinaisons en retard</p>')
  })
})

describe('mail des priorités', () => {
  const choisir = (
    userId: string,
    mode: 'MES_PERIMETRES' | 'ACTIVITE' | 'AUCUN'
  ) =>
    prisma.preferenceOrganisation.upsert({
      where: {
        userId_organisationId: { userId, organisationId: ORGANISATION },
      },
      update: { mailPriorites: mode },
      create: { userId, organisationId: ORGANISATION, mailPriorites: mode },
    })
  const envoisDe = async (date: Date) =>
    (await prioritesAEnvoyer(prisma, planifiee(), date))
      .filter(e => e.editionId === ids.edition)
      .map(e => e.userId)
      .sort()

  // Le 7 juin 4021 est un lundi.
  const lundi = new Date('4021-06-07T05:00:00Z')
  const mardi = new Date('4021-06-08T05:00:00Z')

  it('part le lundi sans point d’équipe, vers les personnes qui ont une place', async () => {
    await choisir(ids.membre, 'MES_PERIMETRES')
    await choisir(ids.coord, 'ACTIVITE')
    await choisir(ids.sansPlace, 'ACTIVITE')
    await choisir(ids.archivee, 'ACTIVITE')
    expect(await envoisDe(lundi)).toEqual([ids.coord, ids.membre].sort())
    expect(await envoisDe(mardi)).toEqual([])
  })

  it('part la veille d’un point d’équipe, et plus le lundi de cette semaine', async () => {
    await prisma.reunion.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        editionId: ids.edition,
        titre: 'Point d’équipe',
        debut: new Date('4021-06-09T18:00:00Z'),
        fin: new Date('4021-06-09T20:00:00Z'),
        pointEquipe: true,
      },
    })
    expect(await envoisDe(lundi)).toEqual([])
    expect(await envoisDe(mardi)).toEqual([ids.coord, ids.membre].sort())
  })

  it('compte un point d’équipe du lundi matin déjà passé à l’heure du job', async () => {
    const semaineSuivante = new Date('4021-06-14T05:00:00Z')
    expect(await envoisDe(semaineSuivante)).toEqual(
      [ids.coord, ids.membre].sort()
    )
    const point = await prisma.reunion.create({
      data: {
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        editionId: ids.edition,
        titre: 'Point du lundi matin',
        debut: new Date('4021-06-14T04:00:00Z'),
        fin: new Date('4021-06-14T04:30:00Z'),
        pointEquipe: true,
      },
    })
    expect(await envoisDe(semaineSuivante)).toEqual([])
    await prisma.reunion.delete({ where: { id: point.id } })
  })

  it('reprend les seuls périmètres de la personne, rangés par périmètre', async () => {
    const message = await composer(prisma, {
      sorte: 'priorites',
      userId: ids.membre,
      organisationId: ORGANISATION,
      activiteId: ACTIVITE,
      editionId: ids.edition,
    })
    expect(message?.texte).toContain('  Ville et lieux')
    expect(message?.texte).toMatch(
      /- « Réservation piscine », en retard depuis le [^\n]+ · Pole, Double/
    )
    expect(message?.texte).toMatch(
      /- « Signer la convention », pour le [^\n]+ · Pole/
    )
    expect(message?.texte).not.toContain('Coordination')
    expect(
      lireJetonDesabonnement(
        env.BETTER_AUTH_SECRET,
        message?.desabonnement?.split('/').at(-1) ?? ''
      )
    ).toMatchObject({ sorte: 'priorites', userId: ids.membre })
  })

  it('reprend toute l’activité, avec le résumé des déclinaisons d’une tâche partagée', async () => {
    const message = await composer(prisma, {
      sorte: 'priorites',
      userId: ids.coord,
      organisationId: ORGANISATION,
      activiteId: ACTIVITE,
      editionId: ids.edition,
    })
    expect(message?.texte).toContain('  Coordination')
    expect(message?.texte).toContain('  Ville et lieux')
    expect(message?.texte).toMatch(
      /- « Vérifier les tâches des pôles », pour le [^\n]+\n {8}· Déclinaisons : 1 en retard sur 1/
    )
  })

  it('porte les nouvelles du résumé hebdomadaire, qui ne part plus le lundi suivant', async () => {
    const tache = await prisma.tache.findFirstOrThrow({
      where: { editionId: ids.edition, titre: 'Signer la convention' },
      select: { id: true, perimetreId: true },
    })
    const nouvelle = await prisma.notification.create({
      data: {
        organisationId: ORGANISATION,
        userId: ids.membre,
        type: 'TACHE_MODIFIEE',
        acteurId: ids.coord,
        tacheId: tache.id,
        perimetreId: tache.perimetreId,
      },
    })
    try {
      const message = await composer(prisma, {
        sorte: 'priorites',
        userId: ids.membre,
        organisationId: ORGANISATION,
        activiteId: ACTIVITE,
        editionId: ids.edition,
      })
      expect(message?.texte).toContain('Vos nouvelles · ')
      expect(message?.texte).toContain(
        'a modifié la tâche « Signer la convention »'
      )
      await message?.apresEnvoi?.()
      expect(
        (
          await prisma.notification.findUniqueOrThrow({
            where: { id: nouvelle.id },
          })
        ).resumeeLe
      ).not.toBeNull()
      // Le lundi 14 juin 4021, le mail des priorités du vendredi a remplacé le
      // résumé de la semaine (ADR 0065) ; celui du lundi précédent, non.
      const lundi = new Date('4021-06-14T05:00:00Z')
      const resumeLe = async (dernierResumeLe: Date) => {
        await prisma.preferenceOrganisation.update({
          where: {
            userId_organisationId: {
              userId: ids.membre,
              organisationId: ORGANISATION,
            },
          },
          data: { dernierResumeLe, frequenceResume: 'HEBDOMADAIRE' },
        })
        return (await personnesAResumer(prisma, planifiee(), lundi)).includes(
          ids.membre
        )
      }
      expect(await resumeLe(new Date('4021-06-11T05:00:00Z'))).toBe(false)
      expect(await resumeLe(new Date('4021-06-07T05:05:00Z'))).toBe(true)
    } finally {
      await prisma.notification.delete({ where: { id: nouvelle.id } })
    }
  })

  it('ne porte pas les nouvelles d’une personne au résumé quotidien', async () => {
    await prisma.preferenceOrganisation.update({
      where: {
        userId_organisationId: {
          userId: ids.coord,
          organisationId: ORGANISATION,
        },
      },
      data: { frequenceResume: 'QUOTIDIEN' },
    })
    const message = await composer(prisma, {
      sorte: 'priorites',
      userId: ids.coord,
      organisationId: ORGANISATION,
      activiteId: ACTIVITE,
      editionId: ids.edition,
    })
    expect(message?.texte ?? '').not.toContain('Vos nouvelles')
  })

  it('n’envoie rien sans choix, ni à une personne sans place', async () => {
    await choisir(ids.membre, 'AUCUN')
    for (const userId of [ids.membre, ids.sansPlace, ids.archivee]) {
      expect(
        await composer(prisma, {
          sorte: 'priorites',
          userId,
          organisationId: ORGANISATION,
          activiteId: ACTIVITE,
          editionId: ids.edition,
        })
      ).toBeNull()
    }
  })
})
