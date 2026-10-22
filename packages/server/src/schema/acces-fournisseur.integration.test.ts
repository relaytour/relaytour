import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { verifierAcces } from '../espace-fichiers/acces.ts'
import { remplacerEspacePourLesTests } from '../espace-fichiers/index.ts'
import {
  annuaireEnMemoire,
  espaceEnMemoire,
} from '../espace-fichiers/memoire.ts'
import type { CompteAnnuaire } from '../espace-fichiers/types.ts'

import { schema } from './index.ts'

// Vérification des accès chez le fournisseur (ADR 0044). Relaytour compare les
// personnes qu'un dossier lié attend aux droits du dossier, lus dans un annuaire
// en mémoire. Les lectures citent des adresses : elles sont réservées aux admins
// de l'organisation.

const s = randomUUID().slice(0, 8)
const slug = `acces-${s}`
const slugAutre = `acces-autre-${s}`
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  org: '',
  orgAutre: '',
  activite: '',
  edition: '',
  natation: '',
  accueil: '',
  admin: '',
  adminActivite: '',
  nageuse: '', // a un compte, et un droit direct
  nageur: '', // sans compte chez le fournisseur
  accueillante: '', // contact principal de l'accueil, invitée sous une autre adresse
  accueil2: '', // à l'accueil, sans être contact principal
  externe: '', // admin de l'autre organisation
  dNatation: '',
  dCommun: '',
  dPoles: '',
}
const adresse = (cle: string) => `${cle}-${slug}@exemple.fr`

async function executer(
  userId: string | null,
  query: string,
  variables: Record<string, unknown> = {},
  organisation = slug
) {
  const r = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, organisation) }
  )
  if (r.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return r.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const comptes: CompteAnnuaire[] = [
  { identifiant: 'u-nageuse', adresse: '', nom: 'Nageuse', invite: false },
  {
    identifiant: 'u-admin-activite',
    adresse: '',
    nom: 'Admin activité',
    invite: false,
  },
  {
    identifiant: 'u-accueillante',
    adresse: `accueil.perso-${s}@exemple.net`,
    nom: 'Accueillante',
    invite: true,
  },
  {
    identifiant: 'u-coordination',
    adresse: `coordination-${s}@exemple.net`,
    nom: 'Coordination',
    invite: false,
  },
]

const VERIFICATION = `query ($a: ID!) { verificationAcces(activiteId: $a) {
  dossier { nom } lignes { nom etat via perimetreIds personne { email } }
} }`
const COMPTES = `{ comptesFournisseur { personne { email } etat adresseSaisie } }`
const SAISIR = `mutation ($u: ID!, $a: String) { saisirAdresseFournisseur(userId: $u, adresse: $a) { adresseSaisie } }`
const VERIFIER = `mutation { verifierAccesFournisseur }`

type Ligne = {
  nom: string
  etat: string
  via: string | null
  perimetreIds: string[]
  personne: { email: string } | null
}

async function lignes(nomDossier: string): Promise<Ligne[]> {
  const r = await executer(ids.admin, VERIFICATION, { a: ids.activite })
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      verificationAcces: { dossier: { nom: string }; lignes: Ligne[] }[]
    }
  ).verificationAcces.find(v => v.dossier.nom === nomDossier)!.lignes
}

const etats = (l: Ligne[]) =>
  Object.fromEntries(l.map(x => [x.nom, [x.etat, x.via]]))

