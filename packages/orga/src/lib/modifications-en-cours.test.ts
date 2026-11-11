import { describe, expect, it } from 'vitest'

import {
  aDesModificationsEnCours,
  inscrireModification,
} from './modifications-en-cours'

describe('saisies en cours (ADR 0065)', () => {
  it('compte chaque saisie jusqu’à son retrait', () => {
    expect(aDesModificationsEnCours()).toBe(false)
    const retirerFiche = inscrireModification()
    const retirerCommentaire = inscrireModification()
    retirerFiche()
    expect(aDesModificationsEnCours()).toBe(true)
    retirerCommentaire()
    expect(aDesModificationsEnCours()).toBe(false)
  })

  it('ne retire une saisie qu’une fois', () => {
    const retirer = inscrireModification()
    const autre = inscrireModification()
    retirer()
    retirer()
    expect(aDesModificationsEnCours()).toBe(true)
    autre()
  })
})
