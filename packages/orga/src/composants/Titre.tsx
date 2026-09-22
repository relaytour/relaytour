import type { ReactNode } from 'react'

/**
 * En-tête de page : le titre et son sous-titre à gauche, les actions à droite.
 * La famille, la graisse et l'échelle du titre viennent du thème. `avant` pose
 * un fil d'Ariane au-dessus du titre.
 */
export default function Titre({
  children,
  sousTitre,
  actions,
  avant,
}: {
  children: ReactNode
  sousTitre?: ReactNode
  actions?: ReactNode
  avant?: ReactNode
}) {
  return (
    <header className="rt-entete">
      <div style={{ minWidth: 0 }}>
        {avant}
        <h1
          className="rt-titre"
          style={{ fontSize: 'calc(30px * var(--rt-titre-echelle))' }}
        >
          {children}
        </h1>
        {sousTitre && (
          <p style={{ margin: '6px 0 0', color: 'var(--rt-encre-70)' }}>
            {sousTitre}
          </p>
        )}
      </div>
      {actions && <div className="rt-entete-actions">{actions}</div>}
    </header>
  )
}
