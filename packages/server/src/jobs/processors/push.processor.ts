import type { Job } from 'bullmq'
import webpush, { WebPushError } from 'web-push'

import { prisma } from '@relaytour/database'

import { env } from '../../env.ts'
import { journal } from '../../lib/journal.ts'
import {
  lienNotification,
  messageNotification,
  preferencesDe,
  SELECTION_ACTIVITE_NOTIFIEE,
  SELECTION_FICHE_NOTIFIEE,
  SELECTION_TACHE_NOTIFIEE,
} from '../../lib/notifications.ts'
import { configurationOrganisation } from '../../lib/organisation.ts'
import {
  adressePushAcceptee,
  clesVapid,
  pushAutorise,
  type MessagePush,
} from '../../lib/push.ts'
import type { PushJobData } from '../queues.ts'

/** Durée pendant laquelle le service de push garde un message pour un appareil éteint. */
const DUREE_DE_VIE_SECONDES = 24 * 3600
const DELAI_ENVOI_MS = 10_000

/**
 * Envoie une notification en push aux appareils de son destinataire (ADR 0024).
 * Le texte, les préférences et les abonnements se relisent en base au moment de
 * l'envoi : une notification déjà lue, un compte archivé ou une préférence coupée
 * ne donnent aucun envoi.
 */
export async function pushProcessor(job: Job<PushJobData>): Promise<void> {
  const cles = clesVapid(env)
  if (cles === null) return
  const { notificationId } = job.data

  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      userId: true,
      organisationId: true,
      lueLe: true,
      type: true,
      jours: true,
      acteurId: true,
      personneId: true,
      statut: true,
      tache: SELECTION_TACHE_NOTIFIEE,
      fiche: SELECTION_FICHE_NOTIFIEE,
      activite: SELECTION_ACTIVITE_NOTIFIEE,
      user: { select: { archivedAt: true } },
    },
  })
  if (n === null || n.lueLe !== null || n.user.archivedAt !== null) return
  if (!pushAutorise(await preferencesDe(prisma, n.userId), n.type)) return

  const abonnements = await prisma.abonnementPush.findMany({
    where: { userId: n.userId },
    select: { id: true, adresse: true, p256dh: true, auth: true },
  })
  if (abonnements.length === 0) return

  const [personnes, organisation, nonLues] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { in: [n.acteurId, n.personneId].filter(id => id !== null) },
      },
      select: { id: true, name: true },
    }),
    configurationOrganisation(n.organisationId),
    prisma.notification.count({
      where: {
        userId: n.userId,
        organisationId: n.organisationId,
        lueLe: null,
      },
    }),
  ])
  const message: MessagePush = {
    titre: organisation.nomCourt,
    corps: messageNotification(
      n,
      new Map(personnes.map(p => [p.id, p.name])),
      n.userId
    ),
    lien: lienNotification(n),
    organisation: organisation.slug,
    etiquette: `notification-${n.id}`,
    icone: organisation.iconeApplicationUrl ?? '/icon.png',
    nonLues,
  }
  const charge = JSON.stringify(message)

  let envoyes = 0
  let retires = 0
  const echecs: string[] = []
  for (const abonnement of abonnements) {
    // Une adresse refusée aujourd'hui ne s'appelle pas, même enregistrée hier.
    if (!adressePushAcceptee(abonnement.adresse)) {
      await prisma.abonnementPush.deleteMany({ where: { id: abonnement.id } })
      retires++
      continue
    }
    try {
      await webpush.sendNotification(
        {
          endpoint: abonnement.adresse,
          keys: { p256dh: abonnement.p256dh, auth: abonnement.auth },
        },
        charge,
        {
          vapidDetails: {
            subject: cles.sujet,
            publicKey: cles.publique,
            privateKey: cles.privee,
          },
          TTL: DUREE_DE_VIE_SECONDES,
          timeout: DELAI_ENVOI_MS,
        }
      )
      envoyes++
    } catch (erreur) {
      const statut = erreur instanceof WebPushError ? erreur.statusCode : 0
      // 404 et 410 : l'appareil a retiré son abonnement, ou le service l'a expiré.
      if (statut === 404 || statut === 410) {
        await prisma.abonnementPush.deleteMany({ where: { id: abonnement.id } })
        retires++
      } else {
        echecs.push(statut === 0 ? (erreur as Error).message : String(statut))
      }
    }
  }

  // Le journal ne porte ni adresse d'abonnement ni clé (invariant 6).
  journal.info(
    {
      evenement: 'push-envoye',
      notificationId: n.id,
      userId: n.userId,
      envoyes,
      retires,
      echecs: echecs.length,
    },
    'Notification push traitée.'
  )
  // Un nouvel essai renvoie aussi aux appareils déjà servis : leur étiquette
  // remplace alors l'affichage, sans doublon.
  if (echecs.length > 0)
    throw new Error(
      `Service de push en échec : ${[...new Set(echecs)].join(', ')}`
    )
}
