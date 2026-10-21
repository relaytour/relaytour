import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'

import { schema } from './index.ts'

// Fiches connexes (ADR 0039) : une fiche de périmètre se lit dans les périmètres de
// sa liste « Concerne aussi », dans ceux des groupes de cette liste, et dans ceux
// d'une déclinaison acceptée qui la cite. Les droits se prouvent par le refus
// (invariant 11). Le fichier crée sa propre organisation.

const s = randomUUID().slice(0, 8)
const slug = `connexes-${s}`
const apollo = new ApolloServer<AppContext>({ schema })

const ids = {
  organisation: '',
  autreOrganisation: '',
  activite: '',
  autreActivite: '',
  edition: '',
  autreEdition: '',
  // Un pôle qui tient la fiche, un pôle d'accueil, deux sports et un sport archivé.
  lieux: '',
  accueil: '',
  natation: '',
  volley: '',
  escrime: '',
  // Un périmètre d'une autre activité, puis d'une autre organisation.
  ailleurs: '',
  etranger: '',
  fiche: '',
  ficheDeclinee: '',
  ficheCommune: '',
  // L'admin de l'organisation, la rédactrice du pôle, une référente de natation, un
  // référent de volley, une référente d'accueil, une référente d'une autre activité.
  admin: '',
  pauline: '',
  nina: '',
  victor: '',
  alice: '',
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

const REGLER = `mutation ($f: ID!, $p: [ID!]!, $g: [String!]!) {
  reglerConcerneAussi(ficheId: $f, perimetreIds: $p, groupes: $g) {
    id concerneAussi { id } concerneGroupes
  }
}`
const FICHE = `query ($s: String!, $a: ID!) {
  fiche(slug: $s, activiteId: $a) {
    id
    connexions { perimetre { id } par groupe tacheId masquee }
  }
}`
const FICHES = `query ($a: ID!) { fiches(activiteId: $a) { id } }`
const CONNEXES = `query ($s: String!, $a: ID!, $m: Boolean) {
  perimetre(slug: $s, activiteId: $a) {
    fichesConnexes(inclureMasquees: $m) { id }
    peutMasquerFichesConnexes
  }
}`
const MASQUER = `mutation ($f: ID!, $p: ID!) { masquerFicheConnexe(ficheId: $f, perimetreId: $p) { id } }`
const AFFICHER = `mutation ($f: ID!, $p: ID!) { afficherFicheConnexe(ficheId: $f, perimetreId: $p) { id } }`
const RECHERCHE = `query ($t: String!) { recherche(texte: $t) { fiches { id } } }`
const NOTIFICATIONS = `query { notifications(limite: 50) { type message lien } }`

const regler = (
  userId: string | null,
  perimetreIds: string[],
  groupes: string[] = [],
  ficheId = ids.fiche
) => executer(userId, REGLER, { f: ficheId, p: perimetreIds, g: groupes })

const lireFiche = (userId: string, cle = 'tableau') =>
  executer(userId, FICHE, { s: `${cle}-${s}`, a: ids.activite })

async function connexions(userId = ids.admin) {
  const r = await lireFiche(userId)
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      fiche: {
        connexions: {
          perimetre: { id: string }
          par: string
          groupe: string | null
          tacheId: string | null
          masquee: boolean
        }[]
      }
    }
  ).fiche.connexions
}

async function fichesConnexesDe(
  userId: string,
  cle: string,
  inclureMasquees = false
) {
  const r = await executer(userId, CONNEXES, {
    s: `${cle}-${s}`,
    a: ids.activite,
    m: inclureMasquees,
  })
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      perimetre: {
        fichesConnexes: { id: string }[]
        peutMasquerFichesConnexes: boolean
      }
    }
  ).perimetre
}

async function listeDesFiches(userId: string) {
  const r = await executer(userId, FICHES, { a: ids.activite })
  expect(r.errors).toBeUndefined()
  return (r.data as { fiches: { id: string }[] }).fiches.map(f => f.id)
}

