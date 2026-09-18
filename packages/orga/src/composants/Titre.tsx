import type { ReactNode } from 'react'

// Titre de page : la famille, la graisse et l'échelle viennent du thème.
export default function Titre({
  children,
  sousTitre,
}: {
  children: ReactNode
  sousTitre?: ReactNode
}) {
  return (
    <header style={{ marginBottom: 24 }}>
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
    </header>
  )
}
