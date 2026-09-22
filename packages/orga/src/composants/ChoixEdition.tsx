import { useQuery } from '@apollo/client/react'
import { Select } from 'antd'

import { EDITIONS } from '../lib/requetes'

/** Le sélecteur d'édition des pages qui en consultent une autre que la courante. */
export default function ChoixEdition({
  valeur,
  onChange,
}: {
  valeur: string | undefined
  onChange: (editionId: string) => void
}) {
  const { data } = useQuery(EDITIONS)
  return (
    <span className="rt-choix-edition">
      <span className="rt-libelle" id="rt-libelle-edition">
        Édition
      </span>
      <Select
        aria-labelledby="rt-libelle-edition"
        style={{ minWidth: 160 }}
        value={valeur}
        onChange={onChange}
        options={(data?.editions ?? []).map(e => ({
          value: e.id,
          label: e.nom,
        }))}
      />
    </span>
  )
}
