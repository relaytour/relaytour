import { Select } from 'antd'

import { depuisValeurs, versValeurs, type Concerne } from '../lib/concerne'
import type { Mentions } from '../lib/mentions'

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
  const options = [
    {
      label: 'Groupes',
      options: [...mentions.groupes].map(([cle, g]) => ({
        value: `g:${cle}`,
        label: `${g.libelle} (tout le groupe)`,
      })),
    },
    {
      label: 'Périmètres',
      options: [...mentions.perimetres.values()]
        .filter(p => p.id !== perimetreDeLaFiche)
        .map(p => ({ value: `p:${p.id}`, label: p.nom })),
    },
  ]
  return (
    <Select
      mode="multiple"
      allowClear
      value={versValeurs(valeur)}
      onChange={valeurs => onChange(depuisValeurs(valeurs))}
      options={options}
      optionFilterProp="label"
      placeholder="Aucun autre périmètre"
      aria-label="Concerne aussi"
    />
  )
}
