import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

// Souhaits des personnes. Les contrôles d'accès se prouvent par le refus, et les
// refus sont testés en premier. La base de développement est partagée : les
// assertions ne portent que sur les personnes, périmètres et éditions de ce fichier.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  admin: '',
  referente: '', // référente natation pour l'édition en cours
  camille: '', // aucune affectation, un souhait pour le basket
  ancienne: '', // compte archivé, un souhait pour le volley
  edition: '',
  archivee: '',
  natation: '',
  basket: '',
  volley: '',
  logistique: '', // périmètre archivé
  souhaitCamille: '',
}
let slugBasket = ''

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const DEFINIR = `mutation ($u: ID!, $e: ID!, $p: [ID!]!) {
  definirSouhaits(personneId: $u, editionId: $e, perimetreIds: $p) {
    id
    satisfait
    perimetre { id }
    personne { id }
    edition { id }
  }
}`

const RETIRER = `mutation ($id: ID!) { retirerSouhait(id: $id) }`

const INVITER = `mutation ($email: String!, $e: ID, $p: [ID!]) {
  inviterPersonne(email: $email, nom: "Invitée ${s}", editionId: $e, perimetresSouhaites: $p) {
    id
    souhaits(editionId: $e) { id perimetre { id } satisfait }
  }
}`

const POSTES = `query ($e: ID!) {
  postesAPourvoir(editionId: $e) {
    perimetre { id }
    souhaits { id personne { id nom } }
  }
}`

const SOUHAITS_DE = `query ($e: ID!) {
  personnes(inclureArchives: true) {
    id
    souhaits(editionId: $e) { id satisfait perimetre { id } }
  }
}`

interface SouhaitLu {
  id: string
  satisfait: boolean
  perimetre: { id: string }
}

async function souhaitsDe(userId: string): Promise<SouhaitLu[]> {
  const r = await executer(ids.admin, SOUHAITS_DE, { e: ids.edition })
  expect(r.errors).toBeUndefined()
  const personnes = (
    r.data as { personnes: { id: string; souhaits: SouhaitLu[] }[] }
  ).personnes
  return personnes.find(p => p.id === userId)?.souhaits ?? []
}

async function souhaitsEnAttente(perimetreId: string) {
  const r = await executer(ids.admin, POSTES, { e: ids.edition })
  expect(r.errors).toBeUndefined()
  const postes = (
    r.data as {
      postesAPourvoir: {
        perimetre: { id: string }
        souhaits: { id: string; personne: { id: string } }[]
      }[]
    }
  ).postesAPourvoir
  return postes.find(p => p.perimetre.id === perimetreId)?.souhaits ?? []
}

const souhaitsEnBase = (userId: string) =>
  prisma.souhait.count({ where: { userId, editionId: ids.edition } })

let ORGANISATION = ''

