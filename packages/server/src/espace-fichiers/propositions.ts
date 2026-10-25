import {
  prisma,
  type AccesFournisseurDossier,
  type EtatAccesFournisseur,
  type RoleFournisseur,
} from '@relaytour/database'

import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import { notifierLesAdmins } from '../lib/notifications-admin.ts'

import { ouvrirEspace } from './index.ts'
import type {
  AnnuaireFournisseur,
  Beneficiaire,
  CompteAnnuaire,
  DroitElement,
  Position,
} from './types.ts'

// Propositions d'accès chez le fournisseur (ADR 0044). Relaytour propose
// d'ajouter les personnes attendues qui n'ont pas accès, et de retirer les droits
// qu'il a lui-même créés pour des personnes qui ne sont plus attendues. Un admin
// de l'organisation applique ou écarte chaque proposition ; un réglage du dossier
// applique les ajouts sans attendre. Avant chaque écriture, Relaytour relit les
// droits : il ne s'approprie pas un droit posé à la main, et ne retire un droit
// que s'il le retrouve tel qu'il l'a créé.

/** Le préfixe d'un droit créé par l'entrée dans un groupe. */
const PREFIXE_GROUPE = 'groupe:'

/** Une raison de ne pas appliquer, rendue telle quelle dans la proposition. */
class Refus extends Error {}

/** Une proposition ne garde qu'un message court et sans donnée personnelle. */
const message = (erreur: unknown) =>
  (erreur instanceof Refus
    ? erreur.message
    : i18n._('Le fournisseur a refusé l’opération : {detail}', {
        detail: (erreur as Error).message,
      })
  ).slice(0, 255)

export interface DossierAGerer {
  id: string
  emplacement: string
  element: string
  activiteId: string
  accesFournisseur: AccesFournisseurDossier
  groupeFournisseurId: string | null
  ajoutsAutomatiques: boolean
}

/** Ce que Relaytour a créé, tel que `PermissionCreee` le garde. */
interface TraceCreee {
  identifiant: string
  role: RoleFournisseur | null
  adresse: string | null
  compte: string | null
}

/** Vrai quand ce bénéficiaire désigne cette personne : même adresse, ou même compte. */
function vise(
  b: Beneficiaire,
  cible: { adresse: string | null; compte: string | null }
): boolean {
  if (b.type !== 'personne') return false
  return (
    (b.adresse !== null &&
      cible.adresse !== null &&
      b.adresse === cible.adresse) ||
    (b.identifiant !== null &&
      cible.compte !== null &&
      b.identifiant === cible.compte)
  )
}

/**
 * Vrai quand un partage créé par Relaytour existe toujours tel quel : même
 * identifiant, propre au dossier, même personne et même rôle. Un droit modifié à
 * la main n'appartient plus à Relaytour.
 */
export function partageIntact(
  creee: TraceCreee,
  droits: DroitElement[]
): boolean {
  if (
    creee.role === null ||
    (creee.adresse === null && creee.compte === null)
  ) {
    return false
  }
  const droit = droits.find(d => d.identifiant === creee.identifiant)
  return (
    droit !== undefined &&
    !droit.herite &&
    droit.role === creee.role &&
    vise(droit.beneficiaire, creee)
  )
}

/**
 * Retire de la table les droits créés par Relaytour qui n'existent plus tels
 * quels chez le fournisseur. Des droits illisibles (`null`) ne retirent rien.
 */
export async function elaguerPermissions(
  dossierLieId: string,
  droits: DroitElement[] | null,
  membres: (groupe: string) => Promise<CompteAnnuaire[] | null>
): Promise<void> {
  if (droits === null) return
  const creees = await prisma.permissionCreee.findMany({
    where: { dossierLieId },
  })
  for (const p of creees) {
    let garde: boolean
    if (p.identifiant.startsWith(PREFIXE_GROUPE)) {
      const lus = await membres(p.identifiant.slice(PREFIXE_GROUPE.length))
      // Un groupe illisible : le droit reste.
      garde =
        lus === null ||
        (p.compte !== null && lus.some(m => m.identifiant === p.compte))
    } else {
      garde = partageIntact(p, droits)
    }
    if (!garde) await prisma.permissionCreee.deleteMany({ where: { id: p.id } })
  }
}

