import { describe, expect, it } from 'vitest'

import {
  cleAvis,
  dernierAvis,
  doitProposer,
  jourLocal,
  noterAvis,
} from './proposition-modele'

const memoire = () => {
  const valeurs = new Map<string, string>()
  return {
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void valeurs.set(cle, valeur),
  }
}

describe('proposition du modèle du rôle (ADR 0065)', () => {
  it('ne propose rien sans modèle à proposer', () => {
    expect(doitProposer(null, null, '2026-11-09')).toBe(false)
  })

  it('propose une fois par jour', () => {
    const s = memoire()
    const cle = cleAvis('timm', 'CONTACT_PRINCIPAL')
    expect(
      doitProposer('CONTACT_PRINCIPAL', dernierAvis(cle, s), '2026-11-09')
    ).toBe(true)
    noterAvis(cle, '2026-11-09', s)
    expect(
      doitProposer('CONTACT_PRINCIPAL', dernierAvis(cle, s), '2026-11-09')
    ).toBe(false)
    expect(
      doitProposer('CONTACT_PRINCIPAL', dernierAvis(cle, s), '2026-11-10')
    ).toBe(true)
  })

  it('distingue les organisations et les modèles', () => {
    expect(cleAvis('timm', 'ADMIN_ACTIVITE')).not.toBe(
      cleAvis('club', 'ADMIN_ACTIVITE')
    )
    expect(cleAvis('timm', 'ADMIN_ACTIVITE')).not.toBe(
      cleAvis('timm', 'CONTACT_PRINCIPAL')
    )
  })

  it('écrit le jour local', () => {
    expect(jourLocal(new Date(2026, 10, 9, 23, 30))).toBe('2026-11-09')
  })
})
