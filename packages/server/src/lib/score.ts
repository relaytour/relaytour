import type { PrismaClient } from '@relaytour/database'

import { aujourdhui } from './droits.ts'

// Score de participation d'une édition (phase 5).
//
// Le score se calcule à partir de l'état actuel des données, pas du journal brut :
// rouvrir une tâche lui retire ses points, et répéter une action n'en rapporte pas
// davantage. Personne ne gagne de points en cochant et décochant.
//
// Barème :
// - tâche faite : 3 points pour la personne indiquée comme réalisatrice, sinon pour
//   la personne qui l'a cochée ; 1 point de plus si elle est faite avant ou le jour
//   de son échéance ;
// - tâche créée et non abandonnée : 1 point pour la personne qui l'a créée ;
// - fiche : 3 points par fiche créée, 2 points par fiche modifiée, au plus une fois
//   par fiche et par jour.
//
// Les fiches ne dépendent d'aucune édition : leurs contributions comptent pour
// l'édition dont la période contient leur date. Les périodes se suivent sans trou :
// celle d'une édition se termine 30 jours après son dernier jour, et celle de
// l'édition suivante commence à ce moment-là. Les jours s'entendent à l'heure de Paris.

export const BAREME = {
  tacheRealisee: 3,
  bonusATemps: 1,
  tacheCreee: 1,
  ficheCreee: 3,
  ficheModifiee: 2,
} as const

const JOUR = 24 * 3600 * 1000

export interface Score {
  userId: string
  points: number
  tachesRealisees: number
  tachesATemps: number
  tachesCreees: number
  fichesCreees: number
  fichesModifiees: number
}

function scoreVide(userId: string): Score {
  return {
    userId,
    points: 0,
    tachesRealisees: 0,
    tachesATemps: 0,
    tachesCreees: 0,
    fichesCreees: 0,
    fichesModifiees: 0,
  }
}

/**
 * Période d'une édition pour les contributions qui n'en dépendent pas. L'édition
 * précédente se cherche dans la même activité (ADR 0008).
 */
export async function periodeEdition(
  prisma: PrismaClient,
  editionId: string
): Promise<{ debut: Date | null; fin: Date; activiteId: string }> {
  const edition = await prisma.edition.findUniqueOrThrow({
    where: { id: editionId },
  })
  const precedente = await prisma.edition.findFirst({
    where: { activiteId: edition.activiteId, annee: { lt: edition.annee } },
    orderBy: { annee: 'desc' },
  })
  return {
    // Fin (exclue) de la période précédente : aucun jour n'est perdu entre deux éditions.
    debut: precedente ? new Date(precedente.fin.getTime() + 31 * JOUR) : null,
    fin: new Date(edition.fin.getTime() + 31 * JOUR),
    activiteId: edition.activiteId,
  }
}

export async function calculerScores(
  prisma: PrismaClient,
  editionId: string,
  // Le jour d'une contribution se lit dans le fuseau de l'organisation.
  fuseau?: string
): Promise<Map<string, Score>> {
  const scores = new Map<string, Score>()
  const de = (userId: string) => {
    let score = scores.get(userId)
    if (!score) {
      score = scoreVide(userId)
      scores.set(userId, score)
    }
    return score
  }

  const taches = await prisma.tache.findMany({
    where: { editionId },
    select: {
      statut: true,
      echeance: true,
      termineeLe: true,
      creeParId: true,
      clotureeParId: true,
      realiseeParId: true,
    },
  })
  for (const tache of taches) {
    if (tache.statut === 'FAITE') {
      const auteur = tache.realiseeParId ?? tache.clotureeParId
      if (auteur) {
        const score = de(auteur)
        score.tachesRealisees += 1
        score.points += BAREME.tacheRealisee
        // Jour de clôture dans le fuseau de l'organisation : une tâche cochée à 1 h du
        // matin le lendemain est en retard.
        const faiteLe = tache.termineeLe
          ? aujourdhui(tache.termineeLe, fuseau)
          : undefined
        const echeance = tache.echeance?.toISOString().slice(0, 10)
        if (faiteLe && echeance && faiteLe <= echeance) {
          score.tachesATemps += 1
          score.points += BAREME.bonusATemps
        }
      }
    }
    if (tache.creeParId && tache.statut !== 'ABANDONNEE') {
      const score = de(tache.creeParId)
      score.tachesCreees += 1
      score.points += BAREME.tacheCreee
    }
  }

  const periode = await periodeEdition(prisma, editionId)
  const activites = await prisma.journal.findMany({
    where: {
      type: { in: ['FICHE_CREEE', 'FICHE_MODIFIEE'] },
      // Seules les fiches de l'activité de l'édition comptent.
      fiche: { activiteId: periode.activiteId },
      createdAt: {
        ...(periode.debut ? { gte: periode.debut } : {}),
        lt: periode.fin,
      },
    },
    select: { type: true, acteurId: true, ficheId: true, createdAt: true },
  })
  const dejaComptees = new Set<string>()
  for (const activite of activites) {
    const cle = `${activite.type}|${activite.acteurId}|${activite.ficheId}|${aujourdhui(activite.createdAt, fuseau)}`
    if (dejaComptees.has(cle)) continue
    dejaComptees.add(cle)
    const score = de(activite.acteurId)
    if (activite.type === 'FICHE_CREEE') {
      score.fichesCreees += 1
      score.points += BAREME.ficheCreee
    } else {
      score.fichesModifiees += 1
      score.points += BAREME.ficheModifiee
    }
  }

  return scores
}
