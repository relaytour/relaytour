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
import { composer } from '../courriel/messages.ts'
import { inviterCompteExterne, purgerInvitations } from '../lib/invitations.ts'

import { schema } from './index.ts'

// Cloisonnement des organisations (ADR 0030). Une adresse connue hors de
// l'organisation ne reçoit qu'une invitation : rien ne s'écrit en son nom, et
// l'organisation ne lit rien de son compte, tant qu'elle n'a pas accepté. Chaque
// règle se prouve par le refus (invariant 11).

const enFile = vi.hoisted(() => [] as { sorte: string; cible: unknown }[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: unknown) => {
    enFile.push({ sorte, cible })
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slugA = `invit-a-${s}`
const slugB = `invit-b-${s}`
const adresse = (cle: string) => `${cle}-invit-${s}@exemple.fr`
const ids = {
  orgA: '',
  orgB: '',
  a1: '',
  a2: '',
  edition1: '',
  edition2: '',
  natation: '', // activité a1
  basket: '', // activité a1
  escrime: '', // activité a1
  judo: '', // activité a2
  adminA: '', // admin de l'organisation A
  adminA1: '', // admin de l'activité a1
  adminA2: '', // admin de l'activité a2
  adminB: '', // admin de l'organisation B
  zoe: '', // membre de B seulement : le compte extérieur
  yann: '', // membre de B seulement
  tiers: '', // membre de B seulement, jamais invité
}
const NOM_DU_COMPTE = `Zoé du compte ${s}`

async function executer(
  userId: string,
  slug: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, slug) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}
const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const INVITER = `mutation ($email: String!, $nom: String!, $e: ID, $s: [ID!], $a: [ID!], $admin: Boolean) {
  inviterPersonne(email: $email, nom: $nom, editionId: $e, perimetresSouhaites: $s, perimetresAffectes: $a, estAdmin: $admin) {
    enAttente nom personne { id nom }
  }
}`
const EN_ATTENTE = `query ($activite: ID) {
  invitationsEnAttente(activiteId: $activite) {
    id nom email estAdmin
    perimetresAffectes { id } perimetresSouhaites { id }
  }
}`
const MIENNES = `query { mesInvitations { id organisationNom estAdmin perimetres } }`
const ACCEPTER = `mutation ($id: ID!) { accepterInvitation(id: $id) }`
const REFUSER = `mutation ($id: ID!) { refuserInvitation(id: $id) }`
const RELANCER = `mutation ($id: ID!) { relancerInvitation(id: $id) }`
const RETIRER = `mutation ($id: ID!) { retirerInvitation(id: $id) }`

interface EnAttente {
  id: string
  nom: string
  email: string
  estAdmin: boolean
  perimetresAffectes: { id: string }[]
  perimetresSouhaites: { id: string }[]
}
async function enAttente(userId: string, slug = slugA, activite?: string) {
  const r = await executer(userId, slug, EN_ATTENTE, { activite })
  return (r.data as { invitationsEnAttente: EnAttente[] } | null)
    ?.invitationsEnAttente
}
async function miennes(userId: string) {
  const r = await executer(userId, slugB, MIENNES)
  return (
    r.data as {
      mesInvitations: {
        id: string
        organisationNom: string
        estAdmin: boolean
        perimetres: string[]
      }[]
    }
  ).mesInvitations
}

const invitationDe = (userId: string) =>
  prisma.invitationOrganisation.findUnique({
    where: { organisationId_userId: { organisationId: ids.orgA, userId } },
  })

/** Ce que le compte a dans l'organisation A : rien, tant qu'il n'a pas accepté. */
const traces = async (userId: string) => ({
  appartenances: await prisma.appartenance.count({
    where: { userId, organisationId: ids.orgA },
  }),
  affectations: await prisma.affectation.count({
    where: { userId, perimetre: { organisationId: ids.orgA } },
  }),
  souhaits: await prisma.souhait.count({
    where: { userId, perimetre: { organisationId: ids.orgA } },
  }),
})
const RIEN = { appartenances: 0, affectations: 0, souhaits: 0 }

async function creerCompte(
  cle: keyof typeof ids,
  organisationId: string,
  role: 'ADMIN' | 'MEMBRE',
  nom = `${cle} ${s}`
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: adresse(cle),
      name: nom,
      appartenances: { create: { organisationId, role } },
    },
  })
  ids[cle] = id
}

