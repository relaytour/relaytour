import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { calculerScores } from '../lib/score.ts'

import { schema } from './index.ts'

// Tâches partagées (ADR 0026) : une tâche d'un périmètre se décline dans d'autres
// périmètres de son activité. Chaque périmètre cible donne son accord, sauf quand
// un admin de l'activité ajoute la déclinaison. Les droits se prouvent par le refus
// (invariant 11). Le fichier crée sa propre organisation.

const s = randomUUID().slice(0, 8)
const slug = `partage-${s}`
const apollo = new ApolloServer<AppContext>({ schema })

const ids = {
  organisation: '',
  activite: '',
  autreActivite: '',
  edition: '',
  archivee: '',
  autreEdition: '',
  // Périmètres de l'activité : un pôle, trois sports dont un archivé, et un pôle
  // d'accueil qui donne une simple consultation des autres.
  lieux: '',
  natation: '',
  volley: '',
  escrime: '',
  accueil: '',
  // Périmètre d'une autre activité, puis d'une autre organisation.
  ailleurs: '',
  autreOrganisation: '',
  etranger: '',
  ficheCommune: '',
  ficheDuPole: '',
  // Personnes : l'admin de l'organisation, la référente du pôle, deux référentes de
  // natation, le référent de volley, une référente du pôle et de volley, une
  // personne en consultation, une personne d'une autre activité.
  admin: '',
  pauline: '',
  nina: '',
  nadia: '',
  victor: '',
  mixte: '',
  consult: '',
  etrangere: '',
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

const CHAMPS = `id titre echeance statut accord version
  fiche { id }
  assignes { id }
  perimetre { id }
  origine { id perimetre { id } }
  declinaisons { id titre statut accord perimetre { id } }`

const CREER = `mutation ($p: ID!, $e: ID!, $t: String!, $f: ID, $m: Boolean, $d: DeclinaisonInput) {
  creerTache(perimetreId: $p, editionId: $e, titre: $t, ficheId: $f, mAssigner: $m, echeance: "2027-01-10", declinaison: $d) { ${CHAMPS} }
}`
const DECLINER = `mutation ($id: ID!, $p: [ID!]!, $t: String) {
  declinerTache(id: $id, perimetreIds: $p, titre: $t) { ${CHAMPS} }
}`
const ACCORDER = `mutation ($id: ID!, $oui: Boolean!) {
  accorderDeclinaison(id: $id, accepter: $oui) { id accord }
}`
const IMPOSER = `mutation ($id: ID!) { imposerDeclinaison(id: $id) { id accord } }`
const STATUT = `mutation ($id: ID!, $s: StatutTache!) {
  changerStatutTache(id: $id, statut: $s, confirmer: true) { id statut }
}`
const MODIFIER = `mutation ($id: ID!, $t: String!, $v: Int) {
  modifierTache(id: $id, titre: $t, versionAttendue: $v, confirmer: true) { id titre version }
}`
const ASSIGNER = `mutation ($id: ID!) { assignerTache(id: $id, assigne: true) { id } }`
const PERIMETRE = `query ($s: String!, $a: ID!, $e: ID!) {
  perimetre(slug: $s, activiteId: $a) {
    taches(editionId: $e) { id accord origine { id } }
    declinaisonsProposees(editionId: $e) { id titre origine { perimetre { id } } }
    avancement(editionId: $e) { total }
  }
}`
// Le détail des déclinaisons se lit sur une seule tâche : dans une liste, le
// plafond de complexité le refuserait.
const TACHE = `query ($id: ID!) {
  tache(id: $id) {
    id
    resumeDeclinaisons { total enAttente refusees acceptees faites abandonnees }
    declinaisons { id accord perimetre { id } historiqueAccord { etape par { nom } } }
  }
}`
const NOTIFICATIONS = `query { notifications(limite: 50) { type message lien } }`

interface TacheLue {
  id: string
  titre: string
  echeance: string | null
  statut: string
  accord: string | null
  version: number
  fiche: { id: string } | null
  assignes: { id: string }[]
  perimetre: { id: string }
  origine: { id: string; perimetre: { id: string } } | null
  declinaisons: {
    id: string
    titre: string
    statut: string
    accord: string
    perimetre: { id: string }
  }[]
}

/** Crée une tâche partagée du pôle et rend la tâche lue. */
async function partager(
  userId: string,
  titre: string,
  cibles: string[],
  options: { declinaison?: Record<string, unknown>; fiche?: string } = {}
): Promise<TacheLue> {
  const r = await executer(userId, CREER, {
    p: ids.lieux,
    e: ids.edition,
    t: titre,
    f: options.fiche ?? null,
    m: true,
    d: { perimetreIds: cibles, ...options.declinaison },
  })
  expect(r.errors).toBeUndefined()
  return (r.data as { creerTache: TacheLue }).creerTache
}

const declinaisonDe = (tache: TacheLue, perimetreId: string) =>
  tache.declinaisons.find(d => d.perimetre.id === perimetreId)!

async function lirePerimetre(userId: string, cle: 'natation' | 'volley') {
  const r = await executer(userId, PERIMETRE, {
    s: `${cle}-${s}`,
    a: ids.activite,
    e: ids.edition,
  })
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      perimetre: {
        taches: { id: string; accord: string | null }[]
        declinaisonsProposees: { id: string; titre: string }[]
        avancement: { total: number }
      }
    }
  ).perimetre
}

