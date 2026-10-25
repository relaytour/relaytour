import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
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
  const { t } = useLingui()
  const couleur =
    renforts < besoin ? 'warning' : renforts > besoin ? 'processing' : 'success'
  const manque = besoin - renforts
  const titre =
    renforts < besoin
      ? t`Il manque ${plural(manque, { one: '# renfort', other: '# renforts' })}.`
      : renforts > besoin
        ? t`Le besoin est dépassé.`
        : t`Le besoin est atteint.`
  return (
    <Tag color={couleur} title={titre} className="rt-jauge">
      {court ? `${renforts}/${besoin}` : t`${renforts} / ${besoin} renforts`}
    </Tag>
  )
}

const LIBELLES: Record<Etat, MessageDescriptor> = {
  CONFIRMEE: msg`Confirmée`,
  A_CONFIRMER: msg`À confirmer`,
  NON_CONFIRMEE: msg`Non confirmée`,
}

/** L'état d'une place qui attend la confirmation de la personne. */
export function EtatPlace({ etat }: { etat: Etat }) {
  const { t } = useLingui()
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
          ? t`La personne n’a pas confirmé depuis sept jours, ou la séquence arrive demain.`
          : undefined
      }
    >
      {t(LIBELLES[etat])}
    </Tag>
  )
}
