import { describe, expect, it } from 'vitest'

import { GABARITS, type NomGabarit } from './gabarits.genere.ts'
import { rendre, type VariablesOrganisation } from './rendu.ts'

const ORGANISATION: VariablesOrganisation = {
  organisation: 'Les Rencontres',
  logoUrl: '',
  couleurEncre: '#1B2730',
  couleurPrimaire: '#1E5A63',
  couleurAccent: '#AD412B',
  couleurSol: '#F4F6F7',
  consigneReponse: 'Pour toute question, répondez à ce mail.',
}

/** Une valeur pour chaque variable d'un gabarit : une adresse pour un lien. */
const VARIABLES_VIDES = (noms: readonly string[]) =>
  Object.fromEntries(
    noms.map(n => [n, /lien|url/i.test(n) ? 'https://exemple.org/' : 'x'])
  )

describe('gabarits', () => {
  it('portent tous le nom de l’organisation et le crédit Relaytour', () => {
    for (const [nom, gabarit] of Object.entries(GABARITS)) {
      // Le nom de l'organisation entre dans le texte traduit du pied (ADR 0047).
      const pied = rendre(
        nom as NomGabarit,
        VARIABLES_VIDES(gabarit.variables),
        ORGANISATION
      )
      expect(pied.html, nom).toContain(ORGANISATION.organisation)
      expect(pied.texte, nom).toContain(ORGANISATION.organisation)
      // La consigne de réponse se compose à l'envoi (ADR 0053).
      expect(pied.html, nom).toContain(ORGANISATION.consigneReponse)
      expect(pied.texte, nom).toContain(ORGANISATION.consigneReponse)
      expect(gabarit.variables, nom).not.toContain('consigneReponse')
      expect(gabarit.html, nom).toContain('github.com/relaytour/relaytour')
      expect(gabarit.texte, nom).toContain('github.com/relaytour/relaytour')
      expect(gabarit.html, nom).not.toMatch(/#0[1-4]0[1-4]0[1-4]/i)
      expect(gabarit.variables, nom).not.toContain('organisation')
    }
  })

  it('insère une valeur saisie dans un texte traduit sans la réinterpréter', () => {
    // Un nom saisi qui ressemble à une variable, à une case ou à du HTML reste
    // une valeur : échappée dans le HTML, telle quelle dans le texte (ADR 0047).
    const nom = '{{lienConnexion}} {{§0}} {nom} <b>gras</b>'
    const rendu = rendre(
      'invitation',
      { ...VARIABLES_VIDES(GABARITS.invitation.variables), nom },
      ORGANISATION
    )
    expect(rendu.html).toContain(
      'Bonjour {{lienConnexion}} {{§0}} {nom} &lt;b&gt;gras&lt;/b&gt;,'
    )
    expect(rendu.html).not.toContain('<b>gras</b>')
    expect(rendu.texte).toContain(`Bonjour ${nom},`)
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

  it('affiche le logo PNG dans l’en-tête HTML et le nom dans la partie texte', () => {
    const { html, texte } = rendre(
      'essai',
      {},
      {
        ...ORGANISATION,
        logoUrl: 'https://orga.exemple.org/medias/abc.png',
      }
    )
    expect(html).toContain(
      '<img src="https://orga.exemple.org/medias/abc.png" alt="Les Rencontres"'
    )
    expect(texte.split('\n')[0]).toBe('Les Rencontres')
  })

  it('place chaque liste sous son intertitre, échappé', () => {
    const { html, texte } = rendre(
      'rappels-echeance',
      {
        rappels: [
          { titre: 'Rencontres', elements: ['La tâche « A » <b> (Natation).'] },
          { titre: 'Club & co', elements: ['La tâche « B » (Bassin).'] },
        ],
        lienConnexion: 'https://orga.exemple.org/',
        lienPreferences: 'https://orga.exemple.org/preferences',
      },
      ORGANISATION
    )
    expect(html).toContain('>Rencontres</p><ul')
    expect(html).toContain('Club &amp; co')
    expect(html).toContain('&lt;b&gt;')
    expect(texte).toContain('Rencontres\n- La tâche « A » <b> (Natation).')
    expect(texte).toContain('Club & co\n- La tâche « B » (Bassin).')
  })

  it('range les lignes par périmètre et par rubrique, avec des lignes en retrait échappées', () => {
    const { html, texte } = rendre(
      'rappels-echeance',
      {
        rappels: [
          {
            titre: 'Rencontres',
            elements: [],
            sousGroupes: [
              {
                titre: 'Coordination <i>',
                rubriques: [
                  {
                    titre: 'En retard',
                    alerte: true,
                    elements: ['« A », en retard depuis le 3 novembre'],
                  },
                  {
                    titre: 'Déclinaisons en retard',
                    alerte: true,
                    elements: [
                      {
                        texte: '« Suivre les pôles »',
                        retrait: [
                          'Ville : « B » <b>, en retard',
                          'Déclinaisons : 1 en retard sur 3',
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        lienConnexion: 'https://orga.exemple.org/',
        lienPreferences: 'https://orga.exemple.org/preferences',
      },
      ORGANISATION
    )
    expect(html).toContain('Coordination &lt;i&gt;</p>')
    expect(html).toContain('color:#B0283F">En retard</p>')
    expect(html).toContain('Ville : « B » &lt;b&gt;, en retard</li>')
    expect(html).not.toContain('<b>')
    expect(texte).toContain(
      [
        'Rencontres',
        '  Coordination <i>',
        '    En retard',
        '    - « A », en retard depuis le 3 novembre',
        '    Déclinaisons en retard',
        '    - « Suivre les pôles »',
        '        · Ville : « B » <b>, en retard',
        '        · Déclinaisons : 1 en retard sur 3',
      ].join('\n')
    )
  })

  it('refuse un logo qui n’a pas une adresse https', () => {
    expect(() =>
      rendre('essai', {}, { ...ORGANISATION, logoUrl: 'javascript:alert(1)' })
    ).toThrow(/https/)
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

  // Proposition du modèle de notifications dans le mail d'équipe (ADR 0065).
  const equipe = (propositionModele: unknown[]) =>
    rendre(
      'equipe',
      {
        nom: 'Sofia',
        changements: ['Vous rejoignez le périmètre Accueil.'],
        propositionModele: propositionModele as [],
        lienConnexion: 'https://orga.exemple.org/',
        roleModeDEmploi: 'des référentes et référents',
        lienModeDEmploi: 'https://relaytour.org/modes-d-emploi/referent.html',
      },
      ORGANISATION
    )

  it('rend la proposition d’un modèle en paragraphe avec un lien échappé', () => {
    const { html, texte } = equipe([
      {
        paragraphe: 'Le modèle « <b>Contact</b> » correspond à votre rôle.',
        libelleLien: 'Appliquer ce modèle',
        lien: 'https://orga.exemple.org/preferences?a=1&b=2',
      },
    ])
    expect(html).toContain(
      `Le modèle « &lt;b&gt;Contact&lt;/b&gt; » correspond à votre rôle. <a href="https://orga.exemple.org/preferences?a=1&amp;b=2" style="color:${ORGANISATION.couleurPrimaire};font-weight:600">Appliquer ce modèle</a>`
    )
    expect(texte).toContain(
      '- Vous rejoignez le périmètre Accueil.\n\nLe modèle « <b>Contact</b> » correspond à votre rôle.\nAppliquer ce modèle : https://orga.exemple.org/preferences?a=1&b=2\n\n'
    )
  })

  it('n’écrit rien sans proposition, pas même une ligne vide', () => {
    const { html, texte } = equipe([])
    expect(html).not.toContain('<a href="https://orga.exemple.org/preferences')
    expect(texte).toContain(
      '- Vous rejoignez le périmètre Accueil.\n\nVos périmètres'
    )
  })

  it('refuse le lien d’une proposition qui n’est pas en https', () => {
    expect(() =>
      equipe([
        { paragraphe: 'x', libelleLien: 'y', lien: 'javascript:alert(1)' },
      ])
    ).toThrow(/https/)
  })
})
