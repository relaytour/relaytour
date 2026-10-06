import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Admins d'activité, visibilité des activités et de leurs personnes (ADR 0010 et
// 0018).
//
// Une organisation porte deux activités, A1 et A2. L'admin de l'organisation les
// voit et les gère toutes. L'admin de A1 gère A1 : il ne voit ni A2, ni les personnes
// hors de son équipe. Une personne ne voit que les activités où elle est affectée.
// La table des refus croisés prouve les refus opération par opération ; ce fichier
// prouve ce que chaque rôle peut faire, et les opérations réservées à l'admin de
// l'organisation.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slug = `admins-${s}`
const ids = {
  org: '',
  a1: '',
  a2: '',
  edition1: '',
  edition2: '',
  perimetre1: '',
  perimetre2: '',
  adminOrg: '',
  adminA1: '',
  membreA1: '',
  membreA2: '',
  sansActivite: '',
}

async function executer(
  userId: string,
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

async function creerCompte(cle: string, role: 'ADMIN' | 'MEMBRE') {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: `${cle}-${s}@exemple.fr`,
      name: `${cle} ${s}`,
      appartenances: { create: { organisationId: ids.org, role } },
    },
  })
  return id
}

async function creerActivite(cle: string) {
  const activite = await prisma.activite.create({
    data: {
      organisationId: ids.org,
      slug: `${cle}-${s}`,
      nom: `Activité ${cle}`,
      groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
    },
  })
  const edition = await prisma.edition.create({
    data: {
      organisationId: ids.org,
      activiteId: activite.id,
      annee: 2027,
      nom: `Période ${cle}`,
      debut: new Date('2027-06-01'),
      fin: new Date('2027-06-02'),
    },
  })
  const perimetre = await prisma.perimetre.create({
    data: {
      organisationId: ids.org,
      activiteId: activite.id,
      slug: 'natation',
      nom: `Natation ${cle}`,
      type: 'SPORT',
      groupe: 'sport',
    },
  })
  return { activite: activite.id, edition: edition.id, perimetre: perimetre.id }
}

const ACTIVITES = 'query { activites { id } }'
const CREER_PERIMETRE =
  'mutation ($a: ID!, $s: String!) { creerPerimetre(activiteId: $a, slug: $s, nom: "Nouveau", groupe: "sport") { id } }'
const AFFECTER =
  'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }'
const EQUIPE = 'query ($a: ID) { equipe(activiteId: $a) { id nom email } }'
const INVITER =
  'mutation ($email: String!, $e: ID, $p: [ID!]) { inviterPersonne(email: $email, nom: "Invitée", editionId: $e, perimetresSouhaites: $p) { id } }'
const DEFINIR_ADMIN =
  'mutation ($u: ID!, $a: ID!, $x: Boolean!) { definirAdminActivite(personneId: $u, activiteId: $a, admin: $x) }'

