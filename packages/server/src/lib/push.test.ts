import { describe, expect, it } from 'vitest'

import {
  adressePushAcceptee,
  clePushValide,
  clesVapid,
  empreinteAdresse,
  famillePush,
  libelleAppareil,
  pushAutorise,
} from './push.ts'

const tout = { pushTaches: true, pushEcheances: true, pushDemandes: true }

describe('famillePush', () => {
  it('range les types qui partent en push dans leur famille', () => {
    expect(famillePush('TACHE_ASSIGNEE')).toBe('taches')
    expect(famillePush('TACHE_DESASSIGNEE')).toBe('taches')
    expect(famillePush('TACHE_MODIFIEE')).toBe('taches')
    expect(famillePush('TACHE_STATUT')).toBe('taches')
    expect(famillePush('ECHEANCE_PROCHE')).toBe('echeances')
    expect(famillePush('TACHE_EN_RETARD')).toBe('echeances')
    expect(famillePush('DEMANDE_RECUE')).toBe('demandes')
  })

  it('écarte ce qui s’annonce à tout un périmètre', () => {
    for (const type of [
      'TACHE_CREEE',
      'FICHE_CREEE',
      'FICHE_MODIFIEE',
    ] as const) {
      expect(famillePush(type)).toBeNull()
      expect(pushAutorise(tout, type)).toBe(false)
    }
  })
})

describe('pushAutorise', () => {
  it('suit la préférence de chaque famille', () => {
    expect(pushAutorise(tout, 'TACHE_ASSIGNEE')).toBe(true)
    expect(pushAutorise({ ...tout, pushTaches: false }, 'TACHE_ASSIGNEE')).toBe(
      false
    )
    expect(
      pushAutorise({ ...tout, pushEcheances: false }, 'TACHE_EN_RETARD')
    ).toBe(false)
    expect(
      pushAutorise({ ...tout, pushDemandes: false }, 'DEMANDE_RECUE')
    ).toBe(false)
    expect(
      pushAutorise({ ...tout, pushDemandes: false }, 'ECHEANCE_PROCHE')
    ).toBe(true)
  })
})

describe('adressePushAcceptee', () => {
  it('accepte les services de push des navigateurs', () => {
    for (const adresse of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://web.push.apple.com/QGk',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ])
      expect(adressePushAcceptee(adresse)).toBe(true)
  })

  it('refuse toute autre adresse', () => {
    for (const adresse of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://exemple.org/push',
      'https://localhost/push',
      'https://fcm.googleapis.com.exemple.org/abc',
      'https://exemple.org/?h=fcm.googleapis.com',
      'https://fcm.googleapis.com:8443/abc',
      'https://identifiant@fcm.googleapis.com/abc',
      'pas une adresse',
      `https://fcm.googleapis.com/${'a'.repeat(2100)}`,
    ])
      expect(adressePushAcceptee(adresse)).toBe(false)
  })
})

describe('abonnement', () => {
  it('désigne une adresse par une empreinte stable', () => {
    const a = empreinteAdresse('https://fcm.googleapis.com/fcm/send/abc')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(empreinteAdresse('https://fcm.googleapis.com/fcm/send/abc')).toBe(a)
    expect(
      empreinteAdresse('https://fcm.googleapis.com/fcm/send/abd')
    ).not.toBe(a)
  })

  it('valide la forme des clés', () => {
    expect(
      clePushValide(
        'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'
      )
    ).toBe(true)
    expect(clePushValide('tBHItJI5svbpez7KI4CCXg==')).toBe(true)
    expect(clePushValide('court')).toBe(false)
    expect(clePushValide('avec espace et <balise>')).toBe(false)
  })

  it('déduit un libellé d’appareil', () => {
    expect(libelleAppareil('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')).toBe(
      'iPhone'
    )
    expect(libelleAppareil('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(
      'Android'
    )
    expect(libelleAppareil(undefined)).toBe('Appareil')
  })
})

describe('clesVapid', () => {
  it('ferme le canal sans les trois valeurs', () => {
    expect(clesVapid({})).toBeNull()
    expect(
      clesVapid({ PUSH_VAPID_PUBLIQUE: 'a', PUSH_VAPID_PRIVEE: 'b' })
    ).toBeNull()
    expect(
      clesVapid({
        PUSH_VAPID_PUBLIQUE: 'a',
        PUSH_VAPID_PRIVEE: 'b',
        PUSH_VAPID_SUJET: 'mailto:contact@exemple.org',
      })
    ).toEqual({
      publique: 'a',
      privee: 'b',
      sujet: 'mailto:contact@exemple.org',
    })
  })
})
