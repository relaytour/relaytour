import { describe, expect, it } from 'vitest'

import { GABARITS } from './gabarits.genere.ts'
import { rendre, type VariablesOrganisation } from './rendu.ts'

const ORGANISATION: VariablesOrganisation = {
  organisation: 'Les Rencontres',
  couleurEncre: '#1B2730',
  couleurPrimaire: '#1E5A63',
  couleurAccent: '#AD412B',
  couleurSol: '#F4F6F7',
}

describe('gabarits', () => {
  it('portent tous le nom de l’organisation et le crédit Relaytour', () => {
    for (const [nom, gabarit] of Object.entries(GABARITS)) {
      expect(gabarit.html, nom).toContain('{{organisation}}')
      expect(gabarit.texte, nom).toContain('{{organisation}}')
      expect(gabarit.html, nom).toContain('github.com/relaytour/relaytour')
      expect(gabarit.texte, nom).toContain('github.com/relaytour/relaytour')
      expect(gabarit.html, nom).not.toMatch(/#0[1-4]0[1-4]0[1-4]/i)
      expect(gabarit.variables, nom).not.toContain('organisation')
    }
  })

  it('rend le gabarit d’essai avec le nom et les couleurs de l’organisation', () => {
    const { html, texte } = rendre('essai', {}, ORGANISATION)
    expect(html).toContain('Essai d’envoi')
    expect(html).toContain('Les Rencontres')
    expect(html).toContain('#1B2730')
    expect(html).toContain('#F4F6F7')
    expect(html).not.toContain('{{')
    expect(texte).toContain('Les Rencontres')
    expect(texte).toContain('propulsé par Relaytour')
  })

  it('refuse une couleur qui n’a pas la forme #RRGGBB', () => {
    expect(() =>
      rendre('essai', {}, { ...ORGANISATION, couleurPrimaire: 'red;x:1' })
    ).toThrow(/#RRGGBB/)
  })

  it('rend une liste échappée dans le HTML et en lignes dans le texte', () => {
    const { html, texte } = rendre(
      'rappels-echeance',
      {
        rappels: ['Tâche <b>A</b>', 'Tâche B'],
        lienConnexion: 'https://orga.exemple.org/',
        lienPreferences: 'https://orga.exemple.org/preferences',
      },
      ORGANISATION
    )
    expect(html).toContain(
      '<li style="margin:0 0 8px">Tâche &lt;b&gt;A&lt;/b&gt;</li>'
    )
    expect(texte).toContain('- Tâche <b>A</b>\n- Tâche B')
  })
})
