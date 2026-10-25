import { sansAccent } from '@relaytour/commun'
import { describe, expect, it } from 'vitest'

import { detecterColonnesSelon, tableauDepuis } from './import-tableur'
import { echeanceDe, lignesDeTaches, REGLES_TACHES } from './import-taches'

describe('échéance d’une tâche importée', () => {
  it('garde un décalage et lit les tournures en jours', () => {
    expect(echeanceDe('J - 30')).toBe('J-30')
    expect(echeanceDe('j+3')).toBe('J+3')
    expect(echeanceDe('D-7')).toBe('J-7')
    expect(echeanceDe('30 jours avant')).toBe('J-30')
    expect(echeanceDe('2 j après')).toBe('J+2')
    expect(echeanceDe('14 days before')).toBe('J-14')
  })

  it('lit une date, et laisse au serveur une valeur illisible', () => {
    expect(echeanceDe('15/05/2027')).toBe('2027-05-15')
    expect(echeanceDe('2027-05-01')).toBe('2027-05-01')
    expect(echeanceDe('demain')).toBe('demain')
    expect(echeanceDe('  ')).toBe('')
  })
})

describe('colonnes et lignes d’un tableur de tâches', () => {
  const tableau = tableauDepuis([
    ['Pôle', 'Action', 'Pour le', 'Consignes', 'Porteur', 'Fiche'],
    [
      'Logistique',
      'Louer les barrières',
      '30 jours avant',
      'Quarante.',
      '',
      'plan',
    ],
    ['', 'Sans pôle', '', '', '', ''],
    ['Football', '', '', '', '', ''],
    ['Communication', 'Imprimer', '15/05/2027', '', 'com@exemple.org', ''],
  ])

  it('reconnaît les en-têtes en français', () => {
    expect(
      detecterColonnesSelon(tableau, REGLES_TACHES, sansAccent).map(
        c => c.champ
      )
    ).toEqual([
      'PERIMETRE',
      'TITRE',
      'ECHEANCE',
      'DESCRIPTION',
      'RESPONSABLE',
      'FICHE',
    ])
  })

  it('écarte les lignes sans périmètre ou sans titre, et normalise les autres', () => {
    const { lignes, ecartees } = lignesDeTaches(tableau, [
      'PERIMETRE',
      'TITRE',
      'ECHEANCE',
      'DESCRIPTION',
      'RESPONSABLE',
      'FICHE',
    ])
    expect(ecartees.map(e => e.ligne)).toEqual([3, 4])
    expect(lignes).toEqual([
      {
        ligne: 2,
        perimetre: 'Logistique',
        titre: 'Louer les barrières',
        description: 'Quarante.',
        echeance: 'J-30',
        fiche: 'plan',
        responsable: null,
      },
      {
        ligne: 5,
        perimetre: 'Communication',
        titre: 'Imprimer',
        description: null,
        echeance: '2027-05-15',
        fiche: null,
        responsable: 'com@exemple.org',
      },
    ])
  })
})
