import { describe, expect, it } from 'vitest'

import { cleCourante, cleEnOctets, etatPush } from './push'

const navigateur = { prisEnCharge: true, iphone: false, installee: false }

describe('etatPush', () => {
  it('ferme le réglage sans clé de l’installation', () => {
    expect(etatPush(null, 'granted', true, navigateur)).toBe('indisponible')
  })

  it('demande l’installation sur un iPhone ouvert dans le navigateur', () => {
    const iphone = { prisEnCharge: false, iphone: true, installee: false }
    expect(etatPush('cle', undefined, false, iphone)).toBe(
      'installation-requise'
    )
    expect(
      etatPush('cle', undefined, false, { ...iphone, installee: true })
    ).toBe('indisponible')
    expect(
      etatPush('cle', undefined, false, { ...navigateur, prisEnCharge: false })
    ).toBe('indisponible')
  })

  it('suit l’autorisation et l’abonnement', () => {
    expect(etatPush('cle', 'denied', true, navigateur)).toBe('refuse')
    expect(etatPush('cle', 'default', false, navigateur)).toBe('a-activer')
    expect(etatPush('cle', 'granted', false, navigateur)).toBe('a-activer')
    expect(etatPush('cle', 'granted', true, navigateur)).toBe('active')
  })
})

describe('cleEnOctets', () => {
  it('décode une clé en base64 adapté aux adresses', () => {
    expect([...cleEnOctets('AQID-_8')]).toEqual([1, 2, 3, 251, 255])
  })
})

describe('cleCourante', () => {
  it('reconnaît un abonnement créé avec la clé de l’installation', () => {
    expect(cleCourante(cleEnOctets('AQID-_8').buffer, 'AQID-_8')).toBe(true)
  })

  it('écarte un abonnement lié à une autre clé, ou sans clé', () => {
    expect(cleCourante(cleEnOctets('AQID-_4').buffer, 'AQID-_8')).toBe(false)
    expect(cleCourante(cleEnOctets('AQID').buffer, 'AQID-_8')).toBe(false)
    expect(cleCourante(null, 'AQID-_8')).toBe(false)
  })
})
