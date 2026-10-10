import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Même compte, deux organisations (ADR 0030). Un compte est global, mais les
// organisations sont cloisonnées : rien de l'une ne se lit ni ne s'écrit depuis
// l'autre, y compris à propos d'une personne membre des deux, et y compris par
// cette personne quand elle travaille dans l'autre.
//
// Zoé est admin de l'organisation B et simple membre de A. Dans chacune, elle a une
// affectation, un souhait, une tâche et une notification ; dans B, elle administre
// aussi l'activité. Les lectures se prouvent par l'absence de tout identifiant et de
// tout nom de l'autre organisation, les écritures par le refus (invariant 11).

vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: () => Promise.resolve(),
}))

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })

type Cle = 'a' | 'b'
interface Monde {
  slug: string
  org: string
  activite: string
  edition: string
  perimetre: string
  autrePerimetre: string
  tache: string
  admin: string
  /** Tout ce qui nomme ou désigne cette organisation. */
  marques: string[]
}
const mondes = {} as Record<Cle, Monde>
const ids = { zoe: '', tiers: '' }
const adresse = (cle: string) => `${cle}-meme-compte-${s}@exemple.fr`

async function executer(
  userId: string,
  slug: string | null,
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

async function creerCompte(
  cle: string,
  appartenances: { organisationId: string; role: 'ADMIN' | 'MEMBRE' }[]
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: adresse(cle),
      name: `${cle} ${s}`,
      appartenances: { create: appartenances },
    },
  })
  return id
}

async function creerMonde(cle: Cle): Promise<Monde> {
  const slug = `meme-${cle}-${s}`
  const nom = (objet: string) => `${objet} ${cle.toUpperCase()} ${s}`
  const org = await prisma.organisation.create({
    data: { slug, nom: nom('Organisation'), configuration: {} },
  })
  const activite = await prisma.activite.create({
    data: {
      organisationId: org.id,
      slug: `activite-${cle}-${s}`,
      nom: nom('Activité'),
      groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
    },
  })
  const edition = await prisma.edition.create({
    data: {
      organisationId: org.id,
      activiteId: activite.id,
      annee: 2027,
      nom: nom('Période'),
      statut: 'EN_COURS',
      debut: new Date('2027-06-01'),
      fin: new Date('2027-06-02'),
    },
  })
  const perimetres = []
  for (const sport of ['Natation', 'Basket']) {
    perimetres.push(
      await prisma.perimetre.create({
        data: {
          organisationId: org.id,
          activiteId: activite.id,
          slug: sport.toLowerCase(),
          nom: nom(sport),
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    )
  }
  const tache = await prisma.tache.create({
    data: {
      titre: nom('Tâche'),
      perimetreId: perimetres[0]!.id,
      editionId: edition.id,
    },
  })
  const admin = await creerCompte(`admin-${cle}`, [
    { organisationId: org.id, role: 'ADMIN' },
  ])
  return {
    slug,
    org: org.id,
    activite: activite.id,
    edition: edition.id,
    perimetre: perimetres[0]!.id,
    autrePerimetre: perimetres[1]!.id,
    tache: tache.id,
    admin,
    marques: [
      slug,
      org.id,
      activite.id,
      edition.id,
      perimetres[0]!.id,
      perimetres[1]!.id,
      tache.id,
      admin,
      ...[
        'Organisation',
        'Activité',
        'Période',
        'Natation',
        'Basket',
        'Tâche',
      ].map(nom),
    ],
  }
}

/** Ce que Zoé a dans une organisation : une affectation, un souhait, une tâche, une notification. */
async function installerZoe(m: Monde) {
  await prisma.affectation.create({
    data: { userId: ids.zoe, perimetreId: m.perimetre, editionId: m.edition },
  })
  await prisma.souhait.create({
    data: {
      userId: ids.zoe,
      perimetreId: m.autrePerimetre,
      editionId: m.edition,
    },
  })
  await prisma.tacheAssignation.create({
    data: { tacheId: m.tache, userId: ids.zoe },
  })
  await prisma.notification.create({
    data: {
      organisationId: m.org,
      userId: ids.zoe,
      type: 'TACHE_CREEE',
      tacheId: m.tache,
      perimetreId: m.perimetre,
    },
  })
}

beforeAll(async () => {
  await apollo.start()
  mondes.a = await creerMonde('a')
  mondes.b = await creerMonde('b')
  ids.zoe = await creerCompte('zoe', [
    { organisationId: mondes.a.org, role: 'MEMBRE' },
    { organisationId: mondes.b.org, role: 'ADMIN' },
  ])
  // Un compte d'une troisième situation : membre d'aucune des deux.
  ids.tiers = await creerCompte('tiers', [])
  await installerZoe(mondes.a)
  await installerZoe(mondes.b)
  await prisma.adminActivite.create({
    data: {
      organisationId: mondes.b.org,
      activiteId: mondes.b.activite,
      userId: ids.zoe,
    },
  })
})

afterAll(async () => {
  const orgs = [mondes.a.org, mondes.b.org]
  const dans = { organisationId: { in: orgs } }
  await prisma.notification.deleteMany({ where: dans })
  await prisma.journal.deleteMany({ where: { perimetre: dans } })
  await prisma.tache.deleteMany({ where: { perimetre: dans } })
  await prisma.souhait.deleteMany({ where: { perimetre: dans } })
  await prisma.affectation.deleteMany({ where: { perimetre: dans } })
  await prisma.adminActivite.deleteMany({ where: dans })
  await prisma.edition.deleteMany({ where: dans })
  await prisma.perimetre.deleteMany({ where: dans })
  await prisma.activite.deleteMany({ where: dans })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-meme-compte-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: orgs } } })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
})

