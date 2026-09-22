import { Link } from 'react-router'

import { useOrganisation } from '../lib/organisation'
import { teinteLisible } from '../lib/theme'

/**
 * Le nom d'un périmètre sur un fond teinté de sa couleur. Sans couleur déclarée,
 * l'étiquette prend la primaire du thème. Avec `lien`, elle mène au périmètre.
 */
export default function EtiquettePerimetre({
  nom,
  couleur,
  lien,
  point = false,
}: {
  nom: string
  couleur: string | null | undefined
  lien?: string
  point?: boolean
}) {
  const { theme } = useOrganisation()
  const base = couleur ?? theme.couleurs.primaire
  const style = {
    background: `color-mix(in srgb, ${base} 13%, transparent)`,
    color: teinteLisible(base, theme.couleurs.encre),
  }
  const contenu = (
    <>
      {point && <span className="rt-point" style={{ background: base }} />}
      {nom}
    </>
  )
  return lien ? (
    <Link className="rt-etiquette" style={style} to={lien}>
      {contenu}
    </Link>
  ) : (
    <span className="rt-etiquette" style={style}>
      {contenu}
    </span>
  )
}
