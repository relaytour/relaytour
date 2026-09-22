import type { ReactNode } from 'react'

export interface OptionPuce<T extends string> {
  valeur: T
  libelle: ReactNode
  /** Un nombre affiché en mono après le libellé. */
  compte?: number
}

/**
 * Un groupe de puces exclusives : une seule est active. Il remplace un
 * Segmented d'antd dans les filtres.
 */
export function Puces<T extends string>({
  libelle,
  valeur,
  options,
  onChange,
}: {
  /** Le nom du groupe, lu par les lecteurs d'écran. */
  libelle: string
  valeur: T
  options: OptionPuce<T>[]
  onChange: (valeur: T) => void
}) {
  return (
    <div className="rt-puces" role="group" aria-label={libelle}>
      {options.map(option => (
        <button
          key={option.valeur}
          type="button"
          className="rt-puce"
          aria-pressed={option.valeur === valeur}
          onClick={() => onChange(option.valeur)}
        >
          {option.libelle}
          {option.compte !== undefined && (
            <span className="rt-puce-compte">{option.compte}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/** Une puce qui s'active et se désactive, comme une case à cocher. */
export function PuceBascule({
  actif,
  onChange,
  children,
}: {
  actif: boolean
  onChange: (actif: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="rt-puce rt-puce-bascule"
      aria-pressed={actif}
      onClick={() => onChange(!actif)}
    >
      {actif && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
      {children}
    </button>
  )
}

/** Un trait vertical entre deux groupes de puces. */
export function SeparateurPuces() {
  return <span className="rt-puces-separateur" aria-hidden="true" />
}
