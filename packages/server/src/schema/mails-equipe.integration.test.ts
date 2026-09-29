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
import {
  annoncerChangementEquipe,
  fenetreEquipe,
  FENETRE_EQUIPE_MS,
} from '../lib/equipe.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Mails d'équipe (ADR 0012). Une affectation ou une nomination met en file un mail
// regroupé par fenêtre ; un souhait, un contact principal ou un retrait n'en mettent
// aucun. L'invitation liste les périmètres de la personne, ou explique comment en
// obtenir un. Le fichier crée sa propre organisation.

const enFile = vi.hoisted(
  () => [] as { sorte: string; cible: unknown; options: unknown }[]
)
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: unknown, options: unknown = {}) => {
    enFile.push({ sorte, cible, options })
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `equipe-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  admin: '',
  alex: '',
  sam: '',
  lou: '',
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
  if (reponse.body.singleResult.errors)
    throw new Error(JSON.stringify(reponse.body.singleResult.errors))
  return reponse.body.singleResult.data as Record<string, unknown>
}

const mailsEquipe = () =>
  enFile.filter(e => e.sorte === 'equipe') as {
    cible: { userId: string }
    options: {
      jobId: string
      delai: number
      fenetre: { debut: string; fin: string }
      activiteId?: string
      organisationId: string
    }
  }[]

let jobAlex = ''

const AFFECTER = `mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }`

beforeAll(async () => {
  await apollo.start()
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: 'Les Rencontres',
      configuration: {},
      activites: {
        create: {
          slug,
          nom: 'Tournoi',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      },
    },
    include: { activites: true },
  })
  ids.org = organisation.id
  ids.activite = organisation.activites[0]!.id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
      },
    })
  ).id
  for (const [cle, nom, description] of [
    ['natation', 'Natation', 'Treize épreuves sur une journée.'],
    ['basket', 'Basket', null],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom,
          description,
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    ).id
  }
  for (const [cle, role] of [
    ['admin', 'ADMIN'],
    ['alex', 'MEMBRE'],
    ['sam', 'MEMBRE'],
    ['lou', 'MEMBRE'],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle[0]!.toUpperCase()}${cle.slice(1)} ${s}`,
        appartenances: {
          create: {
            organisationId: ids.org,
            role,
            // Une appartenance ancienne : un passage admin est une nomination.
            createdAt: new Date(Date.now() - 3 * 3600_000),
          },
        },
      },
    })
  }
})

afterAll(async () => {
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
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  invaliderConfigurationOrganisation()
  await apollo.stop()
  await prisma.$disconnect()
})

beforeEach(() => {
  enFile.length = 0
})

describe('fenêtre de regroupement', () => {
  it('découpe le temps en fenêtres fixes de dix minutes', () => {
    const instant = Date.parse('2027-01-01T10:07:30.000Z')
    expect(fenetreEquipe(instant)).toEqual({
      debut: '2027-01-01T10:00:00.000Z',
      fin: '2027-01-01T10:10:00.000Z',
    })
  })
})

describe('gestes qui mettent un mail d’équipe en file', () => {
  it('une affectation, différée jusqu’à la fin de la fenêtre, avec l’activité', async () => {
    await executer(ids.admin, AFFECTER, {
      u: ids.alex,
      p: ids.natation,
      e: ids.edition,
    })
    const [mail] = mailsEquipe()
    expect(mail?.cible).toEqual({ userId: ids.alex })
    expect(mail?.options.activiteId).toBe(ids.activite)
    // L'organisation et l'activité entrent dans l'identifiant du job.
    expect(mail?.options.jobId).toMatch(
      new RegExp(`^equipe-${ids.org}-${ids.activite}-${ids.alex}-\\d+$`)
    )
    expect(mail?.options.jobId).not.toContain(':')
    jobAlex = mail?.options.jobId ?? ''
    expect(mail?.options.delai).toBeGreaterThan(0)
    expect(mail?.options.delai).toBeLessThanOrEqual(FENETRE_EQUIPE_MS + 5_000)
  })

  it('deux affectations d’une personne dans la même fenêtre partagent le même job', async () => {
    await executer(ids.admin, AFFECTER, {
      u: ids.alex,
      p: ids.basket,
      e: ids.edition,
    })
    await executer(ids.admin, AFFECTER, {
      u: ids.sam,
      p: ids.basket,
      e: ids.edition,
    })
    const [alex, sam] = mailsEquipe()
    // Les deux affectations d'Alex (natation, puis basket) visent le même job, sauf
    // si le test a franchi la fin d'une fenêtre entre les deux.
    if (alex?.options.fenetre.debut === fenetreEquipe().debut) {
      expect(alex.options.jobId).toBe(jobAlex)
    }
    expect(sam?.options.jobId).not.toBe(alex?.options.jobId)
  })

  it('déduit la fenêtre de l’instant écrit en base, pas de l’heure de l’annonce', async () => {
    const instant = new Date('2027-01-01T10:09:59.900Z')
    await annoncerChangementEquipe(
      ids.alex,
      { organisationId: ids.org, activiteId: ids.activite, instant },
      Date.parse('2027-01-01T10:10:00.100Z')
    )
    const [mail] = mailsEquipe()
    expect(mail?.options.fenetre).toEqual({
      debut: '2027-01-01T10:00:00.000Z',
      fin: '2027-01-01T10:10:00.000Z',
    })
    // L'envoi part tout de suite après la fin de la fenêtre.
    expect(mail?.options.delai).toBeLessThanOrEqual(5_000)
  })

  it('une nomination comme admin d’activité', async () => {
    await executer(
      ids.admin,
      `mutation ($u: ID!, $a: ID!) { definirAdminActivite(personneId: $u, activiteId: $a, admin: true) }`,
      { u: ids.lou, a: ids.activite }
    )
    expect(mailsEquipe().map(m => m.cible)).toEqual([{ userId: ids.lou }])
  })

  it('un passage admin de l’organisation, mais pas un simple renommage', async () => {
    const modifier = `mutation ($id: ID!, $n: String!, $a: Boolean!) { modifierPersonne(id: $id, nom: $n, estAdmin: $a) { id } }`
    await executer(ids.admin, modifier, {
      id: ids.sam,
      n: `Sam ${s}`,
      a: false,
    })
    expect(mailsEquipe()).toEqual([])
    await executer(ids.admin, modifier, {
      id: ids.sam,
      n: `Sam ${s}`,
      a: true,
    })
    expect(mailsEquipe().map(m => m.cible)).toEqual([{ userId: ids.sam }])
  })
})