/** Aucune marque de l'organisation `autre` ne figure dans les réponses. */
function sansTraceDe(autre: Monde, reponses: unknown) {
  const texte = JSON.stringify(reponses)
  for (const marque of autre.marques)
    expect(texte, marque).not.toContain(marque)
}

const PERSONNE = `id nom email estAdmin activitesAdministrees
  affectations { id contactPrincipal perimetre { id nom } edition { id nom } }
  souhaits { id perimetre { id nom } }`

/** Tout ce qu'un admin lit d'une personne et de son organisation. */
async function lecturesDeLAdmin(m: Monde) {
  const lire = (query: string, variables = {}) =>
    executer(m.admin, m.slug, query, variables)
  const lectures = [
    await lire(
      `query { personnes { ${PERSONNE} attributions { activiteId } } }`
    ),
    await lire(`query ($a: ID!) { equipe(activiteId: $a) { ${PERSONNE} } }`, {
      a: m.activite,
    }),
    await lire(
      `query ($e: ID!) { affectations(editionId: $e) { personne { ${PERSONNE} } perimetre { nom } } }`,
      { e: m.edition }
    ),
    await lire(
      `query ($t: String!, $e: ID) { recherche(texte: $t, editionId: $e) { taches { id titre } fiches { id } personnes { id nom perimetres { id nom } } } }`,
      { t: s, e: m.edition }
    ),
    await lire(
      `query ($e: ID!) { classement(editionId: $e) { personne { id nom } } retroplanning(editionId: $e) { id titre assignes { id nom } perimetre { nom } } }`,
      { e: m.edition }
    ),
    await lire(
      `query { adminsOrganisation { id nom } activites { id nom slug } }`
    ),
  ]
  for (const l of lectures) {
    expect(l.errors, JSON.stringify(l.errors)).toBeUndefined()
  }
  return lectures.map(l => l.data)
}

