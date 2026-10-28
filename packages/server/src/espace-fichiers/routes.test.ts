import { describe, expect, it } from 'vitest'

import { issueAccordee } from './routes.ts'

// L'issue d'une connexion dit quelle autorisation manque (ADR 0044).

describe('issueAccordee', () => {
  it('réussit quand le fournisseur accorde la portée demandée', () => {
    expect(issueAccordee('FICHIERS', 'FICHIERS')).toBe('reussie')
    expect(issueAccordee('GESTION', 'GESTION')).toBe('reussie')
  })

  it('nomme l’annuaire quand la connexion redescend aux fichiers', () => {
    expect(issueAccordee('ANNUAIRE', 'FICHIERS')).toBe('sans-annuaire')
    expect(issueAccordee('GESTION', 'FICHIERS')).toBe('sans-annuaire')
  })

  it('nomme la gestion quand seule l’écriture des groupes manque', () => {
    expect(issueAccordee('GESTION', 'ANNUAIRE')).toBe('sans-gestion')
  })
})
