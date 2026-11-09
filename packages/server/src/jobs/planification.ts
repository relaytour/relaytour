import type {
  Prisma,
  PrismaClient,
  TypeNotification,
} from '@relaytour/database'

import { membreActif } from '../lib/appartenances.ts'
import { TACHES_ACTIVES } from '../lib/declinaisons.ts'
import { aujourdhui } from '../lib/droits.ts'
import { heureLocale } from '../lib/heures.ts'
import { journal } from '../lib/journal.ts'
import { moduleActif } from '../lib/modules.ts'
import { publierNotification } from '../lib/flux.ts'
import { pousser } from '../lib/push-file.ts'

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
 * Les destinataires sont les personnes assignées. Sans personne assignée, ce sont
 * les contacts principaux du périmètre, ou à défaut toute son équipe, pour que rien
 * ne passe inaperçu (ADR 0065).
 *
 * Une déclinaison en retard prévient en plus les personnes assignées à sa tâche
 * partagée, sauf celles qui sont aussi assignées à la déclinaison (ADR 0063).
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
      // Une déclinaison qui attend un accord ne se rappelle à personne (ADR 0026).
      AND: [TACHES_ACTIVES],
    },
    select: {
      id: true,
      echeance: true,
      perimetreId: true,
      editionId: true,
      assignations: {
        // Une personne archivée dans l'organisation ne reçoit plus ses rappels
        // (ADR 0031).
        where: { user: membreActif(organisation.id) },
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
      // Une tâche sans personne prévient les contacts principaux du périmètre, ou
      // toute l'équipe quand le périmètre n'en a pas (ADR 0065).
      const affectations = await prisma.affectation.findMany({
        where: {
          perimetreId: tache.perimetreId,
          editionId: tache.editionId,
          user: membreActif(organisation.id),
        },
        select: { userId: true, contactPrincipal: true },
      })
      const contacts = affectations.filter(a => a.contactPrincipal)
      destinataires = (contacts.length > 0 ? contacts : affectations).map(
        a => a.userId
      )
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
        // Le worker publie lui aussi : la cloche de la personne se met à jour.
        publierNotification(organisation.id, userId)
        await pousser(notification.id)
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

  // Le retard d'une déclinaison prévient aussi les personnes assignées à sa tâche
  // partagée, quand celle-ci reste ouverte (ADR 0063). La notification porte le
  // périmètre de la tâche partagée. Elle n'envoie aucun push.
  const declinaisons = await prisma.tache.findMany({
    where: {
      ...filtre,
      accord: 'ACCEPTE',
      statut: { in: ['A_FAIRE', 'EN_COURS'] },
      echeance: { not: null, lt: jour },
      edition: { statut: { not: 'ARCHIVEE' } },
      perimetre: { organisationId: organisation.id },
      origine: { is: { statut: { in: ['A_FAIRE', 'EN_COURS'] } } },
    },
    select: {
      id: true,
      echeance: true,
      assignations: { select: { userId: true } },
      origine: {
        select: {
          perimetreId: true,
          assignations: {
            where: { user: membreActif(organisation.id) },
            select: { userId: true },
          },
        },
      },
    },
  })
  for (const declinaison of declinaisons) {
    const origine = declinaison.origine
    if (origine === null) continue
    // Une personne assignée à la déclinaison reçoit déjà son propre rappel.
    const dejaPrevenues = new Set(declinaison.assignations.map(a => a.userId))
    const echeance = declinaison.echeance!.toISOString().slice(0, 10)
    for (const { userId } of origine.assignations) {
      if (dejaPrevenues.has(userId)) continue
      try {
        const notification = await prisma.notification.create({
          data: {
            organisationId: organisation.id,
            userId,
            type: 'DECLINAISON_EN_RETARD',
            tacheId: declinaison.id,
            perimetreId: origine.perimetreId,
            cle: `DECLINAISON_EN_RETARD-${declinaison.id}-${userId}-${echeance}`,
          },
          select: { id: true },
        })
        publierNotification(organisation.id, userId)
        parPersonne.set(userId, [
          ...(parPersonne.get(userId) ?? []),
          notification.id,
        ])
      } catch (erreur) {
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

/**
 * Les membres d'une organisation qui reçoivent son résumé aujourd'hui : fréquence
 * quotidienne, ou hebdomadaire le lundi (valeur par défaut), et pas déjà servis
 * aujourd'hui pour cette organisation. Le résumé hebdomadaire ne part pas quand un
 * mail des priorités a porté les nouvelles dans les six derniers jours (ADR 0065). Le jour et le lundi se lisent dans le fuseau
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

  // Les préférences se lisent dans cette organisation (ADR 0032).
  const personnes = await prisma.user.findMany({
    where: membreActif(organisation.id),
    select: {
      id: true,
      preferencesOrganisation: {
        where: { organisationId: organisation.id },
        select: { frequenceResume: true, dernierResumeLe: true },
      },
    },
  })
  return personnes
    .filter(({ preferencesOrganisation: [preferences] }) => {
      const frequence = preferences?.frequenceResume ?? 'HEBDOMADAIRE'
      if (frequence === 'AUCUN') return false
      if (frequence === 'HEBDOMADAIRE' && !lundi) return false
      const dernier = preferences?.dernierResumeLe ?? null
      if (dernier === null) return true
      // Un mail des priorités des six derniers jours a porté les nouvelles de la
      // semaine : le résumé du lundi ne part pas en double (ADR 0065).
      if (
        frequence === 'HEBDOMADAIRE' &&
        maintenant.getTime() - dernier.getTime() < 6 * 24 * 3600 * 1000
      ) {
        return false
      }
      return aujourdhui(dernier, organisation.fuseauHoraire) !== jour
    })
    .map(p => p.id)
}

export interface PrioritesAEnvoyer {
  userId: string
  editionId: string
  activiteId: string
}

/** « 2027-01-13 » + n jours, en AAAA-MM-JJ. */
function jourPlus(iso: string, jours: number): string {
  return new Date(dateUtc(iso).getTime() + jours * JOUR)
    .toISOString()
    .slice(0, 10)
}

/**
 * Les mails des priorités du jour (ADR 0063), par personne et par période :
 * - la veille d'un point d'équipe de la période ;
 * - le lundi, quand aucun point d'équipe ne tombe du lundi au dimanche.
 *
 * Seules les personnes qui ont choisi « Mes périmètres » ou « Toute l'activité »
 * reçoivent le mail. « Mes périmètres » demande une affectation dans la période.
 * « Toute l'activité » demande une affectation dans la période ou un rôle d'admin
 * de l'activité : une personne en découverte ou seulement rattachée ne reçoit rien.
 * Le jour et le lundi se lisent dans le fuseau de l'organisation.
 */
export async function prioritesAEnvoyer(
  prisma: PrismaClient,
  organisation: OrganisationPlanifiee,
  maintenant = new Date()
): Promise<PrioritesAEnvoyer[]> {
  const jour = aujourdhui(maintenant, organisation.fuseauHoraire)
  const lundi =
    new Intl.DateTimeFormat('en-GB', {
      timeZone: organisation.fuseauHoraire,
      weekday: 'short',
    }).format(maintenant) === 'Mon'
  const preferences = await prisma.preferenceOrganisation.findMany({
    where: {
      organisationId: organisation.id,
      mailPriorites: { not: 'AUCUN' },
      user: membreActif(organisation.id),
    },
    select: { userId: true, mailPriorites: true },
  })
  if (preferences.length === 0) return []
  const userIds = preferences.map(p => p.userId)
  const editions = await prisma.edition.findMany({
    where: {
      statut: { not: 'ARCHIVEE' },
      activite: { organisationId: organisation.id, archivedAt: null },
    },
    select: {
      id: true,
      activiteId: true,
      // Les points d'équipe d'aujourd'hui aux huit prochains jours suffisent à
      // décider. Un point d'aujourd'hui, même passé à l'heure du job, compte pour
      // la semaine.
      reunions: {
        where: {
          perimetreId: null,
          pointEquipe: true,
          statut: 'PREVUE',
          debut: {
            gt: new Date(maintenant.getTime() - JOUR),
            lt: new Date(maintenant.getTime() + 9 * JOUR),
          },
        },
        select: { debut: true },
      },
      affectations: {
        where: { userId: { in: userIds } },
        select: { userId: true },
      },
      activite: {
        select: {
          admins: {
            where: { userId: { in: userIds } },
            select: { userId: true },
          },
        },
      },
    },
  })
  const adminsOrganisation = new Set(
    (
      await prisma.appartenance.findMany({
        where: {
          organisationId: organisation.id,
          role: 'ADMIN',
          archiveLe: null,
          userId: { in: userIds },
        },
        select: { userId: true },
      })
    ).map(a => a.userId)
  )
  const demain = jourPlus(jour, 1)
  const finDeSemaine = jourPlus(jour, 6)
  const resultat: PrioritesAEnvoyer[] = []
  for (const edition of editions) {
    // Sans module Agenda, aucune réunion ne compte comme point d'équipe, comme
    // dans le calcul des priorités (ADR 0059) : le mail part alors le lundi.
    const agenda = await moduleActif(edition.activiteId, 'AGENDA', prisma)
    const jours = agenda
      ? edition.reunions.map(
          r => heureLocale(r.debut, organisation.fuseauHoraire).jour
        )
      : []
    const veille = jours.includes(demain)
    const lundiSansPoint =
      lundi && !jours.some(j => j >= jour && j <= finDeSemaine)
    if (!veille && !lundiSansPoint) continue
    const affectees = new Set(edition.affectations.map(a => a.userId))
    const admins = new Set(edition.activite.admins.map(a => a.userId))
    for (const p of preferences) {
      const place =
        p.mailPriorites === 'MES_PERIMETRES'
          ? affectees.has(p.userId)
          : affectees.has(p.userId) ||
            admins.has(p.userId) ||
            adminsOrganisation.has(p.userId)
      if (place)
        resultat.push({
          userId: p.userId,
          editionId: edition.id,
          activiteId: edition.activiteId,
        })
    }
  }
  return resultat
}
