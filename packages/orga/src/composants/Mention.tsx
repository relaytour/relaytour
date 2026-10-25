import { TeamOutlined } from '@ant-design/icons'
import { Trans } from '@lingui/react/macro'
import { Popover } from 'antd'
import type { ReactNode } from 'react'

import { useActivite } from '../lib/activite'
import type { Mentions } from '../lib/mentions'
import EtiquettePerimetre from './EtiquettePerimetre'

/**
 * Une mention d'une fiche (ADR 0039). Un périmètre s'affiche en étiquette et mène à
 * sa page. Un groupe ouvre une bulle qui liste ses périmètres : au survol sur un
 * ordinateur, à l'appui sur un téléphone.
 */
export default function Mention({
  cible,
  mentions,
  children,
}: {
  /** `perimetre:<slug>` ou `groupe:<clé>`. */
  cible: string
  mentions: Mentions
  children: ReactNode
}) {
  const { lien } = useActivite()
  const [nature, cle = ''] = cible.split(':')
  if (nature === 'perimetre') {
    const perimetre = mentions.perimetres.get(cle)
    if (perimetre === undefined) return <>{children}</>
    return (
      <EtiquettePerimetre
        nom={perimetre.nom}
        couleur={perimetre.couleur}
        lien={
          mentions.sansLien ? undefined : lien(`/perimetres/${perimetre.slug}`)
        }
      />
    )
  }
  const groupe = mentions.groupes.get(cle)
  if (groupe === undefined) return <>{children}</>
  return (
    <Popover
      trigger={['hover', 'click']}
      title={groupe.libelle}
      content={
        groupe.perimetres.length === 0 ? (
          <span className="rt-texte-secondaire">
            <Trans>Ce groupe ne compte aucun périmètre.</Trans>
          </span>
        ) : (
          <span className="rt-mention-membres">
            {groupe.perimetres.map(p => (
              <EtiquettePerimetre
                key={p.id}
                nom={p.nom}
                couleur={p.couleur}
                lien={
                  mentions.sansLien ? undefined : lien(`/perimetres/${p.slug}`)
                }
              />
            ))}
          </span>
        )
      }
    >
      <button type="button" className="rt-etiquette rt-mention-groupe">
        <TeamOutlined aria-hidden /> {groupe.libelle}
      </button>
    </Popover>
  )
}
