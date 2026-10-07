import { describe, expect, it } from 'vitest'

import {
  MESSAGERIES,
  enregistrerMessagerie,
  envoiDEssai,
  lienGuideMessagerie,
  lienVers,
  lireMessagerie,
  ouvreUnOnglet,
} from './messagerie'
import { LIEN_MAX, lienMailto, preparerLien } from './messages'

const envoi = {
  a: ['camille@exemple.org'],
  cc: ['lea@exemple.org'],
  cci: ['alex@exemple.org', 'noa@exemple.org'],
  objet: 'Réunion & suite',
  corps: 'Bonjour,\nÀ jeudi ?',
}

function stockage(depart: Record<string, string> = {}) {
  const valeurs = new Map(Object.entries(depart))
  return {
    valeurs,
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void valeurs.set(cle, valeur),
    removeItem: (cle: string) => void valeurs.delete(cle),
  }
}

describe('lien vers la messagerie choisie', () => {
  it('garde le lien mailto: pour la messagerie par défaut', () => {
    expect(lienVers('defaut', envoi)).toBe(lienMailto(envoi))
  })

  it('compose l’adresse de Gmail avec ses propres noms de champs', () => {
    expect(lienVers('gmail', envoi)).toBe(
      'https://mail.google.com/mail/?view=cm&fs=1' +
        '&to=camille%40exemple.org&cc=lea%40exemple.org' +
        '&bcc=alex%40exemple.org%2Cnoa%40exemple.org' +
        '&su=R%C3%A9union%20%26%20suite' +
        '&body=Bonjour%2C%0D%0A%C3%80%20jeudi%20%3F'
    )
  })

  it('passe un lien mailto: entier à Outlook sur le web, qui ignore un paramètre bcc', () => {
    for (const [cle, base] of [
      ['outlook', 'https://outlook.cloud.microsoft/mail/deeplink/compose'],
      ['outlook-perso', 'https://outlook.live.com/mail/0/deeplink/compose'],
    ] as const) {
      const lien = lienVers(cle, envoi)
      expect(lien.startsWith(`${base}?mailtouri=mailto%3A`)).toBe(true)
      expect(decodeURIComponent(lien.split('?mailtouri=')[1]!)).toBe(
        lienMailto(envoi)
      )
    }
  })

  it('passe un lien mailto: entier à Proton Mail, dans le fragment', () => {
    const lien = lienVers('proton', envoi)
    expect(lien.startsWith('https://mail.proton.me/inbox/#mailto=')).toBe(true)
    expect(decodeURIComponent(lien.split('#mailto=')[1]!)).toBe(
      lienMailto(envoi)
    )
  })

  it('compose les schémas d’URL des applications', () => {
    expect(lienVers('app-gmail', { ...envoi, cc: [], cci: [] })).toBe(
      'googlegmail:///co?to=camille%40exemple.org' +
        '&subject=R%C3%A9union%20%26%20suite' +
        '&body=Bonjour%2C%0D%0A%C3%80%20jeudi%20%3F'
    )
    expect(lienVers('app-outlook', envoi)).toContain(
      'ms-outlook://compose?to=camille%40exemple.org&cc=lea%40exemple.org&bcc='
    )
  })

  it('n’écrit aucun champ vide, ni aucun séparateur de trop', () => {
    const vide = { a: [], cc: [], cci: [], objet: '', corps: '' }
    expect(lienVers('gmail', vide)).toBe(
      'https://mail.google.com/mail/?view=cm&fs=1'
    )
    expect(lienVers('yahoo', vide)).toBe('https://compose.mail.yahoo.com/')
    expect(lienVers('outlook', vide)).toBe(
      'https://outlook.cloud.microsoft/mail/deeplink/compose?mailtouri=mailto%3A'
    )
    expect(lienVers('app-outlook', vide)).toBe('ms-outlook://compose')
  })

  it('ne code jamais une espace par un signe +', () => {
    for (const { cle } of MESSAGERIES) {
      expect(lienVers(cle, envoi)).not.toContain('+')
    }
  })

  it('ouvre un onglet pour une page web seulement', () => {
    for (const { cle, genre } of MESSAGERIES) {
      expect(ouvreUnOnglet(lienVers(cle, envoi))).toBe(genre === 'web')
    }
  })

  it('retire le texte, puis les adresses, d’un lien trop long pour chaque cible', () => {
    const cci = Array.from(
      { length: 200 },
      (_, i) => `personne${i}@exemple.org`
    )
    for (const { cle } of MESSAGERIES) {
      const lien = (e: typeof envoi) => lienVers(cle, e)
      const long = preparerLien({ ...envoi, corps: 'é'.repeat(LIEN_MAX) }, lien)
      expect(long.omis).toBe('texte')
      expect(long.lien.length).toBeLessThanOrEqual(LIEN_MAX)
      const nombreux = preparerLien({ ...envoi, cci }, lien)
      expect(nombreux.omis).toBe('adresses')
      expect(nombreux.lien).not.toContain('exemple.org')
    }
  })
})

describe('messagerie gardée dans le navigateur', () => {
  it('propose la messagerie par défaut sans choix enregistré', () => {
    expect(lireMessagerie(stockage())).toBe('defaut')
    expect(lireMessagerie(null)).toBe('defaut')
  })

  it('relit le choix enregistré', () => {
    const s = stockage()
    expect(enregistrerMessagerie('gmail', s)).toBe(true)
    expect(lireMessagerie(s)).toBe('gmail')
  })

  it('écarte une valeur inconnue', () => {
    expect(
      lireMessagerie(stockage({ 'relaytour.messagerie': 'inconnue' }))
    ).toBe('defaut')
  })

  it('efface la clé quand la personne revient à la messagerie par défaut', () => {
    const s = stockage({ 'relaytour.messagerie': 'gmail' })
    enregistrerMessagerie('defaut', s)
    expect(s.valeurs.size).toBe(0)
  })

  it('signale un stockage absent ou qui refuse l’écriture', () => {
    const plein = {
      ...stockage(),
      setItem: () => {
        throw new Error('Quota dépassé.')
      },
    }
    expect(enregistrerMessagerie('gmail', plein)).toBe(false)
    expect(enregistrerMessagerie('gmail', null)).toBe(false)
  })
})

describe('essai et mode d’emploi', () => {
  it('adresse le message d’essai à la personne seule, en « À » et en « Cci »', () => {
    const essai = envoiDEssai('camille@exemple.org')
    expect(essai.a).toEqual(['camille@exemple.org'])
    expect(essai.cc).toEqual([])
    expect(essai.cci).toEqual(['camille@exemple.org'])
  })

  it('place la page du mode d’emploi à côté de la liste', () => {
    const page = 'https://relaytour.org/modes-d-emploi/messagerie.html'
    expect(lienGuideMessagerie('https://relaytour.org/modes-d-emploi/')).toBe(
      page
    )
    expect(lienGuideMessagerie('https://relaytour.org/modes-d-emploi')).toBe(
      page
    )
    expect(
      lienGuideMessagerie('https://relaytour.org/modes-d-emploi/index.html')
    ).toBe(page)
  })
})
