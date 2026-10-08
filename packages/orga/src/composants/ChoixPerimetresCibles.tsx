import { PlusOutlined } from '@ant-design/icons'
import { Button, Select } from 'antd'

import { useActivite } from '../lib/activite'
import { CIBLES_MAX } from '../lib/declinaisons'

import PastillePerimetre from './PastillePerimetre'

/** Un périmètre où décliner une tâche partagée (ADR 0026). */
export interface PerimetreCible {
  id: string
  nom: string
  groupe: string
  couleur?: string | null
}

/**
 * Le choix des périmètres où décliner une tâche : une liste à choix multiples,
 * rangée par groupe, et un bouton par groupe pour les ajouter tous. Le composant
 * suit le contrat d'un champ de formulaire (`value`, `onChange`).
 */
export default function ChoixPerimetresCibles({
  perimetres,
  value = [],
  onChange,
  disabled = false,
}: {
  perimetres: PerimetreCible[]
  value?: string[]
  onChange?: (ids: string[]) => void
  disabled?: boolean
}) {
  const { activite } = useActivite()
  const groupes = activite.groupes
    .map(groupe => ({
      groupe,
      perimetres: perimetres.filter(p => p.groupe === groupe.cle),
    }))
    .filter(g => g.perimetres.length > 0)
  const couleurDe = new Map(perimetres.map(p => [p.id, p.couleur]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Select
        mode="multiple"
        maxTagCount="responsive"
        // Le serveur refuse une liste plus longue : le champ s'arrête avant.
        maxCount={CIBLES_MAX}
        allowClear
        aria-label="Périmètres"
        placeholder="Choisir des périmètres"
        disabled={disabled}
        value={value}
        onChange={onChange}
        optionFilterProp="label"
        options={groupes.map(g => ({
          label: g.groupe.libellePluriel,
          options: g.perimetres.map(p => ({
            value: p.id,
            label: p.nom,
            couleur: p.couleur,
          })),
        }))}
        optionRender={option => (
          <PastillePerimetre
            nom={String(option.label)}
            couleur={(option.data as { couleur?: string | null }).couleur}
          />
        )}
        tagRender={({ value: id, label, closable, onClose }) => (
          <PastillePerimetre
            nom={String(label)}
            couleur={couleurDe.get(String(id))}
            fermer={closable ? onClose : undefined}
          />
        )}
      />
      {groupes.length > 0 && (
        <div className="rt-puces">
          {groupes.map(g => {
            const avecLeGroupe = [
              ...new Set([...value, ...g.perimetres.map(p => p.id)]),
            ]
            const tropLong = avecLeGroupe.length > CIBLES_MAX
            return (
              <Button
                key={g.groupe.cle}
                size="small"
                icon={<PlusOutlined />}
                disabled={
                  disabled ||
                  tropLong ||
                  g.perimetres.every(p => value.includes(p.id))
                }
                title={
                  tropLong
                    ? `Une tâche se décline dans ${CIBLES_MAX} périmètres au plus.`
                    : undefined
                }
                aria-label={`Ajouter tous les périmètres du groupe ${g.groupe.libellePluriel}`}
                onClick={() => onChange?.(avecLeGroupe)}
              >
                {g.groupe.libellePluriel}
              </Button>
            )
          })}
        </div>
      )}
      {value.length >= CIBLES_MAX && (
        <span className="rt-note">
          Une tâche se décline dans {CIBLES_MAX} périmètres au plus en une fois.
        </span>
      )}
    </div>
  )
}
