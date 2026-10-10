import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'
import { construireExport } from '../lib/export.ts'
import { organisationParDefaut } from '../lib/organisation.ts'
import { activiteParDefaut, contexteDeTest } from '../test/contexte.ts'

import { COMMENTAIRE_MAX } from './commentaires.ts'
import { schema } from './index.ts'

// Commentaires d'une tâche (ADR 0029) : droits prouvés par le refus, anonymat d'un
// passage à « faite » dans le fil, notifications sans texte.

const suffixe = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  alice: '', // référente natation, éditions en cours et archivée
  bruno: '', // référent natation, édition en cours
  chloe: '', // référente basket : elle consulte la natation
  dora: '', // référente natation, édition archivée seulement
  emma: '', // membre de l'organisation, sans aucune affectation
  natation: '',
  basket: '',
  edition: '',
  archivee: '',
  tache: '', // assignée à Bruno
  libre: '', // sans personne assignée
  ancienne: '', // tâche de l'édition archivée
  declinaison: '', // déclinaison de `tache` au basket, en attente d'accord
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await contexteDeTest(userId) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

type Reponse = Awaited<ReturnType<typeof executer>>
const code = (r: Reponse) => r.errors?.[0]?.extensions?.code

const CHAMPS = `tacheId nombreCommentaires peutCommenter
  commentaires { id texte modifieLe auteur { id } peutModifier peutSupprimer }
  evenements { type statut acteur { id } personne { id } }`
const FIL = `query ($id: ID!) { filTache(id: $id) { ${CHAMPS} } }`
const COMMENTER = `mutation ($id: ID!, $t: String!) { commenterTache(id: $id, texte: $t) { ${CHAMPS} } }`
const MODIFIER = `mutation ($id: ID!, $t: String!) { modifierCommentaire(id: $id, texte: $t) { ${CHAMPS} } }`
const SUPPRIMER = `mutation ($id: ID!) { supprimerCommentaire(id: $id) { ${CHAMPS} } }`
const PERIODE = `query ($e: ID!) { commentairesDeLaPeriode(editionId: $e) { perimetresLus nombres { tacheId nombre } } }`

interface Fil {
  tacheId: string
  nombreCommentaires: number
  peutCommenter: boolean
  commentaires: {
    id: string
    texte: string
    modifieLe: string | null
    auteur: { id: string } | null
    peutModifier: boolean
    peutSupprimer: boolean
  }[]
  evenements: {
    type: string
    statut: string | null
    acteur: { id: string } | null
    personne: { id: string } | null
  }[]
}

function fil(r: Reponse): Fil {
  expect(r.errors).toBeUndefined()
  return Object.values(r.data as Record<string, Fil>)[0]!
}

async function commenter(userId: string, tacheId: string, texte: string) {
  const f = fil(await executer(userId, COMMENTER, { id: tacheId, t: texte }))
  return f.commentaires.at(-1)!
}

const notifications = (userId: string, tacheId: string) =>
  prisma.notification.count({
    where: { userId, tacheId, type: 'TACHE_COMMENTEE' },
  })

