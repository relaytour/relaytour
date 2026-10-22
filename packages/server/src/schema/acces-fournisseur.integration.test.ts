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
  type AnnuaireMemoire,
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
// L'annuaire en mémoire : les écritures des propositions le modifient.
let donnees: AnnuaireMemoire

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
  donnees = {
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
  }
  const annuaire = annuaireEnMemoire(donnees)
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

  it('tient la requête de l’écran dans la limite de complexité', async () => {
    // La requête de l'espace organisateur (packages/orga/src/lib/espace-fichiers.ts).
    const r = await executer(
      ids.admin,
      `query ($a: ID!) { verificationAcces(activiteId: $a) { verifieLe
        dossier { id nom touteActivite attendus accesFournisseur groupeFournisseurNom roleFournisseur ajoutsAutomatiques invitationFournisseur groupes perimetres { id nom couleur } }
        propositions { id action etat erreur personne { id nom email } }
        perimetres { id nom couleur }
        lignes { nom etat via perimetreIds personne { id email } } } }`,
      { a: ids.activite }
    )
    expect(r.errors).toBeUndefined()
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

// ── Propositions d'accès (ADR 0044) ───────────────────────────────────────────

const REGLER = `mutation ($id: ID!, $mode: AccesFournisseurDossier!, $g: ID, $auto: Boolean!) {
  reglerAccesFournisseur(id: $id, mode: $mode, groupeId: $g, role: LECTURE, ajoutsAutomatiques: $auto, invitation: false) { accesFournisseur groupeFournisseurNom }
}`
const PROPOSITIONS = `query ($a: ID!) { verificationAcces(activiteId: $a) {
  dossier { nom } propositions { id action etat personne { email } }
} }`
const APPLIQUER = `mutation ($id: ID!) { appliquerPropositionAcces(id: $id) }`
const ECARTER = `mutation ($id: ID!) { ecarterPropositionAcces(id: $id) }`
const GROUPES = `query ($id: ID!) { groupesDuDossier(id: $id) { identifiant nom } }`

type Proposition = {
  id: string
  action: string
  etat: string
  personne: { email: string }
}

async function propositions(nomDossier: string): Promise<Proposition[]> {
  const r = await executer(ids.admin, PROPOSITIONS, { a: ids.activite })
  expect(r.errors).toBeUndefined()
  return (
    r.data as {
      verificationAcces: {
        dossier: { nom: string }
        propositions: Proposition[]
      }[]
    }
  ).verificationAcces.find(v => v.dossier.nom === nomDossier)!.propositions
}

const resume = (p: Proposition[]) =>
  p.map(x => `${x.action}:${x.personne.email}:${x.etat}`).sort()

describe('propositions d’accès', () => {
  it('exigent une connexion qui gère les accès, et un admin de l’organisation', async () => {
    const variables = { id: ids.dNatation, mode: 'PARTAGE', auto: false }
    expect(code(await executer(ids.admin, REGLER, variables))).toBe(
      'SAISIE_INVALIDE'
    )
    await prisma.connexionFichiers.update({
      where: { organisationId: ids.org },
      data: { portee: 'GESTION' },
    })
    for (const qui of [ids.adminActivite, ids.nageuse, null]) {
      expect(code(await executer(qui, REGLER, variables))).toMatch(
        /FORBIDDEN|UNAUTHENTICATED/
      )
    }
    expect(
      code(await executer(ids.externe, REGLER, variables, slugAutre))
    ).toBe('FORBIDDEN')
    const r = await executer(ids.admin, REGLER, variables)
    expect(r.data).toEqual({
      reglerAccesFournisseur: {
        accesFournisseur: 'PARTAGE',
        groupeFournisseurNom: null,
      },
    })
  })

  it('proposent un partage pour une personne sans accès, et l’appliquent', async () => {
    await verifierAcces(ids.org)
    const avant = await propositions('Natation')
    expect(resume(avant)).toEqual([`AJOUTER:${adresse('nageur')}:EN_ATTENTE`])
    // Une notification d'admin l'annonce, une fois par jour.
    const notifications = () =>
      prisma.notification.count({
        where: {
          organisationId: ids.org,
          userId: ids.admin,
          type: 'ACCES_FOURNISSEUR_A_VALIDER',
        },
      })
    expect(await notifications()).toBe(1)
    await verifierAcces(ids.org)
    expect(await notifications()).toBe(1)
    // Seul un admin de l'organisation applique.
    expect(
      code(await executer(ids.adminActivite, APPLIQUER, { id: avant[0]!.id }))
    ).toMatch(/FORBIDDEN/)
    const r = await executer(ids.admin, APPLIQUER, { id: avant[0]!.id })
    expect(r.data).toEqual({ appliquerPropositionAcces: 'APPLIQUEE' })
    expect(
      donnees.droits['d-natation']!.some(
        d =>
          d.beneficiaire.type === 'personne' &&
          d.beneficiaire.adresse === adresse('nageur')
      )
    ).toBe(true)
    expect(
      await prisma.permissionCreee.count({
        where: { dossierLieId: ids.dNatation, userId: ids.nageur },
      })
    ).toBe(1)
    await verifierAcces(ids.org)
    expect(etats(await lignes('Natation')).nageur).toEqual([
      'A_ACCES',
      'direct',
    ])
    expect(await propositions('Natation')).toEqual([])
  })

  it('ne proposent de retirer que les droits créés par Relaytour', async () => {
    // La nageuse et le nageur quittent la natation.
    await prisma.affectation.deleteMany({
      where: { perimetreId: ids.natation },
    })
    await verifierAcces(ids.org)
    // Le droit posé à la main pour la nageuse reste : il n'est qu'en trop.
    const retraits = await propositions('Natation')
    expect(resume(retraits)).toEqual([
      `RETIRER:${adresse('nageur')}:EN_ATTENTE`,
    ])
    expect(etats(await lignes('Natation')).Nageuse).toEqual([
      'EN_TROP',
      'direct',
    ])
    const r = await executer(ids.admin, APPLIQUER, { id: retraits[0]!.id })
    expect(r.data).toEqual({ appliquerPropositionAcces: 'APPLIQUEE' })
    expect(
      donnees.droits['d-natation']!.some(
        d =>
          d.beneficiaire.type === 'personne' &&
          d.beneficiaire.adresse === adresse('nageur')
      )
    ).toBe(false)
    expect(
      donnees.droits['d-natation']!.some(d => d.identifiant === 'p1')
    ).toBe(true)
    expect(
      await prisma.permissionCreee.count({
        where: { dossierLieId: ids.dNatation },
      })
    ).toBe(0)
  })

  it('font entrer dans un groupe du dossier, sans attendre quand le dossier le règle', async () => {
    const groupes = await executer(ids.admin, GROUPES, { id: ids.dPoles })
    expect(groupes.data).toEqual({
      groupesDuDossier: [{ identifiant: 'g-poles', nom: 'Pôles' }],
    })
    // Un groupe du site ne se gère pas.
    expect(
      (await executer(ids.admin, GROUPES, { id: ids.dCommun })).data
    ).toEqual({ groupesDuDossier: [] })
    // Un groupe qui n'a aucun droit sur le dossier est refusé.
    expect(
      code(
        await executer(ids.admin, REGLER, {
          id: ids.dPoles,
          mode: 'GROUPE',
          g: 'g-sports',
          auto: true,
        })
      )
    ).toBe('SAISIE_INVALIDE')
    expect(
      (
        await executer(ids.admin, REGLER, {
          id: ids.dPoles,
          mode: 'GROUPE',
          g: 'g-poles',
          auto: true,
        })
      ).errors
    ).toBeUndefined()
    await prisma.dossierLie.update({
      where: { id: ids.dPoles },
      data: { attendus: 'MEMBRES' },
    })
    // La seconde personne de l'accueil a un compte, sans être dans le groupe.
    comptes.push({
      identifiant: 'u-accueil2',
      adresse: adresse('accueil2'),
      nom: 'Accueil deux',
      invite: false,
    })
    await verifierAcces(ids.org)
    expect(donnees.groupes['g-poles']).toContain('u-accueil2')
    expect(
      await prisma.propositionAcces.count({
        where: {
          dossierLieId: ids.dPoles,
          userId: ids.accueil2,
          etat: 'APPLIQUEE',
          traiteeParId: null,
        },
      })
    ).toBe(1)
    expect(
      (
        await prisma.permissionCreee.findUniqueOrThrow({
          where: {
            dossierLieId_userId: {
              dossierLieId: ids.dPoles,
              userId: ids.accueil2,
            },
          },
        })
      ).identifiant
    ).toBe('groupe:g-poles')
  })

  it('s’écartent sans rien changer chez le fournisseur', async () => {
    // La personne quitte l'accueil : Relaytour propose de la retirer du groupe.
    await prisma.affectation.deleteMany({ where: { userId: ids.accueil2 } })
    await verifierAcces(ids.org)
    const retraits = await propositions('Pôles')
    expect(resume(retraits)).toEqual([
      `RETIRER:${adresse('accueil2')}:EN_ATTENTE`,
    ])
    expect(
      code(await executer(ids.nageuse, ECARTER, { id: retraits[0]!.id }))
    ).toBe('FORBIDDEN')
    expect(
      (await executer(ids.admin, ECARTER, { id: retraits[0]!.id })).data
    ).toEqual({ ecarterPropositionAcces: true })
    expect(donnees.groupes['g-poles']).toContain('u-accueil2')
    expect(await propositions('Pôles')).toEqual([])
    // Une nouvelle vérification ne la propose pas de nouveau.
    await verifierAcces(ids.org)
    expect(await propositions('Pôles')).toEqual([])
  })
})
