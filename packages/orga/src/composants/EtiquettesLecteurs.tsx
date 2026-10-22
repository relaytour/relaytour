import { TeamOutlined } from '@ant-design/icons'

import { useActivite } from '../lib/activite'
import EtiquettePerimetre from './EtiquettePerimetre'

/**
 * Les lecteurs d'un dossier lié (ADR 0043) : « Toute l'activité », ou les
 * étiquettes de ses groupes puis de ses périmètres.
 */
export default function EtiquettesLecteurs({
  touteActivite,
  perimetres,
  groupes,
}: {
  touteActivite: boolean
  perimetres: { id: string; nom: string; couleur?: string | null }[]
  groupes: string[]
}) {
  const { libelleGroupe } = useActivite()
  if (touteActivite) return <span>Toute l’activité</span>
  return (
    <span className="rt-connexions">
      {groupes.map(cle => (
        <span key={cle} className="rt-etiquette rt-mention-groupe">
          <TeamOutlined aria-hidden /> {libelleGroupe(cle, true)}
        </span>
      ))}
      {perimetres.map(p => (
        <EtiquettePerimetre key={p.id} nom={p.nom} couleur={p.couleur} point />
      ))}
    </span>
  )
}