async function notificationsDe(userId: string) {
  const r = await executer(userId, NOTIFICATIONS)
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      notifications: { type: string; message: string; lien: string }[]
    }
  ).notifications
}

const nombreDeTaches = () =>
  prisma.tache.count({
    where: { perimetre: { organisationId: ids.organisation } },
  })

beforeAll(async () => {
  await apollo.start()
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: `Organisation ${slug}`,
      configuration: {
        slug,
        nom: `Organisation ${slug}`,
        domainesCourrielAutorises: ['exemple.fr'],
      },
    },
  })
  ids.organisation = organisation.id
  const autre = await prisma.organisation.create({
    data: {
      slug: `${slug}-b`,
      nom: `Autre ${slug}`,
      configuration: {
        slug: `${slug}-b`,
        nom: `Autre ${slug}`,
        domainesCourrielAutorises: ['exemple.fr'],
      },
    },
  })
  ids.autreOrganisation = autre.id

  const groupes = [
    { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
    { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
  ]
  const activite = (organisationId: string, cle: string) =>
    prisma.activite.create({
      data: { organisationId, slug: `${cle}-${s}`, nom: cle, groupes },
    })
  ids.activite = (await activite(ids.organisation, 'tournoi')).id
  ids.autreActivite = (await activite(ids.organisation, 'section')).id
  const activiteEtrangere = (await activite(ids.autreOrganisation, 'tournoi'))
    .id

  const edition = (
    activiteId: string,
    annee: number,
    statut: 'PREPARATION' | 'ARCHIVEE' = 'PREPARATION'
  ) =>
    prisma.edition.create({
      data: {
        organisationId: ids.organisation,
        activiteId,
        annee,
        nom: `Période ${annee}`,
        debut: new Date(`${annee}-06-05`),
        fin: new Date(`${annee}-06-06`),
        statut,
      },
    })
  ids.edition = (await edition(ids.activite, 2027)).id
  ids.archivee = (await edition(ids.activite, 2025, 'ARCHIVEE')).id
  ids.autreEdition = (await edition(ids.autreActivite, 2027)).id

  const perimetre = (
    cle: string,
    groupe: string,
    ordre: number,
    options: {
      organisationId?: string
      activiteId?: string
      archive?: boolean
    } = {}
  ) =>
    prisma.perimetre.create({
      data: {
        organisationId: options.organisationId ?? ids.organisation,
        activiteId: options.activiteId ?? ids.activite,
        slug: `${cle}-${s}`,
        nom: cle,
        groupe,
        type: groupe === 'sport' ? 'SPORT' : 'POLE',
        ordre,
        archivedAt: options.archive ? new Date() : null,
      },
    })
  ids.lieux = (await perimetre('lieux', 'pole', 1)).id
  ids.accueil = (await perimetre('accueil', 'pole', 2)).id
  ids.natation = (await perimetre('natation', 'sport', 1)).id
  ids.volley = (await perimetre('volley', 'sport', 2)).id
  ids.escrime = (await perimetre('escrime', 'sport', 3, { archive: true })).id
  ids.ailleurs = (
    await perimetre('ailleurs', 'pole', 1, { activiteId: ids.autreActivite })
  ).id
  ids.etranger = (
    await perimetre('etranger', 'pole', 1, {
      organisationId: ids.autreOrganisation,
      activiteId: activiteEtrangere,
    })
  ).id

  const fiche = (cle: string, perimetreId: string | null) =>
    prisma.fiche.create({
      data: {
        organisationId: ids.organisation,
        activiteId: ids.activite,
        slug: `${cle}-${s}`,
        perimetreId,
      },
    })
  ids.ficheCommune = (await fiche('commune', null)).id
  ids.ficheDuPole = (await fiche('du-pole', ids.lieux)).id

  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['pauline', 'MEMBRE'],
    ['nina', 'MEMBRE'],
    ['nadia', 'MEMBRE'],
    ['victor', 'MEMBRE'],
    ['mixte', 'MEMBRE'],
    ['consult', 'MEMBRE'],
    ['etrangere', 'MEMBRE'],
  ] as const) {
    const id = randomUUID()
    await prisma.user.create({
      data: {
        id,
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId: ids.organisation, role } },
      },
    })
    ids[cle] = id
  }
  await prisma.affectation.createMany({
    data: [
      { userId: ids.pauline, perimetreId: ids.lieux, editionId: ids.edition },
      { userId: ids.pauline, perimetreId: ids.lieux, editionId: ids.archivee },
      { userId: ids.nina, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.nadia, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.victor, perimetreId: ids.volley, editionId: ids.edition },
      { userId: ids.mixte, perimetreId: ids.lieux, editionId: ids.edition },
      { userId: ids.mixte, perimetreId: ids.volley, editionId: ids.edition },
      { userId: ids.consult, perimetreId: ids.accueil, editionId: ids.edition },
      {
        userId: ids.etrangere,
        perimetreId: ids.ailleurs,
        editionId: ids.autreEdition,
      },
    ],
  })
})

