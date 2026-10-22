import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  choixDuFichier,
  construirePersonnes,
  detecterColonnes,
  enLots,
  lireCsv,
  lireDate,
  lireFichier,
  lireHoraire,
  posteDe,
  proposerCible,
  valeursDe,
  type Champ,
  type Cible,
  type Tableau,
} from './import-benevoles'

// Les fichiers d'essai sont fictifs (ADR 0042) : une ligne par personne, une
// imitation d'export de billetterie (formes 2 et 4, lot de billets sans
// personne, colonnes sensibles) et plusieurs lignes par personne (forme 3).

const essai = (nom: string) =>
  readFileSync(new URL(`./essais-import/${nom}`, import.meta.url), 'utf8')

const champsDe = (tableau: Tableau) =>
  Object.fromEntries(
    detecterColonnes(tableau).map(c => [c.entete, c.champ] as const)
  )

describe('horaires et dates', () => {
  it('lit les formes courantes d’un horaire', () => {
    expect(lireHoraire('Service au bar - 18h - 19h')).toEqual({
      heureDebut: '18:00',
      heureFin: '19:00',
    })
    expect(lireHoraire('17:00-18:30')).toEqual({
      heureDebut: '17:00',
      heureFin: '18:30',
    })
    expect(lireHoraire('de 9h à 12h')).toEqual({
      heureDebut: '09:00',
      heureFin: '12:00',
    })
    expect(lireHoraire('Accueil')).toBeNull()
    expect(posteDe('Service au bar - 18h - 19h')).toBe('Service au bar')
  })

  it('lit une date française, ISO ou un nombre de série Excel', () => {
    expect(lireDate('12/03/2027')).toBe('2027-03-12')
    expect(lireDate('2027-03-12T10:00')).toBe('2027-03-12')
    expect(lireDate('46458')).toBe('2027-03-12')
    expect(lireDate('bientôt')).toBeNull()
    // Un export américain, et une date impossible.
    expect(lireDate('03/25/2026')).toBe('2026-03-25')
    expect(lireDate('2026-13-45')).toBeNull()
    expect(lireDate('31/02/2026')).toBeNull()
  })

  it('rattache les horaires seuls d’une cellule au poste qui les précède', () => {
    expect(valeursDe('Service au bar\n18h - 19h\n19h - 20h')).toEqual([
      'Service au bar 18h - 19h',
      'Service au bar 19h - 20h',
    ])
    expect(valeursDe('Accueil; Buvette 19h-20h')).toEqual([
      'Accueil',
      'Buvette 19h-20h',
    ])
    expect(valeursDe('Buvette 19h-20h, 20h-21h')).toEqual([
      'Buvette 19h-20h',
      'Buvette 20h-21h',
    ])
  })
})

describe('une ligne par personne', () => {
  it('détecte les colonnes et construit les personnes', async () => {
    const tableau = await lireCsv(essai('une-ligne-par-personne.csv'))
    expect(champsDe(tableau)).toEqual({
      Prénom: 'PRENOM',
      Nom: 'NOM',
      Email: 'COURRIEL',
      Téléphone: 'TELEPHONE',
      Disponibilités: 'PRECISIONS',
    })
    const champs = detecterColonnes(tableau).map(c => c.champ)
    const { personnes, ecartees } = construirePersonnes(
      tableau,
      champs,
      new Map(),
      { valeursNon: [], jour: null }
    )
    expect(ecartees).toEqual([])
    expect(
      personnes.map(p => [p.cle, p.nom, p.courriel, p.precisions])
    ).toEqual([
      [
        'L2',
        'Camille Martin',
        'camille.martin@exemple.org',
        'Le matin seulement',
      ],
      ['L3', 'Lou Roux', 'lou.roux@exemple.org', null],
      ['L4', 'Sacha Bernard', null, null],
    ])
  })
})

