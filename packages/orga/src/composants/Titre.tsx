import { fonts } from '@relaytour/tokens'
import type { ReactNode } from 'react'

// Titre de page en Bebas Neue, comme les titres du site 2027.
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
        style={{
          fontFamily: fonts.display,
          fontWeight: 400,
          fontSize: 44,
          lineHeight: 1,
          margin: 0,
          letterSpacing: '.01em',
        }}
      >
        {children}
      </h1>
      {sousTitre && (
        <p style={{ margin: '8px 0 0', opacity: 0.75, fontWeight: 600 }}>
          {sousTitre}
        </p>
      )}
    </header>
  )
}
