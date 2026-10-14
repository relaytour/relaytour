import type {
  NiveauNotification,
  PrismaClient,
  StatutTache,
  TypeNotification,
} from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { membreActif } from './appartenances.ts'
import { publierNotification } from './flux.ts'
import { pousser } from './push-file.ts'

import { journal } from './journal.ts'

export const PREFERENCES_PAR_DEFAUT = {
  frequenceResume: 'HEBDOMADAIRE',
  mailModification: true,
  mailEcheance: true,
  applicationPerimetre: true,
  pushTaches: true,
  pushEcheances: true,
  mailDemandes: true,
  pushDemandes: true,
  applicationEquipe: true,
  pushEquipe: false,
  resumeAdmin: true,
  dernierResumeLe: null,
} as const

/**
 * Les préférences d'une personne dans une organisation (ADR 0032). Sans ligne, les
 * valeurs par défaut : une organisation ne reprend jamais les réglages d'une autre.
 */
export async function preferencesDe(
  prisma: PrismaClient,
  userId: string,
  organisationId: string
) {
  return (
    (await prisma.preferenceOrganisation.findUnique({
      where: { userId_organisationId: { userId, organisationId } },
    })) ?? { userId, organisationId, ...PREFERENCES_PAR_DEFAUT }
  )
}

/**
 * Les référentes et référents à prévenir de l'activité d'un périmètre : les personnes
 * affectées, sauf l'acteur et celles qui ont coupé ces notifications dans leurs
 * préférences. Avec une édition, ses personnes affectées ; sans édition (une fiche
 * vaut pour toutes les périodes), celles des éditions non archivées.
 */
export async function referentsAPrevenir(
  prisma: PrismaClient,
  perimetreId: string,
  editionId: string | null,
  acteurId: string
): Promise<string[]> {
  const perimetre = await prisma.perimetre.findUnique({
    where: { id: perimetreId },
    select: { organisationId: true },
  })
  if (perimetre === null) return []
  const affectations = await prisma.affectation.findMany({
    where: {
      perimetreId,
      ...(editionId === null
        ? { edition: { statut: { not: 'ARCHIVEE' } } }
        : { editionId }),
      userId: { not: acteurId },
      // Une personne archivée dans l'organisation ne reçoit rien (ADR 0031).
      user: membreActif(perimetre.organisationId),
    },
    select: { userId: true },
    distinct: ['userId'],
  })
  const ids = affectations.map(a => a.userId)
  if (ids.length === 0) return []
  const coupees = await prisma.preferenceOrganisation.findMany({
    where: {
      userId: { in: ids },
      organisationId: perimetre.organisationId,
      applicationPerimetre: false,
    },
    select: { userId: true },
  })
  const sans = new Set(coupees.map(c => c.userId))
  return ids.filter(id => !sans.has(id))
}

/** Une même action répétée dans cette durée ne prévient qu'une fois. */
export const TRANCHE_PERIMETRE_MS = 10 * 60 * 1000

/**
 * Prévient les autres référentes et référents d'un périmètre qu'une personne a agi
 * sur une de ses tâches ou de ses fiches. La notification reste dans l'application :
 * aucun mail immédiat ne part, le résumé la reprend. Une clé par action, auteur,
 * destinataire et tranche de dix minutes évite le bruit d'une série de corrections.
 * Ne lève jamais.
 *
 * Un passage à « faite » ne garde pas son auteur : qui a coché une tâche reste
 * réservé à la personne qui a coché et aux admins.
 */
