import { useOrganisation } from '../lib/organisation'
import { texteSur } from '../lib/theme'

/**
 * Le nom d'un périmètre sur sa couleur pleine. Sans couleur déclarée, la
 * pastille prend la primaire du thème de l'organisation.
 */
export default function PastillePerimetre({
  nom,
  couleur,
  fermer,
}: {
  nom: string
  couleur: string | null | undefined
  /** Présent dans un champ à choix multiples : une croix retire le périmètre. */
  fermer?: () => void
}) {
  const { theme } = useOrganisation()
  const fond = couleur ?? theme.couleurs.primaire
  const texte = texteSur(fond)
  return (
    <span
      className="rt-pastille"
      style={{ background: fond, color: texte }}
      onMouseDown={fermer ? e => e.preventDefault() : undefined}
    >
      {nom}
      {fermer && (
        <button
          type="button"
          className="rt-pastille-fermer"
          aria-label={`Retirer ${nom}`}
          style={{ color: texte }}
          onClick={fermer}
        >
          ×
        </button>
      )}
    </span>
  )
}