let ORGANISATION = ''

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  const activiteId = await activiteParDefaut()
  await apollo.start()
  for (const [cle, estAdmin] of [
    ['admin', true],
    ['alice', false],
    ['bruno', false],
    ['chloe', false],
    ['dora', false],
    ['emma', false],
  ] as const) {
    const id = randomUUID()
    await prisma.user.create({
      data: {
        id,
        email: `${cle}-${suffixe}@exemple.fr`,
        name: `${cle} ${suffixe}`,
        isAdmin: estAdmin,
      },
    })
    ids[cle] = id
  }
  const annee = 3000 + Math.floor(Math.random() * 800)
  for (const [cle, decalage, statut] of [
    ['edition', 0, 'EN_COURS'],
    ['archivee', -1, 'ARCHIVEE'],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ORGANISATION,
          activiteId,
          annee: annee + decalage,
          nom: `Commentaires ${cle} ${suffixe}`,
          debut: new Date('2027-08-27'),
          fin: new Date('2027-08-29'),
          statut,
        },
      })
    ).id
  }
  for (const cle of ['natation', 'basket'] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ORGANISATION,
          activiteId,
          groupe: 'sport',
          slug: `${cle}-fil-${suffixe}`,
          nom: cle,
          type: 'SPORT',
        },
      })
    ).id
  }
  await prisma.affectation.createMany({
    data: [
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.alice, perimetreId: ids.natation, editionId: ids.archivee },
      { userId: ids.bruno, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.chloe, perimetreId: ids.basket, editionId: ids.edition },
      { userId: ids.dora, perimetreId: ids.natation, editionId: ids.archivee },
    ],
  })
  const tache = (titre: string, editionId: string) =>
    prisma.tache.create({
      data: { titre, editionId, perimetreId: ids.natation },
      select: { id: true },
    })
  ids.tache = (await tache(`Réserver le bassin ${suffixe}`, ids.edition)).id
  ids.libre = (await tache(`Compter les bonnets ${suffixe}`, ids.edition)).id
  ids.ancienne = (await tache(`Bilan ${suffixe}`, ids.archivee)).id
  await prisma.tacheAssignation.create({
    data: { tacheId: ids.tache, userId: ids.bruno },
  })
  ids.declinaison = (
    await prisma.tache.create({
      data: {
        titre: `Réserver le bassin ${suffixe}`,
        editionId: ids.edition,
        perimetreId: ids.basket,
        origineId: ids.tache,
        accord: 'EN_ATTENTE',
      },
    })
  ).id
})

