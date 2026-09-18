import { describe, expect, it } from 'vitest'

import { GABARITS } from './gabarits.genere.ts'
import { rendre } from './rendu.ts'

describe('gabarits', () => {
  it('ont tous une partie HTML et une partie texte', () => {
    for (const [nom, gabarit] of Object.entries(GABARITS)) {
      expect(gabarit.html, nom).toContain('github.com/relaytour/relaytour')
      expect(gabarit.texte, nom).toContain('github.com/relaytour/relaytour')
    }
  })

  it('rendent le gabarit d’essai sans variable', () => {
    const { html, texte } = rendre('essai')
    expect(html).toContain('Essai d’envoi')
    expect(texte).toContain('Essai d’envoi')
  })

  it('rend une liste échappée dans le HTML et en lignes dans le texte', async () => {
    const { rendre: rendreListe } = await import('./rendu.ts')
    const { html, texte } = rendreListe('rappels-echeance', {
      rappels: ['Tâche <b>A</b>', 'Tâche B'],
      lienConnexion: 'https://orga.exemple.org/',
      lienPreferences: 'https://orga.exemple.org/preferences',
    })
    expect(html).toContain(
      '<li style="margin:0 0 8px">Tâche &lt;b&gt;A&lt;/b&gt;</li>'
    )
    expect(texte).toContain('- Tâche <b>A</b>\n- Tâche B')
  })
})