beforeAll(async () => {
  await apollo.start()
  const organisation = (cle: string) =>
    prisma.organisation.create({
      data: {
        slug: cle,
        nom: `Organisation ${cle}`,
        configuration: {
          slug: cle,
          nom: `Organisation ${cle}`,
          domainesCourrielAutorises: ['exemple.fr'],
        },
      },
    })
  ids.organisation = (await organisation(slug)).id
  ids.autreOrganisation = (await organisation(`${slug}-b`)).id

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

  const edition = (activiteId: string) =>
    prisma.edition.create({
      data: {
        organisationId: ids.organisation,
        activiteId,
        annee: 2027,
        nom: 'Période 2027',
        debut: new Date('2027-06-05'),
        fin: new Date('2027-06-06'),
      },
    })
  ids.edition = (await edition(ids.activite)).id
  ids.autreEdition = (await edition(ids.autreActivite)).id

  const perimetre = (
    cle: string,
    groupe: string,
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
        archivedAt: options.archive ? new Date() : null,
      },
    })
  ids.lieux = (await perimetre('lieux', 'pole')).id
  ids.accueil = (await perimetre('accueil', 'pole')).id
  ids.natation = (await perimetre('natation', 'sport')).id
  ids.volley = (await perimetre('volley', 'sport')).id
  ids.escrime = (await perimetre('escrime', 'sport', { archive: true })).id
  ids.ailleurs = (
    await perimetre('ailleurs', 'pole', { activiteId: ids.autreActivite })
  ).id
  ids.etranger = (
    await perimetre('etranger', 'pole', {
      organisationId: ids.autreOrganisation,
      activiteId: activiteEtrangere,
    })
  ).id

  const fiche = async (cle: string, perimetreId: string | null) => {
    const creee = await prisma.fiche.create({
      data: {
        organisationId: ids.organisation,
        activiteId: ids.activite,
        slug: `${cle}-${s}`,
        perimetreId,
      },
    })
    const version = await prisma.ficheVersion.create({
      data: {
        ficheId: creee.id,
        titre: `Fiche ${cle} ${s}`,
        contenu: 'Le contenu de la fiche.',
        empreinte: cle.padEnd(64, '0'),
        source: 'APP',
      },
    })
    await prisma.fiche.update({
      where: { id: creee.id },
      data: { versionCouranteId: version.id },
    })
    return creee.id
  }
  ids.fiche = await fiche('tableau', ids.lieux)
  ids.ficheDeclinee = await fiche('declinee', ids.lieux)
  ids.ficheCommune = await fiche('commune', null)

  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['pauline', 'MEMBRE'],
    ['nina', 'MEMBRE'],
    ['victor', 'MEMBRE'],
    ['alice', 'MEMBRE'],
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
      { userId: ids.nina, perimetreId: ids.natation, editionId: ids.edition },
      { userId: ids.victor, perimetreId: ids.volley, editionId: ids.edition },
      { userId: ids.alice, perimetreId: ids.accueil, editionId: ids.edition },
      {
        userId: ids.etrangere,
        perimetreId: ids.ailleurs,
        editionId: ids.autreEdition,
      },
    ],
  })
  // Pauline rédige les fiches du pôle Lieux.
  await prisma.droitRedaction.create({
    data: {
      userId: ids.pauline,
      organisationId: ids.organisation,
      perimetreId: ids.lieux,
    },
  })
})

