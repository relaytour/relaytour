import type { PrismaClient } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { aujourdhui } from './droits.ts'
import { erreurSaisie } from './erreurs.ts'
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
// fenêtre fixe d'une heure : la première demande d'une fenêtre place un mail différé
// jusqu'à sa fin, les suivantes retrouvent le même identifiant de job et BullMQ les
// ignore. À l'envoi, le mail compte les demandes reçues pendant la fenêtre qui
// attendent encore : une demande traitée entre-temps ne s'annonce pas.

export const FENETRE_DEMANDES_MS = 60 * 60 * 1000
/** Marge après la fin de la fenêtre, pour qu'une écriture de la dernière seconde soit lue. */
const MARGE_MS = 5_000

export interface FenetreDemandes {
  debut: string
  fin: string
}

/** La fenêtre de regroupement qui contient l'instant donné. */
export function fenetreDemandes(maintenant = Date.now()): FenetreDemandes {
  const debut =
    Math.floor(maintenant / FENETRE_DEMANDES_MS) * FENETRE_DEMANDES_MS
  return {
    debut: new Date(debut).toISOString(),
    fin: new Date(debut + FENETRE_DEMANDES_MS).toISOString(),
  }
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

/**
 * Le nombre de demandes d'une activité reçues pendant une fenêtre et encore en
 * attente, pour le mail d'un admin. Une demande compte par sa date de dépôt, ou par
 * la date d'une proposition qui la complète. Les propositions de l'admin lui-même ne
 * comptent pas : il les connaît.
 */
export function demandesRecues(
  prisma: PrismaClient,
  activiteId: string,
  fenetre: FenetreDemandes,
  adminId: string
): Promise<number> {
  const pendant = { gte: new Date(fenetre.debut), lt: new Date(fenetre.fin) }
  return prisma.demande.count({
    where: {
      activiteId,
      statut: 'EN_ATTENTE',
      edition: { statut: { not: 'ARCHIVEE' } },
      OR: [
        { origine: 'FORMULAIRE', createdAt: pendant },
        {
          perimetres: {
            some: { createdAt: pendant, proposeParId: { not: adminId } },
          },
        },
      ],
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
 * `instant` est la date écrite en base avec la demande ou avec la proposition : la
 * fenêtre du mail se déduit d'elle, jamais de l'heure du signalement, sinon une
 * demande écrite juste avant la fin d'une fenêtre serait cherchée dans la suivante.
 */
export async function signalerDemande(
  prisma: PrismaClient,
  demande: {
    organisationId: string
    activiteId: string
    acteurId?: string
    instant?: Date
  },
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
    const fenetre = fenetreDemandes((demande.instant ?? maintenant).getTime())
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
          jobId: `demandes-${activiteId}-${userId}-${Date.parse(fenetre.debut)}`,
          delai: Date.parse(fenetre.fin) - maintenant.getTime() + MARGE_MS,
          fenetre,
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
