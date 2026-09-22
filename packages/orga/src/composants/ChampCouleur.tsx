import { ColorPicker } from 'antd'

/**
 * Champ de formulaire pour une couleur de thème, au format #RRGGBB. Une valeur
 * vide reprend la couleur héritée, affichée en indication.
 */
export default function ChampCouleur({
  value,
  onChange,
  heritee,
}: {
  value?: string | null
  onChange?: (valeur: string | null) => void
  heritee: string
}) {
  return (
    <ColorPicker
      value={value ?? heritee}
      allowClear
      showText={() => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value ?? `${heritee} (héritée)`}
        </span>
      )}
      disabledAlpha
      onChange={couleur => onChange?.(couleur.toHexString().toUpperCase())}
      onClear={() => onChange?.(null)}
    />
  )
}
