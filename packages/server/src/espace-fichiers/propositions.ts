import {
  prisma,
  type AccesFournisseurDossier,
  type EtatAccesFournisseur,
} from '@relaytour/database'

import { journal } from '../lib/journal.ts'
import { notifierLesAdmins } from '../lib/notifications-admin.ts'

import { ouvrirEspace } from './index.ts'
import type {
  AnnuaireFournisseur,
  CompteAnnuaire,
  DroitElement,
  Position,
} from './types.ts'

// Propositions d'accès chez le fournisseur (ADR 0044). Relaytour propose
// d'ajouter les personnes attendues qui n'ont pas accès, et de retirer les droits
// qu'il a lui-même créés pour des personnes qui ne sont plus attendues. Un admin
// de l'organisation applique ou écarte chaque proposition ; un réglage du dossier
// applique les ajouts sans attendre. Un droit posé à la main n'est jamais retiré.

/** Le préfixe d'un droit créé par l'entrée dans un groupe. */
const PREFIXE_GROUPE = 'groupe:'

/** Une proposition ne garde qu'un message court et sans donnée personnelle. */
const message = (erreur: unknown) =>
  `Le fournisseur a refusé l’opération : ${(erreur as Error).message}`.slice(
    0,
    255
  )

export interface DossierAGerer {
  id: string
  emplacement: string
  element: string
  activiteId: string
  accesFournisseur: AccesFournisseurDossier
  groupeFournisseurId: string | null
  ajoutsAutomatiques: boolean
}

/** Retire de la table les droits créés par Relaytour qui n'existent plus chez le fournisseur. */
export async function elaguerPermissions(
  dossierLieId: string,
  droits: DroitElement[],
  comptes: Map<string, CompteAnnuaire | null>,
  membres: (groupe: string) => Promise<CompteAnnuaire[] | null>
): Promise<void> {
  const creees = await prisma.permissionCreee.findMany({
    where: { dossierLieId },
  })
  const identifiants = new Set(droits.map(d => d.identifiant))
  for (const p of creees) {
    let present = true
    if (p.identifiant.startsWith(PREFIXE_GROUPE)) {
      const lus = await membres(p.identifiant.slice(PREFIXE_GROUPE.length))
      const compte = comptes.get(p.userId)
      // Un groupe illisible, ou une personne non cherchée : le droit reste.
      if (lus !== null && compte !== undefined && compte !== null) {
        present = lus.some(m => m.identifiant === compte.identifiant)
      }
    } else {
      present = identifiants.has(p.identifiant)
    }
    if (!present) await prisma.permissionCreee.delete({ where: { id: p.id } })
  }
}

/**
 * Met à jour les propositions d'un dossier après une vérification. Rend le
 * nombre de propositions nouvelles qui attendent un admin.
 */
