import { msg } from '@lingui/core/macro'
import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { debutTravail, DUREES_TACHE } from '@relaytour/commun'

import type { DureeTache } from '../gql/graphql'

// Durée estimée d'une tâche et période de travail (ADR 0068). Les jours retenus
// pour chaque durée viennent de `@relaytour/commun`, comme pour le serveur.

const LIBELLES: Record<DureeTache, MessageDescriptor> = {
  QUELQUES_JOURS: msg`Quelques jours`,
  DEUX_A_TROIS_SEMAINES: msg`2 à 3 semaines`,
  UN_A_DEUX_MOIS: msg`1 à 2 mois`,
  DEUX_A_TROIS_MOIS: msg`2 à 3 mois`,
}

/** Le libellé d'une durée, dans la langue active. */
export function useLibelleDuree() {
  const { i18n } = useLingui()
  return (duree: DureeTache) => i18n._(LIBELLES[duree])
}

/** Les durées, dans l'ordre croissant, pour une liste de choix. */
export function useOptionsDuree() {
  const libelle = useLibelleDuree()
  return DUREES_TACHE.map(duree => ({ value: duree, label: libelle(duree) }))
}

/** Le premier jour de la période de travail (AAAA-MM-JJ), ou null. */
export function debutDeLaPeriode(tache: {
  echeance?: string | null
  duree?: DureeTache | null
}): string | null {
  return debutTravail(tache.echeance ?? null, tache.duree ?? null)
}