beforeAll(async () => {
  ORGANISATION = await organisationParDefaut()
  await apollo.start()
  for (const [cle, estAdmin, archive] of [
    ['admin', true, false],
    ['referente', false, false],
    ['camille', false, false],
    ['ancienne', false, true],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${s}@exemple.fr`,
        name: `${cle} ${s}`,
        isAdmin: estAdmin,
        archivedAt: archive ? new Date() : null,
      },
    })
  }
  const annee = 8100 + Math.floor(Math.random() * 800)
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
        annee,
        nom: `Essai ${s}`,
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id
  ids.archivee = (
    await prisma.edition.create({
      data: {
        organisationId: ORGANISATION,
        annee: annee - 1,
        nom: `Archive ${s}`,
        debut: new Date('2025-08-27'),
        fin: new Date('2025-08-29'),
        statut: 'ARCHIVEE',
      },
    })
  ).id
  for (const [cle, type, archive] of [
    ['natation', 'SPORT', false],
    ['basket', 'SPORT', false],
    ['volley', 'SPORT', false],
    ['logistique', 'POLE', true],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ORGANISATION,
        slug: `${cle}-${s}`,
          nom: `${cle} ${s}`,
          type,
          archivedAt: archive ? new Date() : null,
        },
      })
    ).id
  }
  slugBasket = `basket-${s}`
  await prisma.affectation.create({
    data: {
      userId: ids.referente,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
  ids.souhaitCamille = (
    await prisma.souhait.create({
      data: {
        userId: ids.camille,
        perimetreId: ids.basket,
        editionId: ids.edition,
      },
    })
  ).id
  await prisma.souhait.create({
    data: {
      userId: ids.ancienne,
      perimetreId: ids.volley,
      editionId: ids.edition,
    },
  })
})

afterAll(async () => {
  const editions = [ids.edition, ids.archivee]
  await prisma.souhait.deleteMany({ where: { editionId: { in: editions } } })
  await prisma.affectation.deleteMany({
    where: { editionId: { in: editions } },
  })
  await prisma.perimetre.deleteMany({
    where: {
      id: { in: [ids.natation, ids.basket, ids.volley, ids.logistique] },
    },
  })
  await prisma.edition.deleteMany({ where: { id: { in: editions } } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('refus d’accès', () => {
  it('refuse à une référente la lecture de ses propres souhaits', async () => {
    const r = await executer(ids.referente, '{ moi { souhaits { id } } }')
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse definirSouhaits à une référente, sans rien écrire', async () => {
    const r = await executer(ids.referente, DEFINIR, {
      u: ids.referente,
      e: ids.edition,
      p: [ids.basket],
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await souhaitsEnBase(ids.referente)).toBe(0)
  })

  it('refuse retirerSouhait à une référente, et la ligne reste', async () => {
    const r = await executer(ids.referente, RETIRER, { id: ids.souhaitCamille })
    expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.souhait.count({ where: { id: ids.souhaitCamille } })
    ).toBe(1)
  })

  it('refuse definirSouhaits sans session', async () => {
    const r = await executer(null, DEFINIR, {
      u: ids.camille,
      e: ids.edition,
      p: [ids.natation],
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await souhaitsEnBase(ids.camille)).toBe(1)
  })

  it('refuse à une référente une invitation avec des souhaits', async () => {
    const email = `pirate-${s}@exemple.fr`
    const r = await executer(ids.referente, INVITER, {
      email,
      e: ids.edition,
      p: [ids.basket],
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await prisma.user.count({ where: { email } })).toBe(0)
    expect(await prisma.souhait.count({ where: { user: { email } } })).toBe(0)
  })

  it('un souhait n’ouvre pas la lecture du périmètre', async () => {
    const r = await executer(
      ids.camille,
      'query ($s: String!, $e: ID!) { perimetre(slug: $s) { taches(editionId: $e) { id } } }',
      { s: slugBasket, e: ids.edition }
    )
    expect(code(r)).toBe('FORBIDDEN')

    const mes = await executer(ids.camille, '{ mesPerimetres { id } }')
    expect(mes.errors).toBeUndefined()
    const lus = (mes.data as { mesPerimetres: { id: string }[] }).mesPerimetres
    expect(lus.map(p => p.id)).not.toContain(ids.basket)
  })
})

describe('saisies invalides', () => {
  it('refuse des souhaits sans édition, sans créer de compte', async () => {
    const email = `sans-edition-${s}@exemple.fr`
    const r = await executer(ids.admin, INVITER, {
      email,
      e: null,
      p: [ids.basket],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toMatch(/édition/)
    expect(await prisma.user.count({ where: { email } })).toBe(0)
  })

  it('refuse un périmètre archivé ou inconnu', async () => {
    for (const perimetreId of [ids.logistique, `inconnu-${s}`]) {
      const r = await executer(ids.admin, DEFINIR, {
        u: ids.camille,
        e: ids.edition,
        p: [ids.natation, perimetreId],
      })
      expect(code(r)).toBe('SAISIE_INVALIDE')
      expect(r.errors?.[0]?.message).toMatch(/introuvable ou archivé/)
    }
    const email = `archive-${s}@exemple.fr`
    const r = await executer(ids.admin, INVITER, {
      email,
      e: ids.edition,
      p: [ids.logistique],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(await prisma.user.count({ where: { email } })).toBe(0)
    expect(await souhaitsEnBase(ids.camille)).toBe(1)
  })

  it('refuse une édition archivée', async () => {
    const r = await executer(ids.admin, DEFINIR, {
      u: ids.camille,
      e: ids.archivee,
      p: [ids.natation],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toMatch(/archivée/)

    const email = `edition-archivee-${s}@exemple.fr`
    const invitation = await executer(ids.admin, INVITER, {
      email,
      e: ids.archivee,
      p: [ids.natation],
    })
    expect(code(invitation)).toBe('SAISIE_INVALIDE')
    expect(await prisma.user.count({ where: { email } })).toBe(0)

    const ancien = await prisma.souhait.create({
      data: {
        userId: ids.camille,
        perimetreId: ids.natation,
        editionId: ids.archivee,
      },
    })
    const retrait = await executer(ids.admin, RETIRER, { id: ancien.id })
    expect(code(retrait)).toBe('SAISIE_INVALIDE')
    expect(await prisma.souhait.count({ where: { id: ancien.id } })).toBe(1)
  })

  it('refuse une personne archivée ou inconnue', async () => {
    for (const u of [ids.ancienne, `inconnue-${s}`]) {
      const r = await executer(ids.admin, DEFINIR, {
        u,
        e: ids.edition,
        p: [ids.natation],
      })
      expect(code(r)).toBe('SAISIE_INVALIDE')
    }
  })
})

describe('cas nominaux', () => {
  let invitee = ''

  it('invite une personne avec deux souhaits, sans activité ni notification', async () => {
    const r = await executer(ids.admin, INVITER, {
      email: `invitee-${s}@exemple.fr`,
      e: ids.edition,
      p: [ids.natation, ids.basket, ids.natation],
    })
    expect(r.errors).toBeUndefined()
    const personne = (
      r.data as { inviterPersonne: { id: string; souhaits: SouhaitLu[] } }
    ).inviterPersonne
    invitee = personne.id
    expect(personne.souhaits.map(x => x.perimetre.id).sort()).toEqual(
      [ids.natation, ids.basket].sort()
    )
    expect(personne.souhaits.every(x => !x.satisfait)).toBe(true)
    expect(await souhaitsEnBase(invitee)).toBe(2)
    expect(await prisma.activite.count({ where: { acteurId: invitee } })).toBe(
      0
    )
    expect(
      await prisma.notification.count({ where: { userId: invitee } })
    ).toBe(0)
  })

  it('remplace l’ensemble des souhaits sans créer de doublon', async () => {
    const avant = await prisma.souhait.findFirstOrThrow({
      where: { userId: invitee, perimetreId: ids.basket },
    })
    for (let i = 0; i < 2; i++) {
      const r = await executer(ids.admin, DEFINIR, {
        u: invitee,
        e: ids.edition,
        p: [ids.basket, ids.volley, ids.volley],
      })
      expect(r.errors).toBeUndefined()
      const lus = (
        r.data as {
          definirSouhaits: (SouhaitLu & {
            personne: { id: string }
            edition: { id: string }
          })[]
        }
      ).definirSouhaits
      expect(lus.map(x => x.perimetre.id).sort()).toEqual(
        [ids.basket, ids.volley].sort()
      )
      expect(lus.every(x => x.personne.id === invitee)).toBe(true)
      expect(lus.every(x => x.edition.id === ids.edition)).toBe(true)
    }
    const lignes = await prisma.souhait.findMany({ where: { userId: invitee } })
    expect(lignes).toHaveLength(2)
    // Le souhait conservé garde sa ligne : il n'est ni supprimé ni recréé.
    expect(lignes.map(l => l.id)).toContain(avant.id)
  })

  it('satisfait le souhait à l’affectation, et le rouvre au retrait', async () => {
    const enAttente = await souhaitsEnAttente(ids.volley)
    expect(enAttente.map(x => x.personne.id)).toContain(invitee)

    const affectation = await executer(
      ids.admin,
      'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }',
      { u: invitee, p: ids.volley, e: ids.edition }
    )
    expect(affectation.errors).toBeUndefined()
    const affectationId = (affectation.data as { affecter: { id: string } })
      .affecter.id

    const satisfaits = await souhaitsDe(invitee)
    expect(satisfaits.find(x => x.perimetre.id === ids.volley)?.satisfait).toBe(
      true
    )
    expect(satisfaits.find(x => x.perimetre.id === ids.basket)?.satisfait).toBe(
      false
    )
    expect(
      (await souhaitsEnAttente(ids.volley)).map(x => x.personne.id)
    ).not.toContain(invitee)
    // L'affectation ne modifie pas le souhait : il reste en base.
    expect(await souhaitsEnBase(invitee)).toBe(2)

    const retrait = await executer(
      ids.admin,
      'mutation ($id: ID!) { retirerAffectation(id: $id) }',
      { id: affectationId }
    )
    expect(retrait.errors).toBeUndefined()
    expect(
      (await souhaitsDe(invitee)).find(x => x.perimetre.id === ids.volley)
        ?.satisfait
    ).toBe(false)
    expect(
      (await souhaitsEnAttente(ids.volley)).map(x => x.personne.id)
    ).toContain(invitee)
  })

  it('exclut des postes à pourvoir les souhaits des comptes archivés', async () => {
    const enAttente = await souhaitsEnAttente(ids.volley)
    expect(enAttente.map(x => x.personne.id)).not.toContain(ids.ancienne)
  })

  it('laisse un admin retirer un souhait', async () => {
    const r = await executer(ids.admin, RETIRER, { id: ids.souhaitCamille })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({ retirerSouhait: true })
    expect(await souhaitsEnBase(ids.camille)).toBe(0)

    const encore = await executer(ids.admin, RETIRER, {
      id: ids.souhaitCamille,
    })
    expect(encore.data).toEqual({ retirerSouhait: false })
  })

  it('vide les souhaits avec une liste vide', async () => {
    const r = await executer(ids.admin, DEFINIR, {
      u: invitee,
      e: ids.edition,
      p: [],
    })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({ definirSouhaits: [] })
    expect(await souhaitsEnBase(invitee)).toBe(0)
  })
})
