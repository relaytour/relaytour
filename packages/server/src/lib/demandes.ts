import type { PrismaClient } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { aujourdhui } from './droits.ts'
import { erreurSaisie } from './erreurs.ts'
import { publierNotification } from './flux.ts'
import { journal } from './journal.ts'

// Demandes pour rejoindre l'équipe d'une période (ADR 0015).
//
// Une demande porte le nom et l'adresse d'une personne qui n'est pas encore dans
// l'équipe : un·e référent·e la propose pour son périmètre, ou elle vient du
// formulaire public. Aucun compte n'existe avant qu'un admin de l'activité accepte la
// demande. Une demande ne donne aucun accès, et lib/droits.ts ne lit jamais ces
// tables. Les admins de l'activité lisent ses demandes ; la personne qui propose ne
// lit que ses propres propositions, sans adresse. Les demandes vivent en base
// seulement : elles ne sont jamais exportées dans Git.

/** Propositions en attente qu'une même personne peut avoir en cours. */
export const PROPOSITIONS_EN_ATTENTE_MAX = 20

const MOT_MAX = 280

/** Le mot facultatif d'une proposition : rogné, 280 caractères au plus, ou null. */
export function motValide(brut: string | null | undefined): string | null {
  const mot = (brut ?? '').trim()
  if (mot === '') return null
  if (mot.length > MOT_MAX) {
    throw erreurSaisie(`Le mot compte ${MOT_MAX} caractères au plus.`)
  }
  return mot
}

// Mail regroupé aux admins (ADR 0016). Les demandes d'une activité se regroupent par
// fenêtre fixe d'une heure : le premier signalement d'une fenêtre place un mail
// différé jusqu'à sa fin, les suivants retrouvent le même identifiant de job et
// BullMQ les ignore. À l'envoi, le mail compte les demandes en attente de
// l'activité : une demande traitée entre-temps ne s'annonce pas.
//
// La fenêtre se déduit de l'heure du signalement, qui suit la validation de la
// transaction. Le mail d'une fenêtre part à sa fin : toute demande signalée pendant
// la fenêtre est donc déjà en base quand il se compose, et aucun signalement ne
// retrouve l'identifiant d'un job déjà traité.

export const FENETRE_DEMANDES_MS = 60 * 60 * 1000

/** Le début et la fin, en millisecondes, de la fenêtre qui contient l'instant donné. */
export function fenetreDemandes(maintenant = Date.now()): {
  debut: number
  fin: number
} {
  const debut =
    Math.floor(maintenant / FENETRE_DEMANDES_MS) * FENETRE_DEMANDES_MS
  return { debut, fin: debut + FENETRE_DEMANDES_MS }
}

/**
 * Les personnes à prévenir d'une demande : les admins de l'activité, sinon ceux de
 * l'organisation. Un compte archivé ne reçoit rien.
 */
export async function adminsAPrevenir(
  prisma: PrismaClient,
  organisationId: string,
  activiteId: string
): Promise<string[]> {
  const actif = { archivedAt: null }
  const deLActivite = await prisma.adminActivite.findMany({
    where: { activiteId, organisationId, user: actif },
    select: { userId: true },
  })
  const admins =
    deLActivite.length > 0
      ? deLActivite
      : await prisma.appartenance.findMany({
          where: { organisationId, role: 'ADMIN', user: actif },
          select: { userId: true },
        })
  return admins.map(a => a.userId)
}

/** Le nombre de demandes d'une activité qui attendent une décision. */
export function demandesEnAttente(
  prisma: PrismaClient,
  activiteId: string
): Promise<number> {
  return prisma.demande.count({
    where: {
      activiteId,
      statut: 'EN_ATTENTE',
      edition: { statut: { not: 'ARCHIVEE' } },
    },
  })
}

/**
 * Prévient les admins qu'une demande attend leur revue : les admins de l'activité,
 * sinon ceux de l'organisation. Chaque admin reçoit au plus une notification par
 * activité et par jour, garantie par sa clé, et au plus un mail par activité et par
 * heure (ADR 0016). Ne lève jamais : une notification manquée ne doit pas faire
 * échouer la demande.
 *
 * L'appel suit la validation de la transaction qui écrit la demande : le mail de la
 * fenêtre en cours la trouvera en base.
 */
export async function signalerDemande(
  prisma: PrismaClient,
  demande: { organisationId: string; activiteId: string; acteurId?: string },
  maintenant = new Date()
): Promise<void> {
  const { organisationId, activiteId, acteurId } = demande
  try {
    const admins = await adminsAPrevenir(prisma, organisationId, activiteId)
    // Le jour se compte dans le fuseau de l'organisation, comme ses rappels.
    const { fuseauHoraire } = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { fuseauHoraire: true },
    })
    const jour = aujourdhui(maintenant, fuseauHoraire)
    const fenetre = fenetreDemandes(maintenant.getTime())
    for (const userId of admins) {
      if (userId === acteurId) continue
      // BullMQ refuse « : » dans un identifiant de job. Le worker relit la
      // préférence et le rôle de la personne au moment de l'envoi.
      await mettreEnFile(
        'demandes',
        { userId },
        {
          organisationId,
          activiteId,
          jobId: `demandes-${activiteId}-${userId}-${fenetre.debut}`,
          delai: fenetre.fin - maintenant.getTime(),
        }
      )
      try {
        await prisma.notification.create({
          data: {
            organisationId,
            userId,
            type: 'DEMANDE_RECUE',
            acteurId: acteurId ?? null,
            activiteId,
            cle: `DEMANDE_RECUE-${activiteId}-${userId}-${jour}`,
          },
        })
        publierNotification(organisationId, userId)
      } catch (erreur) {
        // P2002 : cet admin est déjà prévenu aujourd'hui pour cette activité.
        if ((erreur as { code?: string }).code !== 'P2002') throw erreur
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type: 'DEMANDE_RECUE',
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}

/**
 * Supprime les demandes des périodes archivées (ADR 0015), quel que soit leur état :
 * les admins les lisent jusqu'à l'archivage de la période, pas au-delà. Les comptes,
 * les affectations et les souhaits créés par une acceptation restent. La purge
 * parcourt chaque organisation, quel que soit son statut : une organisation
 * suspendue ne garde pas des données de personnes non membres. `organisationId` la
 * limite à une organisation.
 */
export async function purgerDemandes(
  prisma: PrismaClient,
  options: { organisationId?: string } = {}
): Promise<number> {
  const organisations = await prisma.organisation.findMany({
    where:
      options.organisationId === undefined
        ? {}
        : { id: options.organisationId },
    select: { id: true },
  })
  let supprimees = 0
  for (const { id: organisationId } of organisations) {
    const { count } = await prisma.demande.deleteMany({
      where: { organisationId, edition: { statut: 'ARCHIVEE' } },
    })
    if (count > 0) {
      journal.info(
        { evenement: 'demandes-purgees', organisationId, demandes: count },
        'Les demandes des périodes archivées ont été supprimées.'
      )
    }
    supprimees += count
  }
  return supprimees
}
