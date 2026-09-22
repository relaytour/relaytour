import { useQuery } from '@apollo/client/react'
import { Select } from 'antd'

import { useActivite } from '../lib/activite'
import { EDITIONS } from '../lib/requetes'

/**
 * Le sélecteur de période des pages qui en consultent une autre que la courante :
 * édition, saison ou mandat selon la nature de l'activité (ADR 0008).
 */
export default function ChoixEdition({
  valeur,
  onChange,
}: {
  valeur: string | undefined
  onChange: (editionId: string) => void
}) {
  const { data } = useQuery(EDITIONS)
  const { periode } = useActivite()
  return (
    <span className="rt-choix-edition">
      <span className="rt-libelle" id="rt-libelle-edition">
        {periode.Nom}
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
