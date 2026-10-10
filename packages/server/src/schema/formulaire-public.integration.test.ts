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
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Formulaire public pour rejoindre l'équipe (ADR 0015) : il se lit et se remplit
// sans session. Il ne répond que pour une organisation active, une activité ouverte
// et un formulaire qu'un admin a ouvert. Le fichier crée sa propre organisation, et
// chaque dépôt part d'une adresse IP propre au fichier : les limites de débit ne
// débordent pas d'une exécution sur l'autre.

// `enFile` reçoit les mails destinés à une personne de l'équipe ou à l'adresse
// saisie ; `mailsAdmins`, les destinataires du mail regroupé aux admins (ADR 0016).
const enFile = vi.hoisted(() => [] as string[])
const mailsAdmins = vi.hoisted(() => [] as unknown[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: unknown) => {
    if (sorte === 'demandes') mailsAdmins.push(cible)
    else enFile.push(sorte)
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `rejoindre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const adresse = (cle: string) => `${cle}-${slug}@exemple.fr`
const ids = {
  org: '',
  activite: '',
  edition: '',
  natation: '',
  basket: '',
  admin: '',
  alice: '',
}
let ips = 0
/** Une adresse IP neuve : un dépôt ne consomme la limite que de son propre test. */
const ipNeuve = () => `ip-${s}-${(ips += 1)}`

async function executer(
  query: string,
  variables: Record<string, unknown> = {},
  options: { userId?: string; ip?: string } = {}
) {
  const contextValue = await buildContext(
    options.ip ?? ipNeuve(),
    options.userId ?? null,
    options.userId ? slug : null
  )
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const LIRE = `query ($o: String, $a: String!) {
  formulaireRejoindre(organisation: $o, activite: $a) {
    organisation activite periode introduction question paliers contact
    groupes { libelle perimetres { slug nom description couleur } }
  }
}`
const lire = async () =>
  (
    (await executer(LIRE, { o: slug, a: slug })).data as {
      formulaireRejoindre: Record<string, unknown> | null
    }
  ).formulaireRejoindre

const ENVOYER = `mutation (
  $o: String, $a: String!, $n: String!, $e: String!, $p: [String!]!,
  $d: String, $r: String, $t: String, $s: String
) {
  envoyerDemande(
    organisation: $o, activite: $a, nom: $n, email: $e, perimetres: $p,
    disponibilite: $d, reponse: $r, texte: $t, siteWeb: $s
  )
}`
const envoyer = (
  cle: string,
  plus: Record<string, unknown> = {},
  options: { ip?: string } = {}
) =>
  executer(
    ENVOYER,
    {
      o: slug,
      a: slug,
      n: `Personne ${cle}`,
      e: adresse(cle),
      p: ['natation'],
      ...plus,
    },
    options
  )

const demandes = () =>
  prisma.demande.count({ where: { organisationId: ids.org } })

const reglerActivite = (data: Record<string, unknown>) =>
  prisma.activite.update({ where: { id: ids.activite }, data })

beforeAll(async () => {
  await apollo.start()
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: 'Organisation',
      // Une déclaration valide, sans contact : le formulaire ne lit rien de
      // l'environnement du poste.
      configuration: {
        slug,
        nom: 'Organisation',
        domainesCourrielAutorises: ['exemple.fr'],
      },
      activites: {
        create: {
          slug,
          nom: 'Tournoi',
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
          identite: { contactRecrutement: 'equipe@exemple.fr' },
          formulaire: {
            introduction: 'Rejoignez le tournoi.',
            question: 'Votre club',
            paliers: ['Quelques heures', 'Chaque semaine'],
          },
          formulaireOuvert: true,
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
  for (const [cle, description] of [
    ['natation', 'Les séries se nagent le samedi.'],
    ['basket', 'Écrire à jean.dupont@messagerie.example pour le gymnase.'],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom: cle,
          description,
          type: 'SPORT',
          groupe: 'sport',
        },
      })
    ).id
  }
  await prisma.perimetre.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      slug: 'escrime',
      nom: 'escrime',
      type: 'SPORT',
      groupe: 'sport',
      archivedAt: new Date(),
    },
  })
  for (const cle of ['admin', 'alice'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: adresse(cle),
        name: `${cle} ${s}`,
        appartenances: {
          create: {
            organisationId: ids.org,
            role: cle === 'admin' ? 'ADMIN' : 'MEMBRE',
          },
        },
      },
    })
  }
  await prisma.affectation.create({
    data: {
      userId: ids.alice,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
  await prisma.demande.deleteMany({ where: { organisationId: ids.org } })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
  await prisma.edition.deleteMany({ where: { organisationId: ids.org } })
  await prisma.perimetre.deleteMany({ where: { organisationId: ids.org } })
  await prisma.activite.deleteMany({ where: { organisationId: ids.org } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  })
  await prisma.organisation.delete({ where: { id: ids.org } })
  await apollo.stop()
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  await prisma.$disconnect()
})

beforeEach(() => {
  enFile.length = 0
  mailsAdmins.length = 0
})

describe('lire le formulaire sans session', () => {
  it('sert l’activité, ses périmètres actifs et son contact, sans identifiant', async () => {
    expect(await lire()).toEqual({
      organisation: 'Organisation',
      activite: 'Tournoi',
      periode: 'Tournoi 2027',
      introduction: 'Rejoignez le tournoi.',
      question: 'Votre club',
      paliers: ['Quelques heures', 'Chaque semaine'],
      contact: 'equipe@exemple.fr',
      groupes: [
        {
          libelle: 'Sports',
          perimetres: [
            // Une description qui cite une adresse personnelle n'est pas publiée.
            { slug: 'basket', nom: 'basket', description: null, couleur: null },
            {
              slug: 'natation',
              nom: 'natation',
              description: 'Les séries se nagent le samedi.',
              couleur: null,
            },
          ],
        },
      ],
    })
  })

  it('refuse un champ réservé demandé dans la même requête', async () => {
    const r = await executer(
      `query ($a: String!) { formulaireRejoindre(activite: $a) { activite } personnes { id } }`,
      { a: slug }
    )
    expect(code(r)).toBe('FORBIDDEN')
  })

  it('ne répond pas pour une activité inconnue ou une autre organisation', async () => {
    const r = await executer(LIRE, { o: slug, a: 'inconnue' })
    expect(r.data).toEqual({ formulaireRejoindre: null })
    const ailleurs = await executer(LIRE, { o: 'inconnue', a: slug })
    expect(ailleurs.data).toEqual({ formulaireRejoindre: null })
  })

  it.each([
    ['le formulaire est fermé', { formulaireOuvert: false }],
    ['l’activité est archivée', { archivedAt: new Date() }],
    ['aucun contact n’est déclaré', { identite: {} }],
  ])('ne répond pas quand %s, et refuse le dépôt', async (_cas, changement) => {
    await reglerActivite(changement)
    try {
      expect(await lire()).toBeNull()
      const avant = await demandes()
      expect(code(await envoyer('ferme'))).toBe('SAISIE_INVALIDE')
      expect(await demandes()).toBe(avant)
    } finally {
      await reglerActivite({
        formulaireOuvert: true,
        archivedAt: null,
        identite: { contactRecrutement: 'equipe@exemple.fr' },
      })
    }
  })

  it.each(['LECTURE_SEULE', 'SUSPENDUE'] as const)(
    'ne répond pas pour une organisation %s, et refuse le dépôt',
    async statut => {
      await prisma.organisation.update({
        where: { id: ids.org },
        data: { statut },
      })
      try {
        expect(await lire()).toBeNull()
        const avant = await demandes()
        expect(code(await envoyer('suspendue'))).toBe('SAISIE_INVALIDE')
        expect(await demandes()).toBe(avant)
      } finally {
        await prisma.organisation.update({
          where: { id: ids.org },
          data: { statut: 'ACTIVE' },
        })
      }
    }
  )

  it('ne répond pas sans période ouverte', async () => {
    await prisma.edition.update({
      where: { id: ids.edition },
      data: { statut: 'ARCHIVEE' },
    })
    try {
      expect(await lire()).toBeNull()
    } finally {
      await prisma.edition.update({
        where: { id: ids.edition },
        data: { statut: 'PREPARATION' },
      })
    }
  })
})

describe('déposer une demande sans session', () => {
  it('crée une demande en attente, sans compte ni mail, et prévient l’admin', async () => {
    const r = await envoyer('lina', {
      p: ['natation', 'basket'],
      d: 'Chaque semaine',
      r: 'Club de la vallée',
      t: 'J’ai déjà tenu une buvette.',
    })
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({ envoyerDemande: true })
    const demande = await prisma.demande.findFirstOrThrow({
      where: { adresse: adresse('lina') },
      include: { perimetres: true },
    })
    expect(demande).toMatchObject({
      organisationId: ids.org,
      activiteId: ids.activite,
      editionId: ids.edition,
      origine: 'FORMULAIRE',
      statut: 'EN_ATTENTE',
      nom: 'Personne lina',
      disponibilite: 'Chaque semaine',
      // La question posée se garde avec la réponse : le réglage peut changer.
      question: 'Votre club',
      reponse: 'Club de la vallée',
      texte: 'J’ai déjà tenu une buvette.',
      userId: null,
    })
    expect(
      demande.perimetres.map(p => [p.perimetreId, p.proposeParId]).sort()
    ).toEqual(
      [
        [ids.natation, null],
        [ids.basket, null],
      ].sort()
    )
    expect(
      await prisma.user.findUnique({ where: { email: adresse('lina') } })
    ).toBeNull()
    // Aucun mail ne part vers l'adresse saisie. L'admin a son mail regroupé.
    expect(enFile).toEqual([])
    expect(mailsAdmins).toEqual([{ userId: ids.admin }])
    expect(
      await prisma.notification.findMany({
        where: { organisationId: ids.org },
        select: { userId: true, type: true, acteurId: true, activiteId: true },
      })
    ).toEqual([
      {
        userId: ids.admin,
        type: 'DEMANDE_RECUE',
        acteurId: null,
        activiteId: ids.activite,
      },
    ])
  })

  it('accepte une demande sans périmètre ni réponse', async () => {
    const r = await envoyer('sans-choix', { p: [] })
    expect(r.data).toEqual({ envoyerDemande: true })
    expect(
      await prisma.demandePerimetre.count({
        where: { demande: { adresse: adresse('sans-choix') } },
      })
    ).toBe(0)
  })

  it('répond de la même façon pour une demande déjà en attente et pour une adresse déjà membre', async () => {
    const avant = await demandes()
    expect((await envoyer('lina')).data).toEqual({ envoyerDemande: true })
    expect(await demandes()).toBe(avant)
    expect((await envoyer('alice')).data).toEqual({ envoyerDemande: true })
    expect(await demandes()).toBe(avant + 1)
  })

  it('répond « vrai » à un dépôt piégé, sans rien écrire', async () => {
    const avant = await demandes()
    const r = await envoyer('robot', { s: 'https://exemple.org' })
    expect(r.data).toEqual({ envoyerDemande: true })
    expect(await demandes()).toBe(avant)
  })

  it.each([
    ['une adresse invalide', { e: 'pas une adresse' }],
    ['un périmètre inconnu', { p: ['inconnu'] }],
    ['un périmètre archivé', { p: ['escrime'] }],
    ['une disponibilité hors des paliers', { d: 'Tous les jours' }],
    ['un lien dans le texte', { t: 'Voir https://exemple.org' }],
    ['un lien dans la réponse', { r: 'www.exemple.org' }],
    ['un nom de domaine nu', { t: 'Mon site : mon-club.fr' }],
    ['une adresse mailto', { t: 'mailto:personne@exemple.org' }],
    ['un texte trop long', { t: 'a'.repeat(601) }],
  ])('refuse %s', async (_cas, plus) => {
    const avant = await demandes()
    expect(code(await envoyer('invalide', plus))).toBe('SAISIE_INVALIDE')
    expect(await demandes()).toBe(avant)
  })

  it('limite les dépôts d’une même adresse IP', async () => {
    const ip = ipNeuve()
    for (let i = 0; i < 5; i += 1) {
      const r = await envoyer(`ip${i}`, {}, { ip })
      expect(r.data).toEqual({ envoyerDemande: true })
    }
    const avant = await demandes()
    expect(code(await envoyer('ip-de-trop', {}, { ip }))).toBe(
      'SAISIE_INVALIDE'
    )
    expect(await demandes()).toBe(avant)
  })

  it('limite les dépôts d’une même adresse IP sur la journée, fenêtre horaire comprise', async () => {
    const ip = ipNeuve()
    const { connection } = await import('../jobs/queues.ts')
    for (let lot = 0; lot < 4; lot += 1) {
      // Seule la fenêtre horaire se remet à zéro : la fenêtre journalière compte.
      await connection.del(`limite:rejoindre-ip-${ip}`)
      for (let i = 0; i < 5; i += 1) {
        const r = await envoyer(`jour${lot}-${i}`, {}, { ip })
        expect(r.data).toEqual({ envoyerDemande: true })
      }
    }
    await connection.del(`limite:rejoindre-ip-${ip}`)
    const avant = await demandes()
    expect(code(await envoyer('jour-de-trop', {}, { ip }))).toBe(
      'SAISIE_INVALIDE'
    )
    expect(await demandes()).toBe(avant)
  })

  it('limite les dépôts pour une même adresse mail', async () => {
    expect((await envoyer('repetee')).data).toEqual({ envoyerDemande: true })
    expect((await envoyer('repetee')).data).toEqual({ envoyerDemande: true })
    expect(code(await envoyer('repetee'))).toBe('SAISIE_INVALIDE')
  })
})

describe('régler le formulaire', () => {
  const REGLER = `mutation ($id: ID!, $f: FormulaireInput, $o: Boolean) {
    modifierActivite(
      id: $id, nom: "Tournoi", nature: EVENEMENT, ordre: 0,
      groupes: [{ cle: "sport", libelle: "Sport", libellePluriel: "Sports" }],
      formulaire: $f, formulaireOuvert: $o
    ) { formulaireOuvert formulaire { introduction question paliers } }
  }`
  const regler = (userId: string, variables: Record<string, unknown>) =>
    executer(REGLER, { id: ids.activite, ...variables }, { userId })

  it('refuse une référente', async () => {
    expect(code(await regler(ids.alice, { o: false }))).toBe('FORBIDDEN')
    expect(await lire()).not.toBeNull()
  })

  it('refuse une coordonnée personnelle et un réglage trop long', async () => {
    const personnelle = await regler(ids.admin, {
      f: { introduction: 'Écrivez à jean.dupont@messagerie.example.' },
    })
    expect(code(personnelle)).toBe('SAISIE_INVALIDE')
    const longue = await regler(ids.admin, {
      f: { paliers: Array.from({ length: 9 }, (_, i) => `Palier ${i}`) },
    })
    expect(code(longue)).toBe('SAISIE_INVALIDE')
    expect((await lire())?.introduction).toBe('Rejoignez le tournoi.')
  })

  it('enregistre le réglage sans toucher à l’ouverture, puis ferme sans toucher au réglage', async () => {
    const reglage = await regler(ids.admin, {
      f: {
        introduction: ' Venez nous aider. ',
        question: '',
        paliers: ['Un soir'],
      },
    })
    expect(reglage.errors).toBeUndefined()
    expect(reglage.data).toEqual({
      modifierActivite: {
        formulaireOuvert: true,
        formulaire: {
          introduction: 'Venez nous aider.',
          question: null,
          paliers: ['Un soir'],
        },
      },
    })
    const fermeture = await regler(ids.admin, { o: false })
    expect(fermeture.data).toEqual({
      modifierActivite: {
        formulaireOuvert: false,
        formulaire: {
          introduction: 'Venez nous aider.',
          question: null,
          paliers: ['Un soir'],
        },
      },
    })
    expect(await lire()).toBeNull()
  })

  it('refuse de retirer le dernier contact d’un formulaire ouvert', async () => {
    await reglerActivite({ formulaireOuvert: true })
    const RETIRER = `mutation ($id: ID!) { modifierIdentiteActivite(id: $id) { id } }`
    const ouvert = await executer(
      RETIRER,
      { id: ids.activite },
      { userId: ids.admin }
    )
    expect(code(ouvert)).toBe('SAISIE_INVALIDE')
    expect(await lire()).not.toBeNull()
    // Formulaire fermé, le contact se retire.
    await reglerActivite({ formulaireOuvert: false })
    try {
      const ferme = await executer(
        RETIRER,
        { id: ids.activite },
        { userId: ids.admin }
      )
      expect(ferme.errors).toBeUndefined()
    } finally {
      await reglerActivite({
        identite: { contactRecrutement: 'equipe@exemple.fr' },
      })
      invaliderConfigurationOrganisation()
    }
  })

  it('refuse d’ouvrir le formulaire sans contact', async () => {
    await reglerActivite({ identite: {} })
    invaliderConfigurationOrganisation()
    try {
      expect(code(await regler(ids.admin, { o: true }))).toBe('SAISIE_INVALIDE')
      expect(
        (
          await prisma.activite.findUniqueOrThrow({
            where: { id: ids.activite },
          })
        ).formulaireOuvert
      ).toBe(false)
    } finally {
      await reglerActivite({
        identite: { contactRecrutement: 'equipe@exemple.fr' },
      })
    }
  })
})