export async function mettreAJourPropositions(
  organisationId: string,
  dossier: DossierAGerer,
  lignes: { userId: string | null; etat: EtatAccesFournisseur }[],
  annuaire: AnnuaireFournisseur
): Promise<number> {
  if (dossier.accesFournisseur === 'AUCUN') {
    await prisma.propositionAcces.deleteMany({
      where: { dossierLieId: dossier.id, etat: 'EN_ATTENTE' },
    })
    return 0
  }
  const partage = dossier.accesFournisseur === 'PARTAGE'
  const attendus = new Set(
    lignes.flatMap(l => (l.userId === null ? [] : [l.userId]))
  )
  // Un partage invite aussi une personne sans compte ; un groupe ne le peut pas.
  const ajouts = new Set(
    lignes.flatMap(l =>
      l.userId !== null &&
      (l.etat === 'SANS_ACCES' || (partage && l.etat === 'SANS_COMPTE'))
        ? [l.userId]
        : []
    )
  )
  const retraits = new Set(
    (
      await prisma.permissionCreee.findMany({
        where: { dossierLieId: dossier.id },
        select: { userId: true },
      })
    )
      .map(p => p.userId)
      .filter(id => !attendus.has(id))
  )
  const enAttente = await prisma.propositionAcces.findMany({
    where: { dossierLieId: dossier.id, etat: 'EN_ATTENTE' },
    select: { id: true, userId: true, action: true },
  })
  // Une proposition devenue sans objet disparaît : personne n'y a touché.
  const obsoletes = enAttente.filter(p =>
    p.action === 'AJOUTER' ? !ajouts.has(p.userId) : !retraits.has(p.userId)
  )
  await prisma.propositionAcces.deleteMany({
    where: { id: { in: obsoletes.map(p => p.id) } },
  })
  // Une proposition écartée ne revient pas tant que la situation de la personne
  // ne change pas : l'écart s'efface quand la proposition perd son objet.
  const ecartees = await prisma.propositionAcces.findMany({
    where: { dossierLieId: dossier.id, etat: 'ECARTEE' },
    select: { id: true, userId: true, action: true },
  })
  await prisma.propositionAcces.deleteMany({
    where: {
      id: {
        in: ecartees
          .filter(p =>
            p.action === 'AJOUTER'
              ? !ajouts.has(p.userId)
              : !retraits.has(p.userId)
          )
          .map(p => p.id),
      },
    },
  })
  const deja = new Set(
    [...enAttente, ...ecartees].map(p => `${p.action}:${p.userId}`)
  )
  const nouvelles = [
    ...[...ajouts].map(userId => ({ userId, action: 'AJOUTER' as const })),
    ...[...retraits].map(userId => ({ userId, action: 'RETIRER' as const })),
  ].filter(p => !deja.has(`${p.action}:${p.userId}`))
  // Une nouvelle proposition remplace l'échec de la même proposition.
  for (const p of nouvelles) {
    await prisma.propositionAcces.deleteMany({
      where: {
        dossierLieId: dossier.id,
        userId: p.userId,
        action: p.action,
        etat: 'ECHEC',
      },
    })
  }
  await prisma.propositionAcces.createMany({
    data: nouvelles.map(p => ({
      organisationId,
      dossierLieId: dossier.id,
      ...p,
    })),
  })
  let attente = nouvelles.length
  const peutAjouter = partage
    ? annuaire.partager !== undefined
    : annuaire.ajouterAuGroupe !== undefined
  if (dossier.ajoutsAutomatiques && peutAjouter) {
    const automatiques = await prisma.propositionAcces.findMany({
      where: {
        dossierLieId: dossier.id,
        etat: 'EN_ATTENTE',
        action: 'AJOUTER',
      },
      select: { id: true },
    })
    for (const p of automatiques) {
      await appliquerProposition(organisationId, p.id, null)
    }
    attente = nouvelles.filter(p => p.action === 'RETIRER').length
  }
  return attente
}

/** Prévient les admins de l'organisation, une fois par jour au plus. */
export async function annoncerPropositions(
  organisationId: string
): Promise<void> {
  const jour = new Date()
  jour.setUTCHours(0, 0, 0, 0)
  await notifierLesAdmins(
    prisma,
    {
      type: 'ACCES_FOURNISSEUR_A_VALIDER',
      organisationId,
      activiteId: null,
      acteurId: null,
    },
    jour.getTime()
  )
}

/**
 * Applique une proposition chez le fournisseur. `acteurId` est nul pour un ajout
 * automatique. Une erreur du fournisseur passe la proposition en échec, sans
 * lever : les propositions suivantes continuent.
 */
