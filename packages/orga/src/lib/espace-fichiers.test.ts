import { describe, expect, it } from 'vitest'

import { nomServi } from './espace-fichiers'

describe('nomServi', () => {
  it('lit le nom encodé que l’API donne au fichier', () => {
    expect(
      nomServi(
        `attachment; filename="Compte rendu.docx"; filename*=UTF-8''Compte%20rendu%20%C3%A9t%C3%A9.docx`
      )
    ).toBe('Compte rendu été.docx')
  })

  it('rend null sans nom, ou avec un nom mal encodé', () => {
    expect(nomServi(null)).toBeNull()
    expect(nomServi('attachment')).toBeNull()
    expect(nomServi(`attachment; filename*=UTF-8''%E0%A4%A`)).toBeNull()
  })
})