describe.each([
  ['A', 'a', 'b'],
  ['B', 'b', 'a'],
] as const)(
  'l’admin de %s lit une personne membre des deux',
  (_nom, ici, la) => {
    it('ne lit rien de l’autre organisation', async () => {
      const lectures = await lecturesDeLAdmin(mondes[ici])
      sansTraceDe(mondes[la], lectures)
      // La personne figure bien dans les réponses, avec ce qu'elle a ici.
      const zoe = (
        lectures[0] as {
          personnes: {
            id: string
            estAdmin: boolean
            activitesAdministrees: string[]
            affectations: { perimetre: { id: string } }[]
            souhaits: { perimetre: { id: string } }[]
          }[]
        }
      ).personnes.find(p => p.id === ids.zoe)!
      expect(zoe.estAdmin).toBe(ici === 'b')
      expect(zoe.activitesAdministrees).toEqual(
        ici === 'b' ? [mondes.b.activite] : []
      )
      expect(zoe.affectations.map(a => a.perimetre.id)).toEqual([
        mondes[ici].perimetre,
      ])
      expect(zoe.souhaits.map(x => x.perimetre.id)).toEqual([
        mondes[ici].autrePerimetre,
      ])
    })

    it('n’agit pas sur ce que la personne a dans l’autre organisation', async () => {
      const autre = mondes[la]
      const agir = (query: string, variables = {}) =>
        executer(mondes[ici].admin, mondes[ici].slug, query, variables)
      const avant = await etatDeZoe(autre)
      const refus = [
        await agir(
          `mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }`,
          { u: ids.zoe, p: autre.autrePerimetre, e: autre.edition }
        ),
        await agir(
          `mutation ($u: ID!, $e: ID!) { definirSouhaits(personneId: $u, editionId: $e, perimetreIds: []) { id } }`,
          { u: ids.zoe, e: autre.edition }
        ),
        await agir(
          `mutation ($u: ID!, $a: ID!) { definirAdminActivite(personneId: $u, activiteId: $a, admin: false) }`,
          { u: ids.zoe, a: autre.activite }
        ),
        await agir(
          `mutation ($id: ID!, $u: ID) { assignerTache(id: $id, personneId: $u, assigne: false) { id } }`,
          { id: autre.tache, u: ids.zoe }
        ),
      ]
      for (const r of refus) {
        expect(code(r)).toBeOneOf(['FORBIDDEN', 'SAISIE_INVALIDE'])
      }
      expect(await etatDeZoe(autre)).toEqual(avant)
    })
  }
)

/** Ce que Zoé a dans une organisation, pour vérifier qu'un geste ne l'a pas changé. */
const etatDeZoe = async (m: Monde) => ({
  affectations: await prisma.affectation.count({
    where: { userId: ids.zoe, perimetre: { organisationId: m.org } },
  }),
  souhaits: await prisma.souhait.count({
    where: { userId: ids.zoe, perimetre: { organisationId: m.org } },
  }),
  admin: await prisma.adminActivite.count({
    where: { userId: ids.zoe, organisationId: m.org },
  }),
  assignations: await prisma.tacheAssignation.count({
    where: { userId: ids.zoe, tacheId: m.tache },
  }),
})

