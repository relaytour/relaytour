// Le pictogramme de Relaytour : deux arcs qui se passent le relais. Le premier
// prend la primaire du thème, le second son accent. Il reste lisible à 16 px.
export function Pictogramme({
  taille = 28,
  monochrome = false,
}: {
  taille?: number
  monochrome?: boolean
}) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 10 37 A 15 15 0 0 1 40 37"
        fill="none"
        stroke={monochrome ? 'currentColor' : 'var(--rt-primaire)'}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d="M 24 27 A 15 15 0 0 0 54 27"
        fill="none"
        stroke={monochrome ? 'currentColor' : 'var(--rt-accent)'}
        strokeWidth={9}
        strokeLinecap="round"
        opacity={monochrome ? 0.55 : 1}
      />
    </svg>
  )
}

/**
 * La marque affichée dans la barre latérale et sur l'écran de connexion. Le
 * nom viendra de la configuration de l'organisation servie par l'API
 * (ADR 0006) ; d'ici là, il vaut « Relaytour ».
 */
export default function Marque({
  nom = 'Relaytour',
  taille = 28,
}: {
  nom?: string
  taille?: number
}) {
  return (
    <span className="rt-marque">
      <Pictogramme taille={taille} />
      <span className="rt-marque-nom">{nom}</span>
    </span>
  )
}
