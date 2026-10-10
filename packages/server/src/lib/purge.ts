import type { Prisma, PrismaClient } from '@relaytour/database'

import { journal } from './journal.ts'

const JOUR_MS = 24 * 3600 * 1000

/** Une notification lue reste consultable ce nombre de jours, puis disparaît. */
export const NOTIFICATIONS_LUES_JOURS = 90
/** Une image qu'aucune identité ne cite plus reste servie ce nombre de jours (mails envoyés). */
export const MEDIAS_ORPHELINS_JOURS = 30

type Base = PrismaClient | Prisma.TransactionClient

/**
 * Supprime les données techniques échues : sessions et vérifications expirées,
 * compteurs de limite de la veille, notifications lues depuis plus de
 * NOTIFICATIONS_LUES_JOURS. Rien ici ne porte le travail des organisations ;
 * le journal des actions (table Journal) reste entier.
 */
export async function purgerDonneesTechniques(
  prisma: Base,
  maintenant = new Date()
): Promise<
  Record<'sessions' | 'verifications' | 'limites' | 'notifications', number>
> {
  const sessions = await prisma.session.deleteMany({
    where: { expiresAt: { lt: maintenant } },
  })
  const verifications = await prisma.verification.deleteMany({
    where: { expiresAt: { lt: maintenant } },
  })
  const limites = await prisma.rateLimit.deleteMany({
    where: { lastRequest: { lt: BigInt(maintenant.getTime() - JOUR_MS) } },
  })
  const notifications = await prisma.notification.deleteMany({
    where: {
      lueLe: {
        lt: new Date(maintenant.getTime() - NOTIFICATIONS_LUES_JOURS * JOUR_MS),
      },
    },
  })
  const compte = {
    sessions: sessions.count,
    verifications: verifications.count,
    limites: limites.count,
    notifications: notifications.count,
  }
  journal.info(
    { evenement: 'donnees-techniques-purgees', ...compte },
    'Les données techniques échues ont été supprimées.'
  )
  return compte
}

const EMPREINTE = /[0-9a-f]{64}/g

/**
 * Supprime les images qu'aucune identité (organisation, activités) ne cite plus
 * depuis MEDIAS_ORPHELINS_JOURS : les mails déjà envoyés citent l'image sous son
 * empreinte pendant ce délai. Chaque passage note la date à laquelle une image
 * cesse d'être citée (`orphelinDepuis`) et l'efface si elle l'est de nouveau.
 * `organisationId` limite la purge à une organisation.
 */
export async function purgerMedias(
  prisma: Base,
  options: { organisationId?: string } = {},
  maintenant = new Date()
): Promise<number> {
  const organisations = await prisma.organisation.findMany({
    where:
      options.organisationId === undefined
        ? {}
        : { id: options.organisationId },
    select: {
      id: true,
      configuration: true,
      activites: { select: { identite: true } },
    },
  })
  const seuil = new Date(
    maintenant.getTime() - MEDIAS_ORPHELINS_JOURS * JOUR_MS
  )
  let supprimees = 0
  for (const organisation of organisations) {
    const citees = new Set(
      JSON.stringify([
        organisation.configuration,
        organisation.activites.map(a => a.identite),
      ]).match(EMPREINTE) ?? []
    )
    await prisma.media.updateMany({
      where: {
        organisationId: organisation.id,
        empreinte: { notIn: [...citees] },
        orphelinDepuis: null,
      },
      data: { orphelinDepuis: maintenant },
    })
    await prisma.media.updateMany({
      where: {
        organisationId: organisation.id,
        empreinte: { in: [...citees] },
        orphelinDepuis: { not: null },
      },
      data: { orphelinDepuis: null },
    })
    const { count } = await prisma.media.deleteMany({
      where: { organisationId: organisation.id, orphelinDepuis: { lt: seuil } },
    })
    if (count > 0) {
      journal.info(
        {
          evenement: 'medias-purges',
          organisationId: organisation.id,
          medias: count,
        },
        'Les images que l’identité ne cite plus ont été supprimées.'
      )
    }
    supprimees += count
  }
  return supprimees
}
