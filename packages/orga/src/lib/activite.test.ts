import { describe, expect, it } from 'vitest'

import {
  activiteParDefaut,
  construireContexte,
  formesPeriode,
  type Activite,
} from './activite'

const activite = (slug: string, options: Partial<Activite> = {}): Activite => ({
  id: slug,
  slug,
  nom: slug,
  sigle: null,
  nature: 'EVENEMENT',
  ordre: 0,
  archive: false,
  groupes: [
    { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
    { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
  ],
  ...options,
})

describe('construireContexte', () => {
  const contexte = construireContexte(activite('rencontres'), [
    activite('rencontres'),
    activite('club', { archive: true }),
  ])

  it('préfixe les adresses par le slug de l’activité', () => {
    expect(contexte.lien('/')).toBe('/rencontres/')
    expect(contexte.lien('/fiches')).toBe('/rencontres/fiches')
    expect(contexte.lien('perimetres/natation?edition=e1')).toBe(
      '/rencontres/perimetres/natation?edition=e1'
    )
  })

  it('nomme les groupes, au singulier et au pluriel', () => {
    expect(contexte.libelleGroupe('pole')).toBe('Pôle')
    expect(contexte.libelleGroupe('sport', true)).toBe('Sports')
    expect(contexte.libelleGroupe('inconnu')).toBe('inconnu')
  })

  it('garde les activités archivées hors du sélecteur, sauf l’affichée', () => {
    expect(contexte.activites.map(a => a.slug)).toEqual(['rencontres'])
    const archivee = construireContexte(activite('club', { archive: true }), [
      activite('rencontres'),
      activite('club', { archive: true }),
    ])
    expect(archivee.activites.map(a => a.slug)).toEqual(['rencontres', 'club'])
  })
})

describe('formesPeriode', () => {
  it('accorde le mot de la période en genre', () => {
    expect(formesPeriode('EVENEMENT')).toMatchObject({
      la: 'l’édition',
      cette: 'cette édition',
      Aucune: 'Aucune édition',
      archivee: 'archivée',
    })
    expect(formesPeriode('SAISON')).toMatchObject({
      la: 'la saison',
      de: 'de la saison',
      Nouvelle: 'Nouvelle saison',
    })
    expect(formesPeriode('MANDAT')).toMatchObject({
      la: 'le mandat',
      une: 'un mandat',
      cette: 'ce mandat',
      Aucune: 'Aucun mandat',
      archivee: 'archivé',
      de: 'du mandat',
    })
  })
})

describe('activiteParDefaut', () => {
  it('prend la première activité ouverte sans activité mémorisée', () => {
    expect(
      activiteParDefaut([
        activite('ancienne', { archive: true }),
        activite('rencontres'),
        activite('club'),
      ])?.slug
    ).toBe('rencontres')
  })

  it('prend une activité archivée seulement s’il n’y a qu’elle', () => {
    expect(
      activiteParDefaut([activite('ancienne', { archive: true })])?.slug
    ).toBe('ancienne')
    expect(activiteParDefaut([])).toBeUndefined()
  })
})