async function creerPerimetre(
  cle: 'natation' | 'basket' | 'escrime' | 'judo',
  activiteId: string
) {
  ids[cle] = (
    await prisma.perimetre.create({
      data: {
        organisationId: ids.orgA,
        activiteId,
        slug: cle,
        nom: cle,
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
}

/** Invite Zoé par l'admin de l'activité a1 : un périmètre affecté, un souhaité. */
const inviterZoe = () =>
  executer(ids.adminA1, slugA, INVITER, {
    email: adresse('zoe'),
    nom: 'Zoé saisie',
    e: ids.edition1,
    a: [ids.natation],
    s: [ids.basket],
  })

beforeAll(async () => {
  await apollo.start()
  for (const [cle, slug] of [
    ['orgA', slugA],
    ['orgB', slugB],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: { slug, nom: `Organisation ${slug}`, configuration: {} },
      })
    ).id
  }
  for (const [cle, edition] of [
    ['a1', 'edition1'],
    ['a2', 'edition2'],
  ] as const) {
    ids[cle] = (
      await prisma.activite.create({
        data: {
          organisationId: ids.orgA,
          slug: `${cle}-${s}`,
          nom: `Activité ${cle}`,
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      })
    ).id
    ids[edition] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.orgA,
          activiteId: ids[cle],
          annee: 2027,
          nom: `Période ${cle}`,
          debut: new Date('2027-06-01'),
          fin: new Date('2027-06-02'),
        },
      })
    ).id
  }
  await creerPerimetre('natation', ids.a1)
  await creerPerimetre('basket', ids.a1)
  await creerPerimetre('escrime', ids.a1)
  await creerPerimetre('judo', ids.a2)
  await creerCompte('adminA', ids.orgA, 'ADMIN')
  await creerCompte('adminA1', ids.orgA, 'MEMBRE')
  await creerCompte('adminA2', ids.orgA, 'MEMBRE')
  await prisma.adminActivite.createMany({
    data: [
      { organisationId: ids.orgA, activiteId: ids.a1, userId: ids.adminA1 },
      { organisationId: ids.orgA, activiteId: ids.a2, userId: ids.adminA2 },
    ],
  })
  await creerCompte('adminB', ids.orgB, 'ADMIN')
  await creerCompte('zoe', ids.orgB, 'MEMBRE', NOM_DU_COMPTE)
  await creerCompte('yann', ids.orgB, 'MEMBRE')
  await creerCompte('tiers', ids.orgB, 'MEMBRE')
})

afterAll(async () => {
  const dansA = { perimetre: { organisationId: ids.orgA } }
  await prisma.notification.deleteMany({
    where: { organisationId: { in: [ids.orgA, ids.orgB] } },
  })
  await prisma.invitationOrganisation.deleteMany({
    where: { organisationId: ids.orgA },
  })
  await prisma.souhait.deleteMany({ where: dansA })
  await prisma.affectation.deleteMany({ where: dansA })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.orgA } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.orgA } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.orgA } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.orgA } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-invit-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.orgA, ids.orgB] } },
  })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
})

beforeEach(async () => {
  enFile.length = 0
  // Les relances sont limitées à une par heure et par personne.
  const { connection } = await import('../jobs/queues.ts')
  for (const cle of ['zoe', 'yann'] as const) {
    await connection.del(`limite:relance-invitation:${ids[cle]}`)
  }
})

