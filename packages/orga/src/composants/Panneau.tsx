import {
  DoubleLeftOutlined,
  DoubleRightOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useLingui } from '@lingui/react/macro'
import { Button } from 'antd'
import { useId, useRef, useState, type ReactNode } from 'react'

import {
  HAUT_SOUS_LA_BARRE,
  LARGEUR_VOLET_DEPLIE,
  useLargeurAuMoins,
  useVoletCollant,
} from '../lib/volets'

/**
 * Un panneau de verre, le plus souvent dans la colonne de droite. `teinte`
 * attire l'attention sur une seule chose : un panneau teinté par écran au plus.
 */
export function Panneau({
  titre,
  icone,
  extra,
  teinte = false,
  children,
  etiquette,
}: {
  titre?: ReactNode
  icone?: ReactNode
  extra?: ReactNode
  teinte?: boolean
  children: ReactNode
  /** Nom accessible du panneau quand il n'a pas de titre. */
  etiquette?: string
}) {
  return (
    <section
      className={`${teinte ? 'rt-verre-teinte' : 'rt-verre'} rt-panneau`}
      aria-label={titre ? undefined : etiquette}
    >
      {(titre || extra) && (
        <div className="rt-panneau-titre">
          {titre && (
            <h2>
              {icone}
              {titre}
            </h2>
          )}
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

/** Le contenu principal, puis une colonne de panneaux de 340 px. */
export function DeuxColonnes({
  children,
  cote,
}: {
  children: ReactNode
  cote: ReactNode
}) {
  // Le volet latéral se replie en une tranche, pour laisser sa largeur au
  // contenu (docs/design-system.md, « Volets »). L'état vaut pour l'écran
  // affiché : il ne se retient pas d'un écran à l'autre.
  const { t } = useLingui()
  const [replie, setReplie] = useState(false)
  // Sous cette largeur, les deux colonnes s'empilent : le volet suit le contenu.
  const coteACote = useLargeurAuMoins(LARGEUR_VOLET_DEPLIE)
  const volet = useRef<HTMLElement>(null)
  useVoletCollant(volet, HAUT_SOUS_LA_BARRE, coteACote)
  const libelle = replie
    ? t`Déplier le volet latéral`
    : t`Replier le volet latéral`
  return (
    <div
      className={
        replie ? 'rt-deux-colonnes rt-volet-replie' : 'rt-deux-colonnes'
      }
    >
      <div className="rt-colonne" style={{ gap: 26 }}>
        {children}
      </div>
      <aside
        className="rt-colonne rt-volet-lateral"
        ref={volet}
        // Replié, un clic sur la tranche rouvre le volet, comme son bouton.
        onClick={replie && coteACote ? () => setReplie(false) : undefined}
      >
        {coteACote && (
          <Button
            className="rt-bascule-volet-lateral"
            size="small"
            shape="circle"
            icon={replie ? <DoubleLeftOutlined /> : <DoubleRightOutlined />}
            aria-label={libelle}
            aria-expanded={!replie}
            title={libelle}
            onClick={evenement => {
              evenement.stopPropagation()
              setReplie(r => !r)
            }}
          />
        )}
        {/* Replié, le volet ne garde que le bord de ses cartes : son contenu
            sort de la lecture d'écran et du parcours au clavier. */}
        <div className="rt-volet-contenu" inert={replie && coteACote}>
          {cote}
        </div>
      </aside>
    </div>
  )
}

/**
 * Un groupe de cartes repliable : un cadre de verre teinté, plus étroit que
 * les cartes, passe derrière elles. Les cartes dépassent du cadre de chaque côté.
 */
export function Groupe({
  titre,
  nom,
  compte,
  extra,
  replie,
  onBasculer,
  children,
}: {
  titre: ReactNode
  /** Le nom du groupe en texte, pour le bouton qui le replie. */
  nom: string
  compte?: ReactNode
  extra?: ReactNode
  replie: boolean
  onBasculer: () => void
  children: ReactNode
}) {
  const { t } = useLingui()
  const id = useId()
  return (
    <section className={replie ? 'rt-groupe rt-groupe-replie' : 'rt-groupe'}>
      <div
        className="rt-groupe-titre"
        // Un clic sur l'en-tête bascule le groupe, sauf sur un lien ou un
        // bouton qu'il contient. Le clavier passe par le bouton.
        onClick={evenement => {
          if (!(evenement.target as Element).closest('a, button')) onBasculer()
        }}
      >
        <Button
          type="text"
          size="small"
          shape="circle"
          className="rt-groupe-bascule"
          icon={<RightOutlined rotate={replie ? 0 : 90} />}
          aria-expanded={!replie}
          aria-controls={id}
          aria-label={
            replie ? t`Déplier le groupe ${nom}` : t`Replier le groupe ${nom}`
          }
          onClick={onBasculer}
        />
        <h2>{titre}</h2>
        {compte !== undefined && <span className="rt-compte">{compte}</span>}
        {extra && <span style={{ marginInlineStart: 'auto' }}>{extra}</span>}
      </div>
      <div id={id} className="rt-groupe-contenu" hidden={replie}>
        {children}
      </div>
    </section>
  )
}

/** Une section du contenu : un titre, un compte en mono, puis la liste. */
export function Section({
  titre,
  compte,
  extra,
  children,
}: {
  titre: ReactNode
  compte?: ReactNode
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rt-section">
      <div className="rt-section-titre">
        <h2>{titre}</h2>
        {compte !== undefined && <span className="rt-compte">{compte}</span>}
        {extra && <span style={{ marginInlineStart: 'auto' }}>{extra}</span>}
      </div>
      {children}
    </section>
  )
}
