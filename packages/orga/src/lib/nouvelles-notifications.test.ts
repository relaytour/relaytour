import { describe, expect, it } from 'vitest'

import { aAnnoncer } from './nouvelles-notifications'

describe('notifications à annoncer (ADR 0065)', () => {
  it('annonce une notification non lue que l’espace n’a pas vue', () => {
    const vues = new Set(['a'])
    expect(
      aAnnoncer(
        [
          { id: 'a', lue: false },
          { id: 'b', lue: false },
          { id: 'c', lue: true },
        ],
        vues
      ).map(n => n.id)
    ).toEqual(['b'])
  })
})