describe('inviter une adresse connue hors de l’organisation', () => {
  it('n’écrit rien au nom du compte et ne rend rien de lui', async () => {
    const r = await inviterZoe()
    expect(r.errors).toBeUndefined()
    // Le nom rendu est celui que l'admin a saisi, jamais celui du compte.
    expect(r.data?.inviterPersonne).toEqual({
      enAttente: true,
      nom: 'Zoé saisie',
      personne: null,
    })
    expect(JSON.stringify(r.data)).not.toContain(NOM_DU_COMPTE)
    expect(await traces(ids.zoe)).toEqual(RIEN)
    expect(enFile).toEqual([
      { sorte: 'invitation', cible: { userId: ids.zoe } },
    ])
  })

  it('ne montre la personne ni dans l’annuaire, ni dans l’équipe, ni dans la recherche', async () => {
    const annuaire = await executer(
      ids.adminA,
      slugA,
      'query { personnes { id } }'
    )
    expect(JSON.stringify(annuaire.data)).not.toContain(ids.zoe)
    const equipe = await executer(
      ids.adminA1,
      slugA,
      'query ($a: ID!) { equipe(activiteId: $a) { id } }',
      { a: ids.a1 }
    )
    expect(equipe.errors).toBeUndefined()
    expect(JSON.stringify(equipe.data)).not.toContain(ids.zoe)
    const recherche = await executer(
      ids.adminA,
      slugA,
      'query ($t: String!) { recherche(texte: $t) { personnes { id } } }',
      { t: 'Zoé du compte' }
    )
    expect(JSON.stringify(recherche.data)).not.toContain(ids.zoe)
  })

  it('n’envoie qu’un mail par heure à la même adresse, même si l’invitation se répète', async () => {
    // Le premier test a déjà envoyé un mail ; le compteur est remis à zéro avant
    // chaque test, donc celui-ci en envoie un, puis plus aucun.
    await inviterZoe()
    await inviterZoe()
    await inviterZoe()
    expect(enFile).toHaveLength(1)
    expect(
      await prisma.invitationOrganisation.count({ where: { userId: ids.zoe } })
    ).toBe(1)
  })

  it('complète l’invitation en attente au lieu d’en créer une seconde', async () => {
    const r = await executer(ids.adminA2, slugA, INVITER, {
      email: adresse('zoe'),
      nom: 'Zoé du judo',
      e: ids.edition2,
      s: [ids.judo],
    })
    expect(r.data?.inviterPersonne).toMatchObject({ enAttente: true })
    const invitation = await invitationDe(ids.zoe)
    expect(invitation?.lots).toHaveLength(2)
    expect(
      await prisma.invitationOrganisation.count({ where: { userId: ids.zoe } })
    ).toBe(1)
    expect(await traces(ids.zoe)).toEqual(RIEN)
  })
})

describe('ce que l’organisation lit d’une invitation en attente', () => {
  it('montre à l’admin d’activité ce qu’il a saisi, pour ses seules activités', async () => {
    const lues = await enAttente(ids.adminA1)
    expect(lues).toHaveLength(1)
    expect(lues![0]).toMatchObject({
      email: adresse('zoe'),
      estAdmin: false,
      perimetresAffectes: [{ id: ids.natation }],
      perimetresSouhaites: [{ id: ids.basket }],
    })
    expect(JSON.stringify(lues)).not.toContain(NOM_DU_COMPTE)
    expect(JSON.stringify(lues)).not.toContain(ids.zoe)
    // L'admin de l'autre activité ne lit que son périmètre.
    const autres = await enAttente(ids.adminA2)
    expect(autres![0]).toMatchObject({
      perimetresAffectes: [],
      perimetresSouhaites: [{ id: ids.judo }],
    })
    // L'admin de l'organisation lit les deux.
    const toutes = await enAttente(ids.adminA)
    expect(toutes![0]!.perimetresSouhaites.map(p => p.id).sort()).toEqual(
      [ids.basket, ids.judo].sort()
    )
  })

  it('refuse la lecture et les gestes à une autre organisation', async () => {
    const { id } = (await invitationDe(ids.zoe))!
    expect(await enAttente(ids.adminB, slugB)).toEqual([])
    for (const mutation of [RELANCER, RETIRER]) {
      expect(code(await executer(ids.adminB, slugB, mutation, { id }))).toBe(
        'FORBIDDEN'
      )
    }
    // Une personne sans rôle de gestion ne lit rien.
    expect(code(await executer(ids.tiers, slugB, EN_ATTENTE))).toBe('FORBIDDEN')
    expect(await invitationDe(ids.zoe)).not.toBeNull()
    expect(enFile).toEqual([])
  })

  it('relance une fois par heure', async () => {
    const { id } = (await invitationDe(ids.zoe))!
    const premiere = await executer(ids.adminA1, slugA, RELANCER, { id })
    expect(premiere.data).toEqual({ relancerInvitation: true })
    expect(code(await executer(ids.adminA1, slugA, RELANCER, { id }))).toBe(
      'SAISIE_INVALIDE'
    )
    expect(enFile).toHaveLength(1)
  })

  it('laisse l’invitation quand un admin d’activité retire ses périmètres', async () => {
    const { id } = (await invitationDe(ids.zoe))!
    const r = await executer(ids.adminA2, slugA, RETIRER, { id })
    expect(r.data).toEqual({ retirerInvitation: true })
    const restante = await invitationDe(ids.zoe)
    expect(restante?.lots).toEqual([
      expect.objectContaining({ editionId: ids.edition1 }),
    ])
    // Il ne la lit plus, et ne peut plus agir dessus.
    expect(await enAttente(ids.adminA2)).toEqual([])
    expect(code(await executer(ids.adminA2, slugA, RETIRER, { id }))).toBe(
      'FORBIDDEN'
    )
  })
})

