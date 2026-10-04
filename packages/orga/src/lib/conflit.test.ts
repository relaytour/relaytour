import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { describe, expect, it } from 'vitest'

import { lireConflit, texteConflit } from './conflit'

const erreur = (extensions: Record<string, unknown>) =>
  new CombinedGraphQLErrors({
    errors: [{ message: 'Conflit', extensions }],
  })

describe('lireConflit', () => {
  it('lit un conflit de contenu, avec la version et l’auteur', () => {
    expect(
      lireConflit(
        erreur({
          code: 'CONFLIT_VERSION',
          versionCourante: 3,
          modifieeLe: '2026-10-04T12:05:00.000Z',
          modifieePar: 'Alex Martin',
        })
      )
    ).toEqual({
      nature: 'contenu',
      versionCourante: 3,
      modifieeLe: '2026-10-04T12:05:00.000Z',
      modifieePar: 'Alex Martin',
    })
  })

  it('lit un conflit de statut, sans auteur', () => {
    expect(
      lireConflit(erreur({ code: 'CONFLIT_VERSION', statutCourant: 'FAITE' }))
    ).toEqual({ nature: 'statut', statutCourant: 'FAITE' })
  })

  it('ignore les autres erreurs et un conflit sans détail', () => {
    expect(lireConflit(erreur({ code: 'CONFIRMATION_REQUISE' }))).toBeNull()
    expect(lireConflit(erreur({ code: 'CONFLIT_VERSION' }))).toBeNull()
    expect(lireConflit(new Error('Réseau coupé.'))).toBeNull()
  })
})

describe('texteConflit', () => {
  it('nomme l’auteur et le moment d’une modification du contenu', () => {
    const { titre, texte } = texteConflit(
      {
        nature: 'contenu',
        versionCourante: 3,
        modifieeLe: '2026-10-04T12:05:00.000Z',
        modifieePar: 'Alex Martin',
      },
      'Europe/Paris'
    )
    expect(titre).toBe('Cette tâche a changé depuis votre lecture')
    expect(texte).toContain(
      'Alex Martin a modifié cette tâche le 4 octobre à 14 h 05.'
    )
  })

  it('reste lisible sans auteur ni date', () => {
    expect(
      texteConflit({
        nature: 'contenu',
        versionCourante: 1,
        modifieeLe: null,
        modifieePar: null,
      }).texte
    ).toContain('Une autre personne a modifié cette tâche.')
  })

  it('dit le nouveau statut sans nommer personne', () => {
    const { titre, texte } = texteConflit({
      nature: 'statut',
      statutCourant: 'FAITE',
    })
    expect(titre).toBe('Le statut de cette tâche a changé')
    expect(texte).toContain('Cette tâche est maintenant « Faite ».')
  })
})