describe('gestes sans mail', () => {
  it('un souhait, un contact principal et un retrait d’affectation', async () => {
    await executer(
      ids.admin,
      `mutation ($u: ID!, $e: ID!, $p: [ID!]!) { definirSouhaits(personneId: $u, editionId: $e, perimetreIds: $p) { id } }`,
      { u: ids.lou, e: ids.edition, p: [ids.natation] }
    )
    const affectation = await prisma.affectation.findFirstOrThrow({
      where: { userId: ids.alex, perimetreId: ids.natation },
    })
    await executer(
      ids.admin,
      `mutation ($id: ID!) { definirContactPrincipal(affectationId: $id, contactPrincipal: true) }`,
      { id: affectation.id }
    )
    const basket = await prisma.affectation.findFirstOrThrow({
      where: { userId: ids.sam, perimetreId: ids.basket },
    })
    await executer(
      ids.admin,
      `mutation ($id: ID!) { retirerAffectation(id: $id) }`,
      {
        id: basket.id,
      }
    )
    expect(mailsEquipe()).toEqual([])
  })
})

// Une fenêtre large autour du test : le contenu ne dépend pas de l'instant où une
// fenêtre de dix minutes se termine.
const autourDuTest = () => ({
  debut: new Date(Date.now() - 3600_000).toISOString(),
  fin: new Date(Date.now() + 3600_000).toISOString(),
})

describe('contenu des mails', () => {
  it('annonce les affectations et les rôles de la fenêtre, avec les descriptions', async () => {
    const message = await composer(prisma, {
      sorte: 'equipe',
      userId: ids.alex,
      organisationId: ids.org,
      activiteId: ids.activite,
      fenetre: autourDuTest(),
    })
    expect(message?.sujet).toMatch(/^Votre place dans l’équipe .+ a changé$/)
    expect(message?.texte).toContain(
      '- Vous rejoignez le périmètre Natation (Tournoi 2027) : Treize épreuves sur une journée.'
    )
    expect(message?.texte).toContain(
      '- Vous rejoignez le périmètre Basket (Tournoi 2027)'
    )
    expect(message?.texte).toContain('mode d’emploi')

    const lou = await composer(prisma, {
      sorte: 'equipe',
      userId: ids.lou,
      organisationId: ids.org,
      activiteId: ids.activite,
      fenetre: autourDuTest(),
    })
    expect(lou?.texte).toContain('Vous devenez admin de l’activité Tournoi')
  })

  it('n’envoie rien quand la fenêtre ne contient aucun changement', async () => {
    const passee = fenetreEquipe(Date.now() - 3 * FENETRE_EQUIPE_MS)
    expect(
      await composer(prisma, {
        sorte: 'equipe',
        userId: ids.alex,
        organisationId: ids.org,
        fenetre: passee,
      })
    ).toBeNull()
  })

  it('n’annonce pas une affectation retirée pendant la fenêtre', async () => {
    // Le mail de l'activité ne trouve plus rien à annoncer.
    expect(
      await composer(prisma, {
        sorte: 'equipe',
        userId: ids.sam,
        organisationId: ids.org,
        activiteId: ids.activite,
        fenetre: autourDuTest(),
      })
    ).toBeNull()
  })

  it('sépare le mail de l’organisation de celui d’une activité', async () => {
    // Sans activité, le mail ne porte que le rôle d'organisation.
    const sam = await composer(prisma, {
      sorte: 'equipe',
      userId: ids.sam,
      organisationId: ids.org,
      fenetre: autourDuTest(),
    })
    expect(sam?.texte).toContain('Vous devenez admin de l’organisation')
    const alex = await composer(prisma, {
      sorte: 'equipe',
      userId: ids.alex,
      organisationId: ids.org,
      fenetre: autourDuTest(),
    })
    expect(alex).toBeNull()
  })

  it('liste les périmètres dans l’invitation', async () => {
    const message = await composer(prisma, {
      sorte: 'invitation',
      userId: ids.alex,
      organisationId: ids.org,
    })
    expect(message?.texte).toContain(
      'Vous faites partie de l’équipe de ces périmètres :'
    )
    expect(message?.texte).toContain(
      '- Natation (Tournoi 2027) : Treize épreuves sur une journée.'
    )
  })

  it('explique comment obtenir un périmètre, selon l’ouverture aux souhaits', async () => {
    const invitation = async () =>
      (
        await composer(prisma, {
          sorte: 'invitation',
          userId: ids.sam,
          organisationId: ids.org,
        })
      )?.texte ?? ''
    expect(await invitation()).toContain(
      'Vous n’avez pas encore de périmètre : un admin vous affectera'
    )
    await prisma.activite.update({
      where: { id: ids.activite },
      data: { souhaitsOuverts: true },
    })
    expect(await invitation()).toContain('Dans « Tous les périmètres »')
  })
})