describe('ce que la personne invitée lit et décide', () => {
  it('lit son invitation, et personne d’autre ne la lit', async () => {
    const lues = await miennes(ids.zoe)
    expect(lues).toEqual([
      {
        id: (await invitationDe(ids.zoe))!.id,
        organisationNom: `Organisation ${slugA}`,
        estAdmin: false,
        perimetres: expect.arrayContaining([
          'basket (Période a1)',
          'natation (Période a1)',
        ]) as string[],
      },
    ])
    expect(lues[0]!.perimetres).toHaveLength(2)
    expect(await miennes(ids.tiers)).toEqual([])
  })

  it('refuse qu’une autre personne accepte ou refuse à sa place', async () => {
    const { id } = (await invitationDe(ids.zoe))!
    expect(code(await executer(ids.tiers, slugB, ACCEPTER, { id }))).toBe(
      'FORBIDDEN'
    )
    const refus = await executer(ids.tiers, slugB, REFUSER, { id })
    expect(refus.data).toEqual({ refuserInvitation: false })
    expect(await invitationDe(ids.zoe)).not.toBeNull()
    expect(await traces(ids.tiers)).toEqual(RIEN)
    // Une requête sans session ne passe pas non plus.
    const anonyme = await apollo.executeOperation(
      { query: ACCEPTER, variables: { id } },
      { contextValue: await buildContext('127.0.0.1', null, null) }
    )
    expect(
      anonyme.body.kind === 'single' &&
        anonyme.body.singleResult.errors?.[0]?.extensions?.code
    ).toBe('FORBIDDEN')
  })

  it('ne lit plus, n’accepte plus et ne relance plus une invitation expirée', async () => {
    const { id, expireLe } = (await invitationDe(ids.zoe))!
    await prisma.invitationOrganisation.update({
      where: { id },
      data: { expireLe: new Date(Date.now() - 1000) },
    })
    expect(await miennes(ids.zoe)).toEqual([])
    expect(await enAttente(ids.adminA)).toEqual([])
    expect(code(await executer(ids.zoe, slugB, ACCEPTER, { id }))).toBe(
      'FORBIDDEN'
    )
    for (const mutation of [RELANCER, RETIRER]) {
      expect(code(await executer(ids.adminA, slugA, mutation, { id }))).toBe(
        'FORBIDDEN'
      )
    }
    expect(await traces(ids.zoe)).toEqual(RIEN)
    // Le mail d'une invitation expirée ne part pas.
    expect(
      await composer(prisma, {
        sorte: 'invitation',
        userId: ids.zoe,
        organisationId: ids.orgA,
      })
    ).toBeNull()
    await prisma.invitationOrganisation.update({
      where: { id },
      data: { expireLe },
    })
  })

  it('reçoit un mail qui annonce une invitation, pas un accès', async () => {
    const message = await composer(prisma, {
      sorte: 'invitation',
      userId: ids.zoe,
      organisationId: ids.orgA,
      activiteId: ids.a1,
    })
    expect(message?.sujet).toContain('vous invite')
    expect(message?.texte).toContain('vous acceptez ou refusez')
    expect(message?.texte).toContain('natation (Période a1)')
    expect(message?.texte).not.toContain('vous a ouvert un accès')
  })

  it('refuse sans que l’organisation l’apprenne, puis peut être réinvitée', async () => {
    const { id } = (await invitationDe(ids.zoe))!
    const r = await executer(ids.zoe, slugB, REFUSER, { id })
    expect(r.data).toEqual({ refuserInvitation: true })
    expect(await invitationDe(ids.zoe)).toBeNull()
    expect(await traces(ids.zoe)).toEqual(RIEN)
    expect(
      await prisma.notification.count({ where: { organisationId: ids.orgA } })
    ).toBe(0)
    expect(enFile).toEqual([])
    expect((await inviterZoe()).data?.inviterPersonne).toMatchObject({
      enAttente: true,
    })
  })

  it('accepte : l’appartenance, l’affectation et le souhait naissent, et la personne qui a invité est prévenue', async () => {
    const { id } = (await invitationDe(ids.zoe))!
    const r = await executer(ids.zoe, slugB, ACCEPTER, { id })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({ accepterInvitation: slugA })
    expect(await traces(ids.zoe)).toEqual({
      appartenances: 1,
      affectations: 1,
      souhaits: 1,
    })
    expect(
      await prisma.affectation.count({
        where: { userId: ids.zoe, perimetreId: ids.natation },
      })
    ).toBe(1)
    expect(await invitationDe(ids.zoe)).toBeNull()
    // Une seconde acceptation ne trouve plus rien.
    expect(code(await executer(ids.zoe, slugB, ACCEPTER, { id }))).toBe(
      'FORBIDDEN'
    )
    const notifications = await executer(
      ids.adminA1,
      slugA,
      'query { notifications { type message } }'
    )
    expect(notifications.data).toEqual({
      notifications: [
        {
          type: 'INVITATION_ACCEPTEE',
          message: `${NOM_DU_COMPTE} a accepté l’invitation et rejoint l’organisation.`,
        },
      ],
    })
    // Une fois membre, la personne se lit dans l'équipe, sous le nom de son compte.
    const equipe = await executer(
      ids.adminA1,
      slugA,
      'query ($a: ID!) { equipe(activiteId: $a) { id nom } }',
      { a: ids.a1 }
    )
    expect(equipe.data?.equipe).toContainEqual({
      id: ids.zoe,
      nom: NOM_DU_COMPTE,
    })
  })
})

