import { describe, expect, it } from 'vitest'

import {
  joursRelatifs,
  lirePhases,
  lirePhasesDeclarees,
  PHASES_MAX,
  PHASES_PAR_DEFAUT,
  PhasesSchema,
  phasesValides,
} from './phases.ts'

const PHASES = [
  { cle: 'cadrage', libelle: 'Cadrage', jusquA: 'J-90' },
  { cle: 'preparation', libelle: 'Préparation', jusquA: 'J-7' },
  { cle: 'bilan', libelle: 'Bilan' },
]

function messages(valeur: unknown): string[] {
  const lu = PhasesSchema.safeParse(valeur)
  return lu.success
    ? []
    : lu.error.issues.map(i => `${i.path.join('.')} ${i.message}`)
}

describe('joursRelatifs', () => {
  it('compte les jours depuis le premier jour de la période', () => {
    expect(joursRelatifs('J-120')).toBe(-120)
    expect(joursRelatifs('J+30')).toBe(30)
    expect(joursRelatifs('J-0')).toBe(0)
    expect(joursRelatifs('J+0')).toBe(0)
  })
})

describe('PhasesSchema', () => {
  it('accepte des phases ordonnées dont seule la dernière est sans borne', () => {
    expect(messages(PHASES)).toEqual([])
    expect(messages(PHASES_PAR_DEFAUT)).toEqual([])
    expect(messages([{ cle: 'tout', libelle: 'Toute la période' }])).toEqual([])
  })

  it('refuse une liste vide ou trop longue', () => {
    expect(messages([])).toEqual([' une phase au moins'])
    const longue = Array.from({ length: PHASES_MAX + 1 }, (_, rang) => ({
      cle: `phase-${rang}`,
      libelle: `Phase ${rang}`,
      ...(rang === PHASES_MAX ? {} : { jusquA: `J+${rang}` }),
    }))
    expect(messages(longue)).toEqual([` ${PHASES_MAX} phases au plus`])
  })

  it('refuse deux phases de même clé', () => {
    expect(
      messages([
        { cle: 'cadrage', libelle: 'Cadrage', jusquA: 'J-90' },
        { cle: 'cadrage', libelle: 'Suite' },
      ])
    ).toEqual(['1.cle la clé cadrage est déclarée deux fois'])
  })

  it('refuse une phase sans borne avant la dernière', () => {
    expect(
      messages([
        { cle: 'cadrage', libelle: 'Cadrage' },
        { cle: 'bilan', libelle: 'Bilan' },
      ])
    ).toEqual([
      '0.jusquA borne attendue : seule la dernière phase n’en porte pas',
    ])
  })

  it('refuse une borne sur la dernière phase', () => {
    expect(
      messages([
        { cle: 'cadrage', libelle: 'Cadrage', jusquA: 'J-90' },
        { cle: 'bilan', libelle: 'Bilan', jusquA: 'J+30' },
      ])
    ).toEqual([
      '1.jusquA la dernière phase ne porte pas de borne : elle reçoit tout ce qui suit',
    ])
  })

  it('refuse des bornes égales ou décroissantes', () => {
    const avec = (premiere: string, deuxieme: string) => [
      { cle: 'a', libelle: 'A', jusquA: premiere },
      { cle: 'b', libelle: 'B', jusquA: deuxieme },
      { cle: 'c', libelle: 'C' },
    ]
    const attendu = ['1.jusquA les bornes se suivent dans l’ordre croissant']
    expect(messages(avec('J-30', 'J-90'))).toEqual(attendu)
    expect(messages(avec('J-30', 'J-30'))).toEqual(attendu)
    expect(messages(avec('J-0', 'J+0'))).toEqual(attendu)
    expect(messages(avec('J-30', 'J+3'))).toEqual([])
  })

  it('refuse une clé, un libellé ou une borne mal formés, et un champ inconnu', () => {
    expect(
      messages([
        { cle: 'Cadrage', libelle: 'Cadrage', jusquA: 'J-90' },
        PHASES[2],
      ])
    ).toEqual(['0.cle minuscules, chiffres et tirets seulement'])
    expect(
      messages([{ cle: 'cadrage', libelle: '  ', jusquA: 'J-90' }, PHASES[2]])
    ).toEqual(['0.libelle libellé attendu'])
    expect(
      messages([
        { cle: 'cadrage', libelle: 'Cadrage', jusquA: '-90' },
        PHASES[2],
      ])
    ).toEqual(['0.jusquA borne attendue de la forme J-120 ou J+3'])
    expect(
      messages([{ cle: 'bilan', libelle: 'Bilan', couleur: '#FF0000' }])
    ).toHaveLength(1)
  })
})

describe('lirePhases', () => {
  it('rend les phases déclarées', () => {
    expect(lirePhases(PHASES)).toEqual(PHASES)
    expect(lirePhasesDeclarees(PHASES)).toEqual(PHASES)
  })

  it('rend les phases par défaut quand l’activité n’en déclare pas', () => {
    expect(lirePhases(null)).toEqual(PHASES_PAR_DEFAUT)
    expect(lirePhasesDeclarees(null)).toBeNull()
  })

  it('rend les phases par défaut quand la valeur est illisible', () => {
    for (const valeur of ['phases', [], [{ cle: 'a' }], { cle: 'a' }]) {
      expect(lirePhases(valeur)).toEqual(PHASES_PAR_DEFAUT)
      expect(lirePhasesDeclarees(valeur)).toBeNull()
    }
  })
})

describe('phasesValides', () => {
  it('nettoie la saisie : une borne vide vaut une borne absente', () => {
    expect(
      phasesValides([
        { cle: ' cadrage ', libelle: ' Cadrage ', jusquA: ' J-90 ' },
        { cle: 'bilan', libelle: 'Bilan', jusquA: '  ' },
      ])
    ).toEqual([
      { cle: 'cadrage', libelle: 'Cadrage', jusquA: 'J-90' },
      { cle: 'bilan', libelle: 'Bilan' },
    ])
    expect(
      phasesValides([{ cle: 'bilan', libelle: 'Bilan', jusquA: null }])
    ).toEqual([{ cle: 'bilan', libelle: 'Bilan' }])
  })

  it('nomme la phase et la règle dans son refus', () => {
    expect(() =>
      phasesValides([
        { cle: 'a', libelle: 'A', jusquA: 'J-30' },
        { cle: 'b', libelle: 'B', jusquA: 'J-90' },
        { cle: 'c', libelle: 'C' },
      ])
    ).toThrow(
      'La phase 2 n’est pas valide : les bornes se suivent dans l’ordre croissant.'
    )
    expect(() => phasesValides([])).toThrow(
      'Les phases ne sont pas valides : une phase au moins.'
    )
  })
})
