import { createHash } from 'node:crypto'

import type {
  NiveauNotification,
  Prisma,
  PrismaClient,
  TypeNotification,
} from '@relaytour/database'

import { adminsAPrevenir } from './demandes.ts'
import { publierNotification } from './flux.ts'
import { journal } from './journal.ts'
import {
  niveauxDes,
  preferencesDe,
  TRANCHE_PERIMETRE_MS,
} from './notifications.ts'
import { pousser } from './push-file.ts'

// Notifications d'admin (ADR 0033). Elles quittent la cloche pour l'écran
// « Notifications d'admin », rangé par activité puis par périmètre.

/** Les familles de notifications d'admin, que la personne règle à part. */
export type FamilleAdmin = 'demandes' | 'equipe'

/** La famille d'un type de notification d'admin. */
export function familleAdmin(type: TypeNotification): FamilleAdmin | null {
  switch (type) {
    case 'DEMANDE_RECUE':
    case 'DEMANDE_ACCEPTEE':
    case 'DEMANDE_REFUSEE':
    case 'INVITATION_ACCEPTEE':
      return 'demandes'
    case 'AFFECTATION_AJOUTEE':
    case 'AFFECTATION_RETIREE':
    case 'SOUHAIT_FORMULE':
    case 'ADMIN_ACTIVITE_NOMME':
    case 'ADMIN_ACTIVITE_RETIRE':
    case 'ADMIN_ORGANISATION_NOMME':
    case 'ADMIN_ORGANISATION_RETIRE':
    case 'PERSONNE_ARCHIVEE':
    case 'PERSONNE_RETABLIE':
      return 'equipe'
    default:
      return null
  }
}

/** Les niveaux des notifications d'admin. */
export const NIVEAUX_ADMIN: NiveauNotification[] = [
  'ADMIN_ACTIVITE',
  'ADMIN_ORGANISATION',
]

/** Une empreinte courte et stable de plusieurs identifiants. */
function empreinte(...parties: string[]): string {
  return createHash('sha256').update(parties.join('|')).digest('hex')
}

/** Les admins actifs d'une organisation. */
async function adminsDeLOrganisation(
  prisma: PrismaClient,
  organisationId: string
): Promise<string[]> {
  return (
    await prisma.appartenance.findMany({
      where: { organisationId, role: 'ADMIN', archiveLe: null },
      select: { userId: true },
    })
  ).map(a => a.userId)
}

export interface NotificationAdmin {
  type: TypeNotification
  organisationId: string
  /** L'activité concernée. Sans activité, la notification va aux admins de l'organisation. */
  activiteId?: string | null
  perimetreId?: string | null
  /** La période de l'action, pour une affectation ou un souhait. */
  editionId?: string | null
  /** La personne qui a agi. Elle ne reçoit jamais sa propre notification. */
  acteurId: string | null
  /** La personne concernée par l'action. */
  personneId?: string | null
  /** Destinataires imposés, à la place des admins de l'activité ou de l'organisation. */
  destinataires?: string[]
}

/**
 * Prévient les admins d'une action de gestion (ADR 0033) : les admins de
 * l'activité, sinon ceux de l'organisation. Une même action répétée dans la tranche
 * de dix minutes ne prévient qu'une fois. La famille « équipe » se coupe dans les
 * préférences de chaque organisation. Ne lève jamais.
 */
export async function notifierLesAdmins(
  prisma: PrismaClient,
  notification: NotificationAdmin,
  maintenant = Date.now()
): Promise<void> {
  const { type, organisationId, acteurId } = notification
  const activiteId = notification.activiteId ?? null
  try {
    const candidats =
      notification.destinataires ??
      (activiteId === null
        ? await adminsDeLOrganisation(prisma, organisationId)
        : await adminsAPrevenir(prisma, organisationId, activiteId))
    const destinataires = [...new Set(candidats)].filter(id => id !== acteurId)
    if (destinataires.length === 0) return
    const niveaux = await niveauxDes(prisma, destinataires, activiteId)
    const famille = familleAdmin(type)
    const tranche = Math.floor(maintenant / TRANCHE_PERIMETRE_MS)
    for (const userId of destinataires) {
      if (
        famille === 'equipe' &&
        !(await preferencesDe(prisma, userId, organisationId)).applicationEquipe
      ) {
        continue
      }
      try {
        const creee = await prisma.notification.create({
          data: {
            organisationId,
            userId,
            type,
            niveau: niveaux.get(userId) ?? 'ADMIN_ORGANISATION',
            acteurId,
            activiteId,
            perimetreId: notification.perimetreId ?? null,
            editionId: notification.editionId ?? null,
            personneId: notification.personneId ?? null,
            // La clé tient dans la colonne : son contenu passe par une empreinte.
            cle: `${type}-${empreinte(
              activiteId ?? organisationId,
              notification.perimetreId ?? '',
              notification.editionId ?? '',
              notification.personneId ?? '',
              acteurId ?? '',
              userId,
              String(tranche)
            )}`,
          },
          select: { id: true },
        })
        publierNotification(organisationId, userId)
        await pousser(creee.id)
      } catch (erreur) {
        // P2002 : cet admin est déjà prévenu de cette action dans la tranche.
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
      'Une notification d’admin n’a pas pu être créée.'
    )
  }
}

/**
 * Le filtre des notifications d'admin qu'une personne lit encore dans une
 * organisation (ADR 0033), ou null quand elle n'y tient aucun rôle d'admin. Un
 * admin de l'organisation lit toutes les siennes ; un admin d'activité, celles des
 * activités qu'il administre encore. Une personne archivée n'en lit aucune.
 */
export async function filtreNotificationsAdmin(
  prisma: Pick<PrismaClient, 'appartenance' | 'adminActivite'>,
  userId: string,
  organisationId: string
): Promise<Prisma.NotificationWhereInput | null> {
  const [appartenance, administrees] = await Promise.all([
    prisma.appartenance.findUnique({
      where: { userId_organisationId: { userId, organisationId } },
      select: { role: true, archiveLe: true },
    }),
    prisma.adminActivite.findMany({
      where: { userId, organisationId },
      select: { activiteId: true },
    }),
  ])
  if (appartenance === null || appartenance.archiveLe !== null) return null
  if (appartenance.role === 'ADMIN') return { niveau: { in: NIVEAUX_ADMIN } }
  if (administrees.length === 0) return null
  return {
    niveau: 'ADMIN_ACTIVITE',
    activiteId: { in: administrees.map(a => a.activiteId) },
  }
}
