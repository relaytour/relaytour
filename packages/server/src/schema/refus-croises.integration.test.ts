import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { empreinte } from '../lib/fiches.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Table des refus entre organisations (ADR 0008, invariant 11).
//
// Chaque requête ou mutation qui reçoit un identifiant est appelée avec les
// identifiants de l'organisation A, depuis la session de l'admin de l'organisation B.
// Elle doit refuser, ou ne rien faire pour les opérations qui retirent ou marquent.
// Le dernier test compare la table au contrat : une opération nouvelle qui reçoit un
// identifiant doit y entrer.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })

const a = {
  org: '',
  activite: '',
  edition: '',
  perimetre: '',
  fiche: '',
  ficheCommune: '',
  version: '',
  tache: '',
  affectation: '',
  souhait: '',
  droit: '',
  notification: '',
  admin: '',
  referente: '',
}
const b = {
  org: '',
  activite: '',
  edition: '',
  perimetre: '',
  tache: '',
  admin: '',
}

async function executer(query: string, variables: Record<string, unknown>) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', b.admin) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

async function creerOrganisation(cle: 'a' | 'b') {
  const slug = `refus-${cle}-${s}`
  const organisation = await prisma.organisation.create({
    data: {
      slug,
      nom: `Organisation ${cle}`,
      configuration: {},
      activites: {
        create: {
          slug,
          nom: `Activité ${cle}`,
          groupes: [
            { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
          ],
        },
      },
    },
    include: { activites: true },
  })
  const activite = organisation.activites[0]!.id
  const edition = await prisma.edition.create({
    data: {
      organisationId: organisation.id,
      activiteId: activite,
      annee: 2027,
      nom: `Période ${cle}`,
      debut: new Date('2027-06-01'),
      fin: new Date('2027-06-02'),
    },
  })
  const perimetre = await prisma.perimetre.create({
    data: {
      organisationId: organisation.id,
      activiteId: activite,
      slug: 'natation',
      nom: `Natation ${cle}`,
      type: 'SPORT',
      groupe: 'sport',
    },
  })
  const tache = await prisma.tache.create({
    data: {
      editionId: edition.id,
      perimetreId: perimetre.id,
      titre: `Tâche ${cle} ${s}`,
    },
  })
  return {
    org: organisation.id,
    activite,
    edition: edition.id,
    perimetre: perimetre.id,
    tache: tache.id,
  }
}

async function creerCompte(
  cle: string,
  organisationId: string,
  admin: boolean
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: `${cle}-${s}@exemple.fr`,
      name: `${cle} ${s}`,
      appartenances: {
        create: { organisationId, role: admin ? 'ADMIN' : 'MEMBRE' },
      },
    },
  })
  return id
}

beforeAll(async () => {
  await apollo.start()
  Object.assign(a, await creerOrganisation('a'))
  Object.assign(b, await creerOrganisation('b'))
  a.admin = await creerCompte('admin-a', a.org, true)
  a.referente = await creerCompte('referente-a', a.org, false)
  b.admin = await creerCompte('admin-b', b.org, true)
  for (const [cle, perimetreId] of [
    ['fiche', a.perimetre],
    ['ficheCommune', null],
  ] as const) {
    const fiche = await prisma.fiche.create({
      data: {
        organisationId: a.org,
        activiteId: a.activite,
        slug: `${cle.toLowerCase()}-${s}`,
        perimetreId,
      },
    })
    const version = await prisma.ficheVersion.create({
      data: {
        ficheId: fiche.id,
        titre: 'Titre',
        contenu: 'Contenu.',
        empreinte: empreinte('Titre', 'Contenu.'),
        source: 'APP',
      },
    })
    await prisma.fiche.update({
      where: { id: fiche.id },
      data: { versionCouranteId: version.id },
    })
    a[cle] = fiche.id
    if (cle === 'fiche') a.version = version.id
  }
  a.affectation = (
    await prisma.affectation.create({
      data: {
        userId: a.referente,
        perimetreId: a.perimetre,
        editionId: a.edition,
      },
    })
  ).id
  a.souhait = (
    await prisma.souhait.create({
      data: {
        userId: a.referente,
        perimetreId: a.perimetre,
        editionId: a.edition,
      },
    })
  ).id
  a.droit = (
    await prisma.droitRedaction.create({
      data: { organisationId: a.org, userId: a.referente, perimetreId: null },
    })
  ).id
  a.notification = (
    await prisma.notification.create({
      data: {
        organisationId: a.org,
        userId: a.referente,
        type: 'TACHE_CREEE',
        tacheId: a.tache,
        perimetreId: a.perimetre,
      },
    })
  ).id
})

