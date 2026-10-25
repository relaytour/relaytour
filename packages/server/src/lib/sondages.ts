import { decalerJour } from './agenda.ts'
import { erreurSaisie } from './erreurs.ts'
import { HEURE } from './heures.ts'
import { i18n } from './langue.ts'

// Sondages de dates (ADR 0037). Ce module ne lit pas la base.

/** Un sondage propose 20 créneaux au plus. */
export const CRENEAUX_MAX = 20

export interface CreneauSaisi {
  id?: string | null
  jour: string
  heureDebut?: string | null
  heureFin?: string | null
}

export interface CreneauValide {
  id: string | null
  jour: string
  heureDebut: string | null
  heureFin: string | null
  ordre: number
}

/**
 * Valide les créneaux d'un sondage : un à vingt, chacun un jour dans les deux ans
 * qui entourent la période, avec un horaire complet ou sans horaire. Les créneaux
 * se rangent par jour puis par heure, et deux créneaux identiques n'en font qu'un.
 */
export function creneauxValides(
  creneaux: readonly CreneauSaisi[],
  periode: { debut: string; fin: string }
): CreneauValide[] {
  if (creneaux.length === 0) {
    throw erreurSaisie(i18n._('Proposez au moins un créneau.'))
  }
  if (creneaux.length > CRENEAUX_MAX) {
    throw erreurSaisie(
      i18n._('Un sondage propose {max} créneaux au plus.', {
        max: CRENEAUX_MAX,
      })
    )
  }
  const vus = new Set<string>()
  const valides: Omit<CreneauValide, 'ordre'>[] = []
  for (const c of creneaux) {
    if (
      c.jour < decalerJour(periode.debut, -730) ||
      c.jour > decalerJour(periode.fin, 730)
    ) {
      throw erreurSaisie(
        i18n._(
          'Un créneau se place dans les deux ans qui entourent la période.'
        )
      )
    }
    const debut = c.heureDebut?.trim() || null
    const fin = c.heureFin?.trim() || null
    if ((debut === null) !== (fin === null)) {
      throw erreurSaisie(
        i18n._(
          'Un créneau porte une heure de début et une heure de fin, ou aucune.'
        )
      )
    }
    if (debut !== null && fin !== null) {
      if (!HEURE.test(debut) || !HEURE.test(fin)) {
        throw erreurSaisie(i18n._('L’heure attendue est au format HH:MM.'))
      }
      if (fin <= debut) {
        throw erreurSaisie(i18n._('L’heure de fin suit l’heure de début.'))
      }
    }
    const cle = `${c.jour} ${debut ?? ''} ${fin ?? ''}`
    if (vus.has(cle)) continue
    vus.add(cle)
    valides.push({
      id: c.id ?? null,
      jour: c.jour,
      heureDebut: debut,
      heureFin: fin,
    })
  }
  // Un créneau existant ne se modifie qu'une fois : deux créneaux qui portent le
  // même identifiant écraseraient l'un l'autre.
  const ids = valides.flatMap(c => (c.id === null ? [] : [c.id]))
  if (new Set(ids).size !== ids.length) {
    throw erreurSaisie(i18n._('Un créneau existant figure deux fois.'))
  }
  return valides
    .sort(
      (a, b) =>
        a.jour.localeCompare(b.jour) ||
        (a.heureDebut ?? '').localeCompare(b.heureDebut ?? '')
    )
    .map((c, ordre) => ({ ...c, ordre }))
}