/**
 * Met à jour les propositions d'un dossier après une vérification. Rend le
 * nombre de propositions nouvelles qui attendent un admin. `resteAttendu` dit si
 * une personne reste attendue par un autre dossier qui passe par ce groupe : la
 * sortir du groupe lui couperait cet autre dossier.
 */
export async function mettreAJourPropositions(
  organisationId: string,
  dossier: DossierAGerer,
  lignes: { userId: string | null; etat: EtatAccesFournisseur }[],
  annuaire: AnnuaireFournisseur,
  resteAttendu: (groupe: string, userId: string) => boolean
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
        select: { userId: true, identifiant: true },
      })
    )
      .filter(
        p =>
          !attendus.has(p.userId) &&
          !(
            p.identifiant.startsWith(PREFIXE_GROUPE) &&
            resteAttendu(p.identifiant.slice(PREFIXE_GROUPE.length), p.userId)
          )
      )
      .map(p => p.userId)
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
    where: { id: { in: obsoletes.map(p => p.id) }, etat: 'EN_ATTENTE' },
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
  // Une proposition en cours d'application ne se double pas.
  const enCours = await prisma.propositionAcces.findMany({
    where: { dossierLieId: dossier.id, etat: 'EN_COURS' },
    select: { userId: true, action: true },
  })
  const deja = new Set(
    [...enAttente, ...ecartees, ...enCours].map(p => `${p.action}:${p.userId}`)
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
 * automatique. La proposition se réserve d'abord : une seconde application
 * simultanée rend null. Une erreur passe la proposition en échec, sans lever :
 * les propositions suivantes continuent.
 */
export async function appliquerProposition(
  organisationId: string,
  id: string,
  acteurId: string | null
): Promise<'APPLIQUEE' | 'ECHEC' | null> {
  const { count } = await prisma.propositionAcces.updateMany({
    where: { id, organisationId, etat: 'EN_ATTENTE' },
    data: { etat: 'EN_COURS' },
  })
  if (count === 0) return null
  const p = await prisma.propositionAcces.findUniqueOrThrow({
    where: { id },
    include: {
      user: { select: { email: true } },
      dossierLie: true,
    },
  })
  const d = p.dossierLie
  const position: Position = {
    emplacement: d.emplacement,
    base: d.element,
    chemin: [],
  }
  const terminer = async (
    etat: 'APPLIQUEE' | 'ECHEC',
    erreur: string | null
  ) => {
    await prisma.propositionAcces.update({
      where: { id: p.id },
      data: { etat, erreur, traiteeParId: acteurId, traiteeLe: new Date() },
    })
    return etat
  }
  try {
    const { espace } = await ouvrirEspace(organisationId)
    const annuaire = espace.annuaire
    if (annuaire === undefined || espace.fournisseur !== d.fournisseur) {
      throw new Refus(
        i18n._('La connexion ne permet pas la gestion des accès.')
      )
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
    const cible = {
      adresse: (compte?.adresseSaisie ?? p.user.email).toLowerCase(),
      compte: compte?.identifiant ?? null,
    }
    const relireDroits = async () => {
      const droits = await annuaire.droits(position)
      if (droits === null) {
        throw new Refus(
          i18n._(
            'Relaytour ne lit pas les droits de ce dossier : rien n’a changé.'
          )
        )
      }
      return droits
    }
    const relireGroupe = async (groupe: string) => {
      const membres = await annuaire.membresDuGroupe(groupe)
      if (membres === null) {
        throw new Refus(
          i18n._(
            'Relaytour ne lit pas les membres de ce groupe : rien n’a changé.'
          )
        )
      }
      return membres
    }
    const tracer = (trace: TraceCreee) =>
      prisma.permissionCreee.upsert({
        where: {
          dossierLieId_userId: { dossierLieId: d.id, userId: p.userId },
        },
        create: {
          organisationId,
          dossierLieId: d.id,
          userId: p.userId,
          ...trace,
        },
        update: trace,
      })

    if (p.action === 'AJOUTER') {
      if (d.accesFournisseur === 'PARTAGE') {
        if (annuaire.partager === undefined) {
          throw new Refus(i18n._('La connexion ne permet pas le partage.'))
        }
        // Un droit posé entre-temps, à la main, reste celui de l'association.
        if ((await relireDroits()).some(x => vise(x.beneficiaire, cible))) {
          return await terminer('APPLIQUEE', null)
        }
        const { identifiant } = await annuaire.partager(
          position,
          { adresse: cible.adresse, identifiant: cible.compte },
          { role: d.roleFournisseur, invitation: d.invitationFournisseur }
        )
        await tracer({ identifiant, role: d.roleFournisseur, ...cible })
      } else if (d.accesFournisseur === 'GROUPE') {
        if (
          annuaire.ajouterAuGroupe === undefined ||
          d.groupeFournisseurId === null
        ) {
          throw new Refus(i18n._('Aucun groupe n’est choisi pour ce dossier.'))
        }
        if (cible.compte === null) {
          throw new Refus(
            i18n._('La personne n’a pas de compte dans l’annuaire.')
          )
        }
        const groupe = d.groupeFournisseurId
        if (
          (await relireGroupe(groupe)).some(m => m.identifiant === cible.compte)
        ) {
          return await terminer('APPLIQUEE', null)
        }
        await annuaire.ajouterAuGroupe(groupe, cible.compte)
        await tracer({
          identifiant: `${PREFIXE_GROUPE}${groupe}`,
          role: null,
          ...cible,
        })
      } else {
        throw new Refus(i18n._('Le dossier ne propose plus d’accès.'))
      }
    } else {
      const creee = await prisma.permissionCreee.findUnique({
        where: {
          dossierLieId_userId: { dossierLieId: d.id, userId: p.userId },
        },
      })
      if (creee !== null) {
        if (creee.identifiant.startsWith(PREFIXE_GROUPE)) {
          const groupe = creee.identifiant.slice(PREFIXE_GROUPE.length)
          if (annuaire.retirerDuGroupe === undefined) {
            throw new Refus(
              i18n._('La connexion ne permet pas le retrait du groupe.')
            )
          }
          const present =
            creee.compte !== null &&
            (await relireGroupe(groupe)).some(
              m => m.identifiant === creee.compte
            )
          // Relaytour retire le compte qu'il a ajouté, et non le compte du jour.
          if (present && creee.compte !== null) {
            await annuaire.retirerDuGroupe(groupe, creee.compte)
          }
        } else {
          if (annuaire.retirerPartage === undefined) {
            throw new Refus(
              i18n._('La connexion ne permet pas le retrait du partage.')
            )
          }
          const droits = await relireDroits()
          if (partageIntact(creee, droits)) {
            await annuaire.retirerPartage(position, creee.identifiant)
          } else if (droits.some(x => x.identifiant === creee.identifiant)) {
            // Le droit a changé à la main : il appartient désormais à
            // l'association, et Relaytour l'oublie.
            await prisma.permissionCreee.deleteMany({ where: { id: creee.id } })
            return await terminer(
              'ECHEC',
              i18n._(
                'Ce droit a changé chez le fournisseur depuis sa création : Relaytour ne le retire pas.'
              )
            )
          }
        }
        await prisma.permissionCreee.deleteMany({ where: { id: creee.id } })
      }
    }
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
    return await terminer('APPLIQUEE', null)
  } catch (erreur) {
    journal.warn(
      {
        evenement: 'proposition-acces-en-echec',
        organisationId,
        propositionId: p.id,
        message: (erreur as Error).message,
      },
      'Une proposition d’accès a échoué chez le fournisseur.'
    )
    return terminer('ECHEC', message(erreur))
  }
}
