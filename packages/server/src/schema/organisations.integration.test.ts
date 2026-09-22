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
    const compte = await prisma.user.findUniqueOrThrow({
      where: { id: ids.referenteA },
    })
    expect(compte.archivedAt).toBeNull()
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

  it('refuse l’archivage de son compte depuis une seule de ses organisations', async () => {
    const r = await executer(
      ids.adminB,
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }',
      { id: ids.double }
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('refuse le changement de son nom depuis une seule de ses organisations', async () => {
    const r = await executer(
      ids.adminB,
      'mutation ($id: ID!) { modifierPersonne(id: $id, nom: "Autre", estAdmin: true) { id } }',
      { id: ids.double }
    )
    expect(code(r)).toBe('SAISIE_INVALIDE')
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
    } finally {
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
