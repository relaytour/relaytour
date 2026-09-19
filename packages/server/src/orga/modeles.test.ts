import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { dateEcheance, ErreurModeles, lireModeles } from './modeles.ts'

const ORGANISATION = `slug: club
nom: Club nautique
domainesCourrielAutorises: [club.example]
`

// Chaque dossier d'essai reçoit une organisation valide, sauf si le test en fournit une.
function dossier(fichiers: Record<string, string>): string {
  const racine = mkdtempSync(path.join(tmpdir(), 'relaytour-modeles-'))
  for (const [chemin, contenu] of Object.entries({
    'organisation.yaml': ORGANISATION,
    ...fichiers,
  })) {
    mkdirSync(path.dirname(path.join(racine, chemin)), { recursive: true })
    writeFileSync(path.join(racine, chemin), contenu)
  }
  return racine
}

const PERIMETRES = `perimetres:
  - slug: natation
    nom: Natation
    type: SPORT
`

const fiche = (slug: string, corps = '## Objectif\n\nRéserver.') =>
  `---\nslug: ${slug}\ntitre: Réserver la piscine\n---\n\n${corps}\n`

function erreurs(racine: string): string[] {
  try {
    lireModeles(racine)
    return []
  } catch (e) {
    if (e instanceof ErreurModeles) return e.erreurs
    throw e
  }
}

describe('lireModeles', () => {
  it('lit un dossier valide', () => {
    const modeles = lireModeles(
      dossier({
        'perimetres.yaml': PERIMETRES,
        'fiches/natation/reserver.md': fiche('reserver'),
        'fiches/communes/accueil.md': fiche('accueil'),
        'taches/natation.yaml':
          'taches:\n  - modele: piscine\n    titre: Réserver\n    echeance: J-30\n    fiche: reserver\n',
      })
    )
    expect(modeles.fiches.map(f => [f.slug, f.perimetre])).toEqual([
      ['accueil', null],
      ['reserver', 'natation'],
    ])
    expect(modeles.taches.get('natation')).toHaveLength(1)
    expect(modeles.organisation.nom).toBe('Club nautique')
    expect(modeles.organisation.fuseauHoraire).toBe('Europe/Paris')
  })

  it('exige organisation.yaml', () => {
    const racine = mkdtempSync(path.join(tmpdir(), 'relaytour-modeles-'))
    writeFileSync(path.join(racine, 'perimetres.yaml'), PERIMETRES)
    expect(erreurs(racine).join()).toMatch(/organisation\.yaml est absent/)
  })

  it('refuse une organisation avec une clé inconnue ou un contact hors domaine', () => {
    expect(
      erreurs(
        dossier({
          'organisation.yaml': `${ORGANISATION}couleur: bleu\n`,
          'perimetres.yaml': PERIMETRES,
        })
      ).join()
    ).toMatch(/organisation\.yaml/)
    expect(
      erreurs(
        dossier({
          'organisation.yaml': `${ORGANISATION}contactRecrutement: contact@autre.example\n`,
          'perimetres.yaml': PERIMETRES,
        })
      ).join()
    ).toMatch(/contactRecrutement/)
  })

  it('admet les boîtes des domaines déclarés dans organisation.yaml', () => {
    const modeles = lireModeles(
      dossier({
        'perimetres.yaml': PERIMETRES,
        'fiches/natation/reserver.md': fiche(
          'reserver',
          'Écrire à natation@club.example.'
        ),
      })
    )
    expect(modeles.fiches).toHaveLength(1)
  })

  it('lit un effectif facultatif', () => {
    const modeles = lireModeles(
      dossier({
        'perimetres.yaml': `${PERIMETRES}    effectif: 2
  - slug: communication
    nom: Communication
    type: POLE
`,
      })
    )
    expect(modeles.perimetres.map(p => [p.slug, p.effectif])).toEqual([
      ['natation', 2],
      ['communication', undefined],
    ])
  })

  it('refuse un effectif négatif ou décimal', () => {
    for (const effectif of ['-1', '1.5']) {
      const racine = dossier({
        'perimetres.yaml': `${PERIMETRES}    effectif: ${effectif}\n`,
      })
      expect(erreurs(racine).join()).toMatch(/perimetres\.yaml : .*effectif/)
    }
  })

  it('refuse un champ inconnu', () => {
    const racine = dossier({
      'perimetres.yaml': PERIMETRES.replace(
        'type: SPORT',
        'type: SPORT\n    responsable: Jean'
      ),
    })
    expect(erreurs(racine).join()).toMatch(/perimetres\.yaml/)
  })

  it('refuse une donnée personnelle dans une fiche', () => {
    const racine = dossier({
      'perimetres.yaml': PERIMETRES,
      'fiches/natation/reserver.md': fiche(
        'reserver',
        'Appeler le 06 12 34 56 78.'
      ),
    })
    expect(erreurs(racine).join()).toMatch(/données personnelles/)
  })

  it('refuse un fichier dont le nom diffère du slug', () => {
    const racine = dossier({
      'perimetres.yaml': PERIMETRES,
      'fiches/natation/autre-nom.md': fiche('reserver'),
    })
    expect(erreurs(racine).join()).toMatch(/reserver\.md/)
  })

  it('refuse un périmètre inconnu et une fiche citée absente', () => {
    const racine = dossier({
      'perimetres.yaml': PERIMETRES,
      'fiches/rugby/regles.md': fiche('regles'),
      'taches/natation.yaml':
        'taches:\n  - modele: piscine\n    titre: Réserver\n    fiche: absente\n',
    })
    const liste = erreurs(racine).join('\n')
    expect(liste).toMatch(/fiches\/rugby/)
    expect(liste).toMatch(/absente/)
  })

  it('refuse une échéance mal formée', () => {
    const racine = dossier({
      'perimetres.yaml': PERIMETRES,
      'taches/natation.yaml':
        'taches:\n  - modele: piscine\n    titre: Réserver\n    echeance: 2027-06-01\n',
    })
    expect(erreurs(racine).join()).toMatch(/J-120/)
  })
})

describe('dateEcheance', () => {
  const debut = new Date('2027-08-27T00:00:00Z')

  it('compte les jours avant le premier jour de l’édition', () => {
    expect(dateEcheance('J-30', debut)?.toISOString().slice(0, 10)).toBe(
      '2027-07-28'
    )
  })

  it('compte les jours après', () => {
    expect(dateEcheance('J+3', debut)?.toISOString().slice(0, 10)).toBe(
      '2027-08-30'
    )
  })

  it('renvoie null sans échéance', () => {
    expect(dateEcheance(undefined, debut)).toBeNull()
  })
})
