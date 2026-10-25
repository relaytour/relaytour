import { TeamOutlined } from '@ant-design/icons'
import { Trans } from '@lingui/react/macro'
import { Popover } from 'antd'

import { useActivite } from '../lib/activite'
import type { Mentions } from '../lib/mentions'
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
  mentions,
  perimetreDeLaFiche,
}: {
  groupes: string[]
  connexions: ConnexionLue[]
  /** Le catalogue des périmètres de l'activité, qui donne les membres d'un groupe. */
  mentions: Mentions
  perimetreDeLaFiche: string | null
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
          <dt>
            <Trans>Concerne aussi</Trans>
          </dt>
          <dd className="rt-connexions">
            {liste.map(c => etiquette(c.perimetre))}
            {groupes.map(cle => {
              // Les membres du groupe, quel que soit le chemin de leur partage : un
              // périmètre aussi présent dans la liste reste dans la bulle.
              const membres = (mentions.groupes.get(cle)?.perimetres ?? [])
                .filter(p => p.id !== perimetreDeLaFiche)
                .map(perimetre => ({ perimetre }))
              return (
                <Popover
                  key={cle}
                  trigger={['hover', 'click']}
                  title={libelleGroupe(cle, true)}
                  content={
                    membres.length === 0 ? (
                      <span className="rt-texte-secondaire">
                        <Trans>Aucun autre périmètre dans ce groupe.</Trans>
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
          <dt>
            <Trans>Par une tâche partagée</Trans>
          </dt>
          <dd className="rt-connexions">
            {parTache.map(c => etiquette(c.perimetre))}
          </dd>
        </>
      )}
      {masquees.length > 0 && (
        <>
          <dt>
            <Trans>Masquée par</Trans>
          </dt>
          <dd className="rt-connexions">
            {masquees.map(c => etiquette(c.perimetre))}
          </dd>
        </>
      )}
    </>
  )
}
