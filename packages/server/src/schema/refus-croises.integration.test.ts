import { randomUUID } from 'node:crypto'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { empreinte } from '../lib/fiches.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { schema } from './index.ts'

// Table des refus entre organisations et entre activités (ADR 0008, 0010 et 0018,
// invariant 11).
//
// Chaque requête ou mutation qui reçoit un identifiant est appelée avec les
// identifiants de l'activité principale de l'organisation A, depuis trois sessions :
// l'admin de l'organisation B, l'admin d'une autre activité de l'organisation A, et
// une référente de cette autre activité. Elle doit refuser, ou ne rien faire pour
// les opérations qui retirent ou marquent.
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
  commentaire: '',
  affectation: '',
  souhait: '',
  demande: '',
  proposition: '',
  message: '',
  droit: '',
  notification: '',
  // Une invitation en attente pour un compte extérieur (ADR 0030).
  invitation: '',
  admin: '',
  referente: '',
  // Une autre activité de l'organisation A, son admin et sa référente (ADR 0010).
  autreActivite: '',
  autreEdition: '',
  autrePerimetre: '',
  adminAutre: '',
  referenteAutre: '',
}
const b = {
  org: '',
  activite: '',
  edition: '',
  perimetre: '',
  tache: '',
  demande: '',
  admin: '',
}

let acteur = ''

