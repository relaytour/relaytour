import { CheckOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, Dropdown } from 'antd'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useActivite } from '../lib/activite'

import Marque from './Marque'

/**
 * L'en-tête de la barre latérale : le logo et le sigle de l'activité affichée
 * (ADR 0008 et 0009), puis le bouton qui ouvre la liste des autres activités.
 * Le bouton disparaît quand l'organisation n'en porte qu'une.
 */
export default function ChoixActivite({
  taille = 28,
  apresChoix,
}: {
  taille?: number
  /** Ferme le tiroir de la vue mobile après un changement d'activité. */
  apresChoix?: () => void
}) {
  const { activite, activites } = useActivite()
  const navigate = useNavigate()
  const entete = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  // Le bouton est à droite de l'en-tête, la liste s'aligne sur le bord gauche du
  // panneau qui la porte : la barre latérale, ou le tiroir de la vue mobile.
  const [decalage, setDecalage] = useState(0)
  const mesurer = (ouvert: boolean) => {
    if (!ouvert || bouton.current === null || entete.current === null) return
    const panneau =
      entete.current.closest('.rt-barre-laterale, .ant-drawer-section') ??
      entete.current
    setDecalage(
      panneau.getBoundingClientRect().left -
        bouton.current.getBoundingClientRect().left
    )
  }
  const nom = activite.sigle ?? activite.nom
  return (
    <div className="rt-entete-activite" ref={entete}>
      <Marque nom={nom} taille={taille} />
      {activites.length > 1 && (
        <Dropdown
          trigger={['click']}
          placement="bottomLeft"
          align={{ points: ['tl', 'bl'], offset: [decalage, 8] }}
          onOpenChange={mesurer}
          menu={{
            selectable: true,
            selectedKeys: [activite.slug],
            items: activites.map(a => ({
              key: a.slug,
              icon:
                a.logoUrl === null ? undefined : (
                  <img src={a.logoUrl} alt="" height={16} />
                ),
              label: a.nom,
              extra: a.slug === activite.slug ? <CheckOutlined /> : undefined,
            })),
            onClick: ({ key }) => {
              apresChoix?.()
              if (key !== activite.slug) navigate(`/${key}/`)
            },
          }}
        >
          <Button
            ref={bouton}
            type="text"
            icon={<SwapOutlined />}
            aria-label="Changer d’activité"
            title="Changer d’activité"
          />
        </Dropdown>
      )}
    </div>
  )
}
