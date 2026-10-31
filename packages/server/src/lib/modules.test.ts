import { describe, expect, it } from 'vitest'

import { lireModules, lireModulesActivite, modulesActifs } from './modules.ts'

describe('modules par défaut', () => {
  it('n’active pas le classement pour une activité à liste nulle (ADR 0056)', () => {
    expect(lireModulesActivite(null)).toEqual([
      'AGENDA',
      'BENEVOLES',
      'DOCUMENTS',
    ])
    expect(lireModulesActivite(['CLASSEMENT'])).toEqual(['CLASSEMENT'])
  })

  it('autorise tous les modules quand l’hébergeur ne restreint rien', () => {
    expect(lireModules(null)).toContain('CLASSEMENT')
  })

  it('garde le classement inactif tant que l’activité ne le nomme pas', () => {
    expect(
      modulesActifs({ modules: null }, { modulesAutorises: null })
    ).not.toContain('CLASSEMENT')
    expect(
      modulesActifs(
        { modules: ['AGENDA', 'CLASSEMENT'] },
        { modulesAutorises: ['AGENDA'] }
      )
    ).toEqual(['AGENDA'])
  })
})
