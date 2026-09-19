import type {
  Prisma,
  PrismaClient,
  TypeNotification,
} from '@relaytour/database'

import { aujourdhuiParis } from '../lib/droits.ts'
import { journal } from '../lib/journal.ts'
import { organisationParDefaut } from '../lib/organisation.ts'

// Tâches planifiées de la phase 4 : elles tournent dans le worker, une fois par jour.
// Les fonctions reçoivent `maintenant` pour être testables à une date donnée.

const JOUR = 24 * 3600 * 1000

/** « 2027-08-27 » → minuit UTC, le format des colonnes @db.Date. */
function dateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function joursEntre(debut: Date, fin: Date): number {
  return Math.round((fin.getTime() - debut.getTime()) / JOUR)
}

export interface RappelsParPersonne {
  userId: string
  notificationIds: string[]
}

/**
 * Crée les notifications d'échéance du jour :
 * - échéance dans 2 à 7 jours : un rappel « semaine » ;
 * - échéance aujourd'hui ou demain : un rappel « veille » ;
 * - échéance passée : un signalement de retard.
 *
 * Chaque rappel n'existe qu'une fois par tâche, personne et échéance (colonne `cle`) :
 * relancer la tâche le même jour, ou le lendemain, ne crée pas de doublon. Si
 * l'échéance change, les rappels repartent pour la nouvelle date.
 *
 * Les destinataires sont les personnes assignées ; sans personne assignée, ce sont
 * les référent·es du périmètre, pour que rien ne passe inaperçu.
 */
export async function genererRappels(
  prisma: PrismaClient,
  maintenant = new Date(),
  // Restreint les tâches examinées. Sert aux tests, qui partagent la base de développement.
  filtre: Prisma.TacheWhereInput = {}
): Promise<RappelsParPersonne[]> {
  const aujourdhui = dateUtc(aujourdhuiParis(maintenant))
  const dansSeptJours = new Date(aujourdhui.getTime() + 7 * JOUR)

  const taches = await prisma.tache.findMany({
    where: {
      statut: { in: ['A_FAIRE', 'EN_COURS'] },
      echeance: { not: null, lte: dansSeptJours },
      edition: { statut: { not: 'ARCHIVEE' } },
      ...filtre,
    },
    select: {
      id: true,
      echeance: true,
      perimetreId: true,
      editionId: true,
      assignations: {
        where: { user: { archivedAt: null } },
        select: { userId: true },
      },
    },
  })

  const parPersonne = new Map<string, string[]>()
  for (const tache of taches) {
    const echeance = tache.echeance!
    const jours = joursEntre(aujourdhui, echeance)
    const [type, palier]: [TypeNotification, string] =
      jours < 0
        ? ['TACHE_EN_RETARD', 'retard']
        : jours <= 1
          ? ['ECHEANCE_PROCHE', 'veille']
          : ['ECHEANCE_PROCHE', 'semaine']

    let destinataires = tache.assignations.map(a => a.userId)
    if (destinataires.length === 0) {
      const affectations = await prisma.affectation.findMany({
        where: {
          perimetreId: tache.perimetreId,
          editionId: tache.editionId,
          user: { archivedAt: null },
        },
        select: { userId: true },
      })
      destinataires = affectations.map(a => a.userId)
    }

    for (const userId of destinataires) {
      const cle = `${type}-${palier}-${tache.id}-${userId}-${echeance.toISOString().slice(0, 10)}`
      try {
        const notification = await prisma.notification.create({
          data: {
            organisationId: await organisationParDefaut(),
            userId,
            type,
            tacheId: tache.id,
            perimetreId: tache.perimetreId,
            jours: type === 'ECHEANCE_PROCHE' ? jours : null,
            cle,
          },
          select: { id: true },
        })
        parPersonne.set(userId, [
          ...(parPersonne.get(userId) ?? []),
          notification.id,
        ])
      } catch (erreur) {
        // P2002 : ce rappel existe déjà.
        if ((erreur as { code?: string }).code !== 'P2002') throw erreur
      }
    }
  }

  const resultat = [...parPersonne].map(([userId, notificationIds]) => ({
    userId,
    notificationIds,
  }))
  journal.info(
    {
      evenement: 'rappels-generes',
      personnes: resultat.length,
      notifications: resultat.reduce((n, r) => n + r.notificationIds.length, 0),
    },
    'Rappels d’échéance générés.'
  )
  return resultat
}

/**
 * Les personnes qui reçoivent un résumé aujourd'hui : fréquence quotidienne, ou
 * hebdomadaire le lundi (valeur par défaut), et pas déjà servies aujourd'hui.
 */
export async function personnesAResumer(
  prisma: PrismaClient,
  maintenant = new Date()
): Promise<string[]> {
  const aujourdhui = aujourdhuiParis(maintenant)
  const lundi =
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      weekday: 'short',
    }).format(maintenant) === 'Mon'

  const personnes = await prisma.user.findMany({
    where: { archivedAt: null },
    select: { id: true, preferences: true },
  })
  return personnes
    .filter(({ preferences }) => {
      const frequence = preferences?.frequenceResume ?? 'HEBDOMADAIRE'
      if (frequence === 'AUCUN') return false
      if (frequence === 'HEBDOMADAIRE' && !lundi) return false
      const dernier = preferences?.dernierResumeLe
      return (
        dernier === null ||
        dernier === undefined ||
        aujourdhuiParis(dernier) !== aujourdhui
      )
    })
    .map(p => p.id)
}
