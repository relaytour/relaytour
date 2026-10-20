import { TeamOutlined } from '@ant-design/icons'
import { Popover } from 'antd'

import { useActivite } from '../lib/activite'
import EtiquettePerimetre from './EtiquettePerimetre'

interface PerimetreLu {
  id: string
  slug: string
  nom: string
  couleur?: string | null
}

export interface ConnexionLue {
  par: 'LISTE' | 'GROUPE' | 'DECLINAISON'
  groupe?: string | null
  masquee: boolean
  perimetre: PerimetreLu
}

/**
 * Les périmètres qu'une fiche concerne aussi (ADR 0039) : ceux de sa liste, ses
 * groupes, avec leurs périmètres dans une bulle, puis ceux d'une tâche partagée.
 * Les masquages se lisent à part. Rien ne s'affiche pour une fiche qui ne concerne
 * aucun autre périmètre.
 */
export default function ConnexionsFiche({
  groupes,
  connexions,
}: {
  groupes: string[]
  connexions: ConnexionLue[]
}) {
  const { lien, libelleGroupe } = useActivite()
  const etiquette = (p: PerimetreLu) => (
    <EtiquettePerimetre
      key={p.id}
      nom={p.nom}
      couleur={p.couleur}
      lien={lien(`/perimetres/${p.slug}`)}
    />
  )
  const liste = connexions.filter(c => c.par === 'LISTE')
  const parTache = connexions.filter(c => c.par === 'DECLINAISON')
  const masquees = connexions.filter(c => c.masquee)
  if (liste.length + groupes.length + parTache.length === 0) return null
  return (
    <>
      {liste.length + groupes.length > 0 && (
        <>
          <dt>Concerne aussi</dt>
          <dd className="rt-connexions">
            {liste.map(c => etiquette(c.perimetre))}
            {groupes.map(cle => {
              const membres = connexions.filter(
                c => c.par === 'GROUPE' && c.groupe === cle
              )
              return (
                <Popover
                  key={cle}
                  trigger={['hover', 'click']}
                  title={libelleGroupe(cle, true)}
                  content={
                    membres.length === 0 ? (
                      <span className="rt-texte-secondaire">
                        Aucun autre périmètre dans ce groupe.
                      </span>
                    ) : (
                      <span className="rt-mention-membres">
                        {membres.map(c => etiquette(c.perimetre))}
                      </span>
                    )
                  }
                >
                  <button
                    type="button"
                    className="rt-etiquette rt-mention-groupe"
                  >
                    <TeamOutlined aria-hidden /> {libelleGroupe(cle, true)}
                  </button>
                </Popover>
              )
            })}
          </dd>
        </>
      )}
      {parTache.length > 0 && (
        <>
          <dt>Par une tâche partagée</dt>
          <dd className="rt-connexions">
            {parTache.map(c => etiquette(c.perimetre))}
          </dd>
        </>
      )}
      {masquees.length > 0 && (
        <>
          <dt>Masquée par</dt>
          <dd className="rt-connexions">
            {masquees.map(c => etiquette(c.perimetre))}
          </dd>
        </>
      )}
    </>
  )
}
