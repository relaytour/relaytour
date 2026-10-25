import { sansAccent } from '@relaytour/commun'
import { describe, expect, it } from 'vitest'

import { lignesDeEquipe, REGLES_EQUIPE } from './import-equipe'
import { detecterColonnesSelon, tableauDepuis } from './import-tableur'

describe('colonnes et lignes d’un tableur d’équipe', () => {
  const tableau = tableauDepuis([
    ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Pôles', 'Contact principal'],
    [
      'Camille',
      'Martin',
      'camille@exemple.org',
      '0612345678',
      'Football; Logistique',
      'oui',
    ],
    ['', '', 'sans.nom@exemple.org', '', '', ''],
    ['Alex', 'Durand', '', '', 'Football', ''],
    ['Sacha', '', 'sacha@exemple.org', '', '', 'non'],
  ])

  it('reconnaît les en-têtes et ignore le téléphone', () => {
    const colonnes = detecterColonnesSelon(tableau, REGLES_EQUIPE, sansAccent)
    expect(colonnes.map(c => c.champ)).toEqual([
      'PRENOM',
      'NOM',
      'ADRESSE',
      'IGNORER',
      'PERIMETRES',
      'CONTACT',
    ])
    expect(colonnes[3]!.sensible).toBe(true)
  })

  it('réunit prénom et nom, sépare les périmètres et écarte les lignes incomplètes', () => {
    const { lignes, ecartees } = lignesDeEquipe(tableau, [
      'PRENOM',
      'NOM',
      'ADRESSE',
      'IGNORER',
      'PERIMETRES',
      'CONTACT',
    ])
    expect(ecartees.map(e => e.ligne)).toEqual([3, 4])
    expect(lignes).toEqual([
      {
        ligne: 2,
        nom: 'Camille Martin',
        adresse: 'camille@exemple.org',
        perimetres: ['Football', 'Logistique'],
        contactPrincipal: true,
      },
      {
        ligne: 5,
        nom: 'Sacha',
        adresse: 'sacha@exemple.org',
        perimetres: [],
        contactPrincipal: false,
      },
    ])
  })
})