export async function appliquerProposition(
  organisationId: string,
  id: string,
  acteurId: string | null
): Promise<'APPLIQUEE' | 'ECHEC' | null> {
  const p = await prisma.propositionAcces.findFirst({
    where: { id, organisationId, etat: 'EN_ATTENTE' },
    include: {
      user: { select: { email: true } },
      dossierLie: true,
    },
  })
  if (p === null) return null
  const d = p.dossierLie
  const position: Position = {
    emplacement: d.emplacement,
    base: d.element,
    chemin: [],
  }
  try {
    const { espace } = await ouvrirEspace(organisationId)
    const annuaire = espace.annuaire
    if (annuaire === undefined || espace.fournisseur !== d.fournisseur) {
      throw new Error('la connexion ne permet pas la gestion des accès.')
    }
    const compte = await prisma.compteFournisseur.findUnique({
      where: {
        organisationId_fournisseur_userId: {
          organisationId,
          fournisseur: d.fournisseur,
          userId: p.userId,
        },
      },
      select: { identifiant: true, adresseSaisie: true },
    })
    if (p.action === 'AJOUTER') {
      let identifiant: string
      if (d.accesFournisseur === 'PARTAGE') {
        if (annuaire.partager === undefined) {
          throw new Error('le partage n’est pas permis par la connexion.')
        }
        identifiant = (
          await annuaire.partager(
            position,
            { adresse: compte?.adresseSaisie ?? p.user.email },
            { role: d.roleFournisseur, invitation: d.invitationFournisseur }
          )
        ).identifiant
      } else if (d.accesFournisseur === 'GROUPE') {
        if (
          annuaire.ajouterAuGroupe === undefined ||
          d.groupeFournisseurId === null
        ) {
          throw new Error('aucun groupe n’est choisi pour ce dossier.')
        }
        if (compte?.identifiant == null) {
          throw new Error('la personne n’a pas de compte dans l’annuaire.')
        }
        await annuaire.ajouterAuGroupe(
          d.groupeFournisseurId,
          compte.identifiant
        )
        identifiant = `${PREFIXE_GROUPE}${d.groupeFournisseurId}`
      } else {
        throw new Error('le dossier ne propose plus d’accès.')
      }
      await prisma.permissionCreee.upsert({
        where: {
          dossierLieId_userId: { dossierLieId: d.id, userId: p.userId },
        },
        create: {
          organisationId,
          dossierLieId: d.id,
          userId: p.userId,
          identifiant,
        },
        update: { identifiant },
      })
    } else {
      const creee = await prisma.permissionCreee.findUnique({
        where: {
          dossierLieId_userId: { dossierLieId: d.id, userId: p.userId },
        },
      })
      if (creee !== null) {
        if (creee.identifiant.startsWith(PREFIXE_GROUPE)) {
          if (
            annuaire.retirerDuGroupe === undefined ||
            compte?.identifiant == null
          ) {
            throw new Error('le retrait du groupe n’est pas possible.')
          }
          await annuaire.retirerDuGroupe(
            creee.identifiant.slice(PREFIXE_GROUPE.length),
            compte.identifiant
          )
        } else {
          if (annuaire.retirerPartage === undefined) {
            throw new Error('le retrait du partage n’est pas permis.')
          }
          await annuaire.retirerPartage(position, creee.identifiant)
        }
        await prisma.permissionCreee.delete({ where: { id: creee.id } })
      }
    }
    await prisma.propositionAcces.update({
      where: { id: p.id },
      data: {
        etat: 'APPLIQUEE',
        erreur: null,
        traiteeParId: acteurId,
        traiteeLe: new Date(),
      },
    })
    journal.info(
      {
        evenement: 'proposition-acces-appliquee',
        organisationId,
        propositionId: p.id,
        action: p.action,
        acteurId,
      },
      'Une proposition d’accès est appliquée chez le fournisseur.'
    )
    return 'APPLIQUEE'
  } catch (erreur) {
    await prisma.propositionAcces.update({
      where: { id: p.id },
      data: {
        etat: 'ECHEC',
        erreur: message(erreur),
        traiteeParId: acteurId,
        traiteeLe: new Date(),
      },
    })
    journal.warn(
      {
        evenement: 'proposition-acces-en-echec',
        organisationId,
        propositionId: p.id,
        message: (erreur as Error).message,
      },
      'Une proposition d’accès a échoué chez le fournisseur.'
    )
    return 'ECHEC'
  }
}
