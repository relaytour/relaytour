import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Isolation entre organisations et entre activités (ADR 0008).
// Un contrôle d'accès se prouve par le refus (invariant 11), y compris avec la
// session d'une autre organisation. Ce fichier crée deux organisations complètes et
// ne touche pas à l'organisation par défaut de la base de développement.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })

const ids = {
  orgA: '',
  orgB: '',
  activiteA1: '',
  activiteA2: '',
  activiteB: '',
  editionA1: '',
  editionA2: '',
  editionB: '',
  perimetreA1: '',
  perimetreA2: '',
  perimetreB: '',
  ficheA: '',
  ficheCommuneA: '',
  tacheA: '',
  adminA: '',
  referenteA: '',
  adminB: '',
  double: '',
}
const slugA = `orga-a-${s}`
const slugB = `orga-b-${s}`

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {},
  organisation: string | null = null,
  activite: string | null = null
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    {
      contextValue: await buildContext(
        '127.0.0.1',
        userId,
        organisation,
        false,
        activite
      ),
    }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

async function creerOrganisation(slug: string) {
  return (
    await prisma.organisation.create({
      data: { slug, nom: `Organisation ${slug}`, configuration: {} },
    })
  ).id
}

async function creerActivite(organisationId: string, slug: string) {
  return (
    await prisma.activite.create({
      data: {
        organisationId,
        slug,
        nom: `Activité ${slug}`,
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
      },
    })
  ).id
}

async function creerEdition(
  organisationId: string,
  activiteId: string,
  annee: number
) {
  return (
    await prisma.edition.create({
      data: {
        organisationId,
        activiteId,
        annee,
        nom: `Période ${annee}`,
        debut: new Date('2027-06-01'),
        fin: new Date('2027-06-02'),
      },
    })
  ).id
}

async function creerPerimetre(
  organisationId: string,
  activiteId: string,
  slug: string
) {
  return (
    await prisma.perimetre.create({
      data: {
        organisationId,
        activiteId,
        slug,
        nom: `Périmètre ${slug}`,
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
}

async function creerCompte(
  cle: string,
  appartenances: { organisationId: string; role: 'ADMIN' | 'MEMBRE' }[]
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: `${cle}-${s}@exemple.fr`,
      name: `${cle} ${s}`,
      appartenances: { create: appartenances },
    },
  })
  return id
}

beforeAll(async () => {
  await apollo.start()
  ids.orgA = await creerOrganisation(slugA)
  ids.orgB = await creerOrganisation(slugB)
  ids.activiteA1 = await creerActivite(ids.orgA, `a1-${s}`)
  ids.activiteA2 = await creerActivite(ids.orgA, `a2-${s}`)
  ids.activiteB = await creerActivite(ids.orgB, `b-${s}`)
  ids.editionA1 = await creerEdition(ids.orgA, ids.activiteA1, 2027)
  ids.editionA2 = await creerEdition(ids.orgA, ids.activiteA2, 2027)
  ids.editionB = await creerEdition(ids.orgB, ids.activiteB, 2027)
  ids.perimetreA1 = await creerPerimetre(ids.orgA, ids.activiteA1, 'natation')
  ids.perimetreA2 = await creerPerimetre(ids.orgA, ids.activiteA2, 'natation')
  ids.perimetreB = await creerPerimetre(ids.orgB, ids.activiteB, 'natation')
  ids.ficheA = (
    await prisma.fiche.create({
      data: {
        organisationId: ids.orgA,
        activiteId: ids.activiteA1,
        slug: `fiche-${s}`,
        perimetreId: ids.perimetreA1,
      },
    })
  ).id
  ids.ficheCommuneA = (
    await prisma.fiche.create({
      data: {
        organisationId: ids.orgA,
        activiteId: ids.activiteA1,
        slug: `commune-${s}`,
      },
    })
  ).id
  ids.tacheA = (
    await prisma.tache.create({
      data: {
        editionId: ids.editionA1,
        perimetreId: ids.perimetreA1,
        titre: `Réserver la piscine ${s}`,
      },
    })
  ).id
  ids.adminA = await creerCompte('admin-a', [
    { organisationId: ids.orgA, role: 'ADMIN' },
  ])
  ids.referenteA = await creerCompte('referente-a', [
    { organisationId: ids.orgA, role: 'MEMBRE' },
  ])
  ids.adminB = await creerCompte('admin-b', [
    { organisationId: ids.orgB, role: 'ADMIN' },
  ])
  ids.double = await creerCompte('double', [
    { organisationId: ids.orgA, role: 'MEMBRE' },
    { organisationId: ids.orgB, role: 'ADMIN' },
  ])
  await prisma.affectation.create({
    data: {
      userId: ids.referenteA,
      perimetreId: ids.perimetreA1,
      editionId: ids.editionA1,
    },
  })
})

afterAll(async () => {
  const organisations = [ids.orgA, ids.orgB]
  await prisma.journal.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.notification.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.droitRedaction.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.fiche.updateMany({
    where: { organisationId: { in: organisations } },
    data: { versionCouranteId: null },
  })
  await prisma.fiche.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.edition.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.perimetre.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.activite.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.preferenceNotification.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: organisations } } })
  invaliderConfigurationOrganisation()
  await apollo.stop()
})

