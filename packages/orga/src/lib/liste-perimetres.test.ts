import { describe, expect, it } from 'vitest'

import {
  ecrireReglages,
  filtrer,
  lireReglages,
  partFaite,
  trier,
  type LignePerimetre,
} from './liste-perimetres'

const GROUPES = ['sport', 'pole']

const ligne = (
  id: string,
  champs: Partial<LignePerimetre> = {}
): LignePerimetre => ({
  id,
  nom: id,
  groupe: 'sport',
  rangGroupe: 0,
  ordre: 0,
  personnes: [],
  aPourvoir: 0,
  enRetard: 0,
  sansPersonne: 0,
  part: null,
  ...champs,
})

const ids = (lignes: LignePerimetre[]) => lignes.map(l => l.id)

describe('lireReglages', () => {
  it('donne les valeurs par défaut pour une adresse sans paramètre', () => {
    expect(lireReglages(new URLSearchParams(), GROUPES)).toEqual({
      vue: 'equipe',
      edition: undefined,
      groupe: 'tous',
      q: '',
      tri: 'priorite',
      filtre: 'tous',
    })
  })

  it('lit chaque réglage de l’adresse', () => {
    const parametres = new URLSearchParams(
      'vue=avancement&edition=e1&groupe=pole&q=nat&tri=retard&filtre=retard'
    )
    expect(lireReglages(parametres, GROUPES)).toEqual({
      vue: 'avancement',
      edition: 'e1',
      groupe: 'pole',
      q: 'nat',
      tri: 'retard',
      filtre: 'retard',
    })
  })

  it('écarte une vue, un tri et un groupe inconnus', () => {
    const parametres = new URLSearchParams('vue=x&tri=y&groupe=commission')
    const reglages = lireReglages(parametres, GROUPES)
    expect(reglages.vue).toBe('equipe')
    expect(reglages.tri).toBe('priorite')
    expect(reglages.groupe).toBe('tous')
  })

  it('écarte le filtre d’une autre vue', () => {
    expect(
      lireReglages(new URLSearchParams('filtre=retard'), GROUPES).filtre
    ).toBe('tous')
    expect(
      lireReglages(
        new URLSearchParams('vue=avancement&filtre=aPourvoir'),
        GROUPES
      ).filtre
    ).toBe('tous')
  })
})

describe('ecrireReglages', () => {
  it('ajoute un réglage et garde les autres paramètres', () => {
    const suivants = ecrireReglages(new URLSearchParams('edition=e1'), {
      vue: 'avancement',
      q: 'nat',
    })
    expect(suivants.toString()).toBe('edition=e1&vue=avancement&q=nat')
  })

  it('retire de l’adresse une valeur par défaut ou vide', () => {
    const suivants = ecrireReglages(
      new URLSearchParams('vue=avancement&q=nat&groupe=pole&edition=e1'),
      { vue: 'equipe', q: '', groupe: 'tous', edition: undefined }
    )
    expect(suivants.toString()).toBe('')
  })

  it('ne modifie pas les paramètres reçus', () => {
    const parametres = new URLSearchParams('q=nat')
    ecrireReglages(parametres, { q: '' })
    expect(parametres.toString()).toBe('q=nat')
  })
})

describe('partFaite', () => {
  it('ignore les tâches abandonnées', () => {
    expect(partFaite({ total: 5, faites: 2, abandonnees: 1 })).toBe(0.5)
  })

  it('vaut null sans tâche à faire', () => {
    expect(partFaite({ total: 2, faites: 0, abandonnees: 2 })).toBeNull()
  })
})

describe('filtrer', () => {
  const lignes = [
    ligne('natation', { nom: 'Natation', personnes: ['Élodie Martin'] }),
    ligne('logistique', {
      nom: 'Logistique',
      groupe: 'pole',
      aPourvoir: 2,
      enRetard: 1,
    }),
    ligne('tresorerie', {
      nom: 'Trésorerie',
      groupe: 'pole',
      sansPersonne: 3,
    }),
  ]
  const tout = { groupe: 'tous', q: '', filtre: 'tous' } as const

  it('garde tout sans réglage', () => {
    expect(ids(filtrer(lignes, tout))).toEqual([
      'natation',
      'logistique',
      'tresorerie',
    ])
  })

  it('garde les périmètres d’un groupe', () => {
    expect(ids(filtrer(lignes, { ...tout, groupe: 'pole' }))).toEqual([
      'logistique',
      'tresorerie',
    ])
  })

  it('cherche dans le nom du périmètre, sans accent ni casse', () => {
    expect(ids(filtrer(lignes, { ...tout, q: ' TRESO ' }))).toEqual([
      'tresorerie',
    ])
  })

  it('cherche dans les noms des personnes affectées', () => {
    expect(ids(filtrer(lignes, { ...tout, q: 'elodie' }))).toEqual(['natation'])
  })

  it('applique le filtre de la vue', () => {
    expect(ids(filtrer(lignes, { ...tout, filtre: 'aPourvoir' }))).toEqual([
      'logistique',
    ])
    expect(ids(filtrer(lignes, { ...tout, filtre: 'retard' }))).toEqual([
      'logistique',
    ])
    expect(ids(filtrer(lignes, { ...tout, filtre: 'sansPersonne' }))).toEqual([
      'tresorerie',
    ])
  })

  it('combine le groupe, le filtre et la recherche', () => {
    expect(
      ids(filtrer(lignes, { groupe: 'sport', q: 'log', filtre: 'tous' }))
    ).toEqual([])
  })
})

describe('trier', () => {
  const lignes = [
    ligne('b', { nom: 'Budget', rangGroupe: 1, ordre: 2, part: 0.5 }),
    ligne('e', { nom: 'Échecs', rangGroupe: 0, ordre: 2, enRetard: 4 }),
    ligne('a', { nom: 'Accueil', rangGroupe: 1, ordre: 1, part: 0.1 }),
    ligne('z', { nom: 'Zumba', rangGroupe: 0, ordre: 1, enRetard: 4, part: 1 }),
  ]

  it('garde l’ordre reçu pour « priorite »', () => {
    expect(ids(trier(lignes, 'priorite'))).toEqual(['b', 'e', 'a', 'z'])
  })

  it('suit l’ordre de l’activité : groupe, ordre, puis nom', () => {
    expect(ids(trier(lignes, 'ordre'))).toEqual(['z', 'e', 'a', 'b'])
  })

  it('trie par nom selon l’alphabet français', () => {
    expect(ids(trier(lignes, 'nom'))).toEqual(['a', 'b', 'e', 'z'])
  })

  it('place en premier les périmètres les plus en retard', () => {
    expect(ids(trier(lignes, 'retard'))).toEqual(['z', 'e', 'a', 'b'])
  })

  it('place en premier les moins avancés, et en dernier ceux sans tâche', () => {
    expect(ids(trier(lignes, 'avancement'))).toEqual(['a', 'b', 'z', 'e'])
  })

  it('ne modifie pas la liste reçue', () => {
    trier(lignes, 'nom')
    expect(ids(lignes)).toEqual(['b', 'e', 'a', 'z'])
  })
})
