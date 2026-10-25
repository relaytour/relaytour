import type { Job } from 'bullmq'
import webpush, { WebPushError } from 'web-push'

import { prisma } from '@relaytour/database'

import { env } from '../../env.ts'
import { journal, sansAdresses } from '../../lib/journal.ts'
import { avecLangue } from '../../lib/langue.ts'
import { langueDuDestinataire } from '../../lib/langue-destinataire.ts'
import {
  composerNotification,
  SELECTION_NOTIFICATION,
} from '../../lib/composition-notifications.ts'
import { preferencesDe } from '../../lib/notifications.ts'
import { filtreNotificationsAdmin } from '../../lib/notifications-admin.ts'
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
 * l'envoi : une notification déjà lue, une personne archivée dans l'organisation ou une préférence coupée
 * ne donnent aucun envoi.
 */
export async function pushProcessor(job: Job<PushJobData>): Promise<void> {
  const cles = clesVapid(env)
  if (cles === null) return
  const { notificationId } = job.data

  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { ...SELECTION_NOTIFICATION, userId: true, lueLe: true },
  })
  if (n === null || n.lueLe !== null) return
  // Une personne archivée dans l'organisation de la notification ne la reçoit plus
  // (ADR 0031).
  const active = await prisma.appartenance.count({
    where: {
      userId: n.userId,
      organisationId: n.organisationId,
      archiveLe: null,
    },
  })
  if (active === 0) return
  // Une notification d'admin ne part qu'à une personne qui tient encore ce rôle :
  // le même filtre que l'écran des admins et le résumé (ADR 0033).
  const filtreAdmin = await filtreNotificationsAdmin(
    prisma,
    n.userId,
    n.organisationId
  )
  if (n.niveau !== 'REFERENT') {
    if (filtreAdmin === null) return
    const lisible = await prisma.notification.count({
      where: { id: n.id, ...filtreAdmin },
    })
    if (lisible === 0) return
  }
  if (
    !pushAutorise(
      await preferencesDe(prisma, n.userId, n.organisationId),
      n.type
    )
  )
    return

  const abonnements = await prisma.abonnementPush.findMany({
    where: { userId: n.userId },
    select: { id: true, adresse: true, p256dh: true, auth: true },
  })
  if (abonnements.length === 0) return

  // Le texte se compose dans la langue du destinataire (ADR 0047).
  const langue = await langueDuDestinataire(prisma, n.userId, n.organisationId)
  const [composee, organisation, nonLues] = await Promise.all([
    avecLangue(langue, () => composerNotification(prisma, n, n.userId)),
    configurationOrganisation(n.organisationId),
    // La pastille de l'application compte les notifications non lues de la cloche
    // et celles des rôles d'admin que la personne tient encore.
    prisma.notification.count({
      where: {
        userId: n.userId,
        organisationId: n.organisationId,
        lueLe: null,
        OR: [
          { niveau: 'REFERENT' },
          ...(filtreAdmin === null ? [] : [filtreAdmin]),
        ],
      },
    }),
  ])
  // Le titre nomme l'organisation, puis l'activité (ADR 0032).
  const message: MessagePush = {
    titre:
      composee.activite === null
        ? organisation.nomCourt
        : `${organisation.nomCourt} · ${composee.activite.nom}`,
    corps: composee.messageAvecContexte,
    lien: composee.lien,
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
        echecs.push(
          statut === 0
            ? sansAdresses((erreur as Error).message)
            : String(statut)
        )
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
