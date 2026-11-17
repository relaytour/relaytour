import type { PrismaClient } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'
import { journal } from '../lib/journal.ts'

import { applicationRefusee } from './refus.ts'

// Entretien des applications tierces (ADR 0067), chaque nuit avec la purge.
//
// - Un rappel part trente jours avant la fin d'une autorisation, une seule fois.
// - Les demandes expirées, les jetons d'application expirés et ceux des
//   autorisations révoquées s'effacent.
// - Une application sans autorisation récente s'efface après 30 jours, qu'elle
//   vienne d'un document CIMD ou de l'enregistrement dynamique.
// - Les autorisations d'une application que l'installation refuse se révoquent.
//   Leurs jetons ne répondaient déjà plus : la révocation les range.

export const RAPPEL_FIN_JOURS = 30
export const OUBLI_CLIENT_JOURS = 30
const JOUR_MS = 86_400_000

/** Met en file le rappel des autorisations qui prennent fin dans 30 jours. Rend leur nombre. */
export async function rappelerFinDesAutorisations(
  prisma: PrismaClient,
  maintenant = new Date()
): Promise<number> {
  const autorisations = await prisma.jetonAcces.findMany({
    where: {
      clientApplicationId: { not: null },
      revoqueLe: null,
      rappelFinLe: null,
      expireLe: {
        gt: maintenant,
        lte: new Date(maintenant.getTime() + RAPPEL_FIN_JOURS * JOUR_MS),
      },
      organisation: { statut: 'ACTIVE' },
    },
    select: { id: true, userId: true, organisationId: true },
    take: 500,
  })
  let envoyes = 0
  for (const a of autorisations) {
    // Le rappel se marque avant l'envoi : un worker relancé n'en envoie pas deux.
    const { count } = await prisma.jetonAcces.updateMany({
      where: { id: a.id, rappelFinLe: null },
      data: { rappelFinLe: maintenant },
    })
    if (count === 0) continue
    await mettreEnFile(
      'autorisation-fin-proche',
      { userId: a.userId },
      { organisationId: a.organisationId, jetonAccesId: a.id }
    )
    envoyes++
  }
  return envoyes
}

/** Révoque les autorisations des applications que l'installation refuse. Rend leur nombre. */
export async function revoquerApplicationsRefusees(
  prisma: PrismaClient,
  maintenant = new Date()
): Promise<number> {
  const clients = await prisma.clientApplication.findMany({
    where: { autorisations: { some: { revoqueLe: null } } },
    select: { id: true, clientId: true },
  })
  const refuses = clients.filter(c => applicationRefusee(c.clientId))
  if (refuses.length === 0) return 0
  const { count } = await prisma.jetonAcces.updateMany({
    where: {
      clientApplicationId: { in: refuses.map(c => c.id) },
      revoqueLe: null,
    },
    data: { revoqueLe: maintenant },
  })
  if (count > 0) {
    journal.info(
      {
        evenement: 'autorisations-application-refusee-revoquees',
        nombre: count,
      },
      'Les autorisations d’applications refusées par l’installation ont été révoquées.'
    )
  }
  return count
}

/** Efface les demandes, les jetons et les applications qui ne servent plus. */
export async function purgerApplications(
  prisma: PrismaClient,
  maintenant = new Date()
): Promise<void> {
  await prisma.demandeAutorisation.deleteMany({
    where: { expireLe: { lt: new Date(maintenant.getTime() - JOUR_MS) } },
  })
  await prisma.jetonApplication.deleteMany({
    where: {
      OR: [
        { expireLe: { lte: maintenant } },
        { jetonAcces: { revoqueLe: { not: null } } },
        { jetonAcces: { expireLe: { lte: maintenant } } },
      ],
    },
  })
  // Une application s'oublie quand aucune autorisation ne la cite depuis 30 jours :
  // ni active, ni révoquée ou échue récemment, que les listes affichent encore.
  const oubli = new Date(maintenant.getTime() - OUBLI_CLIENT_JOURS * JOUR_MS)
  await prisma.clientApplication.deleteMany({
    where: {
      updatedAt: { lt: oubli },
      demandes: { none: {} },
      autorisations: {
        none: {
          OR: [
            { revoqueLe: null, expireLe: { gt: oubli } },
            { revoqueLe: { gt: oubli } },
          ],
        },
      },
    },
  })
}
