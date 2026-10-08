import { describe, expect, it } from 'vitest'

import {
  ecrireRegroupement,
  grouperParFiche,
  grouperParPerimetre,
  grouperParPhase,
  jourRelatif,
  joursDepuisDebut,
  joursRelatifs,
  libelleBorne,
  lireRegroupement,
  phaseDe,
  type Phase,
} from './regroupement'

const PHASES: Phase[] = [
  { cle: 'cadrage', libelle: 'Cadrage', jusquA: 'J-90' },
  { cle: 'preparation', libelle: 'Préparation', jusquA: 'J-7' },
  { cle: 'bilan', libelle: 'Bilan', jusquA: null },
]
const DEBUT = '2027-06-05'

function depot(initial: Record<string, string> = {}): Storage {
  const valeurs = new Map(Object.entries(initial))
  return {
    getItem: cle => valeurs.get(cle) ?? null,
    setItem: (cle, valeur) => void valeurs.set(cle, valeur),
    removeItem: cle => void valeurs.delete(cle),
    clear: () => valeurs.clear(),
    key: () => null,
    get length() {
      return valeurs.size
    },
  }
}

describe('joursRelatifs', () => {
  it('lit une borne avant et après le premier jour', () => {
    expect(joursRelatifs('J-120')).toBe(-120)
    expect(joursRelatifs('J+30')).toBe(30)
    expect(joursRelatifs('J-0')).toBe(0)
  })

  it('rend null pour une borne absente ou illisible', () => {
    expect(joursRelatifs(null)).toBeNull()
    expect(joursRelatifs(undefined)).toBeNull()
    expect(joursRelatifs('120')).toBeNull()
  })
})

describe('joursDepuisDebut', () => {
  it('compte les jours calendaires, avant et après le premier jour', () => {
    expect(joursDepuisDebut('2027-06-05', DEBUT)).toBe(0)
    expect(joursDepuisDebut('2027-06-04', DEBUT)).toBe(-1)
    expect(joursDepuisDebut('2027-07-05', DEBUT)).toBe(30)
  })

  it('traverse un changement d’année et un changement d’heure', () => {
    // Du 5 juin 2027 au 5 juin 2026 : 365 jours, deux changements d'heure.
    expect(joursDepuisDebut('2026-06-05', DEBUT)).toBe(-365)
    expect(joursDepuisDebut('2026-12-31', '2027-01-01')).toBe(-1)
    // Le dernier dimanche de mars compte 23 heures en France.
    expect(joursDepuisDebut('2027-03-29', '2027-03-28')).toBe(1)
  })

  it('est l’inverse de jourRelatif', () => {
    for (const jours of [-365, -120, -1, 0, 1, 30, 365]) {
      expect(joursDepuisDebut(jourRelatif(DEBUT, jours), DEBUT)).toBe(jours)
    }
    expect(jourRelatif(DEBUT, -90)).toBe('2027-03-07')
  })
})

describe('phaseDe', () => {
  const cle = (jours: number) => phaseDe(jours, PHASES)?.cle

  it('range une échéance dans la première phase dont la borne n’est pas dépassée', () => {
    expect(cle(-200)).toBe('cadrage')
    expect(cle(-30)).toBe('preparation')
    expect(cle(10)).toBe('bilan')
  })

  it('compte la borne dans sa phase', () => {
    expect(cle(-90)).toBe('cadrage')
    expect(cle(-89)).toBe('preparation')
    expect(cle(-7)).toBe('preparation')
    expect(cle(-6)).toBe('bilan')
  })

  it('range dans la dernière phase une échéance au-delà de toutes les bornes', () => {
    const bornees: Phase[] = [
      { cle: 'a', libelle: 'A', jusquA: 'J-30' },
      { cle: 'b', libelle: 'B', jusquA: 'J-1' },
    ]
    expect(phaseDe(40, bornees)?.cle).toBe('b')
    expect(phaseDe(0, [])).toBeUndefined()
  })
})

describe('grouperParPhase', () => {
  const tache = (id: string, echeance: string | null) => ({ id, echeance })

  it('suit l’ordre des phases et garde l’ordre des tâches', () => {
    const groupes = grouperParPhase(
      [
        tache('a', '2027-01-10'),
        tache('b', '2027-03-07'),
        tache('c', '2027-05-01'),
        tache('d', '2027-05-29'),
        tache('e', '2027-06-06'),
      ],
      PHASES,
      DEBUT
    )
    expect(groupes.map(g => [g.phase?.cle, g.taches.map(t => t.id)])).toEqual([
      ['cadrage', ['a', 'b']],
      ['preparation', ['c', 'd']],
      ['bilan', ['e']],
    ])
  })

  it('ne forme pas de groupe pour une phase sans tâche', () => {
    const groupes = grouperParPhase([tache('e', '2027-06-06')], PHASES, DEBUT)
    expect(groupes.map(g => g.phase?.cle)).toEqual(['bilan'])
  })

  it('place les tâches sans échéance en dernier', () => {
    const groupes = grouperParPhase(
      [tache('x', null), tache('a', '2027-01-10'), tache('y', null)],
      PHASES,
      DEBUT
    )
    expect(groupes.map(g => [g.phase?.cle ?? null, g.taches.length])).toEqual([
      ['cadrage', 1],
      [null, 2],
    ])
  })

  it('rend une liste vide sans tâche', () => {
    expect(grouperParPhase([], PHASES, DEBUT)).toEqual([])
  })
})