describe.each([
  ['A', 'a', 'b'],
  ['B', 'b', 'a'],
] as const)('la personne travaille dans %s', (_nom, ici, la) => {
  const MOI = `query ($e: ID!) {
    moi { id nom email estAdmin activitesAdministrees affectations { id perimetre { id nom } edition { id nom } } }
    mesOrganisations { slug active }
    notifications { id message lien }
    nombreNotificationsNonLues
    mesTaches(editionId: $e) { id titre perimetre { nom } }
    mesPerimetres { id nom }
    retroplanning(editionId: $e) { id titre }
  }`

  it('ne lit que cette organisation', async () => {
    const r = await executer(ids.zoe, mondes[ici].slug, MOI, {
      e: mondes[ici].edition,
    })
    expect(r.errors, JSON.stringify(r.errors)).toBeUndefined()
    const { mesOrganisations, ...reste } = r.data as {
      mesOrganisations: { slug: string; active: boolean }[]
      nombreNotificationsNonLues: number
      notifications: unknown[]
      mesTaches: { id: string }[]
    }
    // La liste de ses organisations est la seule lecture qui nomme l'autre.
    expect(mesOrganisations.find(o => o.active)?.slug).toBe(mondes[ici].slug)
    sansTraceDe(mondes[la], reste)
    expect(reste.nombreNotificationsNonLues).toBe(1)
    expect(reste.notifications).toHaveLength(1)
    expect(reste.mesTaches.map(t => t.id)).toEqual([mondes[ici].tache])
  })

  it('se voit refuser tout objet de l’autre organisation, même si elle y est admin', async () => {
    const autre = mondes[la]
    const tenter = (query: string, variables = {}) =>
      executer(ids.zoe, mondes[ici].slug, query, variables)
    const tentatives = [
      await tenter(`query ($e: ID!) { retroplanning(editionId: $e) { id } }`, {
        e: autre.edition,
      }),
      await tenter(`query ($id: ID!) { tache(id: $id) { id titre } }`, {
        id: autre.tache,
      }),
      await tenter(`query ($a: ID!) { equipe(activiteId: $a) { id } }`, {
        a: autre.activite,
      }),
      await tenter(
        `mutation ($id: ID!) { changerStatutTache(id: $id, statut: FAITE, confirmer: true) { id } }`,
        { id: autre.tache }
      ),
      await tenter(
        `mutation ($p: ID!, $e: ID!) { creerTache(perimetreId: $p, editionId: $e, titre: "Intrusion") { id } }`,
        { p: autre.perimetre, e: autre.edition }
      ),
    ]
    for (const r of tentatives) expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.tache.count({ where: { perimetreId: autre.perimetre } })
    ).toBe(1)
  })

  it('ne marque lues que les notifications de cette organisation', async () => {
    const r = await executer(
      ids.zoe,
      mondes[ici].slug,
      `mutation { marquerNotificationsLues }`
    )
    expect(r.data).toEqual({ marquerNotificationsLues: 1 })
    expect(
      await prisma.notification.count({
        where: {
          userId: ids.zoe,
          organisationId: mondes[la].org,
          lueLe: null,
        },
      })
    ).toBe(1)
    // Remise en l'état pour l'autre sens du tableau.
    await prisma.notification.updateMany({
      where: { userId: ids.zoe },
      data: { lueLe: null },
    })
  })
})

describe('le rôle ne suit pas la personne d’une organisation à l’autre', () => {
  it('admin de B, elle n’a aucun droit de gestion dans A', async () => {
    const gestes = [
      await executer(ids.zoe, mondes.a.slug, `query { personnes { id } }`),
      await executer(
        ids.zoe,
        mondes.a.slug,
        `query ($a: ID!) { equipe(activiteId: $a) { id email } }`,
        { a: mondes.a.activite }
      ),
      await executer(
        ids.zoe,
        mondes.a.slug,
        `mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }`,
        { id: mondes.a.admin }
      ),
      await executer(
        ids.zoe,
        mondes.a.slug,
        `mutation { creerPerimetre(nom: "Intrusion", slug: "intrusion-${s}") { id } }`
      ),
    ]
    for (const r of gestes) expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.perimetre.count({ where: { organisationId: mondes.a.org } })
    ).toBe(2)
  })

  it('n’a aucune organisation active sans en-tête, ni avec celui d’une organisation inconnue', async () => {
    for (const slug of [null, `inconnue-${s}`]) {
      const r = await executer(ids.zoe, slug, `query { activites { id } }`)
      expect(code(r)).toBe('FORBIDDEN')
    }
  })

  it('refuse l’en-tête d’une organisation à un compte qui n’en est pas membre', async () => {
    for (const m of [mondes.a, mondes.b]) {
      const r = await executer(
        ids.tiers,
        m.slug,
        `query ($e: ID!) { activites { id } retroplanning(editionId: $e) { id } }`,
        { e: m.edition }
      )
      expect(code(r)).toBe('FORBIDDEN')
      expect(r.data ?? null).toBeNull()
    }
  })
})
