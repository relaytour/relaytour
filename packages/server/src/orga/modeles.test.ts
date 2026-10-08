import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ciblesDeLaDeclinaison,
  dateEcheance,
  ErreurModeles,
  lireModeles,
  textesDeLaDeclinaison,
} from './modeles.ts'

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
    expect(
      modeles.activites[0]!.fiches.map(f => [f.slug, f.perimetre])
    ).toEqual([
      ['accueil', null],
      ['reserver', 'natation'],
    ])
    expect(modeles.activites[0]!.taches.get('natation')).toHaveLength(1)
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
    expect(modeles.activites[0]!.fiches).toHaveLength(1)
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
    expect(
      modeles.activites[0]!.perimetres.map(p => [p.slug, p.effectif])
    ).toEqual([
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

  it('lit une description facultative, sans les espaces autour', () => {
    const modeles = lireModeles(
      dossier({
        'perimetres.yaml': `${PERIMETRES}    description: '  Treize épreuves sur une journée.  '\n`,
      })
    )
    expect(modeles.activites[0]!.perimetres[0]!.description).toBe(
      'Treize épreuves sur une journée.'
    )
  })

  it('refuse une description trop longue ou qui contient une coordonnée personnelle', () => {
    for (const [description, motif] of [
      ['x'.repeat(401), /description/],
      ['Appelez le 06 12 34 56 78.', /données personnelles/],
    ] as const) {
      const racine = dossier({
        'perimetres.yaml': `${PERIMETRES}    description: '${description}'\n`,
      })
      expect(erreurs(racine).join()).toMatch(motif)
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

describe('disposition activites/ (ADR 0008)', () => {
  const ACTIVITE_TOURNOI = `slug: tournoi
nom: Tournoi d'été
nature: EVENEMENT
`
  const ACTIVITE_SECTION = `slug: section
nom: Section natation
nature: SAISON
groupes:
  - cle: equipe
    libelle: Équipe
    libellePluriel: Équipes
  - cle: pole
    libelle: Pôle
    libellePluriel: Pôles
`
  const PERIMETRES_SECTION = `perimetres:
  - slug: encadrement
    nom: Encadrement
    groupe: equipe
  - slug: materiel
    nom: Matériel
    groupe: pole
`

  it('lit plusieurs activités, leur nature et leurs groupes', () => {
    const modeles = lireModeles(
      dossier({
        'activites/tournoi/activite.yaml': ACTIVITE_TOURNOI,
        'activites/tournoi/perimetres.yaml': PERIMETRES,
        'activites/tournoi/fiches/natation/reserver.md': fiche('reserver'),
        'activites/section/activite.yaml': ACTIVITE_SECTION,
        'activites/section/perimetres.yaml': PERIMETRES_SECTION,
        'activites/section/fiches/communes/saison.md': fiche('saison'),
        'activites/section/taches/encadrement.yaml':
          'taches:\n  - modele: planning\n    titre: Planifier les créneaux\n    echeance: J-10\n    fiche: saison\n',
      })
    )
    expect(modeles.disposition).toBe('activites')
    expect(
      modeles.activites.map(a => [a.declaration.slug, a.declaration.nature])
    ).toEqual([
      ['section', 'SAISON'],
      ['tournoi', 'EVENEMENT'],
    ])
    const section = modeles.activites[0]!
    expect(section.perimetres.map(p => [p.slug, p.groupe, p.type])).toEqual([
      ['encadrement', 'equipe', 'POLE'],
      ['materiel', 'pole', 'POLE'],
    ])
    expect(section.fiches[0]?.fichier).toBe(
      'activites/section/fiches/communes/saison.md'
    )
    // Le tournoi ne déclare pas de groupes : sport et pôle par défaut.
    expect(modeles.activites[1]!.declaration.groupes.map(g => g.cle)).toEqual([
      'sport',
      'pole',
    ])
    expect(modeles.activites[1]!.perimetres[0]?.groupe).toBe('sport')
  })

  it('lit les phases d’une activité, et les laisse absentes sinon (ADR 0025)', () => {
    const modeles = lireModeles(
      dossier({
        'activites/tournoi/activite.yaml': ACTIVITE_TOURNOI,
        'activites/tournoi/perimetres.yaml': PERIMETRES,
        'activites/section/activite.yaml': `${ACTIVITE_SECTION}phases:
  - cle: rentree
    libelle: Rentrée
    jusquA: J+30
  - cle: saison
    libelle: Saison
`,
        'activites/section/perimetres.yaml': PERIMETRES_SECTION,
      })
    )
    expect(modeles.activites[0]!.declaration.phases).toEqual([
      { cle: 'rentree', libelle: 'Rentrée', jusquA: 'J+30' },
      { cle: 'saison', libelle: 'Saison' },
    ])
    expect(modeles.activites[1]!.declaration.phases).toBeUndefined()
  })

  it('refuse des phases mal ordonnées, en nommant le fichier et la phase', () => {
    expect(
      erreurs(
        dossier({
          'activites/tournoi/activite.yaml': `${ACTIVITE_TOURNOI}phases:
  - cle: preparation
    libelle: Préparation
    jusquA: J-7
  - cle: cadrage
    libelle: Cadrage
    jusquA: J-90
  - cle: bilan
    libelle: Bilan
    jusquA: J+30
`,
          'activites/tournoi/perimetres.yaml': PERIMETRES,
        })
      )
    ).toEqual([
      'activites/tournoi/activite.yaml : phases.1.jusquA les bornes se suivent dans l’ordre croissant',
      'activites/tournoi/activite.yaml : phases.2.jusquA la dernière phase ne porte pas de borne : elle reçoit tout ce qui suit',
    ])
  })

  it('décrit une activité implicite en disposition plate', () => {
    const modeles = lireModeles(dossier({ 'perimetres.yaml': PERIMETRES }))
    expect(modeles.disposition).toBe('plate')
    expect(modeles.activites).toHaveLength(1)
    expect(modeles.activites[0]).toMatchObject({
      implicite: true,
      declaration: { slug: 'club', nom: 'Club nautique', nature: 'EVENEMENT' },
    })
  })

  it('refuse le mélange des deux dispositions', () => {
    const racine = dossier({
      'perimetres.yaml': PERIMETRES,
      'activites/tournoi/activite.yaml': ACTIVITE_TOURNOI,
      'activites/tournoi/perimetres.yaml': PERIMETRES,
    })
    expect(erreurs(racine).join()).toMatch(/mélange deux dispositions/)
  })

  it('refuse une activité sans activite.yaml ou au slug différent du dossier', () => {
    expect(
      erreurs(
        dossier({ 'activites/tournoi/perimetres.yaml': PERIMETRES })
      ).join()
    ).toMatch(/activite\.yaml est absent/)
    expect(
      erreurs(
        dossier({
          'activites/ete/activite.yaml': ACTIVITE_TOURNOI,
          'activites/ete/perimetres.yaml': PERIMETRES,
        })
      ).join()
    ).toMatch(/le slug doit être ete/)
  })

  it('refuse un périmètre d’un groupe que l’activité ne déclare pas', () => {
    const racine = dossier({
      'activites/section/activite.yaml': ACTIVITE_SECTION,
      'activites/section/perimetres.yaml': PERIMETRES,
    })
    expect(erreurs(racine).join()).toMatch(
      /natation appartient au groupe sport, que l'activité ne déclare pas/
    )
  })

  it('refuse un périmètre sans groupe ni type', () => {
    const racine = dossier({
      'perimetres.yaml': 'perimetres:\n  - slug: natation\n    nom: Natation\n',
    })
    expect(erreurs(racine).join()).toMatch(/groupe attendu/)
  })

  it('refuse un slug de fiche utilisé dans deux activités', () => {
    const racine = dossier({
      'activites/tournoi/activite.yaml': ACTIVITE_TOURNOI,
      'activites/tournoi/perimetres.yaml': PERIMETRES,
      'activites/tournoi/fiches/communes/accueil.md': fiche('accueil'),
      'activites/section/activite.yaml': ACTIVITE_SECTION,
      'activites/section/perimetres.yaml': PERIMETRES_SECTION,
      'activites/section/fiches/communes/accueil.md': fiche('accueil'),
    })
    expect(erreurs(racine).join()).toMatch(/le slug accueil est déjà utilisé/)
  })

  it('refuse une tâche qui cite la fiche d’une autre activité', () => {
    const racine = dossier({
      'activites/tournoi/activite.yaml': ACTIVITE_TOURNOI,
      'activites/tournoi/perimetres.yaml': PERIMETRES,
      'activites/tournoi/fiches/communes/accueil.md': fiche('accueil'),
      'activites/section/activite.yaml': ACTIVITE_SECTION,
      'activites/section/perimetres.yaml': PERIMETRES_SECTION,
      'activites/section/taches/encadrement.yaml':
        'taches:\n  - modele: planning\n    titre: Planifier\n    fiche: accueil\n',
    })
    expect(erreurs(racine).join()).toMatch(
      /cite la fiche accueil, qui n'existe pas dans cette activité/
    )
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

describe('tâches partagées (ADR 0026)', () => {
  const ACTIVITE = `slug: tournoi
nom: Tournoi
groupes:
  - cle: sport
    libelle: Sport
    libellePluriel: Sports
  - cle: pole
    libelle: Pôle
    libellePluriel: Pôles
  - cle: atelier
    libelle: Atelier
    libellePluriel: Ateliers
`
  const PERIMETRES_TOURNOI = `perimetres:
  - slug: lieux
    nom: Lieux
    groupe: pole
  - slug: natation
    nom: Natation
    groupe: sport
    ordre: 1
  - slug: volley
    nom: Volley
    groupe: sport
    ordre: 2
`
  const partagee = (declinaison: string, modele = 'besoins-de-lieux') =>
    `taches:
  - modele: ${modele}
    titre: Recenser les besoins de lieux
    description: Le pôle réunit les besoins de chaque sport.
    echeance: J-300
    fiche: reserver
    declinaison:
${declinaison}
`
  const contenu = (fichiers: Record<string, string>) =>
    dossier({
      'activites/tournoi/activite.yaml': ACTIVITE,
      'activites/tournoi/perimetres.yaml': PERIMETRES_TOURNOI,
      'activites/tournoi/fiches/communes/reserver.md': fiche('reserver'),
      'activites/tournoi/fiches/lieux/missions.md': fiche('missions'),
      ...fichiers,
    })

  it('décline une tâche dans les périmètres d’un groupe, sans son périmètre d’origine', () => {
    const modeles = lireModeles(
      contenu({
        'activites/tournoi/taches/lieux.yaml': partagee(
          '      groupe: sport\n      titre: Transmettre les besoins de lieux\n      echeance: J-285'
        ),
      })
    )
    const activite = modeles.activites[0]!
    const tache = activite.taches.get('lieux')![0]!
    expect(ciblesDeLaDeclinaison(tache, 'lieux', activite.perimetres)).toEqual([
      'natation',
      'volley',
    ])
    expect(textesDeLaDeclinaison(tache)).toEqual({
      titre: 'Transmettre les besoins de lieux',
      description: 'Le pôle réunit les besoins de chaque sport.',
      echeance: 'J-285',
    })
  })

  it('décline une tâche dans une liste de périmètres, et reprend ses textes', () => {
    const modeles = lireModeles(
      contenu({
        'activites/tournoi/taches/lieux.yaml': partagee(
          '      perimetres: [volley]'
        ),
      })
    )
    const activite = modeles.activites[0]!
    const tache = activite.taches.get('lieux')![0]!
    expect(ciblesDeLaDeclinaison(tache, 'lieux', activite.perimetres)).toEqual([
      'volley',
    ])
    expect(textesDeLaDeclinaison(tache)).toEqual({
      titre: 'Recenser les besoins de lieux',
      description: 'Le pôle réunit les besoins de chaque sport.',
      echeance: 'J-300',
    })
  })

  it('ne décline pas une tâche ordinaire', () => {
    const modeles = lireModeles(
      contenu({
        'activites/tournoi/taches/lieux.yaml':
          'taches:\n  - modele: visite\n    titre: Visiter les lieux\n',
      })
    )
    const activite = modeles.activites[0]!
    expect(
      ciblesDeLaDeclinaison(
        activite.taches.get('lieux')![0]!,
        'lieux',
        activite.perimetres
      )
    ).toEqual([])
  })

  it.each([
    [
      'un groupe et une liste ensemble',
      '      groupe: sport\n      perimetres: [volley]',
      /declinaison\.groupe groupe ou perimetres attendu/,
    ],
    [
      'ni groupe ni liste',
      '      titre: Transmettre',
      /declinaison\.groupe groupe ou perimetres attendu/,
    ],
    [
      'un groupe que l’activité ne déclare pas',
      '      groupe: commission',
      /se décline dans le groupe commission, que l'activité ne déclare pas/,
    ],
    [
      'un groupe sans autre périmètre',
      '      groupe: atelier',
      /le groupe atelier, qui ne contient aucun autre périmètre/,
    ],
    [
      'un périmètre inconnu',
      '      perimetres: [escrime]',
      /le périmètre escrime, qui n'existe pas/,
    ],
    [
      'son propre périmètre',
      '      perimetres: [lieux, volley]',
      /ne se décline pas dans son propre périmètre/,
    ],
    [
      'deux fois le même périmètre',
      '      perimetres: [volley, volley]',
      /cite deux fois le même périmètre cible/,
    ],
    [
      'une fiche de périmètre',
      '      groupe: sport\n      fiche: missions',
      /ne cite qu'une fiche commune/,
    ],
    [
      'une fiche inconnue',
      '      groupe: sport\n      fiche: absente',
      /cite la fiche absente, qui n'existe pas/,
    ],
    [
      'un champ inconnu',
      '      groupe: sport\n      priorite: haute',
      /declinaison/,
    ],
    [
      'une donnée personnelle dans son titre',
      '      groupe: sport\n      titre: Écrire à jean.dupont@messagerie.example',
      /besoins-de-lieux contient des données personnelles/,
    ],
  ])('refuse %s', (_cas, declinaison, attendu) => {
    const lues = erreurs(
      contenu({ 'activites/tournoi/taches/lieux.yaml': partagee(declinaison) })
    )
    expect(lues.join('\n')).toMatch(attendu)
  })

  it('refuse un modèle que le périmètre cible déclare déjà', () => {
    const lues = erreurs(
      contenu({
        'activites/tournoi/taches/lieux.yaml': partagee('      groupe: sport'),
        'activites/tournoi/taches/volley.yaml':
          'taches:\n  - modele: besoins-de-lieux\n    titre: Transmettre les besoins\n',
      })
    )
    expect(lues).toEqual([
      'activites/tournoi/taches/volley.yaml : le modèle besoins-de-lieux est déjà décliné depuis activites/tournoi/taches/lieux.yaml',
    ])
  })

  it('refuse deux tâches partagées qui déclinent le même modèle dans un périmètre', () => {
    const lues = erreurs(
      contenu({
        'activites/tournoi/taches/lieux.yaml': partagee('      groupe: sport'),
        'activites/tournoi/taches/natation.yaml': partagee(
          '      perimetres: [volley]'
        ).replace('    fiche: reserver\n', ''),
      })
    )
    expect(lues.join('\n')).toMatch(
      /le modèle besoins-de-lieux est déjà décliné dans volley depuis/
    )
  })
})
