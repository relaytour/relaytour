import { describe, expect, it } from 'vitest'

import {
  adresseRetour,
  composerEtat,
  etatBienForme,
  etiquetteRetour,
} from './retour.ts'

const ALEA = 'a'.repeat(43)

describe('adresseRetour', () => {
  it('reste sous l’origine de l’installation sans adresse commune', () => {
    expect(
      adresseRetour({ ORIGINE_ORGA: 'https://orga.exemple.org' }, 'google')
    ).toBe('https://orga.exemple.org/medias/espace-fichiers/retour/google')
  })

  it('prend l’adresse commune et y ajoute le fournisseur', () => {
    expect(
      adresseRetour(
        {
          ORIGINE_ORGA: 'https://orga.exemple.org',
          ESPACE_FICHIERS_RETOUR: 'https://retour.exemple.org/espace-fichiers',
        },
        'sharepoint'
      )
    ).toBe('https://retour.exemple.org/espace-fichiers/sharepoint')
  })
})

describe('état d’une connexion', () => {
  it('ne porte l’étiquette qu’avec l’adresse commune', () => {
    expect(etiquetteRetour({ ESPACE_FICHIERS_RETOUR_ETIQUETTE: 'club' })).toBe(
      undefined
    )
    expect(
      etiquetteRetour({
        ESPACE_FICHIERS_RETOUR: 'https://retour.exemple.org/espace-fichiers',
        ESPACE_FICHIERS_RETOUR_ETIQUETTE: 'club',
      })
    ).toBe('club')
  })

  it('se compose de l’aléa seul, ou de l’étiquette, d’un point et de l’aléa', () => {
    expect(composerEtat(ALEA, undefined)).toBe(ALEA)
    expect(composerEtat(ALEA, 'club')).toBe(`club.${ALEA}`)
  })

  it('n’accepte que la forme émise par l’installation', () => {
    expect(etatBienForme(ALEA, undefined)).toBe(true)
    expect(etatBienForme(`club.${ALEA}`, 'club')).toBe(true)
    // L'état d'une autre installation, ou d'une installation sans étiquette.
    expect(etatBienForme(`autre.${ALEA}`, 'club')).toBe(false)
    expect(etatBienForme(ALEA, 'club')).toBe(false)
    expect(etatBienForme(`club.${ALEA}`, undefined)).toBe(false)
    expect(etatBienForme(`club.${ALEA.slice(1)}`, 'club')).toBe(false)
    expect(etatBienForme(`club.${ALEA}x`, 'club')).toBe(false)
  })
})