afterAll(async () => {
  const editions = [ids.edition, ids.archivee]
  await prisma.journal.deleteMany({ where: { editionId: { in: editions } } })
  await prisma.tache.deleteMany({ where: { id: ids.declinaison } })
  await prisma.tache.deleteMany({ where: { editionId: { in: editions } } })
  await prisma.affectation.deleteMany({
    where: { editionId: { in: editions } },
  })
  await prisma.edition.deleteMany({ where: { id: { in: editions } } })
  await prisma.perimetre.deleteMany({
    where: { id: { in: [ids.natation, ids.basket] } },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${suffixe}@exemple.fr` } },
  })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

describe('écrire un commentaire', () => {
  it('laisse une référente commenter et garde les retours à la ligne', async () => {
    const f = fil(
      await executer(ids.alice, COMMENTER, {
        id: ids.tache,
        t: '  Bassin réservé.\nConfirmation reçue.  ',
      })
    )
    expect(f.nombreCommentaires).toBe(1)
    expect(f.peutCommenter).toBe(true)
    expect(f.commentaires[0]).toMatchObject({
      texte: 'Bassin réservé.\nConfirmation reçue.',
      modifieLe: null,
      auteur: { id: ids.alice },
      peutModifier: true,
      peutSupprimer: true,
    })
  })

  it('refuse un texte vide ou trop long', async () => {
    for (const texte of ['   ', 'a'.repeat(COMMENTAIRE_MAX + 1)]) {
      const r = await executer(ids.alice, COMMENTER, {
        id: ids.tache,
        t: texte,
      })
      expect(code(r)).toBe('SAISIE_INVALIDE')
    }
    expect(
      await prisma.commentaireTache.count({ where: { tacheId: ids.tache } })
    ).toBe(1)
  })

  it('refuse une personne en consultation, sans affectation ou sans session', async () => {
    for (const acteur of [ids.chloe, ids.emma, null]) {
      const r = await executer(acteur, COMMENTER, {
        id: ids.tache,
        t: 'Intrusion',
      })
      expect(code(r)).toBe('FORBIDDEN')
    }
    expect(
      await prisma.commentaireTache.count({ where: { tacheId: ids.tache } })
    ).toBe(1)
  })

  it('refuse un commentaire sur une période archivée', async () => {
    const r = await executer(ids.alice, COMMENTER, {
      id: ids.ancienne,
      t: 'Trop tard',
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(
      await prisma.commentaireTache.count({ where: { tacheId: ids.ancienne } })
    ).toBe(0)
  })

  it('refuse un commentaire sur une déclinaison qui attend un accord', async () => {
    const r = await executer(ids.chloe, COMMENTER, {
      id: ids.declinaison,
      t: 'Pas encore',
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    const f = fil(await executer(ids.chloe, FIL, { id: ids.declinaison }))
    expect(f.peutCommenter).toBe(false)
    expect(f.commentaires).toEqual([])
  })
})

describe('lire le fil', () => {
  it('ouvre le fil à qui lit le périmètre, archives comprises', async () => {
    const f = fil(await executer(ids.bruno, FIL, { id: ids.tache }))
    expect(f.commentaires.map(c => c.texte)).toEqual([
      'Bassin réservé.\nConfirmation reçue.',
    ])
    // Bruno ne modifie ni ne supprime le commentaire d'Alice.
    expect(f.commentaires[0]).toMatchObject({
      peutModifier: false,
      peutSupprimer: false,
    })
    // Dora a été affectée à la natation : elle lit le fil d'une tâche archivée.
    const archive = fil(await executer(ids.dora, FIL, { id: ids.ancienne }))
    expect(archive.peutCommenter).toBe(false)
  })

  it('refuse le fil à une personne en consultation, sans affectation ou sans session', async () => {
    for (const acteur of [ids.chloe, ids.emma, null]) {
      expect(code(await executer(acteur, FIL, { id: ids.tache }))).toBe(
        'FORBIDDEN'
      )
    }
  })

  it('donne la même réponse pour une tâche inconnue', async () => {
    expect(code(await executer(ids.alice, FIL, { id: 'inconnue' }))).toBe(
      'FORBIDDEN'
    )
  })

  it('ne compte que les tâches des périmètres lus', async () => {
    const periode = async (userId: string) => {
      const r = await executer(userId, PERIODE, { e: ids.edition })
      expect(r.errors).toBeUndefined()
      const { perimetresLus, nombres } = (
        r.data as {
          commentairesDeLaPeriode: {
            perimetresLus: string[]
            nombres: { tacheId: string; nombre: number }[]
          }
        }
      ).commentairesDeLaPeriode
      // L'activité par défaut porte d'autres périmètres : seuls ceux du test comptent.
      return {
        natation: perimetresLus.includes(ids.natation),
        basket: perimetresLus.includes(ids.basket),
        nombres: nombres.filter(n => n.tacheId === ids.tache),
      }
    }
    expect(await periode(ids.bruno)).toEqual({
      natation: true,
      basket: false,
      nombres: [{ tacheId: ids.tache, nombre: 1 }],
    })
    expect(await periode(ids.chloe)).toEqual({
      natation: false,
      basket: true,
      nombres: [],
    })
    expect(code(await executer(ids.emma, PERIODE, { e: ids.edition }))).toBe(
      'FORBIDDEN'
    )
  })

  it('ne nomme pas la personne qui a coché, sauf pour elle et pour les admins', async () => {
    const r = await executer(
      ids.alice,
      `mutation ($id: ID!) { changerStatutTache(id: $id, statut: FAITE, confirmer: true) { id } }`,
      { id: ids.tache }
    )
    expect(r.errors).toBeUndefined()
    const acteurDe = async (userId: string) =>
      fil(await executer(userId, FIL, { id: ids.tache })).evenements.find(
        e => e.type === 'STATUT' && e.statut === 'FAITE'
      )?.acteur
    expect(await acteurDe(ids.bruno)).toBeNull()
    expect(await acteurDe(ids.alice)).toEqual({ id: ids.alice })
    expect(await acteurDe(ids.admin)).toEqual({ id: ids.alice })
    await executer(
      ids.alice,
      `mutation ($id: ID!) { changerStatutTache(id: $id, statut: A_FAIRE, confirmer: true) { id } }`,
      { id: ids.tache }
    )
  })

  it('reprend une assignation avec son auteur et la personne concernée', async () => {
    const r = await executer(
      ids.bruno,
      `mutation ($id: ID!, $p: ID) { assignerTache(id: $id, assigne: true, personneId: $p) { id } }`,
      { id: ids.libre, p: ids.alice }
    )
    expect(r.errors).toBeUndefined()
    const f = fil(await executer(ids.alice, FIL, { id: ids.libre }))
    expect(f.evenements).toContainEqual({
      type: 'ASSIGNEE',
      statut: null,
      acteur: { id: ids.bruno },
      personne: { id: ids.alice },
    })
    await prisma.tacheAssignation.deleteMany({ where: { tacheId: ids.libre } })
  })
})

describe('modifier et supprimer un commentaire', () => {
  it('réserve la modification à l’auteur', async () => {
    const commentaire = await commenter(ids.alice, ids.libre, 'Premier jet')
    for (const acteur of [ids.bruno, ids.admin, ids.chloe]) {
      const r = await executer(acteur, MODIFIER, {
        id: commentaire.id,
        t: 'Réécrit',
      })
      expect(code(r)).toBe('FORBIDDEN')
    }
    const f = fil(
      await executer(ids.alice, MODIFIER, { id: commentaire.id, t: 'Corrigé' })
    )
    const modifie = f.commentaires.find(c => c.id === commentaire.id)
    expect(modifie?.texte).toBe('Corrigé')
    expect(modifie?.modifieLe).not.toBeNull()
  })

  it('réserve la suppression à l’auteur et aux admins de l’activité', async () => {
    const deBruno = await commenter(ids.bruno, ids.libre, 'À retirer')
    const dAlice = await commenter(ids.alice, ids.libre, 'À retirer aussi')
    for (const acteur of [ids.chloe, ids.emma]) {
      expect(code(await executer(acteur, SUPPRIMER, { id: deBruno.id }))).toBe(
        'FORBIDDEN'
      )
    }
    expect(code(await executer(ids.alice, SUPPRIMER, { id: deBruno.id }))).toBe(
      'FORBIDDEN'
    )
    expect(
      await prisma.commentaireTache.count({ where: { id: deBruno.id } })
    ).toBe(1)
    // L'auteur supprime son commentaire, l'admin supprime celui d'une autre personne.
    fil(await executer(ids.bruno, SUPPRIMER, { id: deBruno.id }))
    const f = fil(await executer(ids.admin, SUPPRIMER, { id: dAlice.id }))
    expect(f.commentaires.map(c => c.id)).not.toContain(deBruno.id)
    expect(f.commentaires.map(c => c.id)).not.toContain(dAlice.id)
  })
})

describe('notifications et export', () => {
  it('prévient la personne assignée à chaque commentaire, jamais l’auteur', async () => {
    const avant = await notifications(ids.bruno, ids.tache)
    await commenter(ids.alice, ids.tache, 'Créneau confirmé')
    await commenter(ids.alice, ids.tache, 'Maître-nageur prévenu')
    expect(await notifications(ids.bruno, ids.tache)).toBe(avant + 2)
    expect(await notifications(ids.alice, ids.tache)).toBe(0)
  })

  it('prévient les autres référentes et référents une fois par tranche', async () => {
    await prisma.notification.deleteMany({ where: { tacheId: ids.libre } })
    await commenter(ids.alice, ids.libre, 'Un')
    await commenter(ids.alice, ids.libre, 'Deux')
    expect(await notifications(ids.bruno, ids.libre)).toBe(1)
    // Une personne hors du périmètre n'apprend rien.
    expect(await notifications(ids.chloe, ids.libre)).toBe(0)
  })

  it('compose une notification sans le texte, qui ouvre le fil', async () => {
    const r = await executer(
      ids.bruno,
      `query { notifications { type message lien } }`
    )
    expect(r.errors).toBeUndefined()
    const recues = (
      r.data as {
        notifications: { type: string; message: string; lien: string }[]
      }
    ).notifications.filter(n => n.type === 'TACHE_COMMENTEE')
    expect(recues.length).toBeGreaterThan(0)
    for (const n of recues) {
      expect(n.message).toContain('a commenté la tâche')
      expect(n.message).not.toContain('Créneau confirmé')
      expect(n.lien).toMatch(/&tache=[^&]+&fil=1$/)
    }
  })

  it('porte les commentaires dans l’export de l’organisation', async () => {
    const { activites } = await construireExport(ORGANISATION)
    const tache = activites
      .flatMap(a => a.taches)
      .find(
        t =>
          t.titre === `Réserver le bassin ${suffixe}` &&
          t.perimetre === `natation-fil-${suffixe}`
      )
    expect(tache?.commentaires.map(c => c.texte)).toEqual([
      'Bassin réservé.\nConfirmation reçue.',
      'Créneau confirmé',
      'Maître-nageur prévenu',
    ])
    expect(tache?.commentaires[0]?.auteur).toBe(`alice-${suffixe}@exemple.fr`)
  })
})