beforeAll(async () => {
  await apollo.start()
  for (const [cle, slugOrg] of [
    ['org', slug],
    ['orgAutre', slugAutre],
  ] as const) {
    ids[cle] = (
      await prisma.organisation.create({
        data: {
          slug: slugOrg,
          nom: `Organisation ${slugOrg}`,
          configuration: {},
        },
      })
    ).id
  }
  ids.activite = (
    await prisma.activite.create({
      data: {
        organisationId: ids.org,
        slug,
        nom: 'Rencontres',
        groupes: [
          { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
        ],
      },
    })
  ).id
  ids.edition = (
    await prisma.edition.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        annee: 2027,
        nom: 'Rencontres 2027',
        debut: new Date('2027-08-27'),
        fin: new Date('2027-08-29'),
        statut: 'PREPARATION',
      },
    })
  ).id
  for (const [cle, groupe] of [
    ['natation', 'sport'],
    ['accueil', 'pole'],
  ] as const) {
    ids[cle] = (
      await prisma.perimetre.create({
        data: {
          organisationId: ids.org,
          activiteId: ids.activite,
          slug: cle,
          nom: cle,
          type: groupe === 'sport' ? 'SPORT' : 'POLE',
          groupe,
        },
      })
    ).id
  }
  for (const [cle, role, organisationId] of [
    ['admin', 'ADMIN', ids.org],
    ['adminActivite', 'MEMBRE', ids.org],
    ['nageuse', 'MEMBRE', ids.org],
    ['nageur', 'MEMBRE', ids.org],
    ['accueillante', 'MEMBRE', ids.org],
    ['accueil2', 'MEMBRE', ids.org],
    ['externe', 'ADMIN', ids.orgAutre],
  ] as const) {
    ids[cle] = randomUUID()
    await prisma.user.create({
      data: {
        id: ids[cle],
        email: adresse(cle.toLowerCase()),
        name: cle,
        appartenances: { create: { organisationId, role } },
      },
    })
  }
  comptes[0]!.adresse = adresse('nageuse')
  comptes[1]!.adresse = adresse('adminactivite')
  await prisma.adminActivite.create({
    data: {
      userId: ids.adminActivite,
      activiteId: ids.activite,
      organisationId: ids.org,
    },
  })
  for (const [userId, perimetreId, contactPrincipal] of [
    [ids.nageuse, ids.natation, true],
    [ids.nageur, ids.natation, false],
    [ids.accueillante, ids.accueil, true],
    [ids.accueil2, ids.accueil, false],
  ] as const) {
    await prisma.affectation.create({
      data: { userId, perimetreId, editionId: ids.edition, contactPrincipal },
    })
  }
  await prisma.connexionFichiers.create({
    data: {
      organisationId: ids.org,
      fournisseur: 'SHAREPOINT',
      compte: 'Coordination',
      jeton: 'jeton-de-test',
      portee: 'ANNUAIRE',
    },
  })
  const lier = (element: string, nom: string, donnees: object) =>
    prisma.dossierLie.create({
      data: {
        organisationId: ids.org,
        activiteId: ids.activite,
        fournisseur: 'SHAREPOINT',
        emplacement: 'bibliotheque',
        element,
        nom,
        ...donnees,
      },
    })
  ids.dNatation = (
    await lier('d-natation', 'Natation', {
      perimetres: { create: { perimetreId: ids.natation } },
    })
  ).id
  ids.dCommun = (await lier('d-commun', 'Commun', { touteActivite: true })).id
  ids.dPoles = (
    await lier('d-poles', 'Pôles', {
      attendus: 'CONTACTS_PRINCIPAUX',
      groupes: { create: { groupe: 'pole' } },
    })
  ).id
  const annuaire = annuaireEnMemoire({
    comptes,
    droits: {
      'd-natation': [
        {
          identifiant: 'p1',
          beneficiaire: {
            type: 'personne',
            identifiant: 'u-nageuse',
            adresse: null,
            nom: 'Nageuse',
          },
          role: 'ECRITURE',
          herite: false,
        },
        {
          identifiant: 'p2',
          beneficiaire: {
            type: 'groupe',
            identifiant: 'g-sports',
            nom: 'Sports',
          },
          role: 'LECTURE',
          herite: true,
        },
      ],
      'd-commun': [
        {
          identifiant: 'p3',
          beneficiaire: { type: 'domaine', nom: 'Toute l’organisation' },
          role: 'LECTURE',
          herite: false,
        },
        {
          identifiant: 'p4',
          beneficiaire: {
            type: 'groupe',
            identifiant: 'site:3',
            nom: 'Membres du site',
          },
          role: 'ECRITURE',
          herite: true,
        },
      ],
      'd-poles': [
        {
          identifiant: 'p5',
          beneficiaire: {
            type: 'groupe',
            identifiant: 'g-poles',
            nom: 'Pôles',
          },
          role: 'ECRITURE',
          herite: false,
        },
      ],
    },
    groupes: {
      'g-sports': ['u-coordination'],
      'g-poles': ['u-accueillante'],
      'site:3': null,
    },
  })
  remplacerEspacePourLesTests(() => espaceEnMemoire([], annuaire))
})

afterAll(async () => {
  remplacerEspacePourLesTests(null)
  await prisma.dossierLie.deleteMany({ where: { organisationId: ids.org } })
  await prisma.connexionFichiers.deleteMany({
    where: { organisationId: ids.org },
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
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.org, ids.orgAutre] } },
  })
  await apollo.stop()
  await prisma.$disconnect()
})

