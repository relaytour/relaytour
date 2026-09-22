import type {
  Prisma,
  PrismaClient,
  TypeNotification,
} from '@relaytour/database'

import { aujourdhui } from '../lib/droits.ts'
import { journal } from '../lib/journal.ts'

// Tâches planifiées : elles tournent dans le worker, une fois par jour et par
// organisation, dans le fuseau de l'organisation (ADR 0008). Les fonctions reçoivent
// `maintenant` pour être testables à une date donnée.

/** L'organisation pour laquelle une tâche planifiée tourne. */
export interface OrganisationPlanifiee {
  id: string
  fuseauHoraire: string
}

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
  organisation: OrganisationPlanifiee,
  maintenant = new Date(),
  // Restreint les tâches examinées. Sert aux tests, qui partagent la base de développement.
  filtre: Prisma.TacheWhereInput = {}
): Promise<RappelsParPersonne[]> {
  const jour = dateUtc(aujourdhui(maintenant, organisation.fuseauHoraire))
  const dansSeptJours = new Date(jour.getTime() + 7 * JOUR)

  const taches = await prisma.tache.findMany({
    where: {
      ...filtre,
      statut: { in: ['A_FAIRE', 'EN_COURS'] },
      echeance: { not: null, lte: dansSeptJours },
      edition: { statut: { not: 'ARCHIVEE' } },
      perimetre: { organisationId: organisation.id },
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
    const jours = joursEntre(jour, echeance)
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
            organisationId: organisation.id,
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
      organisationId: organisation.id,
      personnes: resultat.length,
      notifications: resultat.reduce((n, r) => n + r.notificationIds.length, 0),
    },
    'Rappels d’échéance générés.'
  )
  return resultat
}

/** Date du dernier résumé d'une organisation, lue dans la colonne JSON des préférences. */
export function dernierResumeDe(
  preferences: { derniersResumes: unknown; dernierResumeLe: Date | null },
  organisationId: string
): Date | null {
  const derniers = preferences.derniersResumes
  if (typeof derniers === 'object' && derniers !== null) {
    // Une organisation absente de la liste n'a jamais envoyé de résumé.
    const valeur = (derniers as Record<string, unknown>)[organisationId]
    return typeof valeur === 'string' ? new Date(valeur) : null
  }
  // Avant l'ADR 0008, une seule date par personne.
  return preferences.dernierResumeLe
}

/**
 * Les membres d'une organisation qui reçoivent son résumé aujourd'hui : fréquence
 * quotidienne, ou hebdomadaire le lundi (valeur par défaut), et pas déjà servis
 * aujourd'hui pour cette organisation. Le jour et le lundi se lisent dans le fuseau
 * de l'organisation.
 */
export async function personnesAResumer(
  prisma: PrismaClient,
  organisation: OrganisationPlanifiee,
  maintenant = new Date()
): Promise<string[]> {
  const jour = aujourdhui(maintenant, organisation.fuseauHoraire)
  const lundi =
    new Intl.DateTimeFormat('en-GB', {
      timeZone: organisation.fuseauHoraire,
      weekday: 'short',
    }).format(maintenant) === 'Mon'

  const personnes = await prisma.user.findMany({
    where: {
      archivedAt: null,
      appartenances: { some: { organisationId: organisation.id } },
    },
    select: { id: true, preferences: true },
  })
  return personnes
    .filter(({ preferences }) => {
      const frequence = preferences?.frequenceResume ?? 'HEBDOMADAIRE'
      if (frequence === 'AUCUN') return false
      if (frequence === 'HEBDOMADAIRE' && !lundi) return false
      const dernier =
        preferences === null
          ? null
          : dernierResumeDe(preferences, organisation.id)
      return (
        dernier === null ||
        aujourdhui(dernier, organisation.fuseauHoraire) !== jour
      )
    })
    .map(p => p.id)
}