describe('imitation d’un export de billetterie', () => {
  const sequences = [
    {
      id: 'bar1',
      titre: 'Service au bar',
      jour: '2027-04-10',
      heureDebut: '18:00',
      heureFin: '19:00',
    },
    {
      id: 'bar2',
      titre: 'Service au bar',
      jour: '2027-04-10',
      heureDebut: '19:00',
      heureFin: '20:00',
    },
    {
      id: 'accueil',
      titre: 'Accueil du public',
      jour: '2027-04-10',
      heureDebut: '17:00',
      heureFin: '18:00',
    },
  ]

  it('ignore les colonnes sensibles et garde la colonne la plus remplie', async () => {
    const tableau = await lireCsv(essai('billetterie.csv'))
    expect(champsDe(tableau)).toMatchObject({
      'Numéro de billet': 'REF_EXTERNE',
      'Nom participant': 'NOM',
      'Prénom participant': 'PRENOM',
      Nom: 'IGNORER',
      Prénom: 'IGNORER',
      Email: 'COURRIEL',
      Téléphone: 'TELEPHONE',
      Genre: 'IGNORER',
      Montant: 'IGNORER',
      'Date de la commande': 'DATE_ACCORD',
      Prestations: 'VALEURS',
      'Service au bar - 18h - 19h': 'CHOIX',
      'Accueil - 17h - 18h': 'CHOIX',
      'Je précise par écrit': 'PRECISIONS',
    })
    const sensibles = detecterColonnes(tableau)
      .filter(c => c.sensible)
      .map(c => c.entete)
    expect(sensibles).toEqual(['Genre', 'Montant'])
  })

  it('écarte le lot de billets, lit « 0 » comme choisi et associe les postes aux séquences', async () => {
    const tableau = await lireCsv(essai('billetterie.csv'))
    const champs = detecterColonnes(tableau).map(c => c.champ)
    const choix = choixDuFichier(tableau, champs)
    const cibles = new Map<string, Cible>(
      choix.map(c => [c.cle, proposerCible(c, sequences, '2027-04-10')])
    )
    expect(
      Object.fromEntries(
        choix.map(c => [c.libelle, cibles.get(c.cle)] as const)
      )
    ).toMatchObject({
      'Service au bar - 18h - 19h': { type: 'SEQUENCE', sequenceId: 'bar1' },
      'Service au bar - 19h - 20h': { type: 'SEQUENCE', sequenceId: 'bar2' },
      'Accueil - 17h - 18h': { type: 'SEQUENCE', sequenceId: 'accueil' },
      'Service au bar 18h - 19h': { type: 'SEQUENCE', sequenceId: 'bar1' },
      'Accueil 17h - 18h': { type: 'SEQUENCE', sequenceId: 'accueil' },
    })
    const { personnes, ecartees } = construirePersonnes(
      tableau,
      champs,
      cibles,
      {
        valeursNon: ['non'],
        jour: '2027-04-10',
      }
    )
    expect(ecartees.map(e => e.ligne)).toEqual([4, 5])
    expect(
      personnes.map(p => [
        p.nom,
        p.refExterne,
        p.accordLe,
        [...p.sequenceIds].sort(),
      ])
    ).toEqual([
      ['Alix Durand', '100201', '2026-03-12', ['bar1', 'bar2']],
      ['Tom Leroy', '100202', '2026-03-13', ['accueil']],
      ['Mia Vidal', '100205', '2026-03-15', ['bar1']],
    ])
    expect(personnes[1]!.precisions).toBe(
      'À partir de 18 h, tout poste sauf photo'
    )
  })

  it('fait d’un horaire sans séquence une plage du jour choisi', async () => {
    const tableau = await lireCsv(essai('billetterie.csv'))
    const champs = detecterColonnes(tableau).map(c => c.champ)
    const cibles = new Map<string, Cible>(
      choixDuFichier(tableau, champs).map(c => [c.cle, { type: 'PLAGE' }])
    )
    const { personnes } = construirePersonnes(tableau, champs, cibles, {
      valeursNon: [],
      jour: '2027-04-10',
    })
    expect(personnes[1]!.plages).toEqual([
      { jour: '2027-04-10', heureDebut: '17:00', heureFin: '18:00' },
    ])
  })
})

describe('plusieurs lignes par personne', () => {
  it('réunit les lignes par regroupement puis par adresse', async () => {
    const tableau = await lireCsv(essai('plusieurs-lignes.csv'))
    const champs: Champ[] = detecterColonnes(tableau).map(c => c.champ)
    expect(champs).toEqual([
      'REGROUPEMENT',
      'NOM_COMPLET',
      'COURRIEL',
      'VALEURS',
    ])
    const cibles = new Map<string, Cible>(
      choixDuFichier(tableau, champs).map(c => [c.cle, { type: 'PLAGE' }])
    )
    const { personnes } = construirePersonnes(tableau, champs, cibles, {
      valeursNon: [],
      jour: '2027-04-10',
    })
    expect(personnes.map(p => [p.nom, p.lignes, p.plages.length])).toEqual([
      ['Jules Fontaine', [2, 3], 2],
      ['Emma Girard', [4], 1],
      ['Léon Roux', [5, 6], 2],
    ])
  })
})

describe('commande de plusieurs personnes', () => {
  it('garde deux personnes d’adresses différentes dans un même groupe', () => {
    const tableau: Tableau = {
      entetes: ['Commande', 'Nom complet', 'Email'],
      lignes: [
        ['C-9', 'Jules Fontaine', 'jules@exemple.org'],
        ['C-9', 'Marie Fontaine', 'marie@exemple.org'],
      ],
    }
    const { personnes } = construirePersonnes(
      tableau,
      ['REGROUPEMENT', 'NOM_COMPLET', 'COURRIEL'],
      new Map(),
      { valeursNon: [], jour: null }
    )
    expect(personnes.map(p => p.courriel)).toEqual([
      'jules@exemple.org',
      'marie@exemple.org',
    ])
  })
})

describe('lots', () => {
  it('découpe une liste en lots de 500', () => {
    expect(
      enLots(Array.from({ length: 1201 }, (_, i) => i)).map(l => l.length)
    ).toEqual([500, 500, 201])
  })
})

describe('classeur Excel', () => {
  it('lit chaque feuille, et une date de cellule en AAAA-MM-JJ', async () => {
    const octets = readFileSync(
      new URL('./essais-import/classeur.xlsx', import.meta.url)
    )
    const feuilles = await lireFichier(new File([octets], 'classeur.xlsx'))
    expect(feuilles.map(f => f.nom)).toEqual(['Inscriptions', 'Notes'])
    const tableau = feuilles[0]!.tableau
    expect(tableau.entetes).toEqual([
      'Prénom',
      'Nom',
      'Email',
      'Date de création',
    ])
    expect(tableau.lignes[0]).toEqual([
      'Camille',
      'Martin',
      'camille.martin@exemple.org',
      '2026-03-12',
    ])
    expect(champsDe(tableau)['Date de création']).toBe('DATE_ACCORD')
  })

  it('refuse un autre format', async () => {
    await expect(lireFichier(new File(['x'], 'liste.ods'))).rejects.toThrow(
      /CSV ou Excel/
    )
  })
})
