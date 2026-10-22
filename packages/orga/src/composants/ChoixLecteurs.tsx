import { Select } from 'antd'

import { depuisValeurs, versValeurs } from '../lib/concerne'
import type { Lecteurs } from '../lib/espace-fichiers'
import type { Mentions } from '../lib/mentions'

/** La valeur de l'option « Toute l'activité ». */
const TOUT = 'tout'

/**
 * Le choix de périmètres et de groupes d'une activité : la liste « Concerne aussi »
 * d'une fiche (ADR 0039), ou les lecteurs d'un dossier lié (ADR 0043). Avec
 * `toutPossible`, l'option « Toute l'activité » s'ajoute en tête : la choisir vide
 * la liste, et choisir un élément de la liste la retire.
 */
export default function ChoixLecteurs({
  valeur,
  onChange,
  mentions,
  exclure,
  toutPossible = false,
  placeholder,
  ariaLabel,
}: {
  valeur: Lecteurs
  onChange: (valeur: Lecteurs) => void
  mentions: Mentions
  /** Un périmètre à ne pas proposer, comme celui de la fiche. */
  exclure?: string
  toutPossible?: boolean
  placeholder: string
  ariaLabel: string
}) {
  const options = [
    ...(toutPossible
      ? [
          {
            label: 'Activité',
            options: [{ value: TOUT, label: 'Toute l’activité' }],
          },
        ]
      : []),
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
        .filter(p => p.id !== exclure)
        .map(p => ({ value: `p:${p.id}`, label: p.nom })),
    },
  ]
  const valeurs = valeur.touteActivite ? [TOUT] : versValeurs(valeur)
  const changer = (choisies: string[]) => {
    const nouvelles = choisies.filter(v => !valeurs.includes(v))
    if (nouvelles.includes(TOUT)) {
      onChange({ touteActivite: true, perimetres: [], groupes: [] })
      return
    }
    onChange({
      touteActivite: false,
      ...depuisValeurs(choisies.filter(v => v !== TOUT)),
    })
  }
  return (
    <Select
      mode="multiple"
      allowClear
      value={valeurs}
      onChange={changer}
      options={options}
      optionFilterProp="label"
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  )
}