beforeAll(async () => {
  ids.org = (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${s}`, configuration: {} },
    })
  ).id
  const a1 = await creerActivite('a1')
  const a2 = await creerActivite('a2')
  Object.assign(ids, {
    a1: a1.activite,
    a2: a2.activite,
    edition1: a1.edition,
    edition2: a2.edition,
    perimetre1: a1.perimetre,
    perimetre2: a2.perimetre,
  })
  ids.adminOrg = await creerCompte('admin-org', 'ADMIN')
  ids.adminA1 = await creerCompte('admin-a1', 'MEMBRE')
  ids.membreA1 = await creerCompte('membre-a1', 'MEMBRE')
  ids.membreA2 = await creerCompte('membre-a2', 'MEMBRE')
  ids.sansActivite = await creerCompte('sans-activite', 'MEMBRE')
  await prisma.adminActivite.create({
    data: { userId: ids.adminA1, activiteId: ids.a1, organisationId: ids.org },
  })
  await prisma.affectation.createMany({
    data: [
      {
        userId: ids.membreA1,
        perimetreId: ids.perimetre1,
        editionId: ids.edition1,
      },
      {
        userId: ids.membreA2,
        perimetreId: ids.perimetre2,
        editionId: ids.edition2,
      },
    ],
  })
})

afterAll(async () => {
  await prisma.droitRedaction.deleteMany({ where: { organisationId: ids.org } })
  await prisma.souhait.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.adminActivite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  invaliderConfigurationOrganisation()
})

describe('visibilité des activités', () => {
  it('montre à chaque rôle ses activités seulement', async () => {
    const liste = async (userId: string) =>
      ((await executer(userId, ACTIVITES)).data?.activites as { id: string }[])
        .map(a => a.id)
        .sort()
    expect(await liste(ids.adminOrg)).toEqual([ids.a1, ids.a2].sort())
    expect(await liste(ids.adminA1)).toEqual([ids.a1])
    expect(await liste(ids.membreA1)).toEqual([ids.a1])
    expect(await liste(ids.membreA2)).toEqual([ids.a2])
    expect(await liste(ids.sansActivite)).toEqual([])
  })

  it('refuse toute lecture d’une activité à une personne qui ne la voit pas', async () => {
    for (const userId of [ids.adminA1, ids.membreA1, ids.sansActivite]) {
      const r = await executer(
        userId,
        'query ($a: ID) { editions(activiteId: $a) { id } }',
        { a: ids.a2 }
      )
      expect(code(r)).toBe('FORBIDDEN')
    }
    // Sans activité visible, même la requête sans identifiant est refusée.
    expect(
      code(await executer(ids.sansActivite, 'query { editions { id } }'))
    ).toBe('FORBIDDEN')
  })

  it('ouvre une activité dès la première affectation', async () => {
    const affectation = await prisma.affectation.create({
      data: {
        userId: ids.sansActivite,
        perimetreId: ids.perimetre2,
        editionId: ids.edition2,
      },
    })
    try {
      const r = await executer(ids.sansActivite, ACTIVITES)
      expect(r.data?.activites).toEqual([{ id: ids.a2 }])
    } finally {
      await prisma.affectation.delete({ where: { id: affectation.id } })
    }
  })
})

describe('admin d’une activité', () => {
  const REFERENTS =
    'query ($a: ID, $e: ID!) { perimetre(slug: "natation", activiteId: $a) { referents(editionId: $e) { id nom } } }'
  const ADRESSES = REFERENTS.replace('id nom', 'id email')
  const liens = () =>
    Promise.all([
      prisma.affectation.count({
        where: { perimetre: { organisationId: ids.org } },
      }),
      prisma.souhait.count({
        where: { perimetre: { organisationId: ids.org } },
      }),
      prisma.droitRedaction.count({ where: { organisationId: ids.org } }),
    ])

  it('gère son activité : périmètre et affectation d’une personne de son équipe', async () => {
    const perimetre = await executer(ids.adminA1, CREER_PERIMETRE, {
      a: ids.a1,
      s: `nouveau-${s}`,
    })
    expect(perimetre.errors).toBeUndefined()
    const nouveau = (perimetre.data?.creerPerimetre as { id: string }).id
    const affectation = await executer(ids.adminA1, AFFECTER, {
      u: ids.membreA1,
      p: nouveau,
      e: ids.edition1,
    })
    expect(affectation.errors).toBeUndefined()
    await prisma.affectation.deleteMany({ where: { perimetreId: nouveau } })
  })

  it('ne lit pas l’annuaire de l’organisation', async () => {
    for (const userId of [ids.adminA1, ids.membreA1]) {
      expect(code(await executer(userId, 'query { personnes { id } }'))).toBe(
        'FORBIDDEN'
      )
    }
    const annuaire = await executer(ids.adminOrg, 'query { personnes { id } }')
    expect(annuaire.data?.personnes).toHaveLength(5)
  })

  it('réserve à l’admin de l’organisation les activités de chaque personne', async () => {
    const ATTRIBUTIONS =
      '{ id attributions { activiteId affectee interessee admin } }'
    expect(
      code(
        await executer(
          ids.adminA1,
          `query ($a: ID) { equipe(activiteId: $a) ${ATTRIBUTIONS} }`,
          { a: ids.a1 }
        )
      )
    ).toBe('FORBIDDEN')
    expect(
      code(await executer(ids.membreA1, `query { moi ${ATTRIBUTIONS} }`))
    ).toBe('FORBIDDEN')

    const souhait = await prisma.souhait.create({
      data: {
        userId: ids.membreA1,
        perimetreId: ids.perimetre2,
        editionId: ids.edition2,
      },
    })
    try {
      const r = await executer(
        ids.adminOrg,
        `query { personnes ${ATTRIBUTIONS} }`
      )
      expect(r.errors).toBeUndefined()
      const attributions = new Map(
        (
          r.data?.personnes as {
            id: string
            attributions: { activiteId: string }[]
          }[]
        ).map(p => [
          p.id,
          [...p.attributions].sort((x, y) =>
            x.activiteId.localeCompare(y.activiteId)
          ),
        ])
      )
      const lien = (activiteId: string, vrai: string) => ({
        activiteId,
        affectee: vrai === 'affectee',
        interessee: vrai === 'interessee',
        admin: vrai === 'admin',
      })
      expect(attributions.get(ids.membreA1)).toEqual(
        [lien(ids.a1, 'affectee'), lien(ids.a2, 'interessee')].sort((x, y) =>
          x.activiteId.localeCompare(y.activiteId)
        )
      )
      expect(attributions.get(ids.adminA1)).toEqual([lien(ids.a1, 'admin')])
      expect(attributions.get(ids.sansActivite)).toEqual([])
    } finally {
      await prisma.souhait.delete({ where: { id: souhait.id } })
    }
  })

  it('sert les listes de l’écran « Personnes » sous la limite de complexité', async () => {
    // Les sélections de l'espace organisateur, `__typename` compris : Apollo Client
    // l'ajoute à chaque objet, et il compte dans la complexité.
    const LIGNE = `__typename id nom email estAdmin activitesAdministrees archive
      affectations(editionId: $e) { __typename id perimetre { __typename id nom couleur } }
      souhaits(editionId: $e) { __typename id satisfait perimetre { __typename id nom couleur } }`
    const annuaire = await executer(
      ids.adminOrg,
      `query ($e: ID) { personnes(inclureArchives: true) { ${LIGNE}
        attributions { __typename activiteId affectee interessee admin } } }`,
      { e: ids.edition1 }
    )
    expect(annuaire.errors).toBeUndefined()
    const equipe = await executer(
      ids.adminA1,
      `query ($e: ID) { equipe { ${LIGNE} } }`,
      { e: ids.edition1 }
    )
    expect(equipe.errors).toBeUndefined()
  })

  it('n’agit pas sur une personne hors de son équipe, comme sur un compte inconnu', async () => {
    const avant = await liens()
    for (const [query, variables] of [
      [AFFECTER, { p: ids.perimetre1, e: ids.edition1 }],
      [
        'mutation ($u: ID!, $e: ID!, $p: [ID!]!) { definirSouhaits(personneId: $u, editionId: $e, perimetreIds: $p) { id } }',
        { e: ids.edition1, p: [ids.perimetre1] },
      ],
      [
        'mutation ($u: ID!, $p: ID) { accorderDroitRedaction(personneId: $u, perimetreId: $p) { id } }',
        { p: ids.perimetre1 },
      ],
      ['mutation ($u: ID!) { renvoyerInvitation(id: $u) }', {}],
    ] as const) {
      const horsEquipe = await executer(ids.adminA1, query, {
        ...variables,
        u: ids.membreA2,
      })
      const inconnu = await executer(ids.adminA1, query, {
        ...variables,
        u: randomUUID(),
      })
      expect(code(horsEquipe), query).toBe('FORBIDDEN')
      expect(horsEquipe.errors?.[0]?.message, query).toBe(
        inconnu.errors?.[0]?.message
      )
    }
    expect(await liens()).toEqual(avant)
  })

  it('laisse l’admin de l’organisation, et l’admin des deux activités, affecter d’une activité à l’autre', async () => {
    const variables = { u: ids.membreA2, p: ids.perimetre1, e: ids.edition1 }
    const parOrganisation = await executer(ids.adminOrg, AFFECTER, variables)
    expect(parOrganisation.errors).toBeUndefined()
    await prisma.affectation.deleteMany({
      where: { userId: ids.membreA2, perimetreId: ids.perimetre1 },
    })
    // Un admin des deux activités lit déjà la personne dans l'équipe de A2.
    const admin = await prisma.adminActivite.create({
      data: {
        userId: ids.adminA1,
        activiteId: ids.a2,
        organisationId: ids.org,
      },
    })
    try {
      const r = await executer(ids.adminA1, AFFECTER, variables)
      expect(r.errors).toBeUndefined()
    } finally {
      await prisma.adminActivite.delete({ where: { id: admin.id } })
      await prisma.affectation.deleteMany({
        where: { userId: ids.membreA2, perimetreId: ids.perimetre1 },
      })
    }
  })

  it('ne lit pas l’adresse des personnes d’une activité où il est simple référent', async () => {
    const affectation = await prisma.affectation.create({
      data: {
        userId: ids.adminA1,
        perimetreId: ids.perimetre2,
        editionId: ids.edition2,
      },
    })
    try {
      const ailleurs = { a: ids.a2, e: ids.edition2 }
      const noms = await executer(ids.adminA1, REFERENTS, ailleurs)
      expect(noms.errors).toBeUndefined()
      expect(code(await executer(ids.adminA1, ADRESSES, ailleurs))).toBe(
        'FORBIDDEN'
      )
      // Dans son activité, il lit l'adresse de son équipe.
      const ici = await executer(ids.adminA1, ADRESSES, {
        a: ids.a1,
        e: ids.edition1,
      })
      expect(ici.errors).toBeUndefined()
    } finally {
      await prisma.affectation.delete({ where: { id: affectation.id } })
    }
  })

  it('ne lit pas les affectations d’une activité qu’il n’administre pas', async () => {
    const ailleurs = await prisma.affectation.create({
      data: {
        userId: ids.membreA1,
        perimetreId: ids.perimetre2,
        editionId: ids.edition2,
      },
    })
    try {
      const r = await executer(
        ids.adminA1,
        'query ($a: ID) { equipe(activiteId: $a) { id affectations { perimetre { id } } } }',
        { a: ids.a1 }
      )
      const membre = (
        r.data?.equipe as {
          id: string
          affectations: { perimetre: { id: string } }[]
        }[]
      ).find(p => p.id === ids.membreA1)
      expect(membre?.affectations).toEqual([
        { perimetre: { id: ids.perimetre1 } },
      ])
    } finally {
      await prisma.affectation.delete({ where: { id: ailleurs.id } })
    }
  })

  it('ne lit pas le rôle d’organisation des personnes de son équipe', async () => {
    const r = await executer(
      ids.adminA1,
      'query ($a: ID) { equipe(activiteId: $a) { id estAdmin } }',
      { a: ids.a1 }
    )
    const personnes = r.data?.equipe as {
      id: string
      estAdmin: boolean | null
    }[]
    expect(personnes.find(p => p.id === ids.membreA1)?.estAdmin).toBeNull()
    expect(personnes.find(p => p.id === ids.adminA1)?.estAdmin).toBe(false)
  })

  it('n’apprend « déjà membre » que pour une personne de son équipe', async () => {
    await prisma.demande.createMany({
      data: ['membre-a1', 'membre-a2'].map(cle => ({
        organisationId: ids.org,
        activiteId: ids.a1,
        editionId: ids.edition1,
        origine: 'FORMULAIRE' as const,
        nom: cle,
        adresse: `${cle}-${s}@exemple.fr`,
      })),
    })
    const lire = async (userId: string) =>
      Object.fromEntries(
        (
          (
            await executer(
              userId,
              'query ($e: ID!) { demandes(editionId: $e) { nom dejaMembre } }',
              { e: ids.edition1 }
            )
          ).data?.demandes as { nom: string; dejaMembre: boolean }[]
        ).map(d => [d.nom, d.dejaMembre])
      )
    try {
      expect(await lire(ids.adminA1)).toEqual({
        'membre-a1': true,
        'membre-a2': false,
      })
      expect(await lire(ids.adminOrg)).toEqual({
        'membre-a1': true,
        'membre-a2': true,
      })
    } finally {
      await prisma.demande.deleteMany({ where: { organisationId: ids.org } })
    }
  })

  it('refuse de gérer une autre activité', async () => {
    expect(
      code(
        await executer(ids.adminA1, CREER_PERIMETRE, {
          a: ids.a2,
          s: `intrus-${s}`,
        })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(ids.adminA1, AFFECTER, {
          u: ids.membreA1,
          p: ids.perimetre2,
          e: ids.edition2,
        })
      )
    ).toBe('FORBIDDEN')
  })

  it('laisse à l’admin de l’organisation les opérations de l’organisation', async () => {
    for (const [query, variables] of [
      [
        'mutation { creerActivite(slug: "intruse", nom: "X", nature: SAISON) { id } }',
        {},
      ],
      [
        'mutation ($a: ID!) { archiverActivite(id: $a, archive: true) { id } }',
        { a: ids.a1 },
      ],
      [
        'mutation ($a: ID!) { modifierActivite(id: $a, nom: "X", nature: EVENEMENT, groupes: [{ cle: "sport", libelle: "Sport", libellePluriel: "Sports" }], ordre: 0, archive: true) { id } }',
        { a: ids.a1 },
      ],
      [DEFINIR_ADMIN, { u: ids.membreA1, a: ids.a1, x: true }],
      [
        'mutation { inviterPersonne(email: "admin-intrus@exemple.fr", nom: "X", estAdmin: true) { id } }',
        {},
      ],
      ['query { identiteOrganisation { nom } }', {}],
      ['query { exportContenu { nomFichier } }', {}],
      [
        'mutation ($u: ID!) { archiverPersonne(id: $u, archive: true) { id } }',
        { u: ids.membreA1 },
      ],
      [
        'mutation ($u: ID!) { accorderDroitRedaction(personneId: $u) { id } }',
        { u: ids.membreA1 },
      ],
    ] as const) {
      const r = await executer(ids.adminA1, query, variables)
      expect(code(r), query).toBe('FORBIDDEN')
    }
    expect(
      await prisma.adminActivite.count({ where: { userId: ids.membreA1 } })
    ).toBe(0)
    expect(
      await prisma.activite.count({ where: { organisationId: ids.org } })
    ).toBe(2)
  })

  it('refuse à une référente les opérations de gestion de sa propre activité', async () => {
    const r = await executer(ids.membreA1, AFFECTER, {
      u: ids.membreA1,
      p: ids.perimetre1,
      e: ids.edition1,
    })
    expect(code(r)).toBe('FORBIDDEN')
  })
})

describe('équipe d’une activité (ADR 0018)', () => {
  const adresse = (cle: string) => `${cle}-${s}@exemple.fr`
  const equipe = async (userId: string, a: string) =>
    ((await executer(userId, EQUIPE, { a })).data?.equipe as { id: string }[])
      .map(p => p.id)
      .sort()
  const comptes = () =>
    Promise.all([
      prisma.user.count({ where: { email: { endsWith: `-${s}@exemple.fr` } } }),
      prisma.appartenance.count({ where: { organisationId: ids.org } }),
      prisma.souhait.count({
        where: { perimetre: { organisationId: ids.org } },
      }),
    ])

  it('réunit les personnes affectées, intéressées et admins, sans les comptes archivés', async () => {
    const interessee = await creerCompte('interessee', 'MEMBRE')
    const archivee = await creerCompte('archivee', 'MEMBRE')
    await prisma.user.update({
      where: { id: archivee },
      data: { archivedAt: new Date() },
    })
    await prisma.souhait.createMany({
      data: [interessee, archivee].map(userId => ({
        userId,
        perimetreId: ids.perimetre1,
        editionId: ids.edition1,
      })),
    })
    const attendue = [ids.adminA1, ids.membreA1, interessee].sort()
    expect(await equipe(ids.adminA1, ids.a1)).toEqual(attendue)
    // L'admin de l'organisation lit la même équipe : il n'en fait pas partie sans lien.
    expect(await equipe(ids.adminOrg, ids.a1)).toEqual(attendue)
    expect(await equipe(ids.adminOrg, ids.a2)).toEqual([ids.membreA2])
    await prisma.souhait.deleteMany({
      where: { userId: { in: [interessee, archivee] } },
    })
  })

  it('refuse l’équipe à qui n’administre pas l’activité', async () => {
    for (const [userId, a] of [
      [ids.membreA1, ids.a1],
      [ids.adminA1, ids.a2],
      [ids.membreA2, ids.a1],
      [ids.sansActivite, ids.a1],
    ] as const) {
      expect(code(await executer(userId, EQUIPE, { a }))).toBe('FORBIDDEN')
    }
    const anonyme = await apollo.executeOperation(
      { query: EQUIPE, variables: { a: ids.a1 } },
      { contextValue: await buildContext('127.0.0.1', null, slug) }
    )
    if (anonyme.body.kind !== 'single') throw new Error('Réponse inattendue.')
    expect(anonyme.body.singleResult.errors?.[0]?.extensions?.code).toBe(
      'FORBIDDEN'
    )
  })

  it('refuse à un admin d’activité une invitation sans périmètre, quelle que soit l’adresse', async () => {
    const avant = await comptes()
    const inconnue = await executer(ids.adminA1, INVITER, {
      email: adresse('inconnue'),
    })
    const membre = await executer(ids.adminA1, INVITER, {
      email: adresse('membre-a2'),
    })
    expect(code(inconnue)).toBe('SAISIE_INVALIDE')
    expect(membre.errors?.[0]?.message).toBe(inconnue.errors?.[0]?.message)
    expect(await comptes()).toEqual(avant)
  })

  it('rattache à l’équipe un membre d’une autre activité invité par son adresse', async () => {
    const [utilisateurs, appartenances, souhaits] = await comptes()
    const variables = {
      email: adresse('membre-a2'),
      e: ids.edition1,
      p: [ids.perimetre1],
    }
    const r = await executer(ids.adminA1, INVITER, variables)
    expect(r.errors).toBeUndefined()
    expect(r.data?.inviterPersonne).toEqual({ id: ids.membreA2 })
    expect(await comptes()).toEqual([utilisateurs, appartenances, souhaits + 1])
    expect(await equipe(ids.adminA1, ids.a1)).toContain(ids.membreA2)
    // Une seconde invitation ne change rien et répond de la même façon.
    const encore = await executer(ids.adminA1, INVITER, variables)
    expect(encore.data?.inviterPersonne).toEqual({ id: ids.membreA2 })
    expect(await comptes()).toEqual([utilisateurs, appartenances, souhaits + 1])
    await prisma.souhait.deleteMany({ where: { userId: ids.membreA2 } })
  })

  it('rattache le compte d’une autre organisation, et refuse un compte archivé sans rien écrire', async () => {
    const externe = randomUUID()
    const archive = randomUUID()
    await prisma.user.createMany({
      data: [
        { id: externe, email: adresse('externe-equipe'), name: 'Externe' },
        {
          id: archive,
          email: adresse('archive-equipe'),
          name: 'Archivé',
          archivedAt: new Date(),
        },
      ],
    })
    const souhait = { e: ids.edition1, p: [ids.perimetre1] }
    const r = await executer(ids.adminA1, INVITER, {
      email: adresse('externe-equipe'),
      ...souhait,
    })
    expect(r.data?.inviterPersonne).toEqual({ id: externe })
    expect(await equipe(ids.adminA1, ids.a1)).toContain(externe)

    const avant = await comptes()
    const refus = await executer(ids.adminA1, INVITER, {
      email: adresse('archive-equipe'),
      ...souhait,
    })
    expect(code(refus)).toBe('SAISIE_INVALIDE')
    expect(await comptes()).toEqual(avant)
    await prisma.souhait.deleteMany({ where: { userId: externe } })
  })

  it('garde à l’admin de l’organisation le refus d’inviter un membre sans périmètre', async () => {
    const r = await executer(ids.adminOrg, INVITER, {
      email: adresse('membre-a2'),
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toBe(
      'Un compte existe déjà pour cette adresse.'
    )
  })
})

describe('nomination d’un admin d’activité', () => {
  it('donne puis retire les droits de gestion d’une activité', async () => {
    const nomme = await executer(ids.adminOrg, DEFINIR_ADMIN, {
      u: ids.membreA2,
      a: ids.a2,
      x: true,
    })
    expect(nomme.data?.definirAdminActivite).toBe(true)
    const gestion = await executer(ids.membreA2, CREER_PERIMETRE, {
      a: ids.a2,
      s: `gere-${s}`,
    })
    expect(gestion.errors).toBeUndefined()

    await executer(ids.adminOrg, DEFINIR_ADMIN, {
      u: ids.membreA2,
      a: ids.a2,
      x: false,
    })
    const refus = await executer(ids.membreA2, CREER_PERIMETRE, {
      a: ids.a2,
      s: `refuse-${s}`,
    })
    expect(code(refus)).toBe('FORBIDDEN')
  })

  it('refuse de nommer une personne d’une autre organisation', async () => {
    const autre = randomUUID()
    await prisma.user.create({
      data: { id: autre, email: `externe-${s}@exemple.fr`, name: 'Externe' },
    })
    const r = await executer(ids.adminOrg, DEFINIR_ADMIN, {
      u: autre,
      a: ids.a1,
      x: true,
    })
    expect(code(r)).toBeOneOf(['FORBIDDEN', 'SAISIE_INVALIDE'])
    expect(await prisma.adminActivite.count({ where: { userId: autre } })).toBe(
      0
    )
  })
})
