import { describe, expect, it } from 'vitest'

import {
  MODELES,
  modeleDe,
  REGLAGES_DES_MODELES,
} from './modeles-notification.ts'
import { PREFERENCES_PAR_DEFAUT } from './notifications.ts'

describe('modèles de réglages (ADR 0065)', () => {
  it('chaque modèle se reconnaît à ses réglages', () => {
    for (const modele of MODELES) {
      expect(modeleDe(REGLAGES_DES_MODELES[modele])).toBe(modele)
    }
  })

  it('les réglages par défaut sont ceux du modèle Essentiel', () => {
    expect(modeleDe(PREFERENCES_PAR_DEFAUT)).toBe('ESSENTIEL')
  })

  it('un réglage changé donne des réglages personnalisés', () => {
    expect(
      modeleDe({ ...REGLAGES_DES_MODELES.ESSENTIEL, frequenceResume: 'AUCUN' })
    ).toBeNull()
  })

  it('deux modèles ne partagent jamais les mêmes réglages', () => {
    const empreintes = MODELES.map(m => JSON.stringify(REGLAGES_DES_MODELES[m]))
    expect(new Set(empreintes).size).toBe(MODELES.length)
  })
})
