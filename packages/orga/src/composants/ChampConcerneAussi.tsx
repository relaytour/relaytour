import { useLingui } from '@lingui/react/macro'

import type { Concerne } from '../lib/concerne'
import type { Mentions } from '../lib/mentions'
import ChoixLecteurs from './ChoixLecteurs'

/**
 * Le choix de la liste « Concerne aussi » d'une fiche (ADR 0039) : les groupes de
 * l'activité, puis ses autres périmètres non archivés.
 */
export default function ChampConcerneAussi({
  valeur,
  onChange,
  mentions,
  perimetreDeLaFiche,
}: {
  valeur: Concerne
  onChange: (valeur: Concerne) => void
  mentions: Mentions
  perimetreDeLaFiche: string
}) {
  const { t } = useLingui()
  return (
    <ChoixLecteurs
      valeur={{ touteActivite: false, ...valeur }}
      onChange={({ perimetres, groupes }) => onChange({ perimetres, groupes })}
      mentions={mentions}
      exclure={perimetreDeLaFiche}
      placeholder={t`Aucun autre périmètre`}
      ariaLabel={t`Concerne aussi`}
    />
  )
}
