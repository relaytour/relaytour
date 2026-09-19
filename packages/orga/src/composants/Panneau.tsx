import type { ReactNode } from 'react'

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
  return (
    <div className="rt-deux-colonnes">
      <div className="rt-colonne" style={{ gap: 26 }}>
        {children}
      </div>
      <aside className="rt-colonne">{cote}</aside>
    </div>
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