export async function notifierLePerimetre(
  prisma: PrismaClient,
  notification: {
    type:
      | 'TACHE_MODIFIEE'
      | 'TACHE_STATUT'
      | 'TACHE_COMMENTEE'
      | 'FICHE_CREEE'
      | 'FICHE_MODIFIEE'
    perimetreId: string
    /** L'édition de la tâche, ou null pour une fiche. */
    editionId: string | null
    acteurId: string
    tacheId?: string
    ficheId?: string
    statut?: StatutTache
    /** Les personnes déjà prévenues par une autre voie. */
    sauf?: string[]
  },
  maintenant = Date.now()
): Promise<void> {
  const { type, perimetreId, acteurId, statut } = notification
  try {
    const sauf = new Set(notification.sauf ?? [])
    const destinataires = (
      await referentsAPrevenir(
        prisma,
        perimetreId,
        notification.editionId,
        acteurId
      )
    ).filter(id => !sauf.has(id))
    if (destinataires.length === 0) return
    const { organisationId } = await prisma.perimetre.findUniqueOrThrow({
      where: { id: perimetreId },
      select: { organisationId: true },
    })
    const cible = notification.tacheId ?? notification.ficheId ?? perimetreId
    const tranche = Math.floor(maintenant / TRANCHE_PERIMETRE_MS)
    for (const userId of destinataires) {
      try {
        await prisma.notification.create({
          data: {
            organisationId,
            userId,
            type,
            acteurId: statut === 'FAITE' ? null : acteurId,
            tacheId: notification.tacheId ?? null,
            ficheId: notification.ficheId ?? null,
            perimetreId,
            statut: statut ?? null,
            // La clé d'un passage à « faite » ne porte pas son auteur non plus.
            cle: `${type}-${cible}-${statut ?? ''}-${statut === 'FAITE' ? '' : acteurId}-${userId}-${tranche}`,
          },
        })
        publierNotification(organisationId, userId)
      } catch (erreur) {
        // P2002 : cette personne est déjà prévenue de cette action dans la tranche.
        if ((erreur as { code?: string }).code !== 'P2002') throw erreur
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type,
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}

/**
 * Crée une notification par destinataire. Ne lève jamais : une notification manquée
 * ne doit pas faire échouer l'action qui l'a produite.
 *
 * Avec `mailImmediat`, la notification part aussi par mail (règle de collaboration
 * n° 2). Le worker vérifie la préférence du destinataire au moment de l'envoi.
 *
 * Un passage à « faite » (`statut: 'FAITE'`) ne garde son auteur ni dans la
 * notification ni dans le mail : qui a coché une tâche reste réservé à la personne
 * qui a coché et aux admins.
 */
export async function notifier(
  prisma: PrismaClient,
  notification: {
    type: TypeNotification
    destinataires: string[]
    acteurId: string
    tacheId: string
    perimetreId: string
    personneId?: string
    changement?: 'contenu' | 'statut'
    /** Pour TACHE_STATUT : le nouveau statut. */
    statut?: StatutTache
  },
  options: { mailImmediat?: boolean } = {}
): Promise<void> {
  const anonyme = notification.statut === 'FAITE'
  const destinataires = [...new Set(notification.destinataires)].filter(
    id => id !== notification.acteurId
  )
  if (destinataires.length === 0) return
  try {
    // La notification appartient à l'organisation du périmètre (ADR 0008).
    const { organisationId } = await prisma.perimetre.findUniqueOrThrow({
      where: { id: notification.perimetreId },
      select: { organisationId: true },
    })
    for (const userId of destinataires) {
      const creee = await prisma.notification.create({
        data: {
          organisationId,
          userId,
          type: notification.type,
          acteurId: anonyme ? null : notification.acteurId,
          tacheId: notification.tacheId,
          perimetreId: notification.perimetreId,
          personneId: notification.personneId ?? null,
          statut: notification.statut ?? null,
        },
        select: { id: true },
      })
      publierNotification(organisationId, userId)
      // Push (ADR 0024) : la modification d'une tâche assignée, et l'assignation
      // ou le retrait qui concerne le destinataire lui-même. Ce que la personne
      // apprend comme simple référente du périmètre reste dans la cloche.
      if (
        options.mailImmediat ||
        // Un commentaire prévient en push les personnes assignées (ADR 0029).
        notification.type === 'TACHE_COMMENTEE' ||
        ((notification.type === 'TACHE_ASSIGNEE' ||
          notification.type === 'TACHE_DESASSIGNEE') &&
          notification.personneId === userId)
      )
        await pousser(creee.id)
      if (options.mailImmediat) {
        await mettreEnFile(
          'tache-modifiee',
          { userId },
          {
            tache: {
              tacheId: notification.tacheId,
              ...(anonyme ? {} : { acteurId: notification.acteurId }),
              changement: notification.changement ?? 'contenu',
            },
            notificationId: creee.id,
            organisationId,
          }
        )
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type: notification.type,
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}

/**
 * Le niveau de chaque destinataire : admin de l'activité quand il l'administre,
 * admin de l'organisation sinon (une activité sans admin renvoie ses notifications
 * aux admins de l'organisation).
 */
export async function niveauxDes(
  prisma: Pick<PrismaClient, 'adminActivite'>,
  userIds: string[],
  activiteId: string | null
): Promise<Map<string, NiveauNotification>> {
  const adminsActivite =
    activiteId === null || userIds.length === 0
      ? new Set<string>()
      : new Set(
          (
            await prisma.adminActivite.findMany({
              where: { activiteId, userId: { in: userIds } },
              select: { userId: true },
            })
          ).map(a => a.userId)
        )
  return new Map(
    userIds.map(id => [
      id,
      adminsActivite.has(id) ? 'ADMIN_ACTIVITE' : 'ADMIN_ORGANISATION',
    ])
  )
}