afterAll(async () => {
  const organisations = [ids.organisation, ids.autreOrganisation]
  const dansLesOrganisations = { organisationId: { in: organisations } }
  await prisma.notification.deleteMany({ where: dansLesOrganisations })
  await prisma.journal.deleteMany({
    where: { perimetre: dansLesOrganisations },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: dansLesOrganisations, origineId: { not: null } },
  })
  await prisma.tache.deleteMany({ where: { perimetre: dansLesOrganisations } })
  await prisma.affectation.deleteMany({
    where: { perimetre: dansLesOrganisations },
  })
  await prisma.droitRedaction.deleteMany({ where: dansLesOrganisations })
  await prisma.fiche.updateMany({
    where: dansLesOrganisations,
    data: { versionCouranteId: null },
  })
  await prisma.ficheVersion.deleteMany({
    where: { fiche: dansLesOrganisations },
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

describe('la liste « Concerne aussi »', () => {
  it('une personne d’un autre périmètre ne lit pas la fiche avant le partage', async () => {
    expect(code(await lireFiche(ids.nina))).toBe('FORBIDDEN')
    expect(await listeDesFiches(ids.nina)).not.toContain(ids.fiche)
  })

  it('refuse la liste à une personne sans droit de rédaction', async () => {
    expect((await regler(null, [ids.natation])).errors).toBeDefined()
    expect(code(await regler(ids.nina, [ids.natation]))).toBe('FORBIDDEN')
    expect(code(await regler(ids.alice, [ids.natation]))).toBe('FORBIDDEN')
    expect(code(await regler(ids.etrangere, [ids.natation]))).toBe('FORBIDDEN')
  })

  it('refuse un périmètre d’une autre activité, d’une autre organisation ou archivé', async () => {
    expect(code(await regler(ids.pauline, [ids.ailleurs]))).toBe('FORBIDDEN')
    expect(code(await regler(ids.pauline, [ids.etranger]))).toBe('FORBIDDEN')
    expect(code(await regler(ids.pauline, [ids.escrime]))).toBe('FORBIDDEN')
    expect(code(await regler(ids.pauline, ['inconnu']))).toBe('FORBIDDEN')
  })

  it('refuse le périmètre de la fiche, un groupe inconnu et une fiche commune', async () => {
    expect((await regler(ids.pauline, [ids.lieux])).errors).toBeDefined()
    expect((await regler(ids.pauline, [], ['inconnu'])).errors).toBeDefined()
    const commune = await regler(
      ids.admin,
      [ids.natation],
      [],
      ids.ficheCommune
    )
    expect(commune.errors?.[0]?.message).toMatch(/fiche commune/)
  })

  it('la rédactrice ajoute natation : la référente de natation lit la fiche', async () => {
    const r = await regler(ids.pauline, [ids.natation])
    expect(r.errors).toBeUndefined()
    expect(code(await lireFiche(ids.nina))).toBeUndefined()
    expect(await listeDesFiches(ids.nina)).toContain(ids.fiche)
    expect(
      (await fichesConnexesDe(ids.nina, 'natation')).fichesConnexes.map(
        f => f.id
      )
    ).toEqual([ids.fiche])
    const trouvees = await executer(ids.nina, RECHERCHE, { t: `tableau ${s}` })
    expect(
      (trouvees.data as { recherche: { fiches: { id: string }[] } }).recherche
        .fiches
    ).toEqual([{ id: ids.fiche }])
  })

  it('le partage n’ouvre ni le volley, ni la consultation, ni une autre activité', async () => {
    expect(code(await lireFiche(ids.victor))).toBe('FORBIDDEN')
    expect(code(await lireFiche(ids.alice))).toBe('FORBIDDEN')
    expect(code(await lireFiche(ids.etrangere))).toBeDefined()
    // La consultation de natation par Alice n'ouvre pas ses fiches connexes.
    const r = await executer(ids.alice, CONNEXES, {
      s: `natation-${s}`,
      a: ids.activite,
    })
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('prévient les référentes et référents du périmètre ajouté, pas l’autrice', async () => {
    const recues = await executer(ids.nina, NOTIFICATIONS)
    const connexes = (
      recues.data as { notifications: { type: string; message: string }[] }
    ).notifications.filter(n => n.type === 'FICHE_CONNEXE')
    expect(connexes).toHaveLength(1)
    expect(connexes[0]!.message).toMatch(/concerne aussi votre périmètre/)
    const envoyees = await executer(ids.pauline, NOTIFICATIONS)
    expect(
      (envoyees.data as { notifications: { type: string }[] }).notifications
    ).not.toContainEqual(expect.objectContaining({ type: 'FICHE_CONNEXE' }))
  })
})

describe('un groupe dans la liste', () => {
  it('concerne ses périmètres non archivés, sauf le périmètre de la fiche', async () => {
    const r = await regler(ids.pauline, [ids.natation], ['sport', 'pole'])
    expect(r.errors).toBeUndefined()
    const liste = await connexions()
    const par = Object.fromEntries(liste.map(c => [c.perimetre.id, c.par]))
    expect(par[ids.natation]).toBe('LISTE')
    expect(par[ids.volley]).toBe('GROUPE')
    expect(par[ids.accueil]).toBe('GROUPE')
    expect(par[ids.escrime]).toBeUndefined()
    expect(par[ids.lieux]).toBeUndefined()
    expect(code(await lireFiche(ids.victor))).toBeUndefined()
  })

  it('concerne aussi un périmètre qui rejoint le groupe plus tard', async () => {
    const judo = await prisma.perimetre.create({
      data: {
        organisationId: ids.organisation,
        activiteId: ids.activite,
        slug: `judo-${s}`,
        nom: 'judo',
        groupe: 'sport',
        type: 'SPORT',
      },
    })
    const liste = await connexions()
    expect(liste.map(c => c.perimetre.id)).toContain(judo.id)
  })

  it('retirer le groupe retire la lecture', async () => {
    const r = await regler(ids.pauline, [ids.natation], [])
    expect(r.errors).toBeUndefined()
    expect(code(await lireFiche(ids.victor))).toBe('FORBIDDEN')
    expect(code(await lireFiche(ids.alice))).toBe('FORBIDDEN')
  })
})

describe('le masquage par le périmètre cible', () => {
  it('refuse le masquage à une personne qui n’écrit pas dans le périmètre', async () => {
    expect(
      code(
        await executer(ids.victor, MASQUER, { f: ids.fiche, p: ids.natation })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(
        await executer(ids.pauline, MASQUER, { f: ids.fiche, p: ids.natation })
      )
    ).toBe('FORBIDDEN')
    expect(
      code(await executer(null, MASQUER, { f: ids.fiche, p: ids.natation }))
    ).toBeDefined()
  })

  it('refuse un périmètre que la fiche ne concerne pas', async () => {
    const r = await executer(ids.admin, MASQUER, {
      f: ids.fiche,
      p: ids.volley,
    })
    expect(r.errors?.[0]?.message).toMatch(/ne concerne pas/)
  })

  it('la référente masque : la fiche quitte la liste et reste lisible par son lien', async () => {
    expect(
      (await fichesConnexesDe(ids.nina, 'natation')).peutMasquerFichesConnexes
    ).toBe(true)
    const r = await executer(ids.nina, MASQUER, {
      f: ids.fiche,
      p: ids.natation,
    })
    expect(r.errors).toBeUndefined()
    expect(
      (await fichesConnexesDe(ids.nina, 'natation')).fichesConnexes
    ).toEqual([])
    expect(
      (await fichesConnexesDe(ids.nina, 'natation', true)).fichesConnexes
    ).toEqual([{ id: ids.fiche }])
    expect(code(await lireFiche(ids.nina))).toBeUndefined()
    const masquee = (await connexions()).find(
      c => c.perimetre.id === ids.natation
    )
    expect(masquee?.masquee).toBe(true)
    const journal = await prisma.journal.count({
      where: { ficheId: ids.fiche, type: 'FICHE_CONNEXE_MASQUEE' },
    })
    expect(journal).toBe(1)
  })

  it('la référente affiche de nouveau la fiche', async () => {
    const r = await executer(ids.nina, AFFICHER, {
      f: ids.fiche,
      p: ids.natation,
    })
    expect(r.errors).toBeUndefined()
    expect(
      (await fichesConnexesDe(ids.nina, 'natation')).fichesConnexes
    ).toEqual([{ id: ids.fiche }])
  })

  it('retirer natation de la liste retire la lecture', async () => {
    expect((await regler(ids.pauline, [])).errors).toBeUndefined()
    expect(code(await lireFiche(ids.nina))).toBe('FORBIDDEN')
  })

  it('une notification d’une fiche devenue illisible ne la nomme plus', async () => {
    const r = await executer(ids.nina, NOTIFICATIONS)
    const connexes = (
      r.data as {
        notifications: { type: string; message: string; lien: string }[]
      }
    ).notifications.filter(n => n.type === 'FICHE_CONNEXE')
    expect(connexes.length).toBeGreaterThan(0)
    for (const n of connexes) {
      expect(n.message).toMatch(/ne concerne plus votre périmètre/)
      expect(n.message).not.toMatch(/tableau/)
      expect(n.lien).not.toMatch(/fiches/)
    }
  })
})

describe('une déclinaison qui cite une fiche du pôle', () => {
  const CREER = `mutation ($p: ID!, $e: ID!, $f: ID, $d: DeclinaisonInput) {
    creerTache(perimetreId: $p, editionId: $e, titre: "Préparer les lieux", ficheId: $f, declinaison: $d) {
      id declinaisons { id accord fiche { id } perimetre { id } }
    }
  }`
  const ACCORDER = `mutation ($id: ID!, $oui: Boolean!) {
    accorderDeclinaison(id: $id, accepter: $oui) { id accord }
  }`
  const TACHE = `query ($id: ID!) { tache(id: $id) { id fiche { id } } }`
  let declinaisons: { id: string; perimetre: { id: string } }[] = []

  it('cite la fiche du pôle dans chaque déclinaison', async () => {
    const r = await executer(ids.pauline, CREER, {
      p: ids.lieux,
      e: ids.edition,
      f: ids.ficheDeclinee,
      d: { perimetreIds: [ids.accueil, ids.volley] },
    })
    expect(r.errors).toBeUndefined()
    declinaisons = (
      r.data as {
        creerTache: {
          declinaisons: { id: string; perimetre: { id: string } }[]
        }
      }
    ).creerTache.declinaisons
    expect(declinaisons).toHaveLength(2)
    const enBase = await prisma.tache.findMany({
      where: { id: { in: declinaisons.map(d => d.id) } },
      select: { ficheId: true },
    })
    expect(enBase.every(t => t.ficheId === ids.ficheDeclinee)).toBe(true)
  })

  it('une déclinaison en attente n’ouvre pas la fiche', async () => {
    expect(code(await lireFiche(ids.alice, 'declinee'))).toBe('FORBIDDEN')
  })

  it('une déclinaison acceptée ouvre la fiche à son périmètre', async () => {
    const accueil = declinaisons.find(d => d.perimetre.id === ids.accueil)!
    const r = await executer(ids.alice, ACCORDER, { id: accueil.id, oui: true })
    expect(r.errors).toBeUndefined()
    expect(code(await lireFiche(ids.alice, 'declinee'))).toBeUndefined()
    const tache = await executer(ids.alice, TACHE, { id: accueil.id })
    expect(
      (tache.data as { tache: { fiche: { id: string } | null } }).tache.fiche
    ).toEqual({ id: ids.ficheDeclinee })
    const liste = await executer(ids.admin, FICHE, {
      s: `declinee-${s}`,
      a: ids.activite,
    })
    const connexion = (
      liste.data as {
        fiche: {
          connexions: {
            perimetre: { id: string }
            par: string
            tacheId: string
          }[]
        }
      }
    ).fiche.connexions.find(c => c.perimetre.id === ids.accueil)
    expect(connexion).toMatchObject({ par: 'DECLINAISON', tacheId: accueil.id })
  })

  it('une déclinaison refusée n’ouvre pas la fiche', async () => {
    const volley = declinaisons.find(d => d.perimetre.id === ids.volley)!
    const r = await executer(ids.victor, ACCORDER, {
      id: volley.id,
      oui: false,
    })
    expect(r.errors).toBeUndefined()
    expect(code(await lireFiche(ids.victor, 'declinee'))).toBe('FORBIDDEN')
  })
})

describe('une fiche déplacée vers une autre activité', () => {
  it('ne s’ouvre plus par une déclinaison de son ancienne activité', async () => {
    // Alice lit Accueil par la déclinaison acceptée, et voit aussi l'autre activité.
    const atelier = await prisma.perimetre.create({
      data: {
        organisationId: ids.organisation,
        activiteId: ids.autreActivite,
        slug: `atelier-${s}`,
        nom: 'atelier',
        groupe: 'pole',
        type: 'POLE',
      },
    })
    await prisma.affectation.create({
      data: {
        userId: ids.alice,
        perimetreId: atelier.id,
        editionId: ids.autreEdition,
      },
    })
    expect(code(await lireFiche(ids.alice, 'declinee'))).toBeUndefined()
    // Un import déplace la fiche vers l'autre activité, dans un périmètre qu'Alice
    // ne lit pas ; la déclinaison reste dans la première activité.
    await prisma.fiche.update({
      where: { id: ids.ficheDeclinee },
      data: { activiteId: ids.autreActivite, perimetreId: ids.ailleurs },
    })
    const r = await executer(ids.alice, FICHE, {
      s: `declinee-${s}`,
      a: ids.autreActivite,
    })
    expect(code(r)).toBe('FORBIDDEN')
    const liste = await executer(ids.alice, FICHES, { a: ids.autreActivite })
    expect(
      (liste.data as { fiches: { id: string }[] }).fiches.map(f => f.id)
    ).not.toContain(ids.ficheDeclinee)
  })
})
