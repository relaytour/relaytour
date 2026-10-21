import { Tag } from 'antd'

import type { EtatPlace as Etat } from '../gql/graphql'

// La jauge d'une séquence et l'état d'une place (ADR 0041). Le besoin compte les
// renforts recherchés ; une place à confirmer y compte déjà.

/** « 2 / 6 renforts », coloré selon le manque ou le dépassement. */
export function Jauge({
  renforts,
  besoin,
  court = false,
}: {
  renforts: number
  besoin: number
  /** « 2/6 » seulement, pour une carte du programme. */
  court?: boolean
}) {
  const couleur =
    renforts < besoin ? 'warning' : renforts > besoin ? 'processing' : 'success'
  const titre =
    renforts < besoin
      ? `Il manque ${besoin - renforts} renfort${besoin - renforts > 1 ? 's' : ''}.`
      : renforts > besoin
        ? 'Le besoin est dépassé.'
        : 'Le besoin est atteint.'
  return (
    <Tag color={couleur} title={titre} className="rt-jauge">
      {court ? `${renforts}/${besoin}` : `${renforts} / ${besoin} renforts`}
    </Tag>
  )
}

const LIBELLES: Record<Etat, string> = {
  CONFIRMEE: 'Confirmée',
  A_CONFIRMER: 'À confirmer',
  NON_CONFIRMEE: 'Non confirmée',
}

/** L'état d'une place qui attend la confirmation de la personne. */
export function EtatPlace({ etat }: { etat: Etat }) {
  return (
    <Tag
      color={
        etat === 'NON_CONFIRMEE'
          ? 'error'
          : etat === 'A_CONFIRMER'
            ? 'warning'
            : 'success'
      }
      title={
        etat === 'NON_CONFIRMEE'
          ? 'La personne n’a pas confirmé depuis sept jours, ou la séquence arrive demain.'
          : undefined
      }
    >
      {LIBELLES[etat]}
    </Tag>
  )
}