afterAll(async () => {
  const organisations = [a.org, b.org]
  await prisma.notification.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.journal.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.tache.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.souhait.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.affectation.deleteMany({
    where: { perimetre: { organisationId: { in: organisations } } },
  })
  await prisma.effectifPerimetre.deleteMany({
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
  await prisma.organisation.deleteMany({ where: { id: { in: organisations } } })
  invaliderConfigurationOrganisation()
  await apollo.stop()
})

/** Refus attendu : l'opération renvoie une erreur de l'un de ces codes. */
type Refus = { refus: ('FORBIDDEN' | 'SAISIE_INVALIDE')[] }
/** Sans effet attendu : l'opération répond, sans toucher aux données de A. */
type SansEffet = { sansEffet: (data: Record<string, unknown>) => void }

interface Cas {
  operation: string
  query: string
  variables: () => Record<string, unknown>
  attente: Refus | SansEffet
}

const INTERDIT: Refus = { refus: ['FORBIDDEN'] }
// Une saisie refusée ne dit pas si l'objet existe ailleurs : « introuvable » ou
// « ne peut pas être lié » valent pour un identifiant inconnu comme pour celui d'une
// autre organisation.
const REFUSE: Refus = { refus: ['FORBIDDEN', 'SAISIE_INVALIDE'] }

const CAS: Cas[] = [
  // ── Mutations ──────────────────────────────────────────────────────────────
  {
    operation: 'accorderDroitRedaction',
    query:
      'mutation ($u: ID!, $p: ID) { accorderDroitRedaction(personneId: $u, perimetreId: $p) { id } }',
    variables: () => ({ u: a.referente, p: a.perimetre }),
    attente: INTERDIT,
  },
  {
    operation: 'affecter',
    query:
      'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }',
    variables: () => ({ u: a.referente, p: a.perimetre, e: a.edition }),
    attente: INTERDIT,
  },
  {
    operation: 'archiverActivite',
    query:
      'mutation ($id: ID!) { archiverActivite(id: $id, archive: true) { id } }',
    variables: () => ({ id: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'archiverFiche',
    query:
      'mutation ($id: ID!) { archiverFiche(id: $id, archive: true) { id } }',
    variables: () => ({ id: a.fiche }),
    attente: INTERDIT,
  },
  {
    operation: 'archiverPersonne',
    query:
      'mutation ($id: ID!) { archiverPersonne(id: $id, archive: true) { id } }',
    variables: () => ({ id: a.referente }),
    attente: INTERDIT,
  },
  {
    operation: 'assignerTache',
    query:
      'mutation ($id: ID!, $u: ID) { assignerTache(id: $id, assigne: true, personneId: $u) { id } }',
    variables: () => ({ id: a.tache, u: a.referente }),
    attente: INTERDIT,
  },
  {
    operation: 'changerStatutTache',
    query:
      'mutation ($id: ID!, $r: ID) { changerStatutTache(id: $id, statut: FAITE, realiseeParId: $r) { id } }',
    variables: () => ({ id: a.tache, r: a.referente }),
    attente: INTERDIT,
  },
  {
    operation: 'creerEdition',
    query:
      'mutation ($a: ID) { creerEdition(activiteId: $a, annee: 2030, nom: "X", debut: "2030-01-01", fin: "2030-01-02") { id } }',
    variables: () => ({ a: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'creerFiche',
    query:
      'mutation ($p: ID, $a: ID) { creerFiche(slug: "intrusion", titre: "X", contenu: "Y", perimetreId: $p, activiteId: $a) { id } }',
    variables: () => ({ p: a.perimetre }),
    attente: INTERDIT,
  },
  {
    operation: 'creerFiche',
    query:
      'mutation ($p: ID, $a: ID) { creerFiche(slug: "intrusion", titre: "X", contenu: "Y", perimetreId: $p, activiteId: $a) { id } }',
    variables: () => ({ a: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'creerPerimetre',
    query:
      'mutation ($a: ID) { creerPerimetre(activiteId: $a, slug: "intrusion", nom: "X", groupe: "sport") { id } }',
    variables: () => ({ a: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'creerTache',
    query:
      'mutation ($p: ID!, $e: ID!, $f: ID) { creerTache(perimetreId: $p, editionId: $e, titre: "Intrusion", ficheId: $f) { id } }',
    variables: () => ({ p: a.perimetre, e: a.edition }),
    attente: INTERDIT,
  },
  {
    operation: 'creerTache',
    query:
      'mutation ($p: ID!, $e: ID!, $f: ID) { creerTache(perimetreId: $p, editionId: $e, titre: "Intrusion", ficheId: $f) { id } }',
    variables: () => ({ p: b.perimetre, e: b.edition, f: a.ficheCommune }),
    attente: REFUSE,
  },
  {
    operation: 'definirEffectif',
    query:
      'mutation ($p: ID!, $e: ID!) { definirEffectif(perimetreId: $p, editionId: $e, effectif: 9) }',
    variables: () => ({ p: a.perimetre, e: a.edition }),
    attente: INTERDIT,
  },
  {
    operation: 'definirSouhaits',
    query:
      'mutation ($u: ID!, $e: ID!, $p: [ID!]!) { definirSouhaits(personneId: $u, editionId: $e, perimetreIds: $p) { id } }',
    variables: () => ({ u: a.referente, e: a.edition, p: [a.perimetre] }),
    attente: INTERDIT,
  },
  {
    operation: 'definirSouhaits',
    query:
      'mutation ($u: ID!, $e: ID!, $p: [ID!]!) { definirSouhaits(personneId: $u, editionId: $e, perimetreIds: $p) { id } }',
    variables: () => ({ u: b.admin, e: b.edition, p: [a.perimetre] }),
    attente: REFUSE,
  },
  {
    operation: 'inviterPersonne',
    query:
      'mutation ($e: ID, $p: [ID!]) { inviterPersonne(email: "intrusion-refus@exemple.fr", nom: "X", editionId: $e, perimetresSouhaites: $p) { id } }',
    variables: () => ({ e: a.edition, p: [a.perimetre] }),
    attente: INTERDIT,
  },
  {
    operation: 'marquerNotificationsLues',
    query: 'mutation ($ids: [ID!]) { marquerNotificationsLues(ids: $ids) }',
    variables: () => ({ ids: [a.notification] }),
    attente: { sansEffet: d => expect(d.marquerNotificationsLues).toBe(0) },
  },
  {
    operation: 'modifierActivite',
    query:
      'mutation ($id: ID!) { modifierActivite(id: $id, nom: "X", nature: SAISON, groupes: [{ cle: "x", libelle: "X", libellePluriel: "X" }], ordre: 0) { id } }',
    variables: () => ({ id: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'modifierEdition',
    query:
      'mutation ($id: ID!) { modifierEdition(id: $id, nom: "X", debut: "2027-06-01", fin: "2027-06-02", statut: ARCHIVEE) { id } }',
    variables: () => ({ id: a.edition }),
    attente: INTERDIT,
  },
  {
    operation: 'modifierFiche',
    query:
      'mutation ($id: ID!) { modifierFiche(id: $id, titre: "X", contenu: "Y") { id } }',
    variables: () => ({ id: a.fiche }),
    attente: INTERDIT,
  },
  {
    operation: 'modifierPerimetre',
    query:
      'mutation ($id: ID!) { modifierPerimetre(id: $id, nom: "X", ordre: 0, archive: true) { id } }',
    variables: () => ({ id: a.perimetre }),
    attente: INTERDIT,
  },
  {
    operation: 'modifierPersonne',
    query:
      'mutation ($id: ID!) { modifierPersonne(id: $id, nom: "X", estAdmin: true) { id } }',
    variables: () => ({ id: a.referente }),
    attente: INTERDIT,
  },
  {
    operation: 'modifierTache',
    query:
      'mutation ($id: ID!, $f: ID) { modifierTache(id: $id, titre: "X", ficheId: $f, confirmer: true) { id } }',
    variables: () => ({ id: a.tache }),
    attente: INTERDIT,
  },
  {
    operation: 'modifierTache',
    query:
      'mutation ($id: ID!, $f: ID) { modifierTache(id: $id, titre: "X", ficheId: $f, confirmer: true) { id } }',
    variables: () => ({ id: b.tache, f: a.fiche }),
    attente: REFUSE,
  },
  {
    operation: 'renvoyerInvitation',
    query: 'mutation ($id: ID!) { renvoyerInvitation(id: $id) }',
    variables: () => ({ id: a.referente }),
    attente: INTERDIT,
  },
  {
    operation: 'restaurerVersionFiche',
    query: 'mutation ($v: ID!) { restaurerVersionFiche(versionId: $v) { id } }',
    variables: () => ({ v: a.version }),
    attente: REFUSE,
  },
  {
    operation: 'retirerAffectation',
    query: 'mutation ($id: ID!) { retirerAffectation(id: $id) }',
    variables: () => ({ id: a.affectation }),
    attente: { sansEffet: d => expect(d.retirerAffectation).toBe(false) },
  },
  {
    operation: 'retirerDroitRedaction',
    query: 'mutation ($id: ID!) { retirerDroitRedaction(id: $id) }',
    variables: () => ({ id: a.droit }),
    attente: { sansEffet: d => expect(d.retirerDroitRedaction).toBe(false) },
  },
  {
    operation: 'retirerSouhait',
    query: 'mutation ($id: ID!) { retirerSouhait(id: $id) }',
    variables: () => ({ id: a.souhait }),
    attente: { sansEffet: d => expect(d.retirerSouhait).toBe(false) },
  },
  // ── Requêtes ───────────────────────────────────────────────────────────────
  ...(
    [
      ['affectations', 'affectations(editionId: $e) { id }'],
      ['appelPostes', 'appelPostes(editionId: $e)'],
      [
        'avancementGlobal',
        'avancementGlobal(editionId: $e) { perimetre { id } }',
      ],
      ['classement', 'classement(editionId: $e) { rang }'],
      ['mesTaches', 'mesTaches(editionId: $e) { id }'],
      ['monScore', 'monScore(editionId: $e) { points }'],
      ['postesAPourvoir', 'postesAPourvoir(editionId: $e) { etat }'],
      [
        'recherche',
        'recherche(texte: "Tâche", editionId: $e) { taches { id } }',
      ],
      ['retroplanning', 'retroplanning(editionId: $e) { id }'],
      ['tachesAPrendre', 'tachesAPrendre(editionId: $e) { id }'],
    ] as const
  ).map(([operation, champ]) => ({
    operation,
    query: `query ($e: ID!) { ${champ} }`,
    variables: () => ({ e: a.edition }),
    attente: INTERDIT,
  })),
  ...(
    [
      ['editionCourante', 'editionCourante(activiteId: $a) { id }'],
      ['editions', 'editions(activiteId: $a) { id }'],
      ['fiches', 'fiches(activiteId: $a) { id }'],
      ['mesPerimetres', 'mesPerimetres(activiteId: $a) { id }'],
      ['perimetre', 'perimetre(slug: "natation", activiteId: $a) { id }'],
      ['perimetres', 'perimetres(activiteId: $a) { id }'],
    ] as const
  ).map(([operation, champ]) => ({
    operation,
    query: `query ($a: ID) { ${champ} }`,
    variables: () => ({ a: a.activite }),
    attente: INTERDIT,
  })),
]

/** Une empreinte des données de A : aucune opération de la table ne doit la changer. */
async function etatDeA() {
  const [tache, fiche, perimetre, activite, edition, referente, compteurs] =
    await Promise.all([
      prisma.tache.findUniqueOrThrow({
        where: { id: a.tache },
        select: {
          titre: true,
          statut: true,
          ficheId: true,
          _count: { select: { assignations: true } },
        },
      }),
      prisma.fiche.findUniqueOrThrow({
        where: { id: a.fiche },
        select: { archivedAt: true, versionCouranteId: true },
      }),
      prisma.perimetre.findUniqueOrThrow({
        where: { id: a.perimetre },
        select: { nom: true, archivedAt: true },
      }),
      prisma.activite.findUniqueOrThrow({
        where: { id: a.activite },
        select: { nom: true, archivedAt: true, nature: true },
      }),
      prisma.edition.findUniqueOrThrow({
        where: { id: a.edition },
        select: { nom: true, statut: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: a.referente },
        select: {
          name: true,
          archivedAt: true,
          appartenances: { select: { organisationId: true, role: true } },
        },
      }),
      Promise.all([
        prisma.affectation.count({
          where: { perimetre: { organisationId: a.org } },
        }),
        prisma.souhait.count({
          where: { perimetre: { organisationId: a.org } },
        }),
        prisma.droitRedaction.count({ where: { organisationId: a.org } }),
        prisma.fiche.count({ where: { organisationId: a.org } }),
        prisma.tache.count({ where: { perimetre: { organisationId: a.org } } }),
        prisma.perimetre.count({ where: { organisationId: a.org } }),
        prisma.edition.count({ where: { organisationId: a.org } }),
        prisma.effectifPerimetre.count({
          where: { perimetre: { organisationId: a.org } },
        }),
        prisma.notification.count({
          where: { organisationId: a.org, lueLe: null },
        }),
        prisma.user.count({ where: { email: 'intrusion-refus@exemple.fr' } }),
      ]),
    ])
  return JSON.stringify({
    tache,
    fiche,
    perimetre,
    activite,
    edition,
    referente,
    compteurs,
  })
}

describe('refus croisés : l’admin de B ne touche à rien de A', () => {
  let reference = ''
  beforeAll(async () => {
    reference = await etatDeA()
  })

  for (const cas of CAS) {
    it(`${cas.operation} (${JSON.stringify(Object.keys(cas.variables()))})`, async () => {
      const r = await executer(cas.query, cas.variables())
      if ('refus' in cas.attente) {
        expect(r.errors?.[0]?.extensions?.code).toBeOneOf(cas.attente.refus)
      } else {
        expect(r.errors).toBeUndefined()
        cas.attente.sansEffet(r.data as Record<string, unknown>)
      }
      expect(await etatDeA()).toBe(reference)
    })
  }
})

describe('couverture de la table', () => {
  it('contient chaque opération du contrat qui reçoit un identifiant', () => {
    // Opérations de l'administration de l'installation : elles n'ouvrent qu'au
    // jeton, jamais à une session (installation.integration.test.ts).
    const HORS_TABLE = new Set([
      'creerOrganisation',
      'inviterPremierAdmin',
      'modifierOrganisationInstallation',
      'demanderExport',
      'organisations',
    ])
    const recoitUnIdentifiant = (champ: {
      args: readonly { type: unknown }[]
    }) => champ.args.some(arg => /\bID\b/.test(String(arg.type)))
    const attendues = [
      ...Object.values(schema.getMutationType()!.getFields()),
      ...Object.values(schema.getQueryType()!.getFields()),
    ]
      .filter(recoitUnIdentifiant)
      .map(champ => champ.name)
      .filter(nom => !HORS_TABLE.has(nom))
      .sort()
    const couvertes = [...new Set(CAS.map(c => c.operation))].sort()
    expect(attendues.filter(nom => !couvertes.includes(nom))).toEqual([])
  })
})
