import { describe, expect, it } from 'vitest'

import {
  cheminValide,
  convertibleParMicrosoft,
  disposition,
  formatApercu,
  typeServi,
} from './chemin.ts'
import { adresseGraph, HOTES_MICROSOFT } from './sharepoint.ts'
import { hoteAdmis } from './sortant.ts'

describe('cheminValide', () => {
  it('accepte un chemin de noms', () => {
    expect(cheminValide([])).toBe(true)
    expect(cheminValide(['Natation', 'Plan du bassin.pdf'])).toBe(true)
    expect(cheminValide(['Été 2027', 'Équipes'])).toBe(true)
  })

  it('refuse tout segment qui sortirait de la base', () => {
    for (const chemin of [
      ['..'],
      ['.'],
      [''],
      ['a/b'],
      ['a\\b'],
      [' espace'],
      ['retour\n'],
      Array.from({ length: 21 }, () => 'a'),
    ]) {
      expect(cheminValide(chemin)).toBe(false)
    }
  })
})

describe('formatApercu et typeServi', () => {
  const formats = (nom: string) => formatApercu(nom, convertibleParMicrosoft)

  it('déduit le format du nom, jamais du type annoncé', () => {
    expect(formats('Plan.PDF')).toBe('PDF')
    expect(formats('photo.jpeg')).toBe('IMAGE')
    expect(formats('notes.txt')).toBe('TEXTE')
    expect(formats('fiche.md')).toBe('MARKDOWN')
    expect(formats('budget.xlsx')).toBe('PDF_CONVERTI')
    expect(formats('archive.zip')).toBe('AUCUN')
    expect(formatApercu('budget.xlsx', () => false)).toBe('AUCUN')
  })

  it('ne sert jamais le HTML ni le SVG comme une page', () => {
    for (const nom of ['page.html', 'logo.svg', 'page.htm', 'sans-extension']) {
      expect(formats(nom)).toBe('AUCUN')
      expect(typeServi(nom, formats(nom))).toBe('application/octet-stream')
    }
    expect(typeServi('fiche.md', 'MARKDOWN')).toBe('text/plain; charset=utf-8')
    expect(typeServi('photo.jpg', 'IMAGE')).toBe('image/jpeg')
  })

  it('écrit le nom du fichier sans casser l’en-tête', () => {
    expect(disposition('Équipe "A".pdf', 'inline')).toBe(
      `inline; filename="_quipe _A_.pdf"; filename*=UTF-8''%C3%89quipe%20%22A%22.pdf`
    )
  })
})

describe('hoteAdmis', () => {
  it('admet les hôtes de Microsoft en https', () => {
    for (const adresse of [
      'https://graph.microsoft.com/v1.0/me',
      'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
      'https://asso.sharepoint.com/_layouts/15/download.aspx?x=1',
      'https://francecentral1-mediap.svc.ms/transform/pdf',
    ]) {
      expect(hoteAdmis(adresse, HOTES_MICROSOFT)).toBe(true)
    }
  })

  it('refuse tout autre hôte, http, un port ou un compte', () => {
    for (const adresse of [
      'http://graph.microsoft.com/v1.0/me',
      'https://graph.microsoft.com.exemple.org/',
      'https://sharepoint.com/',
      'https://exemple-sharepoint.com/',
      'https://graph.microsoft.com:8443/',
      'https://moi@graph.microsoft.com/',
      'https://127.0.0.1/',
      'pas une adresse',
    ]) {
      expect(hoteAdmis(adresse, HOTES_MICROSOFT)).toBe(false)
    }
  })
})

describe('adresseGraph', () => {
  it('adresse un élément depuis sa base, chemin encodé', () => {
    expect(adresseGraph({ emplacement: 'b!abc', base: null, chemin: [] })).toBe(
      'https://graph.microsoft.com/v1.0/drives/b!abc/root'
    )
    expect(
      adresseGraph({
        emplacement: 'b!abc',
        base: '01XYZ',
        chemin: ['Été 2027', 'Plan #1.pdf'],
      })
    ).toBe(
      'https://graph.microsoft.com/v1.0/drives/b!abc/items/01XYZ:/%C3%89t%C3%A9%202027/Plan%20%231.pdf:'
    )
  })
})
