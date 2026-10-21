import { describe, expect, it } from 'vitest'

import { documentWord } from '../test/docx.ts'

import {
  formatImport,
  lireFiche,
  slugDepuisNom,
  wordVersMarkdown,
} from './conversion.ts'

describe('formatImport', () => {
  it('importe le Markdown, le texte et Word, rien d’autre', () => {
    expect(formatImport('Fiche.md')).toBe('MARKDOWN')
    expect(formatImport('fiche.MARKDOWN')).toBe('MARKDOWN')
    expect(formatImport('notes.txt')).toBe('TEXTE')
    expect(formatImport('Plan.docx')).toBe('WORD')
    for (const nom of [
      'Plan.doc',
      'Plan.pdf',
      'image.png',
      'sans-extension',
      '.md',
    ])
      expect(formatImport(nom)).toBeNull()
  })
})

describe('slugDepuisNom', () => {
  it('tire un identifiant du nom de fichier', () => {
    expect(slugDepuisNom('Réserver la piscine.docx')).toBe(
      'reserver-la-piscine'
    )
    expect(slugDepuisNom('L’accueil des bénévoles.md')).toBe(
      'l-accueil-des-benevoles'
    )
    expect(slugDepuisNom('!!!.md')).toBe('')
  })
})

describe('lireFiche', () => {
  it('lit l’en-tête quand il existe', () => {
    expect(
      lireFiche(
        'autre-nom.md',
        '---\nslug: accueil\ntitre: Accueillir les bénévoles\n---\n\nTexte.\n'
      )
    ).toEqual({
      slug: 'accueil',
      titre: 'Accueillir les bénévoles',
      contenu: 'Texte.\n',
    })
  })

  it('prend le premier titre de niveau 1, puis le retire du contenu', () => {
    expect(
      lireFiche('Charte.txt', '\n# La charte\n\nArriver à l’heure.')
    ).toEqual({
      slug: 'charte',
      titre: 'La charte',
      contenu: 'Arriver à l’heure.\n',
    })
  })

  it('retombe sur le nom du fichier, sans toucher un titre placé plus bas', () => {
    expect(lireFiche('Plan du bassin.md', 'Intro.\n\n# Section\n')).toEqual({
      slug: 'plan-du-bassin',
      titre: 'Plan du bassin',
      contenu: 'Intro.\n\n# Section\n',
    })
  })
})

describe('wordVersMarkdown', () => {
  it('convertit un document Word en Markdown', async () => {
    const { texte, pertes } = await wordVersMarkdown(
      documentWord('Plan du bassin', [
        'Réserver **deux lignes** pour les relais.',
      ])
    )
    expect(pertes).toEqual([])
    expect(lireFiche('Plan du bassin.docx', texte)).toEqual({
      slug: 'plan-du-bassin',
      titre: 'Plan du bassin',
      contenu: 'Réserver **deux lignes** pour les relais.\n',
    })
  })
})
