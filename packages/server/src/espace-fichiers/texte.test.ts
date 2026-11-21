import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { documentWord } from '../test/docx.ts'
import { documentPdf } from '../test/pdf.ts'

import {
  bornerTexte,
  executerFil,
  ExtractionImpossible,
  extraireTexte,
  FichierTropLourd,
  formatTexte,
  lireOctetsBornes,
  nettoyerTexte,
  TEXTE_CARACTERES_MAX,
  TEXTE_PAGES_MAX,
} from './texte.ts'

// Texte d'un document (ADR 0072) : format déduit du nom, lecture bornée à 10 Mo,
// extraction dans un fil séparé et texte borné à 200 000 caractères.

/** Un flux qui rend ces morceaux, et note s'il a été annulé. */
function flux(morceaux: Uint8Array[]) {
  const etat = { annule: false, lus: 0 }
  const lecture = new ReadableStream<Uint8Array>({
    pull(controleur) {
      const suivant = morceaux[etat.lus++]
      if (suivant === undefined) controleur.close()
      else controleur.enqueue(suivant)
    },
    cancel() {
      etat.annule = true
    },
  })
  return { lecture, etat }
}

describe('formatTexte', () => {
  it('lit le texte, le Markdown, Word et le PDF d’après le nom', () => {
    expect(formatTexte('notes.txt', false)).toBe('TEXTE')
    expect(formatTexte('Charte.md', false)).toBe('MARKDOWN')
    expect(formatTexte('Compte rendu.DOCX', false)).toBe('WORD')
    expect(formatTexte('Plan.pdf', false)).toBe('PDF')
  })

  it('refuse les autres formats et tout document natif du fournisseur', () => {
    for (const nom of [
      'Plan.doc',
      'Budget.xlsx',
      'logo.svg',
      'page.html',
      'photo.png',
      'sans-extension',
      '.docx',
    ]) {
      expect(formatTexte(nom, false)).toBeNull()
    }
    // Un document Google porte parfois un nom qui finit par une extension connue.
    expect(formatTexte('Règlement.pdf', true)).toBeNull()
    expect(formatTexte('Ordre du jour.docx', true)).toBeNull()
  })
})

describe('lireOctetsBornes', () => {
  it('lit un flux sous la borne', async () => {
    const { lecture } = flux([new Uint8Array([1, 2]), new Uint8Array([3])])
    expect([...(await lireOctetsBornes(lecture, 3))]).toEqual([1, 2, 3])
  })

  it('coupe le téléchargement au-delà de la borne', async () => {
    const morceaux = Array.from({ length: 10 }, () => new Uint8Array(4))
    const { lecture, etat } = flux(morceaux)
    await expect(lireOctetsBornes(lecture, 10)).rejects.toBeInstanceOf(
      FichierTropLourd
    )
    expect(etat.annule).toBe(true)
    // Le serveur cesse de lire dès la borne franchie.
    expect(etat.lus).toBe(3)
  })
})

describe('nettoyerTexte', () => {
  it('normalise les fins de ligne et retire les caractères de contrôle', () => {
    expect(
      nettoyerTexte('Titre  \r\nLigne\u0000 une\tdeux\u0007\r\u001b[31m')
    ).toBe('Titre\nLigne une\tdeux\n[31m\n')
    expect(nettoyerTexte('A\u0085B\u007fC')).toBe('ABC\n')
  })

  it('rend un texte vide pour un document sans caractère visible', () => {
    expect(nettoyerTexte('\n\n \u000c \n')).toBe('')
  })
})

describe('bornerTexte', () => {
  it('rend le texte entier sous la borne', () => {
    expect(bornerTexte('abc', 5)).toEqual({
      texte: 'abc',
      caracteres: 3,
      tronque: false,
    })
  })

  it('coupe au-delà de 200 000 caractères et garde la longueur d’origine', () => {
    const long = 'a'.repeat(TEXTE_CARACTERES_MAX + 10)
    const borne = bornerTexte(long)
    expect(borne.texte.length).toBe(TEXTE_CARACTERES_MAX)
    expect(borne.caracteres).toBe(TEXTE_CARACTERES_MAX + 10)
    expect(borne.tronque).toBe(true)
  })

  it('ne sépare pas les deux moitiés d’un caractère', () => {
    expect(bornerTexte('ab😀cd', 3).texte).toBe('ab')
  })
})

describe('extraireTexte', () => {
  it('rend un texte ou un Markdown tel quel, sans marque d’ordre', async () => {
    const octets = new Uint8Array(Buffer.from('﻿# Charte\nTexte', 'utf8'))
    expect(await extraireTexte('MARKDOWN', octets)).toEqual({
      texte: '# Charte\nTexte',
      pagesTronquees: false,
    })
  })

  it('convertit un document Word en Markdown', async () => {
    const { texte } = await extraireTexte(
      'WORD',
      new Uint8Array(documentWord('Compte rendu', ['Ordre du **jour**.']))
    )
    expect(texte).toContain('# Compte rendu')
    expect(texte).toContain('Ordre du **jour**.')
  })

  it('rend le texte des pages d’un PDF', async () => {
    const { texte, pagesTronquees } = await extraireTexte(
      'PDF',
      documentPdf(['Page une (bassin)', 'Page deux'])
    )
    expect(texte).toBe('Page une (bassin)\n\nPage deux')
    expect(pagesTronquees).toBe(false)
  })

  it('ne lit que les 200 premières pages d’un PDF', async () => {
    const pages = Array.from(
      { length: TEXTE_PAGES_MAX + 5 },
      (_, i) => `Page ${i + 1}`
    )
    const { texte, pagesTronquees } = await extraireTexte(
      'PDF',
      documentPdf(pages)
    )
    expect(pagesTronquees).toBe(true)
    expect(texte).toContain(`Page ${TEXTE_PAGES_MAX}`)
    expect(texte).not.toContain(`Page ${TEXTE_PAGES_MAX + 1}`)
  }, 20_000)

  it('refuse un fichier illisible sans texte partiel', async () => {
    await expect(
      extraireTexte('PDF', new Uint8Array(Buffer.from('pas un PDF')))
    ).rejects.toBeInstanceOf(ExtractionImpossible)
    await expect(
      extraireTexte('WORD', new Uint8Array(Buffer.from('pas un docx')))
    ).rejects.toBeInstanceOf(ExtractionImpossible)
  })
})

describe('executerFil', () => {
  it('arrête un fil qui dépasse son délai', async () => {
    const dossier = await mkdtemp(join(tmpdir(), 'fil-'))
    try {
      const fichier = join(dossier, 'boucle.mjs')
      // Une extraction qui ne rend jamais la main.
      await writeFile(fichier, 'for (;;) {}\n')
      const debut = Date.now()
      await expect(
        executerFil(pathToFileURL(fichier), null, 300)
      ).rejects.toBeInstanceOf(ExtractionImpossible)
      expect(Date.now() - debut).toBeLessThan(5_000)
    } finally {
      await rm(dossier, { recursive: true, force: true })
    }
  })

  it('arrête un fil qui dépasse sa mémoire', async () => {
    const dossier = await mkdtemp(join(tmpdir(), 'fil-'))
    try {
      const fichier = join(dossier, 'memoire.mjs')
      await writeFile(
        fichier,
        'const t = []; for (;;) t.push(new Array(1e6).fill(Math.random()))\n'
      )
      await expect(
        executerFil(pathToFileURL(fichier), null, 15_000)
      ).rejects.toBeInstanceOf(ExtractionImpossible)
    } finally {
      await rm(dossier, { recursive: true, force: true })
    }
  }, 20_000)
})