afterAll(async () => {
  const organisations = [ids.organisation, ids.autreOrganisation]
  const dansLesOrganisations = { organisationId: { in: organisations } }
  await prisma.notification.deleteMany({ where: dansLesOrganisations })
  await prisma.journal.deleteMany({
    where: { perimetre: dansLesOrganisations },
  })
  // Les déclinaisons partent avant leur tâche partagée.
  await prisma.tache.deleteMany({
    where: { perimetre: dansLesOrganisations, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { perimetre: dansLesOrganisations } })
  await prisma.affectation.deleteMany({
    where: { perimetre: dansLesOrganisations },
  })
  await prisma.fiche.deleteMany({ where: dansLesOrganisations })
  await prisma.edition.deleteMany({ where: dansLesOrganisations })
  await prisma.perimetre.deleteMany({ where: dansLesOrganisations })
  await prisma.activite.deleteMany({ where: dansLesOrganisations })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: organisations } } })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('une référente propose une tâche partagée', () => {
  let partagee: TacheLue

  it('crée la tâche dans son périmètre et une déclinaison en attente par cible', async () => {
    partagee = await partager(
      ids.pauline,
      'Recenser les besoins de lieux',
      [ids.natation, ids.volley, ids.natation],
      {
        fiche: ids.ficheDuPole,
        declinaison: {
          titre: 'Transmettre les besoins de lieux',
          echeance: '2027-01-25',
        },
      }
    )
    expect(partagee.perimetre.id).toBe(ids.lieux)
    expect(partagee.origine).toBeNull()
    expect(partagee.accord).toBeNull()
    // La case « Je m'en occupe » vaut pour la tâche partagée seule.
    expect(partagee.assignes).toEqual([{ id: ids.pauline }])
    // Un périmètre cité deux fois ne reçoit qu'une déclinaison.
    expect(
      partagee.declinaisons.map(d => [d.perimetre.id, d.titre, d.accord])
    ).toEqual([
      [ids.natation, 'Transmettre les besoins de lieux', 'EN_ATTENTE'],
      [ids.volley, 'Transmettre les besoins de lieux', 'EN_ATTENTE'],
    ])
    const natation = await prisma.tache.findUniqueOrThrow({
      where: { id: declinaisonDe(partagee, ids.natation).id },
      include: { assignations: true },
    })
    expect(natation.origineId).toBe(partagee.id)
    expect(natation.echeance?.toISOString().slice(0, 10)).toBe('2027-01-25')
    expect(natation.creeParId).toBe(ids.pauline)
    expect(natation.assignations).toEqual([])
    // La fiche du pôle ne suit pas : les sports ne la lisent pas.
    expect(natation.ficheId).toBeNull()
  })

  it('garde la déclinaison hors des tâches et de l’avancement du périmètre cible', async () => {
    const natation = await lirePerimetre(ids.nina, 'natation')
    expect(natation.taches).toEqual([])
    expect(natation.avancement.total).toBe(0)
    expect(natation.declinaisonsProposees).toEqual([
      {
        id: declinaisonDe(partagee, ids.natation).id,
        titre: 'Transmettre les besoins de lieux',
        origine: { perimetre: { id: ids.lieux } },
      },
    ])
  })

  it('prévient les référentes du périmètre cible, dans l’application', async () => {
    for (const personne of [ids.nina, ids.nadia]) {
      expect(await notificationsDe(personne)).toEqual([
        {
          type: 'DECLINAISON_PROPOSEE',
          message: `pauline ${s} propose la tâche « Transmettre les besoins de lieux » (natation), demandée par lieux. Elle attend l’accord du périmètre.`,
          lien: `/tournoi-${s}/perimetres/natation-${s}?edition=${ids.edition}&tache=${declinaisonDe(partagee, ids.natation).id}`,
        },
      ])
    }
    // Aucun mail immédiat : la notification n'est pas marquée comme envoyée.
    expect(
      await prisma.notification.count({
        where: { organisationId: ids.organisation, envoyeeLe: { not: null } },
      })
    ).toBe(0)
  })

  it('refuse de modifier, de cocher ou de prendre une déclinaison en attente', async () => {
    const id = declinaisonDe(partagee, ids.natation).id
    for (const r of [
      await executer(ids.nina, MODIFIER, { id, t: 'Autre titre' }),
      await executer(ids.nina, STATUT, { id, s: 'FAITE' }),
      await executer(ids.nina, ASSIGNER, { id }),
    ]) {
      expect(code(r)).toBe('SAISIE_INVALIDE')
    }
    const enBase = await prisma.tache.findUniqueOrThrow({
      where: { id },
      include: { assignations: true },
    })
    expect(enBase.titre).toBe('Transmettre les besoins de lieux')
    expect(enBase.statut).toBe('A_FAIRE')
    expect(enBase.assignations).toEqual([])
  })

  it('refuse l’accord à qui n’écrit pas dans le périmètre cible, sans rien écrire', async () => {
    const id = declinaisonDe(partagee, ids.natation).id
    // La référente du pôle qui propose, le référent d'un autre sport, une personne
    // en consultation, une personne d'une autre activité, une requête sans session.
    for (const personne of [
      ids.pauline,
      ids.victor,
      ids.consult,
      ids.etrangere,
      null,
    ]) {
      const r = await executer(personne, ACCORDER, { id, oui: true })
      expect(code(r)).toBe('FORBIDDEN')
    }
    expect(
      (await prisma.tache.findUniqueOrThrow({ where: { id } })).accord
    ).toBe('EN_ATTENTE')
  })

  it('entre dans le périmètre quand une de ses référentes l’accepte', async () => {
    const id = declinaisonDe(partagee, ids.natation).id
    const r = await executer(ids.nina, ACCORDER, { id, oui: true })
    expect(r.data).toEqual({ accorderDeclinaison: { id, accord: 'ACCEPTE' } })
    const enBase = await prisma.tache.findUniqueOrThrow({ where: { id } })
    expect(enBase.accordParId).toBe(ids.nina)
    expect(enBase.accordLe).not.toBeNull()

    const natation = await lirePerimetre(ids.nina, 'natation')
    expect(natation.taches).toEqual([
      { id, accord: 'ACCEPTE', origine: { id: partagee.id } },
    ])
    expect(natation.avancement.total).toBe(1)
    expect(natation.declinaisonsProposees).toEqual([])

    // La même réponse une seconde fois ne change rien ; un refus arrive trop tard.
    const encore = await executer(ids.nadia, ACCORDER, { id, oui: true })
    expect(encore.errors).toBeUndefined()
    expect(
      (await prisma.tache.findUniqueOrThrow({ where: { id } })).accordParId
    ).toBe(ids.nina)
    expect(code(await executer(ids.nadia, ACCORDER, { id, oui: false }))).toBe(
      'SAISIE_INVALIDE'
    )
  })

  it('prévient le périmètre d’origine et l’autre référente du périmètre cible', async () => {
    const id = declinaisonDe(partagee, ids.natation).id
    expect(await notificationsDe(ids.pauline)).toContainEqual({
      type: 'DECLINAISON_ACCEPTEE',
      message: `nina ${s} a accepté la tâche « Transmettre les besoins de lieux » (natation).`,
      // La réponse se lit sur la tâche partagée, dans le pôle.
      lien: `/tournoi-${s}/perimetres/lieux-${s}?edition=${ids.edition}&tache=${partagee.id}`,
    })
    expect(await notificationsDe(ids.nadia)).toContainEqual({
      type: 'TACHE_CREEE',
      message: `nina ${s} a ajouté la tâche « Transmettre les besoins de lieux » (natation), demandée par lieux.`,
      lien: `/tournoi-${s}/perimetres/natation-${s}?edition=${ids.edition}&tache=${id}`,
    })
  })

  it('reste hors du périmètre quand son référent la refuse', async () => {
    const id = declinaisonDe(partagee, ids.volley).id
    const r = await executer(ids.victor, ACCORDER, { id, oui: false })
    expect(r.data).toEqual({ accorderDeclinaison: { id, accord: 'REFUSE' } })
    const volley = await lirePerimetre(ids.victor, 'volley')
    expect(volley.taches).toEqual([])
    expect(volley.declinaisonsProposees).toEqual([])
    expect(await notificationsDe(ids.pauline)).toContainEqual({
      type: 'DECLINAISON_REFUSEE',
      message: `victor ${s} a refusé la tâche « Transmettre les besoins de lieux » (volley).`,
      lien: `/tournoi-${s}/perimetres/lieux-${s}?edition=${ids.edition}&tache=${partagee.id}`,
    })
    // Le périmètre ne revient pas seul sur un refus.
    expect(code(await executer(ids.victor, ACCORDER, { id, oui: true }))).toBe(
      'SAISIE_INVALIDE'
    )
  })

  it('n’est imposée que par un admin de l’activité, même après un refus', async () => {
    const id = declinaisonDe(partagee, ids.volley).id
    for (const personne of [
      ids.victor,
      ids.pauline,
      ids.consult,
      ids.etrangere,
      null,
    ]) {
      expect(code(await executer(personne, IMPOSER, { id }))).toBe('FORBIDDEN')
    }
    expect(
      (await prisma.tache.findUniqueOrThrow({ where: { id } })).accord
    ).toBe('REFUSE')

    const r = await executer(ids.admin, IMPOSER, { id })
    expect(r.data).toEqual({ imposerDeclinaison: { id, accord: 'ACCEPTE' } })
    const volley = await lirePerimetre(ids.victor, 'volley')
    expect(volley.taches.map(t => t.id)).toEqual([id])
    expect(volley.avancement.total).toBe(1)
    expect(await notificationsDe(ids.victor)).toContainEqual({
      type: 'TACHE_CREEE',
      message: `admin ${s} a ajouté la tâche « Transmettre les besoins de lieux » (volley), demandée par lieux.`,
      lien: `/tournoi-${s}/perimetres/volley-${s}?edition=${ids.edition}&tache=${id}`,
    })
    // Imposer une déclinaison déjà acceptée ne change rien.
    expect((await executer(ids.admin, IMPOSER, { id })).errors).toBeUndefined()
    expect(
      await prisma.journal.count({
        where: { tacheId: id, type: 'DECLINAISON_IMPOSEE' },
      })
    ).toBe(1)
  })

  it('montre l’historique de l’accord aux admins seulement', async () => {
    const lire = async (userId: string) => {
      const r = await executer(userId, TACHE, { id: partagee.id })
      expect(r.errors).toBeUndefined()
      const tache = (
        r.data as {
          tache: {
            declinaisons: {
              perimetre: { id: string }
              historiqueAccord: { etape: string; par: { nom: string } }[]
            }[]
          }
        }
      ).tache
      return Object.fromEntries(
        tache.declinaisons.map(d => [
          d.perimetre.id,
          d.historiqueAccord.map(e => `${e.etape} ${e.par.nom}`),
        ])
      )
    }
    expect(await lire(ids.admin)).toEqual({
      [ids.natation]: [`PROPOSEE pauline ${s}`, `ACCEPTEE nina ${s}`],
      [ids.volley]: [
        `PROPOSEE pauline ${s}`,
        `REFUSEE victor ${s}`,
        `IMPOSEE admin ${s}`,
      ],
    })
    // La référente du pôle lit l'accord de chaque déclinaison, sans son historique.
    expect(await lire(ids.pauline)).toEqual({
      [ids.natation]: [],
      [ids.volley]: [],
    })
  })

  it('se lit par toute personne qui consulte l’activité, et par elle seule', async () => {
    // La personne en consultation lit la tâche partagée et le résumé de ses
    // déclinaisons.
    const lue = await executer(ids.consult, TACHE, { id: partagee.id })
    expect(lue.errors).toBeUndefined()
    expect(
      (lue.data as { tache: { resumeDeclinaisons: unknown } }).tache
        .resumeDeclinaisons
    ).toEqual({
      total: 2,
      enAttente: 0,
      refusees: 0,
      acceptees: 2,
      faites: 0,
      abandonnees: 0,
    })
    // Une personne d'une autre activité, une requête sans session et un identifiant
    // inconnu reçoivent le même refus.
    for (const [personne, id] of [
      [ids.etrangere, partagee.id],
      [null, partagee.id],
      [ids.pauline, 'inconnue'],
    ] as const) {
      expect(code(await executer(personne, TACHE, { id }))).toBe('FORBIDDEN')
    }
  })

  it('garde un statut et une version propres à chaque déclinaison', async () => {
    const natation = declinaisonDe(partagee, ids.natation).id
    const volley = declinaisonDe(partagee, ids.volley).id
    await prisma.notification.deleteMany({ where: { userId: ids.pauline } })

    // Le pôle n'est prévenu que d'une déclinaison faite : la commencer ne le
    // prévient pas.
    const commencee = await executer(ids.nina, STATUT, {
      id: natation,
      s: 'EN_COURS',
    })
    expect(commencee.errors).toBeUndefined()
    expect(await notificationsDe(ids.pauline)).toEqual([])

    const faite = await executer(ids.nina, STATUT, { id: natation, s: 'FAITE' })
    expect(faite.errors).toBeUndefined()
    const statuts = async () =>
      Object.fromEntries(
        (
          await prisma.tache.findMany({
            where: { id: { in: [partagee.id, natation, volley] } },
            select: { id: true, statut: true },
          })
        ).map(t => [t.id, t.statut])
      )
    expect(await statuts()).toEqual({
      [partagee.id]: 'A_FAIRE',
      [natation]: 'FAITE',
      [volley]: 'A_FAIRE',
    })
    // Le pôle l'apprend, sans le nom de la personne qui a coché.
    expect(await notificationsDe(ids.pauline)).toEqual([
      {
        type: 'TACHE_STATUT',
        message:
          'La tâche « Transmettre les besoins de lieux » (natation) est faite.',
        lien: `/tournoi-${s}/perimetres/natation-${s}?edition=${ids.edition}&tache=${natation}`,
      },
    ])
    expect(
      await prisma.notification.count({
        where: { userId: ids.pauline, acteurId: { not: null } },
      })
    ).toBe(0)

    // Abandonner la tâche partagée ne change aucune déclinaison.
    await executer(ids.pauline, STATUT, { id: partagee.id, s: 'ABANDONNEE' })
    expect(await statuts()).toEqual({
      [partagee.id]: 'ABANDONNEE',
      [natation]: 'FAITE',
      [volley]: 'A_FAIRE',
    })

    // La version d'une déclinaison ne dépend pas de celle de sa tâche partagée.
    const modifiee = await executer(ids.pauline, MODIFIER, {
      id: partagee.id,
      t: 'Recenser les besoins de lieux et de créneaux',
      v: 0,
    })
    expect(modifiee.errors).toBeUndefined()
    const declinaison = await executer(ids.victor, MODIFIER, {
      id: volley,
      t: 'Demander deux gymnases',
      v: 0,
    })
    expect(declinaison.data).toEqual({
      modifierTache: {
        id: volley,
        titre: 'Demander deux gymnases',
        version: 1,
      },
    })
    // Modifier la tâche partagée n'a pas modifié la déclinaison.
    expect(
      (await prisma.tache.findUniqueOrThrow({ where: { id: natation } })).titre
    ).toBe('Transmettre les besoins de lieux')
  })
})