describe('invitation née d’un import', () => {
  const lot = (contactPrincipal: string[]) => ({
    editionId: '',
    activiteId: '',
    affectes: [ids.natation, ids.escrime],
    souhaites: [],
    contactPrincipal,
  })

  it('n’applique le contact principal qu’à un périmètre qui n’en a pas, et prévient les admins', async () => {
    const { id } = await prisma.$transaction(tx =>
      inviterCompteExterne(tx, {
        organisationId: ids.orgA,
        userId: ids.yann,
        role: 'MEMBRE',
        nom: 'Yann saisi',
        origine: 'IMPORT',
        inviteParId: null,
        lot: {
          ...lot([ids.natation, ids.escrime]),
          editionId: ids.edition1,
          activiteId: ids.a1,
        },
        instant: new Date(),
      })
    )
    // Pendant l'attente, Zoé est désignée contact principal de la natation.
    await prisma.affectation.updateMany({
      where: { userId: ids.zoe, perimetreId: ids.natation },
      data: { contactPrincipal: true },
    })
    const r = await executer(ids.yann, slugB, ACCEPTER, { id })
    expect(r.errors).toBeUndefined()
    const affectations = await prisma.affectation.findMany({
      where: { userId: ids.yann },
      select: { perimetreId: true, contactPrincipal: true },
    })
    expect(affectations).toContainEqual({
      perimetreId: ids.natation,
      contactPrincipal: false,
    })
    expect(affectations).toContainEqual({
      perimetreId: ids.escrime,
      contactPrincipal: true,
    })
    // La désignation faite entre-temps demeure.
    expect(
      await prisma.affectation.count({
        where: {
          userId: ids.zoe,
          perimetreId: ids.natation,
          contactPrincipal: true,
        },
      })
    ).toBe(1)
    // Sans personne qui invite, les admins de l'organisation sont prévenus.
    expect(
      await prisma.notification.findMany({
        where: { type: 'INVITATION_ACCEPTEE', acteurId: ids.yann },
        select: { userId: true },
      })
    ).toEqual([{ userId: ids.adminA }])
  })
})