describe('vérification des accès', () => {
  beforeAll(async () => {
    await verifierAcces(ids.org)
  })

  it('compare les membres attendus aux droits directs et aux groupes', async () => {
    const natation = await lignes('Natation')
    expect(etats(natation)).toEqual({
      nageuse: ['A_ACCES', 'direct'],
      nageur: ['SANS_COMPTE', null],
      // Un compte du groupe que personne n'attend : un nom, sans adresse.
      Coordination: ['EN_TROP', 'groupe:Sports'],
    })
    expect(natation.find(l => l.nom === 'nageuse')!.perimetreIds).toEqual([
      ids.natation,
    ])
    expect(natation.find(l => l.nom === 'Coordination')!.personne).toBeNull()
  })

  it('attend toute l’équipe et les admins de l’activité pour un dossier de toute l’activité', async () => {
    expect(etats(await lignes('Commun'))).toEqual({
      nageuse: ['A_ACCES', 'domaine'],
      nageur: ['SANS_COMPTE', null],
      accueillante: ['SANS_COMPTE', null],
      accueil2: ['SANS_COMPTE', null],
      adminActivite: ['A_ACCES', 'domaine'],
    })
  })

  it('n’attend que les contacts principaux quand le dossier le règle', async () => {
    expect(etats(await lignes('Pôles'))).toEqual({
      accueillante: ['SANS_COMPTE', null],
      // Son compte, cherché sous une autre adresse, a un droit sans être attendu.
      Accueillante: ['EN_TROP', 'groupe:Pôles'],
    })
  })

  it('suit l’adresse saisie par un admin, et un invité n’entre pas par le domaine', async () => {
    const r = await executer(ids.admin, SAISIR, {
      u: ids.accueillante,
      a: `Accueil.Perso-${s}@exemple.net`,
    })
    expect(r.data).toEqual({
      saisirAdresseFournisseur: {
        adresseSaisie: `accueil.perso-${s}@exemple.net`,
      },
    })
    await verifierAcces(ids.org)
    expect(etats(await lignes('Pôles'))).toEqual({
      accueillante: ['A_ACCES', 'groupe:Pôles'],
    })
    // Le groupe du site ne se lit pas : il couvre peut-être l'invitée.
    expect(etats(await lignes('Commun')).accueillante).toEqual([
      'INCONNU',
      null,
    ])
    const liste = await executer(ids.admin, COMPTES)
    expect(liste.errors).toBeUndefined()
    const parAdresse = Object.fromEntries(
      (
        liste.data as {
          comptesFournisseur: {
            personne: { email: string }
            etat: string | null
          }[]
        }
      ).comptesFournisseur.map(c => [c.personne.email, c.etat])
    )
    expect(parAdresse).toMatchObject({
      [adresse('nageuse')]: 'TROUVE',
      [adresse('nageur')]: 'ABSENT',
      [adresse('accueillante')]: 'INVITE',
      // L'admin de l'organisation n'est attendu par aucun dossier.
      [adresse('admin')]: null,
    })
    // Un membre d'une autre organisation n'y figure jamais.
    expect(parAdresse[adresse('externe')]).toBeUndefined()
  })

  it('refuse les lectures et les gestes à toute personne qui n’est pas admin de l’organisation', async () => {
    for (const [qui, organisation] of [
      [null, slug],
      [ids.adminActivite, slug],
      [ids.nageuse, slug],
      [ids.externe, slug],
    ] as const) {
      for (const [query, variables] of [
        [VERIFICATION, { a: ids.activite }],
        [COMPTES, {}],
        [VERIFIER, {}],
        [SAISIR, { u: ids.nageuse, a: 'pirate@exemple.net' }],
      ] as const) {
        expect(
          code(await executer(qui, query, variables, organisation))
        ).toMatch(/FORBIDDEN|UNAUTHENTICATED/)
      }
    }
    // L'activité d'une autre organisation se refuse aussi à son admin.
    expect(
      code(
        await executer(
          ids.externe,
          VERIFICATION,
          { a: ids.activite },
          slugAutre
        )
      )
    ).toBe('FORBIDDEN')
    // Une adresse saisie pour un membre d'une autre organisation est refusée.
    expect(
      code(await executer(ids.admin, SAISIR, { u: ids.externe, a: null }))
    ).toBe('FORBIDDEN')
  })

  it('demande une connexion qui lit l’annuaire', async () => {
    await prisma.connexionFichiers.update({
      where: { organisationId: ids.org },
      data: { portee: 'FICHIERS' },
    })
    try {
      expect(code(await executer(ids.admin, VERIFIER))).toBe('SAISIE_INVALIDE')
    } finally {
      await prisma.connexionFichiers.update({
        where: { organisationId: ids.org },
        data: { portee: 'ANNUAIRE' },
      })
    }
    expect((await executer(ids.admin, VERIFIER)).data).toEqual({
      verifierAccesFournisseur: true,
    })
  })
})