describe('accord d’office', () => {
  it('ajoute sans accord les déclinaisons créées par un admin de l’activité', async () => {
    const tache = await partager(
      ids.admin,
      'Vérifier les assurances',
      [ids.natation, ids.volley],
      { fiche: ids.ficheCommune }
    )
    expect(tache.declinaisons.map(d => d.accord)).toEqual([
      'ACCEPTE',
      'ACCEPTE',
    ])
    const natation = declinaisonDe(tache, ids.natation).id
    const enBase = await prisma.tache.findUniqueOrThrow({
      where: { id: natation },
    })
    // Sans texte propre, la déclinaison reprend la tâche partagée, et sa fiche
    // commune.
    expect(enBase.titre).toBe('Vérifier les assurances')
    expect(enBase.echeance?.toISOString().slice(0, 10)).toBe('2027-01-10')
    expect(enBase.ficheId).toBe(ids.ficheCommune)
    expect(enBase.accordParId).toBe(ids.admin)
    expect(
      (
        await prisma.journal.findMany({
          where: { tacheId: natation },
          select: { type: true },
        })
      ).map(l => l.type)
    ).toEqual(['DECLINAISON_IMPOSEE'])
    expect(
      (await lirePerimetre(ids.nina, 'natation')).taches.map(t => t.id)
    ).toContain(natation)
  })

  it('accepte la déclinaison d’un périmètre où la personne écrit déjà', async () => {
    const tache = await partager(ids.mixte, 'Visiter les salles', [
      ids.natation,
      ids.volley,
    ])
    expect(
      Object.fromEntries(
        tache.declinaisons.map(d => [d.perimetre.id, d.accord])
      )
    ).toEqual({ [ids.natation]: 'EN_ATTENTE', [ids.volley]: 'ACCEPTE' })
    expect(
      (
        await prisma.journal.findMany({
          where: { tacheId: declinaisonDe(tache, ids.volley).id },
          select: { type: true },
        })
      ).map(l => l.type)
    ).toEqual(['DECLINAISON_ACCEPTEE'])
  })
})

