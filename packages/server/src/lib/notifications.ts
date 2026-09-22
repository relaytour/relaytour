import type { PrismaClient, TypeNotification } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { journal } from './journal.ts'

export const PREFERENCES_PAR_DEFAUT = {
  frequenceResume: 'HEBDOMADAIRE',
  mailModification: true,
  mailEcheance: true,
  dernierResumeLe: null,
} as const

export async function preferencesDe(prisma: PrismaClient, userId: string) {
  return (
    (await prisma.preferenceNotification.findUnique({ where: { userId } })) ?? {
      userId,
      ...PREFERENCES_PAR_DEFAUT,
    }
  )
}

/** Les personnes affectées à un périmètre pour une édition, sauf l'acteur. */
export async function referentsSauf(
  prisma: PrismaClient,
  perimetreId: string,
  editionId: string,
  acteurId: string
): Promise<string[]> {
  const affectations = await prisma.affectation.findMany({
    where: {
      perimetreId,
      editionId,
      userId: { not: acteurId },
      user: { archivedAt: null },
    },
    select: { userId: true },
  })
  return affectations.map(a => a.userId)
}

/**
 * Crée une notification par destinataire. Ne lève jamais : une notification manquée
 * ne doit pas faire échouer l'action qui l'a produite.
 *
 * Avec `mailImmediat`, la notification part aussi par mail (règle de collaboration
 * n° 2). Le worker vérifie la préférence du destinataire au moment de l'envoi.
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
  },
  options: { mailImmediat?: boolean } = {}
): Promise<void> {
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
          acteurId: notification.acteurId,
          tacheId: notification.tacheId,
          perimetreId: notification.perimetreId,
          personneId: notification.personneId ?? null,
        },
        select: { id: true },
      })
      if (options.mailImmediat) {
        await mettreEnFile(
          'tache-modifiee',
          { userId },
          {
            tache: {
              tacheId: notification.tacheId,
              acteurId: notification.acteurId,
              changement: notification.changement ?? 'contenu',
            },
            notificationId: creee.id,
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

// ── Texte ────────────────────────────────────────────────────────────────────

export interface NotificationAComposer {
  type: TypeNotification
  jours: number | null
  acteurId: string | null
  personneId: string | null
  tache: {
    titre: string
    echeance: Date | null
    perimetre: { nom: string; slug: string }
  } | null
}

function dateLongue(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/**
 * Phrase affichée pour une notification. `noms` associe un identifiant de personne à
 * son nom ; `moiId` est la personne qui lit.
 */
export function messageNotification(
  n: NotificationAComposer,
  noms: Map<string, string>,
  moiId: string
): string {
  const tache = n.tache
  if (tache === null) return 'Cette tâche n’existe plus.'
  const titre = `« ${tache.titre} » (${tache.perimetre.nom})`
  const acteur = (n.acteurId && noms.get(n.acteurId)) ?? 'Une personne'
  const personne =
    n.personneId === moiId
      ? 'vous'
      : ((n.personneId && noms.get(n.personneId)) ?? 'une personne')

  switch (n.type) {
    case 'TACHE_CREEE':
      return `${acteur} a créé la tâche ${titre}.`
    case 'TACHE_MODIFIEE':
      return `${acteur} a modifié la tâche ${titre}.`
    case 'TACHE_ASSIGNEE':
      return n.personneId === n.acteurId
        ? `${acteur} s’occupe de la tâche ${titre}.`
        : `${acteur} a assigné la tâche ${titre} à ${personne}.`
    case 'TACHE_DESASSIGNEE':
      return n.personneId === n.acteurId
        ? `${acteur} ne s’occupe plus de la tâche ${titre}.`
        : `${acteur} a retiré ${personne} de la tâche ${titre}.`
    case 'ECHEANCE_PROCHE':
      return n.jours === 0
        ? `La tâche ${titre} arrive à échéance aujourd’hui.`
        : n.jours === 1
          ? `La tâche ${titre} arrive à échéance demain.`
          : `La tâche ${titre} arrive à échéance dans ${n.jours ?? 7} jours.`
    case 'TACHE_EN_RETARD':
      return tache.echeance
        ? `La tâche ${titre} est en retard depuis le ${dateLongue(tache.echeance)}.`
        : `La tâche ${titre} est en retard.`
  }
}

/** Chemin de l'espace organisateur vers lequel renvoie une notification. */
export function lienNotification(n: NotificationAComposer): string {
  return n.tache ? `/perimetres/${n.tache.perimetre.slug}` : '/'
}
