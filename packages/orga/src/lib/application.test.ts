import { describe, expect, it } from 'vitest'

import { pageAJour } from './application'

const COQUILLE = [
  '/assets/antd-b2.js',
  '/assets/index-a1.css',
  '/assets/index-a1.js',
  '/assets/Taches-c3.js',
]

describe('pageAJour', () => {
  it('reconnaît une page déjà chargée sur la version du service worker en attente', () => {
    expect(
      pageAJour(
        ['/assets/index-a1.js', '/assets/antd-b2.js', '/assets/index-a1.css'],
        COQUILLE
      )
    ).toBe(true)
  })

  it('annonce la version quand un fichier de la page manque à la coquille', () => {
    expect(
      pageAJour(['/assets/index-a0.js', '/assets/antd-b2.js'], COQUILLE)
    ).toBe(false)
  })

  it('annonce la version quand la page ne nomme aucun fichier du build', () => {
    expect(pageAJour([], COQUILLE)).toBe(false)
  })
})