describe('décliner une tâche existante', () => {
  let ordinaire: TacheLue

  it('transforme une tâche du périmètre en tâche partagée', async () => {
    const creee = await executer(ids.pauline, CREER, {
      p: ids.lieux,
      e: ids.edition,
      t: 'Préparer le plan des sites',
    })
    ordinaire = (creee.data as { creerTache: TacheLue }).creerTache
    expect(ordinaire.declinaisons).toEqual([])

    const r = await executer(ids.pauline, DECLINER, {
      id: ordinaire.id,
      p: [ids.natation],
      t: 'Relire le plan du site',
    })
    expect(r.errors).toBeUndefined()
    const lue = (r.data as { declinerTache: TacheLue }).declinerTache
    expect(
      lue.declinaisons.map(d => [d.perimetre.id, d.titre, d.accord])
    ).toEqual([[ids.natation, 'Relire le plan du site', 'EN_ATTENTE']])
  })

  it('ignore un périmètre déjà servi et ajoute les autres', async () => {
    const r = await executer(ids.pauline, DECLINER, {
      id: ordinaire.id,
      p: [ids.natation, ids.volley],
    })
    const lue = (r.data as { declinerTache: TacheLue }).declinerTache
    expect(lue.declinaisons.map(d => [d.perimetre.id, d.titre])).toEqual([
      [ids.natation, 'Relire le plan du site'],
      [ids.volley, 'Préparer le plan des sites'],
    ])
    // Une seconde demande identique ne crée rien.
    const avant = await nombreDeTaches()
    await executer(ids.pauline, DECLINER, {
      id: ordinaire.id,
      p: [ids.natation, ids.volley],
    })
    expect(await nombreDeTaches()).toBe(avant)
  })

  it('refuse de décliner une déclinaison, ou la tâche d’un autre périmètre', async () => {
    const avant = await nombreDeTaches()
    const declinaison = (
      await prisma.tache.findFirstOrThrow({
        where: { origineId: ordinaire.id, perimetreId: ids.volley },
      })
    ).id
    await executer(ids.admin, IMPOSER, { id: declinaison })
    expect(
      code(
        await executer(ids.victor, DECLINER, {
          id: declinaison,
          p: [ids.natation],
        })
      )
    ).toBe('SAISIE_INVALIDE')
    // Le référent du volley n'écrit pas dans le pôle.
    for (const personne of [ids.victor, ids.consult, ids.etrangere, null]) {
      expect(
        code(
          await executer(personne, DECLINER, {
            id: ordinaire.id,
            p: [ids.accueil],
          })
        )
      ).toBe('FORBIDDEN')
    }
    expect(await nombreDeTaches()).toBe(avant)
  })
})

