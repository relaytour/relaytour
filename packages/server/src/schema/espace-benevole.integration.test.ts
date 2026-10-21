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
import type { CourrielJobData } from '../jobs/queues.ts'
import { empreinteJeton } from '../lib/abonnements-agenda.ts'
import { revoquerEspaces } from '../lib/espace-benevole.ts'

import { schema } from './index.ts'

// Espace bénévole et mails aux bénévoles (ADR 0041). La première acceptation
// envoie un seul mail, avec le lien personnel ; l'ouverture du lien ne confirme
// rien ; seule une adresse confirmée reçoit ensuite le mail de ses places. Le
// jeton naît à l'envoi, jamais dans la file (invariant 5).

const enFile = vi.hoisted(
  () =>
    [] as {
      sorte: string
      cible: Record<string, string>
      options: Record<string, unknown>
    }[]
)
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (
    sorte: string,
    cible: Record<string, string>,
    options: Record<string, unknown> = {}
  ) => {
    enFile.push({ sorte, cible, options })
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `espace-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  activite: '',
  edition: '',
  natation: '',
  finales: '',
  relais: '',
  accueil: '',
  appel: '',
  admin: '',
  referent: '',
  basketteuse: '',
  saisie: '',
}

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const r = await apollo.executeOperation(
    { query, variables },
    {
      contextValue: await buildContext(`ip-${s}`, userId, userId ? slug : null),
    }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const donnees = <T>(r: Awaited<ReturnType<typeof executer>>, champ: string) => {
  expect(r.errors).toBeUndefined()
  return (r.data as Record<string, T>)[champ]!
}

const h = (heure: string, jour = '2027-06-05') =>
  new Date(`${jour}T${heure}:00+02:00`)

const ACCEPTER = `mutation ($id: ID!) { accepterChoixCandidature(id: $id) { benevoleId } }`
const ESPACE = `query ($j: String!) { espaceBenevole(jeton: $j) { organisation activite nom confirme contact ics places { ref titre jour heureDebut heureFin lieu consignes confirmee } } }`

interface EspaceLu {
  nom: string
  confirme: boolean
  ics: string
  places: {
    ref: string
    titre: string
    confirmee: boolean
    consignes: string | null
  }[]
}

const lireEspace = async (jeton: string) =>
  (
    (await executer(null, ESPACE, { j: jeton })).data as {
      espaceBenevole: EspaceLu | null
    }
  ).espaceBenevole

/** Dépose une candidature, puis l'accepte sur ses séquences : rend la fiche. */
async function candidatAccepte(nom: string, sequences: string[]) {
  const courriel = `${nom.toLowerCase().replace(/\W/g, '')}-${s}@exemple.fr`
  const candidature = await prisma.candidature.create({
    data: {
      organisationId: ids.org,
      activiteId: ids.activite,
      editionId: ids.edition,
      appelId: ids.appel,
      nom,
      courriel,
      courrielEnAttente: courriel,
      accordLe: new Date(),
      choix: {
        create: sequences.map(sequenceId => ({
          sequenceId,
          statut: 'EN_ATTENTE',
        })),
      },
    },
    include: { choix: true },
  })
  let benevoleId = ''
  for (const choix of candidature.choix) {
    benevoleId = donnees<{ benevoleId: string }>(
      await executer(ids.admin, ACCEPTER, { id: choix.id }),
      'accepterChoixCandidature'
    ).benevoleId
  }
  return { benevoleId, candidatureId: candidature.id }
}

/** Compose le mail d'un job comme le worker, et rend le jeton du lien. */
async function envoyer(
  sorte: 'benevole-lien' | 'benevole-places',
  benevoleId: string
) {
  const message = await composer(prisma, {
    sorte,
    benevoleId,
    organisationId: ids.org,
    activiteId: ids.activite,
  } satisfies CourrielJobData)
  if (message === null) return null
  const jeton = /\/benevole\/([A-Za-z0-9_-]{43})/.exec(message.texte)?.[1]
  return { message, jeton: jeton! }
}

beforeEach(() => {
  enFile.length = 0
})

beforeAll(async () => {
  await apollo.start()
  ids.org = (
    await prisma.organisation.create({
      data: {
        slug,
        nom: 'Organisation',
        configuration: {
          slug,
          nom: 'Organisation',
          domainesCourrielAutorises: ['exemple.fr'],
        },
      },
    })
  ).id
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug,
        nom: 'Tournoi',
        groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
        identite: { contactRecrutement: 'benevoles@exemple.fr' },
      },
    })
  ).id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Tournoi 2027',
        debut: new Date('2027-06-05'),
        fin: new Date('2027-06-06'),
      },
    })
  ).id
  ids.natation = (
    await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: 'natation',
        nom: 'Natation',
        type: 'SPORT',
        groupe: 'sport',
      },
    })
  ).id
  for (const [cle, perimetreId, debut, fin] of [
    ['finales', ids.natation, '09:00', '12:00'],
    ['relais', ids.natation, '14:00', '16:00'],
    ['accueil', null, '08:00', '09:00'],
  ] as const) {
    ids[cle] = (
      await prisma.sequence.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          editionId: ids.edition,
          perimetreId,
          titre: cle,
          debut: h(debut),
          fin: h(fin),
          besoinBenevoles: 3,
          consignesBenevoles: 'Tenue claire.',
        },
      })
    ).id
  }
  for (const cle of ['admin', 'referent', 'basketteuse'] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: `${cle}-${slug}@exemple.fr`,
        name: `${cle} ${s}`,
        appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
      },
    })
  }
  await prisma.adminActivite.create({
    data: {
      userId: ids.admin,
      activiteId: ids.activite,
      organisationId: ids.org,
    },
  })
  await prisma.affectation.create({
    data: {
      userId: ids.referent,
      perimetreId: ids.natation,
      editionId: ids.edition,
    },
  })
  ids.appel = (
    await prisma.appelBenevoles.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        editionId: ids.edition,
        portee: 'PERIODE',
        nom: 'Appel',
        ouvertLe: new Date(),
        fermeLe: h('20:00', '2027-06-06'),
        empreinte: empreinteJeton(randomUUID()),
        fin: 'abcdef',
      },
    })
  ).id
  ids.saisie = (
    await prisma.benevole.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        nom: 'Fiche saisie',
        courriel: `saisie-${s}@exemple.fr`,
        accordLe: new Date(),
        creeParId: ids.admin,
      },
    })
  ).id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { organisationId: ids.org } })
  await prisma.candidature.deleteMany({ where: { organisationId: ids.org } })
  await prisma.appelBenevoles.deleteMany({ where: { organisationId: ids.org } })
  await prisma.sequence.deleteMany({ where: { organisationId: ids.org } })
  await prisma.benevole.deleteMany({ where: { organisationId: ids.org } })
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
  await prisma.organisation.deleteMany({ where: { id: ids.org } })
  await apollo.stop()
})

describe('premier mail', () => {
  it('part une seule fois, à la première acceptation, sans jeton dans la file', async () => {
    const { benevoleId } = await candidatAccepte('Lou Martin', [
      ids.finales,
      ids.relais,
    ])
    expect(enFile.filter(j => j.sorte === 'benevole-lien')).toEqual([
      expect.objectContaining({ cible: { benevoleId } }),
    ])
    // La seconde acceptation, avant confirmation, n'envoie rien.
    expect(enFile.filter(j => j.sorte === 'benevole-places')).toEqual([])
    expect(JSON.stringify(enFile)).not.toMatch(/[A-Za-z0-9_-]{43}/)
  })

  it('porte le lien, les places à confirmer et l’avertissement ; le jeton naît à l’envoi', async () => {
    const { benevoleId } = await candidatAccepte('Ana Diaz', [ids.finales])
    const envoi = await envoyer('benevole-lien', benevoleId)
    expect(envoi!.message.sujet).toBe(
      'Organisation · Tournoi : votre participation'
    )
    expect(envoi!.message.texte).toContain('finales')
    expect(envoi!.message.texte).toContain('à confirmer')
    expect(envoi!.message.texte).toContain('ignorez ce message')
    const fiche = await prisma.benevole.findUniqueOrThrow({
      where: { id: benevoleId },
    })
    expect(fiche.espaceEmpreinte).toBe(empreinteJeton(envoi!.jeton))
  })

  it('ne part jamais vers une fiche saisie à la main', async () => {
    await executer(
      ids.admin,
      `mutation ($sq: ID!, $b: ID) { placerBenevole(sequenceId: $sq, benevoleId: $b) { id } }`,
      { sq: ids.accueil, b: ids.saisie }
    )
    expect(enFile).toEqual([])
  })
})

describe('espace', () => {
  it('s’ouvre sans confirmer, puis confirme toutes les places par le bouton', async () => {
    const { benevoleId } = await candidatAccepte('Noa Petit', [
      ids.finales,
      ids.relais,
    ])
    const { jeton } = (await envoyer('benevole-lien', benevoleId))!
    const ouvert = await lireEspace(jeton)
    expect(ouvert).toMatchObject({ nom: 'Noa Petit', confirme: false })
    expect(
      ouvert!.places.map(p => [p.titre, p.confirmee, p.consignes])
    ).toEqual([
      ['finales', false, 'Tenue claire.'],
      ['relais', false, 'Tenue claire.'],
    ])
    expect(ouvert!.ics).toContain('BEGIN:VCALENDAR')
    expect(ouvert!.ics).toContain('SUMMARY:finales')
    expect(ouvert!.ics).not.toContain(jeton)
    expect(JSON.stringify(ouvert)).not.toContain(`noapetit-${s}`)
    // L'ouverture ne confirme rien.
    expect(
      (await prisma.benevole.findUniqueOrThrow({ where: { id: benevoleId } }))
        .courrielConfirmeLe
    ).toBeNull()

    expect(
      donnees<boolean>(
        await executer(
          null,
          `mutation ($j: String!) { confirmerParticipation(jeton: $j) }`,
          {
            j: jeton,
          }
        ),
        'confirmerParticipation'
      )
    ).toBe(true)
    const confirme = await lireEspace(jeton)
    expect(confirme!.confirme).toBe(true)
    expect(confirme!.places.every(p => p.confirmee)).toBe(true)
  })

  it('annonce ensuite les places changées à une adresse confirmée, avec un nouveau lien', async () => {
    const { benevoleId } = await candidatAccepte('Inès Roy', [ids.finales])
    const { jeton } = (await envoyer('benevole-lien', benevoleId))!
    await executer(
      null,
      `mutation ($j: String!) { confirmerParticipation(jeton: $j) }`,
      {
        j: jeton,
      }
    )
    enFile.length = 0
    await executer(
      ids.admin,
      `mutation ($sq: ID!, $b: ID) { placerBenevole(sequenceId: $sq, benevoleId: $b) { id } }`,
      { sq: ids.accueil, b: benevoleId }
    )
    expect(enFile.map(j => [j.sorte, j.cible, j.options.delai])).toEqual([
      ['benevole-places', { benevoleId }, 120_000],
    ])
    const envoi = await envoyer('benevole-places', benevoleId)
    expect(envoi!.message.texte).toContain('accueil')
    expect(envoi!.message.texte).toContain('à confirmer')
    // Le lien précédent cesse de répondre.
    expect(await lireEspace(jeton)).toBeNull()
    expect(await lireEspace(envoi!.jeton)).not.toBeNull()
  })

  it('annonce un horaire changé à une adresse confirmée', async () => {
    const { benevoleId } = await candidatAccepte('Tom Lenoir', [ids.relais])
    const { jeton } = (await envoyer('benevole-lien', benevoleId))!
    await executer(
      null,
      `mutation ($j: String!) { confirmerParticipation(jeton: $j) }`,
      {
        j: jeton,
      }
    )
    const version = (
      await prisma.sequence.findUniqueOrThrow({ where: { id: ids.relais } })
    ).version
    const places = await prisma.placeSequence.findMany({
      where: { sequenceId: ids.relais },
    })
    enFile.length = 0
    const r = await executer(
      ids.referent,
      `mutation ($id: ID!, $pl: [PlaceSequenceInput!], $v: Int!) { modifierSequence(id: $id, titre: "relais", jour: "2027-06-05", heureDebut: "14:30", heureFin: "16:00", places: $pl, versionAttendue: $v) { id } }`,
      {
        id: ids.relais,
        pl: places.map(p => ({ benevoleId: p.benevoleId, role: p.role })),
        v: version,
      }
    )
    expect(r.errors).toBeUndefined()
    expect(
      enFile
        .filter(j => j.sorte === 'benevole-places')
        .map(j => j.cible.benevoleId)
    ).toContain(benevoleId)
  })

  it('quitte une place et prévient le périmètre ; une fiche non confirmée qui décline tout disparaît', async () => {
    const { benevoleId } = await candidatAccepte('Zoé Blanc', [ids.finales])
    const { jeton } = (await envoyer('benevole-lien', benevoleId))!
    const espace = await lireEspace(jeton)
    const QUITTER = `mutation ($j: String!, $r: String!) { quitterPlace(jeton: $j, ref: $r) }`
    expect(
      (await executer(null, QUITTER, { j: jeton, r: 'inconnue' })).errors?.[0]
        ?.message
    ).toMatch(/n’existe plus/)
    donnees(
      await executer(null, QUITTER, { j: jeton, r: espace!.places[0]!.ref }),
      'quitterPlace'
    )
    expect(await prisma.benevole.count({ where: { id: benevoleId } })).toBe(0)
    const notification = await prisma.notification.findFirst({
      where: {
        type: 'BENEVOLE_RETIRE',
        userId: ids.referent,
        sequenceId: ids.finales,
      },
    })
    expect(notification).not.toBeNull()
    const liste = donnees<{ message: string; lien: string }[]>(
      await executer(
        ids.referent,
        `query { notifications { message lien } }`
      ),
      'notifications'
    )
    expect(liste.map(n => n.message)).toContainEqual(
      expect.stringMatching(/a quitté la séquence « finales »/)
    )
  })

  it('supprime la fiche confirmée seulement sans place à venir', async () => {
    const { benevoleId } = await candidatAccepte('Léo Brun', [ids.relais])
    const { jeton } = (await envoyer('benevole-lien', benevoleId))!
    await executer(
      null,
      `mutation ($j: String!) { confirmerParticipation(jeton: $j) }`,
      {
        j: jeton,
      }
    )
    const SUPPRIMER = `mutation ($j: String!) { supprimerMaFiche(jeton: $j) }`
    expect(
      (await executer(null, SUPPRIMER, { j: jeton })).errors?.[0]?.message
    ).toMatch(/Quittez d’abord/)
    const espace = await lireEspace(jeton)
    await executer(
      null,
      `mutation ($j: String!, $r: String!) { quitterPlace(jeton: $j, ref: $r) }`,
      {
        j: jeton,
        r: espace!.places[0]!.ref,
      }
    )
    // Confirmée, la fiche reste après le retrait.
    expect(await prisma.benevole.count({ where: { id: benevoleId } })).toBe(1)
    donnees(await executer(null, SUPPRIMER, { j: jeton }), 'supprimerMaFiche')
    expect(await prisma.benevole.count({ where: { id: benevoleId } })).toBe(0)
  })

  it('répond « lien plus valable » à un jeton inconnu', async () => {
    expect(await lireEspace('x'.repeat(43))).toBeNull()
    expect(
      (
        await executer(
          null,
          `mutation ($j: String!) { confirmerParticipation(jeton: $j) }`,
          {
            j: 'x'.repeat(43),
          }
        )
      ).errors?.[0]?.message
    ).toMatch(/plus valable/)
  })
})

describe('relance', () => {
  const RENVOYER = `mutation ($b: ID!) { renvoyerLienBenevole(benevoleId: $b) }`

  it('renvoie le lien une seule fois, par une personne qui lit les coordonnées', async () => {
    const { benevoleId } = await candidatAccepte('Mia Leroy', [ids.finales])
    enFile.length = 0
    expect(
      (await executer(ids.basketteuse, RENVOYER, { b: benevoleId })).errors?.[0]
        ?.extensions?.code
    ).toBe('FORBIDDEN')
    expect(
      donnees<boolean>(
        await executer(ids.referent, RENVOYER, { b: benevoleId }),
        'renvoyerLienBenevole'
      )
    ).toBe(true)
    expect(enFile).toEqual([
      expect.objectContaining({
        sorte: 'benevole-lien',
        cible: { benevoleId },
      }),
    ])
    expect(
      (await executer(ids.admin, RENVOYER, { b: benevoleId })).errors?.[0]
        ?.message
    ).toMatch(/déjà été renvoyé/)
    // Une fiche saisie à la main n'a jamais de lien.
    expect(
      (await executer(ids.admin, RENVOYER, { b: ids.saisie })).errors?.[0]
        ?.message
    ).toMatch(/pas reçu de premier lien/)
  })
})

describe('révocation', () => {
  it('révoque le lien à l’archivage de la dernière période de la fiche', async () => {
    const { benevoleId } = await candidatAccepte('Eva Morel', [ids.finales])
    const { jeton } = (await envoyer('benevole-lien', benevoleId))!
    await prisma.edition.update({
      where: { id: ids.edition },
      data: { statut: 'ARCHIVEE' },
    })
    try {
      expect(
        await revoquerEspaces(prisma, { organisationId: ids.org })
      ).toBeGreaterThan(0)
      expect(await lireEspace(jeton)).toBeNull()
    } finally {
      await prisma.edition.update({
        where: { id: ids.edition },
        data: { statut: 'PREPARATION' },
      })
    }
  })
})