describe('libelleBorne', () => {
  it('donne le dernier jour d’une phase bornée', () => {
    expect(libelleBorne(PHASES[0]!, PHASES, DEBUT)).toBe(
      'jusqu’au 7 mars 2027 · J-90'
    )
  })

  it('donne le premier jour de la dernière phase', () => {
    expect(libelleBorne(PHASES[2]!, PHASES, DEBUT)).toBe(
      'à partir du 30 mai 2027'
    )
  })

  it('couvre toute la période quand l’activité déclare une seule phase', () => {
    const seule: Phase[] = [{ cle: 'tout', libelle: 'Tout' }]
    expect(libelleBorne(seule[0]!, seule, DEBUT)).toBe('toute la période')
  })
})

describe('grouperParFiche', () => {
  const fiche = (id: string) => ({ id, slug: id, titre: `Fiche ${id}` })
  const tache = (id: string, f: string | null) => ({
    id,
    fiche: f === null ? null : fiche(f),
  })

  it('suit l’ordre de première apparition et place « sans fiche » en dernier', () => {
    const groupes = grouperParFiche([
      tache('a', 'budget'),
      tache('b', null),
      tache('c', 'tarifs'),
      tache('d', 'budget'),
      tache('e', null),
    ])
    expect(
      groupes.map(g => [g.fiche?.id ?? null, g.taches.map(t => t.id)])
    ).toEqual([
      ['budget', ['a', 'd']],
      ['tarifs', ['c']],
      [null, ['b', 'e']],
    ])
  })

  it('ne forme pas de groupe « sans fiche » quand chaque tâche a une fiche', () => {
    expect(
      grouperParFiche([tache('a', 'budget')]).map(g => g.fiche?.id)
    ).toEqual(['budget'])
  })
})

describe('grouperParPerimetre', () => {
  const perimetre = (id: string, groupe: string, ordre: number, nom = id) => ({
    id,
    nom,
    groupe,
    ordre,
  })
  const natation = perimetre('natation', 'sport', 2, 'Natation')
  const football = perimetre('football', 'sport', 1, 'Football')
  const benevoles = perimetre('benevoles', 'pole', 1, 'Bénévoles')
  const accueil = perimetre('accueil', 'pole', 1, 'Accueil')
  const ailleurs = perimetre('ailleurs', 'inconnu', 0, 'Ailleurs')

  it('suit l’ordre des groupes, puis l’ordre et le nom des périmètres', () => {
    const groupes = grouperParPerimetre(
      [
        { id: '1', perimetre: benevoles },
        { id: '2', perimetre: natation },
        { id: '3', perimetre: ailleurs },
        { id: '4', perimetre: football },
        { id: '5', perimetre: accueil },
        { id: '6', perimetre: natation },
      ],
      ['sport', 'pole']
    )
    expect(groupes.map(g => [g.perimetre.id, g.taches.map(t => t.id)])).toEqual(
      [
        ['football', ['4']],
        ['natation', ['2', '6']],
        ['accueil', ['5']],
        ['benevoles', ['1']],
        ['ailleurs', ['3']],
      ]
    )
  })
})

describe('regroupement gardé par le navigateur', () => {
  const ADMIS = ['echeance', 'phase', 'fiche'] as const

  it('relit la valeur écrite', () => {
    const d = depot()
    ecrireRegroupement('cle', 'phase', d)
    expect(lireRegroupement('cle', ADMIS, 'echeance', d)).toBe('phase')
  })

  it('rend le défaut pour une valeur absente ou inconnue', () => {
    expect(lireRegroupement('cle', ADMIS, 'echeance', depot())).toBe('echeance')
    expect(
      lireRegroupement('cle', ADMIS, 'echeance', depot({ cle: 'couleur' }))
    ).toBe('echeance')
  })

  it('fonctionne sans dépôt, ou avec un dépôt qui refuse', () => {
    expect(lireRegroupement('cle', ADMIS, 'fiche', null)).toBe('fiche')
    expect(() => ecrireRegroupement('cle', 'phase', null)).not.toThrow()
    const refus = {
      ...depot(),
      getItem: () => {
        throw new Error('refusé')
      },
      setItem: () => {
        throw new Error('refusé')
      },
    } as Storage
    expect(lireRegroupement('cle', ADMIS, 'echeance', refus)).toBe('echeance')
    expect(() => ecrireRegroupement('cle', 'phase', refus)).not.toThrow()
  })
})
