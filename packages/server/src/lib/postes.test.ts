import { describe, expect, it } from 'vitest'

import {
  etatPostes,
  texteAppel,
  trierPostes,
  type EtatPostes,
} from './postes.ts'

describe('etatPostes', () => {
  it('attend au moins une personne quand l’effectif n’est pas défini', () => {
    expect(etatPostes(null, 0)).toEqual({ aPourvoir: 1, etat: 'SANS_PERSONNE' })
    expect(etatPostes(null, 1)).toEqual({ aPourvoir: 0, etat: 'COMPLET' })
  })

  it('considère complet un périmètre dont l’effectif vaut zéro', () => {
    expect(etatPostes(0, 0)).toEqual({ aPourvoir: 0, etat: 'COMPLET' })
  })

  it('compte les postes restants d’un périmètre incomplet', () => {
    expect(etatPostes(3, 1)).toEqual({ aPourvoir: 2, etat: 'INCOMPLET' })
  })

  it('ne rend jamais un nombre négatif quand l’effectif est dépassé', () => {
    expect(etatPostes(2, 4)).toEqual({ aPourvoir: 0, etat: 'COMPLET' })
  })
})

describe('trierPostes', () => {
  const poste = (
    nom: string,
    etat: EtatPostes,
    aPourvoir: number,
    type: 'SPORT' | 'POLE',
    ordre = 0
  ) => ({ etat, aPourvoir, perimetre: { nom, type, ordre } })

  it('place les périmètres sans personne en premier, puis les incomplets', () => {
    const liste = [
      poste('Complet', 'COMPLET', 0, 'SPORT'),
      poste('Incomplet', 'INCOMPLET', 1, 'SPORT'),
      poste('Pôle vide', 'SANS_PERSONNE', 1, 'POLE'),
      poste('Sport vide', 'SANS_PERSONNE', 1, 'SPORT', 2),
      poste('Autre sport vide', 'SANS_PERSONNE', 1, 'SPORT', 1),
      poste('Grand manque', 'SANS_PERSONNE', 3, 'POLE'),
      poste('Basket', 'COMPLET', 0, 'POLE', 5),
      poste('Athlétisme', 'COMPLET', 0, 'POLE', 5),
    ]
    expect(trierPostes(liste).map(p => p.perimetre.nom)).toEqual([
      'Grand manque',
      'Autre sport vide',
      'Sport vide',
      'Pôle vide',
      'Incomplet',
      'Complet',
      'Athlétisme',
      'Basket',
    ])
    expect(liste[0]?.perimetre.nom).toBe('Complet')
  })
})

describe('texteAppel', () => {
  const organisation = {
    nom: 'Les Rencontres de la Vallée',
    contact: 'contact@exemple.org',
    pageEquipe: 'https://exemple.org/equipe',
  }
  const texte = texteAppel(
    2027,
    [
      { nom: 'Natation', type: 'SPORT' },
      { nom: 'Communication', type: 'POLE' },
    ],
    organisation
  )

  it('rend le message attendu, groupé par type', () => {
    expect(texte)
      .toBe(`Les Rencontres de la Vallée 2027 : rejoignez l’équipe d’organisation

Nous préparons Les Rencontres de la Vallée 2027. Nous cherchons encore des référentes et des référents pour ces périmètres :

Sports
- Natation

Pôles
- Communication

Vous pouvez proposer votre aide par mail :
contact@exemple.org

Vous trouverez plus d’informations sur la page de l’équipe :
https://exemple.org/equipe`)
  })

  it('omet un groupe vide', () => {
    const sansPole = texteAppel(
      2027,
      [{ nom: 'Natation', type: 'SPORT' }],
      organisation
    )
    expect(sansPole).toContain('Sports\n- Natation')
    expect(sansPole).not.toContain('Pôles')
  })

  it('contient l’adresse de contact et la page de l’équipe', () => {
    expect(texte).toContain(organisation.contact)
    expect(texte).toContain(organisation.pageEquipe)
  })

  it('ne contient aucun chiffre en dehors de l’année', () => {
    expect(texte?.replaceAll('2027', '')).not.toMatch(/\d/)
  })

  it('renvoie null quand aucun périmètre n’est à pourvoir', () => {
    expect(texteAppel(2027, [], organisation)).toBeNull()
  })

  it('respecte le style neutre : phrases courtes et aucun « on »', () => {
    const phrases = (texte ?? '')
      .split(/[.:\n]\s/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
    for (const phrase of phrases) {
      expect(phrase.split(/\s+/).length).toBeLessThanOrEqual(25)
    }
    expect(texte).not.toMatch(/(^|[^\p{L}])on([^\p{L}]|$)/iu)
  })
})
