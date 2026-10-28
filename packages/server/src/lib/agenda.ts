import type { AppContext } from '../context.ts'

import { erreurSaisie } from './erreurs.ts'
import { joursRelatifs, type Phase } from './phases.ts'
import { i18n } from './langue.ts'
import { exigerModule } from './modules.ts'

// Agenda d'une activité (ADR 0037).
//
// Ce module ne lit pas la base. Les jours s'écrivent au format AAAA-MM-JJ et se
// comparent comme des chaînes : aucun fuseau ne les décale.

const JOUR_MS = 24 * 60 * 60 * 1000

/** Un jour stocké en `@db.Date` (minuit UTC), au format AAAA-MM-JJ. */
export function jourISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function instantDuJour(jour: string): number {
  const [annee, mois, quantieme] = jour.split('-').map(Number)
  return Date.UTC(annee ?? 0, (mois ?? 1) - 1, quantieme ?? 1)
}

/** Le jour situé à `jours` jours d'un autre, au format AAAA-MM-JJ. */
export function decalerJour(jour: string, jours: number): string {
  return new Date(instantDuJour(jour) + jours * JOUR_MS)
    .toISOString()
    .slice(0, 10)
}

/** Le nombre de jours de `du` à `au` : 0 pour un même jour. */
export function ecartEnJours(du: string, au: string): number {
  return Math.round((instantDuJour(au) - instantDuJour(du)) / JOUR_MS)
}

export interface PhaseDatee {
  cle: string
  libelle: string
  /** Premier jour de la phase. */
  du: string
  /** Dernier jour de la phase, compris. */
  au: string
}

/**
 * Les jours que couvre chaque phase d'une période (ADR 0025). Une phase va du
 * lendemain de la borne précédente jusqu'à sa propre borne. La première phase
 * n'a pas de début déclaré : elle commence à l'ouverture de la période, ou à sa
 * borne si l'ouverture est plus tardive. La dernière phase n'a pas de fin
 * déclarée : elle finit le dernier jour de la période, ou à son début s'il est
 * plus tardif.
 */
export function bornesDesPhases(
  phases: readonly Phase[],
  periode: { debut: string; fin: string; ouverture: string }
): PhaseDatee[] {
  let precedente: string | null = null
  return phases.map((phase, rang) => {
    const derniere = rang === phases.length - 1
    const borne =
      phase.jusquA === undefined
        ? null
        : decalerJour(periode.debut, joursRelatifs(phase.jusquA))
    let du =
      precedente === null ? periode.ouverture : decalerJour(precedente, 1)
    let au = borne ?? (derniere ? periode.fin : du)
    if (precedente === null && au < du) du = au
    if (au < du) au = du
    precedente = au
    return { cle: phase.cle, libelle: phase.libelle, du, au }
  })
}

/** Durée d'une date clé : 366 jours au plus, du premier au dernier jour. */
export const DATE_CLE_JOURS_MAX = 366

/** Une période compte 200 dates clés au plus. */
export const DATES_CLES_MAX = 200

/**
 * Valide les jours d'une date clé : le dernier jour suit le premier, la date clé
 * dure DATE_CLE_JOURS_MAX jours au plus, bornes comprises, et ses deux bornes
 * restent dans les deux ans qui entourent la période.
 */
export function joursDeDateCle(
  jour: string,
  jourFin: string | null,
  periode: { debut: string; fin: string }
): { jour: string; jourFin: string | null } {
  const horsFenetre = (j: string) =>
    j < decalerJour(periode.debut, -730) || j > decalerJour(periode.fin, 730)
  if (horsFenetre(jour) || (jourFin !== null && horsFenetre(jourFin))) {
    throw erreurSaisie(
      i18n._(
        'Une date clé se place dans les deux ans qui entourent la période.'
      )
    )
  }
  if (jourFin === null || jourFin === jour) return { jour, jourFin: null }
  if (jourFin < jour) {
    throw erreurSaisie(i18n._('Le dernier jour suit le premier.'))
  }
  // Le premier et le dernier jour comptent tous les deux.
  if (ecartEnJours(jour, jourFin) + 1 > DATE_CLE_JOURS_MAX) {
    throw erreurSaisie(
      i18n._('Une date clé dure {max} jours au plus.', {
        max: DATE_CLE_JOURS_MAX,
      })
    )
  }
  return { jour, jourFin }
}

/**
 * Refuse l'écriture dans l'agenda global d'une période : réservée aux admins de
 * l'activité et de l'organisation, tant que la période n'est pas archivée.
 */
export async function exigerEcritureGlobale(
  ctx: AppContext,
  editionId: string
): Promise<{ id: string; activiteId: string }> {
  const edition = await ctx.exigerEdition(editionId)
  await exigerModule(edition.activiteId, 'AGENDA')
  await ctx.exigerAdminDe(edition.activiteId)
  if (edition.statut === 'ARCHIVEE') {
    throw erreurSaisie(
      i18n._('Cette période est archivée : son agenda est en lecture seule.')
    )
  }
  return edition
}
