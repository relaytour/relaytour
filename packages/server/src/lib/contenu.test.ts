import { describe, expect, it } from 'vitest'

import {
  domainesAutorises,
  donneesPersonnelles,
  empreinte,
  normaliserContenu,
} from './contenu.ts'

describe('empreinte', () => {
  it('ignore les fins de ligne Windows et les espaces de fin de ligne', () => {
    expect(empreinte('Titre', 'a  \r\nb\r\n')).toBe(empreinte('Titre', 'a\nb'))
  })

  it('change quand le titre change', () => {
    expect(empreinte('Titre', 'a')).not.toBe(empreinte('Autre titre', 'a'))
  })
})

describe('normaliserContenu', () => {
  it('termine le contenu par un seul saut de ligne', () => {
    expect(normaliserContenu('\n\ntexte\n\n\n')).toBe('texte\n')
  })
})

describe('donneesPersonnelles', () => {
  it('relève une adresse personnelle et un numéro de téléphone', () => {
    const texte = 'Écrire à prenom.nom@courriel-perso.example ou appeler le 06 12 34 56 78.'
    expect(donneesPersonnelles(texte)).toHaveLength(2)
  })

  it('accepte les boîtes partagées des domaines autorisés', () => {
    expect(
      donneesPersonnelles('Écrire à contact@exemple.org.', ['exemple.org'])
    ).toEqual([])
    expect(donneesPersonnelles('Écrire à contact@exemple.org.')).toHaveLength(1)
  })

  it('relève un numéro au format international', () => {
    expect(donneesPersonnelles('+33 6 12 34 56 78')).toHaveLength(1)
  })

  it('ne confond pas une date ou une année avec un numéro', () => {
    expect(
      donneesPersonnelles('Le 27/08/2027, de 9 h à 18 h, pour 2027 personnes.')
    ).toEqual([])
  })

  it('masque les valeurs relevées', () => {
    expect(donneesPersonnelles('prenom.nom@courriel-perso.example')[0]).toBe('pre…')
  })
})

describe('domainesAutorises', () => {
  it('lit une liste séparée par des virgules, en minuscules, sans blancs', () => {
    expect(
      domainesAutorises({ DOMAINES_COURRIEL_AUTORISES: ' Exemple.org, asso.fr ' })
    ).toEqual(['exemple.org', 'asso.fr'])
  })

  it('renvoie une liste vide sans variable', () => {
    expect(domainesAutorises({})).toEqual([])
  })
})