const RETROPLANNING = 'query ($e: ID!) { retroplanning(editionId: $e) { id } }'
const CREER_TACHE = `mutation ($p: ID!, $e: ID!) {
  creerTache(perimetreId: $p, editionId: $e, titre: "Essai") { id }
}`

describe('refus entre organisations', () => {
  it('refuse la lecture d’une édition d’une autre organisation', async () => {
    const r = await executer(ids.adminB, RETROPLANNING, { e: ids.editionA1 })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse les activités d’une autre organisation', async () => {
    const r = await executer(
      ids.adminB,
      'query ($a: ID) { editions(activiteId: $a) { id } }',
      { a: ids.activiteA1 }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('ne liste que les activités de l’organisation active', async () => {
    const r = await executer(ids.adminB, '{ activites { id } }')
    expect(r.data?.activites).toEqual([{ id: ids.activiteB }])
  })

  it('refuse la création d’une tâche dans une autre organisation', async () => {
    const r = await executer(ids.adminB, CREER_TACHE, {
      p: ids.perimetreA1,
      e: ids.editionA1,
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(await prisma.tache.count({ where: { titre: 'Essai' } })).toBe(0)
  })

  it('refuse le changement de statut d’une tâche d’une autre organisation', async () => {
    const r = await executer(
      ids.adminB,
      'mutation ($id: ID!) { changerStatutTache(id: $id, statut: FAITE) { id } }',
      { id: ids.tacheA }
    )
    expect(code(r)).toBe('FORBIDDEN')
    const tache = await prisma.tache.findUniqueOrThrow({
      where: { id: ids.tacheA },
    })
    expect(tache.statut).toBe('A_FAIRE')
  })

  it('ne trouve pas la fiche commune d’une autre organisation', async () => {
    const r = await executer(
      ids.adminB,
      'query ($s: String!) { fiche(slug: $s) { id } }',
      { s: `commune-${s}` }
    )
    expect(r.errors).toBeUndefined()
    expect(r.data?.fiche).toBeNull()
  })

  it('refuse la modification d’une fiche d’une autre organisation', async () => {
    const r = await executer(
      ids.adminB,
      'mutation ($id: ID!) { modifierFiche(id: $id, titre: "X", contenu: "Y") { id } }',
      { id: ids.ficheCommuneA }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse l’affectation d’une personne d’une autre organisation', async () => {
    const r = await executer(
      ids.adminB,
      'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }',
      { u: ids.referenteA, p: ids.perimetreB, e: ids.editionB }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('ne liste pas les membres d’une autre organisation', async () => {
    const r = await executer(ids.adminB, '{ personnes { id } }')
    const personnes = (r.data?.personnes as { id: string }[]).map(p => p.id)
    expect(personnes).toContain(ids.adminB)
    expect(personnes).toContain(ids.double)
    expect(personnes).not.toContain(ids.referenteA)
    expect(personnes).not.toContain(ids.adminA)
  })

  it('refuse l’archivage d’un compte d’une autre organisation', async () => {
    const r = await executer(
      ids.adminB,
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }',
      { id: ids.referenteA }
    )
    expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.appartenance.count({
        where: { userId: ids.referenteA, archiveLe: { not: null } },
      })
    ).toBe(0)
  })

  it('refuse un droit de rédaction pour une personne d’une autre organisation', async () => {
    const r = await executer(
      ids.adminB,
      'mutation ($u: ID!) { accorderDroitRedaction(personneId: $u) { id } }',
      { u: ids.referenteA }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('ne trouve rien d’une autre organisation par la recherche', async () => {
    const r = await executer(
      ids.adminB,
      'query ($t: String!) { recherche(texte: $t) { fiches { id } personnes { id } } }',
      { t: s }
    )
    expect(r.errors).toBeUndefined()
    const resultats = r.data?.recherche as {
      fiches: { id: string }[]
      personnes: { id: string }[]
    }
    expect(resultats.fiches).toEqual([])
    expect(resultats.personnes.map(p => p.id)).not.toContain(ids.referenteA)
  })
})

describe('refus entre activités d’une même organisation', () => {
  it('refuse une tâche qui mêle le périmètre d’une activité et l’édition d’une autre', async () => {
    const r = await executer(ids.adminA, CREER_TACHE, {
      p: ids.perimetreA1,
      e: ids.editionA2,
    })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('distingue deux périmètres de même slug dans deux activités', async () => {
    const r = await executer(
      ids.adminA,
      'query ($a: ID) { perimetre(slug: "natation", activiteId: $a) { id } }',
      { a: ids.activiteA2 }
    )
    expect(r.data?.perimetre).toEqual({ id: ids.perimetreA2 })
  })

  it('ne sert une fiche que dans son activité', async () => {
    const requete =
      'query ($s: String!, $a: ID) { fiche(slug: $s, activiteId: $a) { id } }'
    const ailleurs = await executer(ids.adminA, requete, {
      s: `fiche-${s}`,
      a: ids.activiteA2,
    })
    expect(ailleurs.data?.fiche).toBeNull()
    const chezElle = await executer(ids.adminA, requete, {
      s: `fiche-${s}`,
      a: ids.activiteA1,
    })
    expect(chezElle.data?.fiche).toEqual({ id: ids.ficheA })
  })

  it('annule toute la modification quand l’archivage est refusé', async () => {
    const r = await executer(
      ids.adminB,
      'mutation ($id: ID!) { modifierActivite(id: $id, nom: "Renommée", nature: EVENEMENT, groupes: [{ cle: "sport", libelle: "Sport", libellePluriel: "Sports" }], ordre: 0, archive: true) { id } }',
      { id: ids.activiteB }
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
    const activite = await prisma.activite.findUniqueOrThrow({
      where: { id: ids.activiteB },
      select: { nom: true, archivedAt: true },
    })
    expect(activite.nom).not.toBe('Renommée')
    expect(activite.archivedAt).toBeNull()
  })
})

describe('personne membre de deux organisations', () => {
  it('n’a aucune organisation active sans en-tête', async () => {
    const r = await executer(ids.double, RETROPLANNING, { e: ids.editionA1 })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('lit l’organisation désignée par l’en-tête, avec son rôle', async () => {
    const r = await executer(ids.double, '{ moi { estAdmin } }', {}, slugB)
    expect(r.data?.moi).toEqual({ estAdmin: true })
    const rA = await executer(ids.double, '{ moi { estAdmin } }', {}, slugA)
    expect(rA.data?.moi).toEqual({ estAdmin: false })
  })

  it('refuse une organisation dont elle n’est pas membre', async () => {
    const r = await executer(
      ids.adminB,
      RETROPLANNING,
      { e: ids.editionB },
      slugA
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  // L'archivage porte sur l'appartenance (ADR 0031) : une organisation ne produit
  // aucun effet dans une autre.
  const ARCHIVER =
    'mutation ($id: ID!, $a: Boolean!) { archiverPersonne(id: $id, archive: $a) { id archive } }'
  const MES_ORGANISATIONS = '{ mesOrganisations { slug } }'
  const compteDerive = async () =>
    (
      await prisma.user.findUniqueOrThrow({
        where: { id: ids.double },
        select: { sansAppartenanceActiveLe: true },
      })
    ).sansAppartenanceActiveLe

  it('archive la personne dans une organisation sans rien changer dans l’autre', async () => {
    const r = await executer(ids.adminB, ARCHIVER, { id: ids.double, a: true })
    expect(r.errors).toBeUndefined()
    expect(r.data?.archiverPersonne).toEqual({ id: ids.double, archive: true })
    // Elle perd B à la requête suivante, et garde A.
    expect(
      code(await executer(ids.double, '{ moi { estAdmin } }', {}, slugB))
    ).toBeUndefined()
    expect(
      code(await executer(ids.double, '{ activites { id } }', {}, slugB))
    ).toBe('FORBIDDEN')
    const chezA = await executer(ids.double, MES_ORGANISATIONS, {}, slugA)
    expect(chezA.data).toEqual({ mesOrganisations: [{ slug: slugA }] })
    expect(
      (await executer(ids.double, '{ activites { id } }', {}, slugA)).errors
    ).toBeUndefined()
    // B ne lui renvoie plus d'invitation ; A le peut encore.
    const RENVOYER = `mutation ($id: ID!) { renvoyerInvitation(id: $id) }`
    const refus = await executer(ids.adminB, RENVOYER, { id: ids.double })
    expect(refus.errors?.[0]?.message).toBe(
      'Cette personne est archivée dans votre organisation.'
    )
    expect(
      (await executer(ids.adminA, RENVOYER, { id: ids.double }, slugA)).errors
    ).toBeUndefined()
    // L'admin de A ne lit pas cet archivage : il n'est pas le sien.
    const vueDeA = await executer(
      ids.adminA,
      '{ personnes(inclureArchives: true) { id archive } }',
      {},
      slugA
    )
    expect(
      (vueDeA.data as { personnes: { id: string; archive: boolean }[] })
        .personnes
    ).toContainEqual({ id: ids.double, archive: false })
    // Le compte garde une appartenance active : la valeur dérivée reste vide.
    expect(await compteDerive()).toBeNull()
  })

  it('tient la valeur dérivée du compte quand il n’a plus aucune appartenance active', async () => {
    // Archivée aussi dans A, la personne n'a plus aucune organisation.
    await executer(ids.adminA, ARCHIVER, { id: ids.double, a: true }, slugA)
    expect(await compteDerive()).not.toBeNull()
    const sans = await executer(ids.double, MES_ORGANISATIONS, {}, slugA)
    expect(sans.data).toEqual({ mesOrganisations: [] })
    // Rétablie dans A puis dans B, elle retrouve les deux.
    await executer(ids.adminA, ARCHIVER, { id: ids.double, a: false }, slugA)
    expect(await compteDerive()).toBeNull()
    const retabli = await executer(ids.adminB, ARCHIVER, {
      id: ids.double,
      a: false,
    })
    expect(retabli.data?.archiverPersonne).toEqual({
      id: ids.double,
      archive: false,
    })
    expect(
      (await executer(ids.double, '{ activites { id } }', {}, slugB)).errors
    ).toBeUndefined()
  })

  it('refuse l’archivage d’une personne par l’admin d’une organisation dont elle n’est pas membre', async () => {
    const r = await executer(ids.adminB, ARCHIVER, {
      id: ids.referenteA,
      a: true,
    })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('refuse d’affecter, de nommer ou d’accorder un droit à une personne archivée', async () => {
    // Dans A, la personne est simple membre : sa promotion se refuse aussi.
    await executer(ids.adminA, ARCHIVER, { id: ids.double, a: true }, slugA)
    const message =
      'Cette personne est archivée dans votre organisation : un admin de l’organisation la rétablit depuis l’annuaire.'
    const essais = [
      [
        `mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }`,
        { u: ids.double, p: ids.perimetreA2, e: ids.editionA2 },
      ],
      [
        `mutation ($u: ID!, $a: ID!) { definirAdminActivite(personneId: $u, activiteId: $a, admin: true) }`,
        { u: ids.double, a: ids.activiteA2 },
      ],
      [
        `mutation ($u: ID!, $p: ID) { accorderDroitRedaction(personneId: $u, perimetreId: $p) { id } }`,
        { u: ids.double, p: ids.perimetreA2 },
      ],
      [
        `mutation ($u: ID!, $n: String!) { modifierPersonne(id: $u, nom: $n, estAdmin: true) { id } }`,
        { u: ids.double, n: `double ${s}` },
      ],
    ] as const
    try {
      for (const [mutation, variables] of essais) {
        const r = await executer(ids.adminA, mutation, variables, slugA)
        expect(r.errors?.[0]?.message, mutation).toBe(message)
      }
      // Rien ne s'est écrit dans A.
      expect(
        await prisma.affectation.count({
          where: { userId: ids.double, perimetreId: ids.perimetreA2 },
        })
      ).toBe(0)
      expect(
        await prisma.adminActivite.count({
          where: { userId: ids.double, activiteId: ids.activiteA2 },
        })
      ).toBe(0)
      expect(
        await prisma.droitRedaction.count({ where: { userId: ids.double } })
      ).toBe(0)
      expect(
        (
          await prisma.appartenance.findUniqueOrThrow({
            where: {
              userId_organisationId: {
                userId: ids.double,
                organisationId: ids.orgA,
              },
            },
          })
        ).role
      ).toBe('MEMBRE')
    } finally {
      await executer(ids.adminA, ARCHIVER, { id: ids.double, a: false }, slugA)
    }
  })

  it('tient la valeur dérivée quand deux organisations archivent en même temps', async () => {
    // Le verrou du compte fait compter les deux transactions l'une après l'autre.
    const [a, b] = await Promise.all([
      executer(ids.adminA, ARCHIVER, { id: ids.double, a: true }, slugA),
      executer(ids.adminB, ARCHIVER, { id: ids.double, a: true }),
    ])
    expect(a.errors).toBeUndefined()
    expect(b.errors).toBeUndefined()
    expect(await compteDerive()).not.toBeNull()
    await Promise.all([
      executer(ids.adminA, ARCHIVER, { id: ids.double, a: false }, slugA),
      executer(ids.adminB, ARCHIVER, { id: ids.double, a: false }),
    ])
    expect(await compteDerive()).toBeNull()
  })

  // Le nom appartient à la personne (ADR 0031).
  const RENOMMER =
    'mutation ($id: ID!, $nom: String!) { modifierPersonne(id: $id, nom: $nom, estAdmin: true) { id nom } }'

  it('laisse un admin corriger le nom tant que la personne ne s’est jamais connectée', async () => {
    const avant = (
      await prisma.user.findUniqueOrThrow({ where: { id: ids.double } })
    ).name
    const r = await executer(ids.adminB, RENOMMER, {
      id: ids.double,
      nom: 'Nom corrigé',
    })
    expect(r.data?.modifierPersonne).toEqual({
      id: ids.double,
      nom: 'Nom corrigé',
    })
    await prisma.user.update({
      where: { id: ids.double },
      data: { name: avant },
    })
  })

  it('refuse à un admin le nom d’une personne déjà connectée, sans rien dire de ses autres organisations', async () => {
    await prisma.user.update({
      where: { id: ids.double },
      data: { emailVerified: true },
    })
    const r = await executer(ids.adminB, RENOMMER, {
      id: ids.double,
      nom: 'Autre',
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).not.toContain('autre organisation')
    // Le refus est le même pour une personne qui n'a que cette organisation.
    await prisma.user.update({
      where: { id: ids.adminA },
      data: { emailVerified: true },
    })
    const seule = await executer(
      ids.adminA,
      'mutation ($id: ID!) { modifierPersonne(id: $id, nom: "Autre", estAdmin: true) { id } }',
      { id: ids.adminA },
      slugA
    )
    expect(seule.errors?.[0]?.message).toBe(r.errors?.[0]?.message)
    // Le rôle, lui, se modifie toujours sans toucher au nom.
    const memeNom = (
      await prisma.user.findUniqueOrThrow({ where: { id: ids.double } })
    ).name
    const role = await executer(ids.adminB, RENOMMER, {
      id: ids.double,
      nom: memeNom,
    })
    expect(role.errors).toBeUndefined()
  })

  it('laisse la personne modifier son nom, lu ensuite dans ses deux organisations', async () => {
    const r = await executer(
      ids.double,
      'mutation { modifierMonNom(nom: "  Camille Renommée ") { id nom } }',
      {},
      slugA
    )
    expect(r.data?.modifierMonNom).toEqual({
      id: ids.double,
      nom: 'Camille Renommée',
    })
    for (const [admin, slug] of [
      [ids.adminA, slugA],
      [ids.adminB, slugB],
    ] as const) {
      const lu = await executer(admin, '{ personnes { id nom } }', {}, slug)
      expect(
        (lu.data as { personnes: { id: string; nom: string }[] }).personnes
      ).toContainEqual({ id: ids.double, nom: 'Camille Renommée' })
    }
    // Sans session, rien ne se modifie.
    const anonyme = await executer(
      null,
      'mutation { modifierMonNom(nom: "X") { id } }'
    )
    expect(code(anonyme)).toBe('FORBIDDEN')
  })

  it('laisse la personne choisir sa langue, lue par elle seule (ADR 0047)', async () => {
    const LANGUE =
      'mutation ($l: String) { modifierMaLangue(langue: $l) { id langue } }'
    const choix = await executer(ids.double, LANGUE, { l: 'en' }, slugA)
    expect(choix.data?.modifierMaLangue).toEqual({
      id: ids.double,
      langue: 'en',
    })
    // Le choix vaut dans ses deux organisations.
    const lu = await executer(ids.double, '{ moi { langue } }', {}, slugB)
    expect(lu.data).toEqual({ moi: { langue: 'en' } })
    // Un admin ne lit pas la langue d'un membre.
    const parAdmin = await executer(
      ids.adminA,
      '{ personnes { id langue } }',
      {},
      slugA
    )
    expect(
      (parAdmin.data as { personnes: { id: string; langue: string | null }[] })
        .personnes
    ).toContainEqual({ id: ids.double, langue: null })
    // Une langue absente du logiciel est refusée, et rien ne change.
    const inconnue = await executer(ids.double, LANGUE, { l: 'de' }, slugA)
    expect(code(inconnue)).toBe('SAISIE_INVALIDE')
    // Nulle, la langue suit de nouveau celle de l'organisation.
    const efface = await executer(ids.double, LANGUE, { l: null }, slugA)
    expect(efface.data?.modifierMaLangue).toEqual({
      id: ids.double,
      langue: null,
    })
    const anonyme = await executer(null, LANGUE, { l: 'en' })
    expect(code(anonyme)).toBe('FORBIDDEN')
  })
})

describe('statut de l’organisation', () => {
  it('laisse lire et refuse d’écrire en lecture seule', async () => {
    await prisma.organisation.update({
      where: { id: ids.orgA },
      data: { statut: 'LECTURE_SEULE' },
    })
    try {
      const lecture = await executer(ids.adminA, RETROPLANNING, {
        e: ids.editionA1,
      })
      expect(lecture.errors).toBeUndefined()
      const ecriture = await executer(ids.adminA, CREER_TACHE, {
        p: ids.perimetreA1,
        e: ids.editionA1,
      })
      expect(code(ecriture)).toBe('LECTURE_SEULE')
      // Lire une notification ne modifie aucune donnée de l'organisation : la
      // marquer comme lue reste possible. Un réglage reste une écriture.
      const notification = await prisma.notification.create({
        data: {
          organisationId: ids.orgA,
          userId: ids.adminA,
          type: 'TACHE_CREEE',
        },
      })
      const lue = await executer(
        ids.adminA,
        'mutation ($ids: [ID!]) { marquerNotificationsLues(ids: $ids) }',
        { ids: [notification.id] }
      )
      expect(lue.data).toEqual({ marquerNotificationsLues: 1 })
      const reglage = await executer(
        ids.adminA,
        'mutation { modifierPreferencesNotification(frequenceResume: AUCUN, mailModification: true, mailEcheance: true) { frequenceResume } }'
      )
      expect(code(reglage)).toBe('LECTURE_SEULE')
      // Sans session, la mutation reste refusée.
      const sansSession = await executer(
        null,
        'mutation { marquerNotificationsLues }'
      )
      expect(code(sansSession)).toBe('FORBIDDEN')
    } finally {
      await prisma.notification.deleteMany({
        where: { organisationId: ids.orgA, userId: ids.adminA },
      })
      await prisma.organisation.update({
        where: { id: ids.orgA },
        data: { statut: 'ACTIVE' },
      })
    }
  })

  it('ne donne aucun contexte à une organisation suspendue', async () => {
    await prisma.organisation.update({
      where: { id: ids.orgA },
      data: { statut: 'SUSPENDUE' },
    })
    try {
      const r = await executer(ids.adminA, RETROPLANNING, { e: ids.editionA1 })
      expect(code(r)).toBe('FORBIDDEN')
    } finally {
      await prisma.organisation.update({
        where: { id: ids.orgA },
        data: { statut: 'ACTIVE' },
      })
    }
  })
})

describe('limites', () => {
  const CREER_ACTIVITE = `mutation ($slug: String!) {
    creerActivite(slug: $slug, nom: "Section", nature: SAISON) { id nature groupes { cle } }
  }`
  const CREER_EDITION = `mutation ($a: ID!, $annee: Int!) {
    creerEdition(activiteId: $a, annee: $annee, nom: "Saison", debut: "2028-09-01", fin: "2029-06-30") { id }
  }`

  it('refuse une activité au-delà de la limite, puis l’accepte après un archivage', async () => {
    await prisma.organisation.update({
      where: { id: ids.orgA },
      data: { limites: { activites: 2 } },
    })
    try {
      const refus = await executer(ids.adminA, CREER_ACTIVITE, {
        slug: `section-${s}`,
      })
      expect(code(refus)).toBe('LIMITE_ATTEINTE')
      await executer(
        ids.adminA,
        'mutation ($id: ID!) { archiverActivite(id: $id, archive: true) { id } }',
        { id: ids.activiteA2 }
      )
      const accord = await executer(ids.adminA, CREER_ACTIVITE, {
        slug: `section-${s}`,
      })
      expect(accord.errors).toBeUndefined()
      expect(accord.data?.creerActivite).toMatchObject({
        nature: 'SAISON',
        groupes: [{ cle: 'sport' }, { cle: 'pole' }],
      })
      // L'activité archivée reste lisible : ses périodes aussi.
      const lecture = await executer(
        ids.adminA,
        'query ($a: ID) { editions(activiteId: $a) { id } }',
        { a: ids.activiteA2 }
      )
      expect(lecture.data?.editions).toEqual([{ id: ids.editionA2 }])
    } finally {
      await prisma.organisation.update({
        where: { id: ids.orgA },
        data: { limites: {} },
      })
    }
  })

  it('refuse une période ouverte de plus, et ne bloque pas la lecture', async () => {
    const ouvertes = await prisma.edition.count({
      where: { organisationId: ids.orgA, statut: { not: 'ARCHIVEE' } },
    })
    await prisma.organisation.update({
      where: { id: ids.orgA },
      data: { limites: { periodesOuvertes: ouvertes } },
    })
    try {
      const refus = await executer(ids.adminA, CREER_EDITION, {
        a: ids.activiteA1,
        annee: 2028,
      })
      expect(code(refus)).toBe('LIMITE_ATTEINTE')
      expect(refus.errors?.[0]?.message).toMatch(/administrateur|admin/)
      const lecture = await executer(ids.adminA, RETROPLANNING, {
        e: ids.editionA1,
      })
      expect(lecture.errors).toBeUndefined()
    } finally {
      await prisma.organisation.update({
        where: { id: ids.orgA },
        data: { limites: {} },
      })
    }
  })

  it('n’applique aucune limite à une organisation sans limites', async () => {
    const r = await executer(ids.adminB, CREER_EDITION, {
      a: ids.activiteB,
      annee: 2028,
    })
    expect(r.errors).toBeUndefined()
  })
})

describe('espace organisateur : organisation et activité choisies', () => {
  it('liste les organisations d’une personne, sans organisation active sans en-tête', async () => {
    const r = await executer(
      ids.double,
      '{ mesOrganisations { slug estAdmin active } }'
    )
    expect(r.errors).toBeUndefined()
    expect(r.data?.mesOrganisations).toEqual(
      expect.arrayContaining([
        { slug: slugA, estAdmin: false, active: false },
        { slug: slugB, estAdmin: true, active: false },
      ])
    )
    const avecEntete = await executer(
      ids.double,
      '{ mesOrganisations { slug active } }',
      {},
      slugB
    )
    expect(avecEntete.data?.mesOrganisations).toEqual(
      expect.arrayContaining([{ slug: slugB, active: true }])
    )
  })

  it('refuse la liste des organisations sans session', async () => {
    const r = await executer(null, '{ mesOrganisations { slug } }')
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('suit l’activité de l’en-tête quand la requête n’en précise pas', async () => {
    const sansEntete = await executer(
      ids.adminA,
      '{ perimetre(slug: "natation") { id } }'
    )
    expect(sansEntete.data?.perimetre).toEqual({ id: ids.perimetreA1 })
    const avecEntete = await executer(
      ids.adminA,
      '{ perimetre(slug: "natation") { id } }',
      {},
      null,
      `a2-${s}`
    )
    expect(avecEntete.data?.perimetre).toEqual({ id: ids.perimetreA2 })
  })

  it('ignore une activité d’en-tête inconnue de l’organisation', async () => {
    const r = await executer(
      ids.adminA,
      '{ perimetre(slug: "natation") { id } }',
      {},
      null,
      `b-${s}`
    )
    expect(r.data?.perimetre).toEqual({ id: ids.perimetreA1 })
  })

  it('refuse un slug d’activité réservé par l’espace organisateur', async () => {
    const r = await executer(
      ids.adminA,
      'mutation { creerActivite(slug: "admin", nom: "Admin", nature: MANDAT) { id } }'
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('range un périmètre dans un groupe de son activité seulement', async () => {
    const CREER = `mutation ($g: String!, $slug: String!) {
      creerPerimetre(slug: $slug, nom: "Essai", groupe: $g) { id groupe type }
    }`
    const refus = await executer(ids.adminA, CREER, {
      g: 'commission',
      slug: `essai-${s}`,
    })
    expect(code(refus)).toBe('SAISIE_INVALIDE')
    const accord = await executer(ids.adminA, CREER, {
      g: 'sport',
      slug: `essai-${s}`,
    })
    expect(accord.data?.creerPerimetre).toMatchObject({
      groupe: 'sport',
      type: 'SPORT',
    })
  })

  it('sert sans session le thème de l’organisation désignée, ou une identité neutre', async () => {
    // Une déclaration valide, comme après l'import d'organisation.yaml.
    await prisma.organisation.update({
      where: { id: ids.orgB },
      data: {
        configuration: {
          slug: slugB,
          nom: 'Organisation B',
          domainesCourrielAutorises: [],
        },
      },
    })
    invaliderConfigurationOrganisation()
    const designee = await executer(
      null,
      'query ($s: String) { organisation(slug: $s) { slug } }',
      { s: slugB }
    )
    expect(designee.data?.organisation).toEqual({ slug: slugB })
    // Plusieurs organisations existent : sans slug, aucune n'impose sa marque.
    const neutre = await executer(null, '{ organisation { slug } }')
    expect(neutre.data?.organisation).not.toEqual({ slug: slugA })
    expect(neutre.data?.organisation).not.toEqual({ slug: slugB })
  })
})
