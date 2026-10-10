import { randomUUID } from 'node:crypto'

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

import { ErreurEquipe, importerEquipe, lireEquipe } from './equipe-import.ts'

// Import d'une équipe depuis le serveur (ADR 0013) : additif, rejouable, sans mail
// par défaut. Le fichier crée sa propre organisation.

const enFile = vi.hoisted(() => [] as { sorte: string; cible: unknown }[])
vi.mock('../courriel/file.ts', () => ({
  mettreEnFile: (sorte: string, cible: unknown) => {
    enFile.push({ sorte, cible })
    return Promise.resolve()
  },
}))

const s = randomUUID().slice(0, 8)
const slug = `import-equipe-${s}`
const ids = { org: '', activite: '', edition: '', ancienne: '', membre: '' }
const adresse = (cle: string) => `${cle}-${slug}@exemple.fr`

const FICHIER = `
personnes:
  - nom: Rémy ${s}
    adresse: ${adresse('remy').toUpperCase()}
    affectations: [ville, restauration]
    contactPrincipal: [ville, restauration]
  - nom: Julien ${s}
    adresse: ${adresse('julien')}
    affectations: [ville]
    souhaits: [soirees, ville]
  - nom: Nom mis à jour ${s}
    adresse: ${adresse('membre')}
    affectations: [soirees]
    souhaits: [restauration]
`

const options = () => ({
  organisationId: ids.org,
  activiteId: ids.activite,
  annee: 2027,
})

beforeAll(async () => {
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: 'Organisation',
      configuration: {},
      activites: {
        create: {
          slug,
          nom: 'Tournoi',
          groupes: [{ cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' }],
        },
      },
    },
    include: { activites: true },
  })
  ids.org = organisation.id
  ids.activite = organisation.activites[0]!.id
  for (const [cle, annee, statut] of [
    ['edition', 2027, 'PREPARATION'],
    ['ancienne', 2025, 'ARCHIVEE'],
  ] as const) {
    ids[cle] = (
      await prisma.edition.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          annee,
          nom: `Tournoi ${annee}`,
          debut: new Date(`${annee}-08-27`),
          fin: new Date(`${annee}-08-29`),
          statut,
        },
      })
    ).id
  }
  for (const cle of ['ville', 'restauration', 'soirees']) {
    await prisma.perimetre.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        slug: cle,
        nom: cle,
        type: 'POLE',
        groupe: 'pole',
      },
    })
  }
  ids.membre = randomUUID()
  await prisma.user.create({
    data: {
      id: ids.membre,
      email: adresse('membre'),
      name: `Membre ${s}`,
      appartenances: { create: { organisationId: ids.org, role: 'MEMBRE' } },
    },
  })
})

afterAll(async () => {
  await prisma.souhait.deleteMany({
    where: { perimetre: { organisationId: ids.org } },
  })
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
  await prisma.$disconnect()
})

beforeEach(() => {
  enFile.length = 0
})

const compter = async () => ({
  comptes: await prisma.user.count({
    where: { email: { endsWith: `-${slug}@exemple.fr` } },
  }),
  affectations: await prisma.affectation.count({
    where: { perimetre: { organisationId: ids.org } },
  }),
  souhaits: await prisma.souhait.count({
    where: { perimetre: { organisationId: ids.org } },
  }),
})

describe('lecture du fichier', () => {
  it('refuse une adresse en double, un contact principal non affecté et deux contacts pour un périmètre', () => {
    const erreurs = (texte: string) => {
      try {
        lireEquipe(texte)
        return ''
      } catch (e) {
        return (e as ErreurEquipe).erreurs.join('\n')
      }
    }
    expect(
      erreurs(`personnes:
  - { nom: A, adresse: a@exemple.fr }
  - { nom: B, adresse: A@exemple.fr }`)
    ).toMatch(/adresse déjà listée/)
    expect(
      erreurs(`personnes:
  - { nom: A, adresse: a@exemple.fr, contactPrincipal: [ville] }`)
    ).toMatch(/sans y être affecté/)
    expect(
      erreurs(`personnes:
  - { nom: A, adresse: a@exemple.fr, affectations: [ville], contactPrincipal: [ville] }
  - { nom: B, adresse: b@exemple.fr, affectations: [ville], contactPrincipal: [ville] }`)
    ).toMatch(/a déjà un contact principal/)
    for (const liste of ['affectations', 'souhaits']) {
      expect(
        erreurs(`personnes:
  - { nom: A, adresse: a@exemple.fr, ${liste}: [ville, soirees, ville] }`)
      ).toMatch(`personnes.0.${liste} : périmètre répété (ville)`)
    }
    expect(
      erreurs(`personnes:
  - { nom: A, adresse: a@exemple.fr, role: admin }`)
    ).not.toBe('')
  })
})