async function executer(query: string, variables: Record<string, unknown>) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', acteur) }
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
  // L'autre activité de A : une période, un périmètre, un admin d'activité qui y
  // est aussi affecté, et une référente.
  const autre = await prisma.activite.create({
    data: {
      organisationId: a.org,
      slug: `autre-${s}`,
      nom: 'Autre activité',
      groupes: [{ cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' }],
    },
  })
  a.autreActivite = autre.id
  const autreEdition = await prisma.edition.create({
    data: {
      organisationId: a.org,
      activiteId: autre.id,
      annee: 2027,
      nom: 'Autre période',
      debut: new Date('2027-06-01'),
      fin: new Date('2027-06-02'),
    },
  })
  const autrePerimetre = await prisma.perimetre.create({
    data: {
      organisationId: a.org,
      activiteId: autre.id,
      slug: 'natation',
      nom: 'Natation autre',
      type: 'SPORT',
      groupe: 'sport',
    },
  })
  a.autreEdition = autreEdition.id
  a.autrePerimetre = autrePerimetre.id
  a.adminAutre = await creerCompte('admin-autre', a.org, false)
  a.referenteAutre = await creerCompte('referente-autre', a.org, false)
  await prisma.adminActivite.create({
    data: { userId: a.adminAutre, activiteId: autre.id, organisationId: a.org },
  })
  for (const userId of [a.adminAutre, a.referenteAutre]) {
    await prisma.affectation.create({
      data: {
        userId,
        perimetreId: autrePerimetre.id,
        editionId: autreEdition.id,
      },
    })
  }
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
  const demande = await prisma.demande.create({
    data: {
      organisationId: a.org,
      activiteId: a.activite,
      editionId: a.edition,
      origine: 'PROPOSITION',
      nom: 'Personne proposée',
      adresse: 'proposee-refus@exemple.fr',
      adresseEnAttente: 'proposee-refus@exemple.fr',
      perimetres: {
        create: { perimetreId: a.perimetre, proposeParId: a.referente },
      },
    },
    include: { perimetres: true },
  })
  a.demande = demande.id
  // Une demande de l'organisation B, pour les combinaisons d'identifiants mêlés.
  b.demande = (
    await prisma.demande.create({
      data: {
        organisationId: b.org,
        activiteId: b.activite,
        editionId: b.edition,
        origine: 'PROPOSITION',
        nom: 'Personne proposée à B',
        adresse: `proposee-b-refus-${s}@exemple.fr`,
        adresseEnAttente: `proposee-b-refus-${s}@exemple.fr`,
        perimetres: { create: { perimetreId: b.perimetre } },
      },
    })
  ).id
  a.proposition = demande.perimetres[0]!.id
  // Un message de l'activité principale, écrit par son admin (ADR 0020).
  a.message = (
    await prisma.message.create({
      data: {
        organisationId: a.org,
        activiteId: a.activite,
        editionId: a.edition,
        auteurId: a.admin,
        modele: 'message-libre',
        objet: 'Réunion',
        corps: 'Bonjour',
        champ: 'A',
        destinataires: { create: { userId: a.referente } },
      },
    })
  ).id
  // Un commentaire de la référente sur la tâche (ADR 0029).
  a.commentaire = (
    await prisma.commentaireTache.create({
      data: {
        tacheId: a.tache,
        auteurId: a.referente,
        texte: 'Salle réservée.',
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
  const invitee = randomUUID()
  await prisma.user.create({
    data: {
      id: invitee,
      email: `invitee-refus-${s}@exemple.fr`,
      name: 'Compte extérieur',
    },
  })
  a.invitation = (
    await prisma.invitationOrganisation.create({
      data: {
        organisationId: a.org,
        userId: invitee,
        nom: 'Invitée',
        origine: 'PERSONNE',
        inviteParId: a.admin,
        lots: [
          {
            editionId: a.edition,
            activiteId: a.activite,
            affectes: [a.perimetre],
            souhaites: [],
            contactPrincipal: [],
          },
        ],
        expireLe: new Date(Date.now() + 24 * 3600 * 1000),
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
  await prisma.demande.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.message.deleteMany({
    where: { organisationId: { in: organisations } },
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
  await prisma.adminActivite.deleteMany({
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
/**
 * Sans effet attendu : l'opération répond sans toucher aux données de A. Une
 * session sans rôle de gestion reçoit un refus avant tout traitement, ce qui vaut
 * aussi.
 */
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

const MESSAGE = {
  modele: 'message-libre',
  objet: 'Réunion',
  corps: 'Bonjour',
  champ: 'A',
}

// Identifiants mêlés : l'opération part d'un objet de l'organisation B et y joint
// un objet de A. Chaque identifiant se contrôle, et pas seulement le premier : un
// périmètre, une personne ou une période de A n'entre jamais dans un objet de B.
// Les deux acteurs de A, pour qui l'objet de B est étranger, sont refusés aussi.
const MELES: Cas[] = [
  {
    operation: 'accepterDemande',
    query:
      'mutation ($id: ID!, $p: [ID!]!) { accepterDemande(id: $id, affecter: $p) { id } }',
    variables: () => ({ id: b.demande, p: [a.perimetre] }),
    attente: REFUSE,
  },
  {
    operation: 'inviterPersonne',
    query:
      'mutation ($e: ID, $p: [ID!]) { inviterPersonne(email: "melee-refus@exemple.fr", nom: "X", editionId: $e, perimetresAffectes: $p) { enAttente } }',
    variables: () => ({ e: b.edition, p: [a.perimetre] }),
    attente: REFUSE,
  },
  {
    operation: 'changerStatutTache',
    query:
      'mutation ($id: ID!, $u: ID) { changerStatutTache(id: $id, statut: FAITE, realiseeParId: $u, confirmer: true) { id } }',
    variables: () => ({ id: b.tache, u: a.referente }),
    attente: REFUSE,
  },
  {
    operation: 'assignerTache',
    query:
      'mutation ($id: ID!, $u: ID) { assignerTache(id: $id, personneId: $u, assigne: true) { id } }',
    variables: () => ({ id: b.tache, u: a.referente }),
    attente: REFUSE,
  },
  {
    operation: 'creerMessage',
    query: 'mutation ($m: MessageInput!) { creerMessage(message: $m) { id } }',
    variables: () => ({
      m: { ...MESSAGE, activiteId: b.activite, destinataireIds: [a.referente] },
    }),
    attente: REFUSE,
  },
  {
    operation: 'creerMessage',
    query: 'mutation ($m: MessageInput!) { creerMessage(message: $m) { id } }',
    variables: () => ({
      m: {
        ...MESSAGE,
        activiteId: b.activite,
        editionId: a.edition,
        destinataireIds: [b.admin],
      },
    }),
    attente: REFUSE,
  },
  {
    operation: 'creerMessage',
    query: 'mutation ($m: MessageInput!) { creerMessage(message: $m) { id } }',
    variables: () => ({
      m: {
        ...MESSAGE,
        activiteId: b.activite,
        editionId: b.edition,
        perimetreId: a.perimetre,
        destinataireIds: [b.admin],
      },
    }),
    attente: REFUSE,
  },
  {
    operation: 'definirEffectif',
    query:
      'mutation ($e: ID!, $p: ID!) { definirEffectif(editionId: $e, perimetreId: $p, effectif: 3) }',
    variables: () => ({ e: b.edition, p: a.perimetre }),
    attente: REFUSE,
  },
  {
    operation: 'declinerTache',
    query:
      'mutation ($id: ID!, $p: [ID!]!) { declinerTache(id: $id, perimetreIds: $p) { id } }',
    variables: () => ({ id: b.tache, p: [a.perimetre] }),
    attente: REFUSE,
  },
  {
    operation: 'accorderDroitRedaction',
    query:
      'mutation ($u: ID!, $p: ID) { accorderDroitRedaction(personneId: $u, perimetreId: $p) { id } }',
    variables: () => ({ u: a.referente, p: b.perimetre }),
    attente: REFUSE,
  },
  {
    operation: 'affecter',
    query:
      'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }',
    variables: () => ({ u: a.referente, p: b.perimetre, e: b.edition }),
    attente: REFUSE,
  },
  {
    operation: 'affecter',
    query:
      'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }',
    variables: () => ({ u: b.admin, p: b.perimetre, e: a.edition }),
    attente: REFUSE,
  },
]

const CAS: Cas[] = [
  ...MELES,
  // ── Mutations ──────────────────────────────────────────────────────────────
  // Invitations entre organisations (ADR 0030) : seule la personne invitée accepte
  // ou refuse, seuls les admins de l'activité de A relancent ou retirent.
  {
    operation: 'accepterInvitation',
    query: 'mutation ($id: ID!) { accepterInvitation(id: $id) }',
    variables: () => ({ id: a.invitation }),
    attente: INTERDIT,
  },
  {
    operation: 'refuserInvitation',
    query: 'mutation ($id: ID!) { refuserInvitation(id: $id) }',
    variables: () => ({ id: a.invitation }),
    attente: { sansEffet: d => expect(d.refuserInvitation).toBe(false) },
  },
  {
    operation: 'relancerInvitation',
    query: 'mutation ($id: ID!) { relancerInvitation(id: $id) }',
    variables: () => ({ id: a.invitation }),
    attente: INTERDIT,
  },
  {
    operation: 'retirerInvitation',
    query: 'mutation ($id: ID!) { retirerInvitation(id: $id) }',
    variables: () => ({ id: a.invitation }),
    attente: INTERDIT,
  },
  {
    operation: 'invitationsEnAttente',
    query:
      'query ($a: ID) { invitationsEnAttente(activiteId: $a) { id nom email } }',
    variables: () => ({ a: a.activite }),
    attente: INTERDIT,
  },
  // Tâches partagées (ADR 0026) : accorder, décliner et imposer portent sur une
  // tâche de l'activité principale de A.
  {
    operation: 'accorderDeclinaison',
    query:
      'mutation ($id: ID!) { accorderDeclinaison(id: $id, accepter: true) { id } }',
    variables: () => ({ id: a.tache }),
    attente: INTERDIT,
  },
  {
    operation: 'declinerTache',
    query:
      'mutation ($id: ID!, $p: [ID!]!) { declinerTache(id: $id, perimetreIds: $p) { id } }',
    variables: () => ({ id: a.tache, p: [a.autrePerimetre] }),
    attente: INTERDIT,
  },
  {
    operation: 'imposerDeclinaison',
    query: 'mutation ($id: ID!) { imposerDeclinaison(id: $id) { id } }',
    variables: () => ({ id: a.tache }),
    attente: INTERDIT,
  },
  {
    operation: 'accorderDroitRedaction',
    query:
      'mutation ($u: ID!, $p: ID) { accorderDroitRedaction(personneId: $u, perimetreId: $p) { id } }',
    variables: () => ({ u: a.referente, p: a.perimetre }),
    attente: INTERDIT,
  },
  // Le périmètre de l'acteur et une personne d'une autre activité : un admin
  // d'activité n'agit que sur son équipe (ADR 0018).
  {
    operation: 'accorderDroitRedaction',
    query:
      'mutation ($u: ID!, $p: ID) { accorderDroitRedaction(personneId: $u, perimetreId: $p) { id } }',
    variables: () => ({ u: a.referente, p: a.autrePerimetre }),
    attente: INTERDIT,
  },
  {
    operation: 'affecter',
    query:
      'mutation ($u: ID!, $p: ID!, $e: ID!) { affecter(personneId: $u, perimetreId: $p, editionId: $e) { id } }',
    variables: () => ({
      u: a.referente,
      p: a.autrePerimetre,
      e: a.autreEdition,
    }),
    attente: INTERDIT,
  },
  {
    operation: 'definirSouhaits',
    query:
      'mutation ($u: ID!, $e: ID!, $p: [ID!]!) { definirSouhaits(personneId: $u, editionId: $e, perimetreIds: $p) { id } }',
    variables: () => ({
      u: a.referente,
      e: a.autreEdition,
      p: [a.autrePerimetre],
    }),
    attente: INTERDIT,
  },
  {
    operation: 'accepterDemande',
    query:
      'mutation ($id: ID!, $p: [ID!]!) { accepterDemande(id: $id, affecter: $p) { id } }',
    variables: () => ({ id: a.demande, p: [a.perimetre] }),
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
  // Depuis son propre périmètre, une tâche ne se décline pas dans un périmètre
  // d'une autre organisation (ADR 0026).
  {
    operation: 'creerTache',
    query:
      'mutation ($p: ID!, $e: ID!, $c: [ID!]!) { creerTache(perimetreId: $p, editionId: $e, titre: "Intrusion", declinaison: { perimetreIds: $c }) { id } }',
    variables: () => ({ p: b.perimetre, e: b.edition, c: [a.perimetre] }),
    attente: REFUSE,
  },
  {
    operation: 'definirAdminActivite',
    query:
      'mutation ($u: ID!, $a: ID!) { definirAdminActivite(personneId: $u, activiteId: $a, admin: true) }',
    variables: () => ({ u: a.referente, a: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'definirContactPrincipal',
    query:
      'mutation ($id: ID!) { definirContactPrincipal(affectationId: $id, contactPrincipal: true) }',
    variables: () => ({ id: a.affectation }),
    attente: {
      sansEffet: d => expect(d.definirContactPrincipal).toBe(false),
    },
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
    operation: 'formulerSouhait',
    query:
      'mutation ($p: ID!, $e: ID!) { formulerSouhait(perimetreId: $p, editionId: $e) }',
    variables: () => ({ p: a.perimetre, e: a.edition }),
    attente: INTERDIT,
  },
  {
    operation: 'inviterPersonne',
    query:
      'mutation ($e: ID, $p: [ID!]) { inviterPersonne(email: "intrusion-refus@exemple.fr", nom: "X", editionId: $e, perimetresSouhaites: $p) { personne { id } } }',
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
      'mutation ($id: ID!) { modifierActivite(id: $id, nom: "X", nature: SAISON, groupes: [{ cle: "x", libelle: "X", libellePluriel: "X" }], phases: [{ cle: "x", libelle: "X" }], ordre: 0) { id } }',
    variables: () => ({ id: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'modifierIdentiteActivite',
    query:
      'mutation ($id: ID!) { modifierIdentiteActivite(id: $id, pageEquipe: "https://exemple.org/intrusion") { id } }',
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
    operation: 'proposerPersonne',
    query:
      'mutation ($p: ID!, $e: ID!) { proposerPersonne(perimetreId: $p, editionId: $e, nom: "Intrusion", email: "intrusion-refus@exemple.fr") }',
    variables: () => ({ p: a.perimetre, e: a.edition }),
    attente: INTERDIT,
  },
  {
    operation: 'refuserDemande',
    query: 'mutation ($id: ID!) { refuserDemande(id: $id) { id } }',
    variables: () => ({ id: a.demande }),
    attente: INTERDIT,
  },
  {
    operation: 'creerMessage',
    query: 'mutation ($m: MessageInput!) { creerMessage(message: $m) { id } }',
    variables: () => ({
      m: {
        activiteId: a.activite,
        modele: 'message-libre',
        objet: 'Réunion',
        corps: 'Bonjour',
        champ: 'A',
        destinataireIds: [a.referente],
      },
    }),
    attente: INTERDIT,
  },
  {
    operation: 'definirStatutMessage',
    query:
      'mutation ($id: ID!) { definirStatutMessage(id: $id, statut: ENVOYE) { id } }',
    variables: () => ({ id: a.message }),
    attente: INTERDIT,
  },
  {
    operation: 'messages',
    query: 'query ($a: ID) { messages(activiteId: $a) { id objet } }',
    variables: () => ({ a: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'retirerProposition',
    query: 'mutation ($id: ID!) { retirerProposition(id: $id) }',
    variables: () => ({ id: a.proposition }),
    attente: { sansEffet: d => expect(d.retirerProposition).toBe(false) },
  },
  {
    operation: 'retirerMonSouhait',
    query:
      'mutation ($p: ID!, $e: ID!) { retirerMonSouhait(perimetreId: $p, editionId: $e) }',
    variables: () => ({ p: a.perimetre, e: a.edition }),
    attente: { sansEffet: d => expect(d.retirerMonSouhait).toBe(false) },
  },
  {
    operation: 'retirerSouhait',
    query: 'mutation ($id: ID!) { retirerSouhait(id: $id) }',
    variables: () => ({ id: a.souhait }),
    attente: { sansEffet: d => expect(d.retirerSouhait).toBe(false) },
  },
  // ── Requêtes ───────────────────────────────────────────────────────────────
  // Le fil d'une tâche et ses commentaires (ADR 0029).
  {
    operation: 'filTache',
    query:
      'query ($id: ID!) { filTache(id: $id) { commentaires { texte } evenements { id } } }',
    variables: () => ({ id: a.tache }),
    attente: INTERDIT,
  },
  {
    operation: 'commentairesDeLaPeriode',
    query:
      'query ($e: ID!) { commentairesDeLaPeriode(editionId: $e) { perimetresLus nombres { tacheId nombre } } }',
    variables: () => ({ e: a.edition }),
    attente: INTERDIT,
  },
  {
    operation: 'commenterTache',
    query:
      'mutation ($id: ID!) { commenterTache(id: $id, texte: "Intrusion") { tacheId } }',
    variables: () => ({ id: a.tache }),
    attente: INTERDIT,
  },
  {
    operation: 'modifierCommentaire',
    query:
      'mutation ($id: ID!) { modifierCommentaire(id: $id, texte: "Intrusion") { tacheId } }',
    variables: () => ({ id: a.commentaire }),
    attente: INTERDIT,
  },
  {
    operation: 'supprimerCommentaire',
    query: 'mutation ($id: ID!) { supprimerCommentaire(id: $id) { tacheId } }',
    variables: () => ({ id: a.commentaire }),
    attente: INTERDIT,
  },
  // Une tâche et ses déclinaisons (ADR 0026).
  {
    operation: 'tache',
    query:
      'query ($id: ID!) { tache(id: $id) { id titre declinaisons { id } } }',
    variables: () => ({ id: a.tache }),
    attente: INTERDIT,
  },
  {
    operation: 'equipe',
    query: 'query ($a: ID) { equipe(activiteId: $a) { id nom } }',
    variables: () => ({ a: a.activite }),
    attente: INTERDIT,
  },
  {
    operation: 'mesPropositions',
    query:
      'query ($p: ID!, $e: ID!) { mesPropositions(perimetreId: $p, editionId: $e) { id } }',
    variables: () => ({ p: a.perimetre, e: a.edition }),
    attente: INTERDIT,
  },
  ...(
    [
      ['affectations', 'affectations(editionId: $e) { id }'],
      ['appelPostes', 'appelPostes(editionId: $e)'],
      [
        'avancementGlobal',
        'avancementGlobal(editionId: $e) { perimetre { id } }',
      ],
      ['classement', 'classement(editionId: $e) { rang }'],
      ['demandes', 'demandes(editionId: $e) { id adresse }'],
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
      ['fiche', 'fiche(slug: "piscine", activiteId: $a) { id }'],
      ['fiches', 'fiches(activiteId: $a) { id }'],
      ['mesPerimetres', 'mesPerimetres(activiteId: $a) { id }'],
      ['perimetre', 'perimetre(slug: "natation", activiteId: $a) { id }'],
      ['perimetres', 'perimetres(activiteId: $a) { id }'],
      [
        'tousLesPerimetres',
        'tousLesPerimetres(activiteId: $a) { perimetres { affecte } }',
      ],
      [
        'peutRedigerFichesCommunes',
        'peutRedigerFichesCommunes(activiteId: $a)',
      ],
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
        select: { nom: true, archivedAt: true, nature: true, identite: true },
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
        prisma.affectation.count({
          where: {
            perimetre: { organisationId: a.org },
            contactPrincipal: true,
          },
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
        prisma.adminActivite.count({ where: { organisationId: a.org } }),
        prisma.demande.count({ where: { organisationId: a.org } }),
        prisma.demande.count({
          where: { organisationId: a.org, statut: 'EN_ATTENTE' },
        }),
        prisma.demandePerimetre.count({
          where: { demande: { organisationId: a.org } },
        }),
        prisma.commentaireTache.findMany({
          where: { tache: { perimetre: { organisationId: a.org } } },
          select: { id: true, texte: true, modifieLe: true },
          orderBy: { id: 'asc' },
        }),
      ]),
    ])
  const invitation = await prisma.invitationOrganisation.findUnique({
    where: { id: a.invitation },
    select: { lots: true, expireLe: true, role: true },
  })
  // Rien de A n'entre dans B par une combinaison d'identifiants mêlés.
  const dansB = {
    affectations: await prisma.affectation.count({
      where: { perimetre: { organisationId: b.org } },
    }),
    messages: await prisma.message.count({ where: { organisationId: b.org } }),
    invitations: await prisma.invitationOrganisation.count({
      where: { organisationId: b.org },
    }),
    membres: await prisma.appartenance.count({
      where: { organisationId: b.org },
    }),
    droits: await prisma.droitRedaction.count({
      where: { organisationId: b.org },
    }),
    declinaisons: await prisma.tache.count({
      where: { perimetre: { organisationId: b.org } },
    }),
    demande: await prisma.demande.findUnique({
      where: { id: b.demande },
      select: { statut: true },
    }),
    tache: await prisma.tache.findUnique({
      where: { id: b.tache },
      select: { statut: true, _count: { select: { assignations: true } } },
    }),
  }
  return JSON.stringify({
    dansB,
    invitation,
    tache,
    fiche,
    perimetre,
    activite,
    edition,
    referente,
    compteurs,
  })
}

const ACTEURS = [
  ['l’admin de l’organisation B', () => b.admin],
  ['l’admin d’une autre activité de A', () => a.adminAutre],
  ['une référente d’une autre activité de A', () => a.referenteAutre],
] as const

describe.each(ACTEURS)(
  'refus croisés : %s ne touche à rien de l’activité de A',
  (_nom, qui) => {
    let reference = ''
    beforeAll(async () => {
      acteur = qui()
      reference = await etatDeA()
    })

    for (const cas of CAS) {
      it(`${cas.operation} (${JSON.stringify(Object.keys(cas.variables()))})`, async () => {
        const r = await executer(cas.query, cas.variables())
        if ('refus' in cas.attente) {
          expect(r.errors?.[0]?.extensions?.code).toBeOneOf(cas.attente.refus)
        } else if (r.errors !== undefined) {
          expect(r.errors[0]?.extensions?.code).toBe('FORBIDDEN')
        } else {
          expect(r.errors).toBeUndefined()
          cas.attente.sansEffet(r.data as Record<string, unknown>)
        }
        expect(await etatDeA()).toBe(reference)
      })
    }
  }
)

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