describe('refus à la création d’une tâche partagée', () => {
  const tenter = (
    userId: string | null,
    cibles: string[],
    options: { perimetre?: string; edition?: string } = {}
  ) =>
    executer(userId, CREER, {
      p: options.perimetre ?? ids.lieux,
      e: options.edition ?? ids.edition,
      t: 'Intrusion',
      d: { perimetreIds: cibles },
    })

  it('refuse qui n’écrit pas dans le périmètre d’origine', async () => {
    const avant = await nombreDeTaches()
    for (const personne of [ids.nina, ids.consult, ids.etrangere, null]) {
      expect(code(await tenter(personne, [ids.volley]))).toBe('FORBIDDEN')
    }
    expect(await nombreDeTaches()).toBe(avant)
  })

  it('refuse une cible inconnue, d’une autre activité ou d’une autre organisation', async () => {
    const avant = await nombreDeTaches()
    for (const cible of [ids.ailleurs, ids.etranger, 'inconnu']) {
      // Même refus pour la référente et pour l'admin : rien ne dit si le périmètre
      // existe ailleurs.
      for (const personne of [ids.pauline, ids.admin]) {
        expect(code(await tenter(personne, [ids.natation, cible]))).toBe(
          'FORBIDDEN'
        )
      }
    }
    expect(await nombreDeTaches()).toBe(avant)
  })

  it('refuse une liste vide, son propre périmètre et un périmètre archivé', async () => {
    const avant = await nombreDeTaches()
    for (const cibles of [[], [ids.lieux], [ids.natation, ids.escrime]]) {
      expect(code(await tenter(ids.pauline, cibles))).toBe('SAISIE_INVALIDE')
    }
    expect(await nombreDeTaches()).toBe(avant)
  })

  it('refuse une période archivée', async () => {
    const avant = await nombreDeTaches()
    const r = await tenter(ids.pauline, [ids.natation], {
      edition: ids.archivee,
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toMatch(/archivée/)
    expect(await nombreDeTaches()).toBe(avant)
  })
})

describe('score et tâches partagées', () => {
  it('compte une seule création, et la réalisation de chaque déclinaison acceptée', async () => {
    const scores = await calculerScores(prisma, ids.edition)
    const pauline = scores.get(ids.pauline)
    // Trois tâches créées dans le pôle : deux tâches partagées et une ordinaire.
    // La première est abandonnée et ne compte plus. Aucune déclinaison ne compte.
    expect(pauline?.tachesCreees).toBe(1)
    const taches = await prisma.tache.count({
      where: { creeParId: ids.pauline, statut: { not: 'ABANDONNEE' } },
    })
    expect(taches).toBeGreaterThan(pauline!.tachesCreees)
    // La référente de natation a réalisé sa déclinaison.
    expect(scores.get(ids.nina)?.tachesRealisees).toBe(1)
  })
})