describe('gestes simultanés', () => {
  const lot = (editionId: string, activiteId: string, perimetreId: string) => ({
    editionId,
    activiteId,
    affectes: [perimetreId],
    souhaites: [],
    contactPrincipal: [perimetreId],
  })
  const inviter = (userId: string, lots: ReturnType<typeof lot>[]) =>
    prisma.invitationOrganisation.create({
      data: {
        organisationId: ids.orgA,
        userId,
        nom: 'Saisi',
        origine: 'IMPORT',
        lots,
        expireLe: new Date(Date.now() + 3600_000),
      },
    })

  it('retire entièrement l’invitation quand deux admins d’activité retirent ensemble leurs périmètres', async () => {
    const { id } = await inviter(ids.tiers, [
      lot(ids.edition1, ids.a1, ids.basket),
      lot(ids.edition2, ids.a2, ids.judo),
    ])
    const [un, deux] = await Promise.all([
      executer(ids.adminA1, slugA, RETIRER, { id }),
      executer(ids.adminA2, slugA, RETIRER, { id }),
    ])
    expect(un.errors ?? deux.errors).toBeUndefined()
    // Sans verrou, le second retrait réécrirait le lot que le premier a retiré.
    expect(await invitationDe(ids.tiers)).toBeNull()
  })

  it('ne désigne qu’un contact principal quand deux personnes invitées acceptent ensemble', async () => {
    const invitations = await Promise.all(
      [ids.tiers, ids.adminB].map(userId =>
        inviter(userId, [lot(ids.edition1, ids.a1, ids.basket)])
      )
    )
    const [un, deux] = await Promise.all([
      executer(ids.tiers, slugB, ACCEPTER, { id: invitations[0]!.id }),
      executer(ids.adminB, slugB, ACCEPTER, { id: invitations[1]!.id }),
    ])
    expect(un.errors ?? deux.errors).toBeUndefined()
    expect(
      await prisma.affectation.count({
        where: { perimetreId: ids.basket, editionId: ids.edition1 },
      })
    ).toBe(2)
    expect(
      await prisma.affectation.count({
        where: {
          perimetreId: ids.basket,
          editionId: ids.edition1,
          contactPrincipal: true,
        },
      })
    ).toBe(1)
  })
})

describe('mail d’une invitation au rôle d’admin', () => {
  it('lie le mode d’emploi du rôle proposé, pas celui d’un rôle que la personne n’a pas encore', async () => {
    const userId = randomUUID()
    await prisma.user.create({
      data: { id: userId, email: adresse('future-admin'), name: 'Compte' },
    })
    await prisma.$transaction(tx =>
      inviterCompteExterne(tx, {
        organisationId: ids.orgA,
        userId,
        role: 'ADMIN',
        nom: 'Saisie',
        origine: 'INSTALLATION',
        inviteParId: null,
        instant: new Date(),
      })
    )
    const message = await composer(prisma, {
      sorte: 'invitation',
      userId,
      organisationId: ids.orgA,
    })
    expect(message?.texte).toContain('admin-organisation.html')
    expect(message?.texte).not.toContain('referent.html')
  })
})

describe('purge', () => {
  it('efface les invitations expirées et laisse les autres', async () => {
    const instant = new Date()
    for (const [userId, decalage] of [
      [ids.tiers, -1000],
      [ids.adminB, 3600_000],
    ] as const) {
      await prisma.invitationOrganisation.create({
        data: {
          organisationId: ids.orgA,
          userId,
          nom: 'Saisi',
          origine: 'INSTALLATION',
          globale: true,
          lots: [],
          expireLe: new Date(instant.getTime() + decalage),
        },
      })
    }
    expect(await purgerInvitations(prisma, instant)).toBeGreaterThanOrEqual(1)
    expect(await invitationDe(ids.tiers)).toBeNull()
    expect(await invitationDe(ids.adminB)).not.toBeNull()
  })
})