describe('import', () => {
  it('refuse un périmètre inconnu et une période archivée, sans rien écrire', async () => {
    const avant = await compter()
    await expect(
      importerEquipe(
        prisma,
        lireEquipe(`personnes:
  - { nom: A, adresse: ${adresse('a')}, affectations: [inconnu] }`),
        options()
      )
    ).rejects.toThrow(/périmètres inconnus/)
    await expect(
      importerEquipe(prisma, lireEquipe(FICHIER), {
        ...options(),
        annee: 2025,
      })
    ).rejects.toThrow(/archivée/)
    expect(await compter()).toEqual(avant)
  })

  it('n’écrit rien en simulation', async () => {
    const avant = await compter()
    const rapport = await importerEquipe(prisma, lireEquipe(FICHIER), {
      ...options(),
      simulation: true,
    })
    expect(rapport.comptesCrees).toHaveLength(2)
    expect(await compter()).toEqual(avant)
    expect(enFile).toEqual([])
  })

  it('crée les comptes, les affectations, les contacts principaux et les souhaits, sans mail', async () => {
    const rapport = await importerEquipe(prisma, lireEquipe(FICHIER), options())
    expect(rapport.comptesCrees).toEqual([`Rémy ${s}`, `Julien ${s}`])
    expect(rapport.comptesExistants).toEqual([`Nom mis à jour ${s}`])
    expect(rapport.nomsDifferents).toHaveLength(1)
    expect(rapport.affectationsCreees).toHaveLength(4)
    expect(rapport.souhaitsCrees).toEqual([
      `Julien ${s} → soirees`,
      `Nom mis à jour ${s} → restauration`,
    ])
    expect(rapport.souhaitsIgnores).toEqual([`Julien ${s} → ville (affecté·e)`])
    expect(enFile).toEqual([])

    // L'adresse est normalisée ; le nom d'un compte existant ne change pas.
    const remy = await prisma.user.findUniqueOrThrow({
      where: { email: adresse('remy') },
      select: {
        appartenances: { select: { role: true } },
        affectations: {
          select: {
            contactPrincipal: true,
            perimetre: { select: { slug: true } },
          },
        },
      },
    })
    expect(remy.appartenances).toEqual([{ role: 'MEMBRE' }])
    expect(
      remy.affectations
        .filter(a => a.contactPrincipal)
        .map(a => a.perimetre.slug)
        .sort()
    ).toEqual(['restauration', 'ville'])
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: ids.membre },
          select: { name: true },
        })
      ).name
    ).toBe(`Membre ${s}`)
  })

  it('se rejoue sans rien créer', async () => {
    const avant = await compter()
    const rapport = await importerEquipe(prisma, lireEquipe(FICHIER), options())
    expect(rapport.comptesCrees).toEqual([])
    expect(rapport.affectationsCreees).toEqual([])
    expect(rapport.souhaitsCrees).toEqual([])
    expect(await compter()).toEqual(avant)
  })

  it('envoie les invitations et les mails d’équipe avec l’option d’envoi', async () => {
    const fichier = `
personnes:
  - nom: Nouvelle ${s}
    adresse: ${adresse('nouvelle')}
    affectations: [soirees]
  - nom: Membre ${s}
    adresse: ${adresse('membre')}
    affectations: [restauration]
`
    await importerEquipe(prisma, lireEquipe(fichier), {
      ...options(),
      envoyerMails: true,
    })
    const nouvelle = await prisma.user.findUniqueOrThrow({
      where: { email: adresse('nouvelle') },
      select: { id: true },
    })
    expect(enFile).toEqual([
      { sorte: 'invitation', cible: { userId: nouvelle.id } },
      { sorte: 'equipe', cible: { userId: ids.membre } },
    ])
  })

  it('laisse en attente un compte connu hors de l’organisation, avec ses périmètres et son contact principal', async () => {
    const externe = randomUUID()
    await prisma.user.create({
      data: { id: externe, email: adresse('externe'), name: `Compte ${s}` },
    })
    const fichier = `
personnes:
  - nom: Saisie ${s}
    adresse: ${adresse('externe')}
    affectations: [soirees]
    contactPrincipal: [soirees]
    souhaits: [restauration]
`
    const avant = await compter()
    const rapport = await importerEquipe(prisma, lireEquipe(fichier), {
      ...options(),
      envoyerMails: true,
    })
    // ADR 0030 : rien ne s'écrit au nom du compte, et son nom ne se lit pas.
    expect(rapport.invitationsEnAttente).toEqual([`Saisie ${s}`])
    expect(rapport.nomsDifferents).toEqual([])
    expect(rapport.affectationsCreees).toEqual([])
    expect(await compter()).toEqual(avant)
    const invitation = await prisma.invitationOrganisation.findUniqueOrThrow({
      where: {
        organisationId_userId: { organisationId: ids.org, userId: externe },
      },
    })
    expect(invitation).toMatchObject({
      origine: 'IMPORT',
      inviteParId: null,
      nom: `Saisie ${s}`,
      role: 'MEMBRE',
    })
    const [lot] = invitation.lots as {
      affectes: string[]
      souhaites: string[]
      contactPrincipal: string[]
    }[]
    expect(lot!.affectes).toHaveLength(1)
    expect(lot!.contactPrincipal).toEqual(lot!.affectes)
    expect(lot!.souhaites).toHaveLength(1)
    expect(enFile).toEqual([
      { sorte: 'invitation', cible: { userId: externe } },
    ])
    // Un import rejoué dans l'heure ne renvoie pas le mail d'invitation.
    enFile.length = 0
    const rejoue = await importerEquipe(prisma, lireEquipe(fichier), {
      ...options(),
      envoyerMails: true,
    })
    expect(rejoue.invitationsEnAttente).toEqual([`Saisie ${s}`])
    expect(rejoue.mails.invitations).toBe(0)
    expect(enFile).toEqual([])
  })
})
