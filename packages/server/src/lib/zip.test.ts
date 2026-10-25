import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  archiveZip,
  ErreurArchive,
  lireArchiveZip,
  sansDossierEnglobant,
} from './zip.ts'

describe('archiveZip', () => {
  it('produit une archive que unzip relit à l’identique', () => {
    const fichiers = new Map([
      ['organisation.yaml', Buffer.from('slug: exemple\nnom: Exemple\n')],
      [
        'activites/ete/fiches/communes/accueil.md',
        Buffer.from('é'.repeat(500)),
      ],
    ])
    const dossier = mkdtempSync(path.join(tmpdir(), 'relaytour-zip-'))
    try {
      const archive = path.join(dossier, 'contenu.zip')
      writeFileSync(archive, archiveZip(fichiers))
      execFileSync('unzip', ['-q', archive, '-d', path.join(dossier, 'sortie')])
      for (const [chemin, donnees] of fichiers) {
        expect(readFileSync(path.join(dossier, 'sortie', chemin))).toEqual(
          donnees
        )
      }
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  })

  it('est reproductible', () => {
    const fichiers = new Map([['a.txt', Buffer.from('a')]])
    expect(archiveZip(fichiers)).toEqual(archiveZip(fichiers))
  })
})

const LARGES = { taille: 1e8, decompressee: 1e8, fichiers: 100 }

/** Position de l'unique entrée du répertoire central d'une archive. */
function entreeCentrale(archive: Buffer, nom: string): number {
  return archive.length - 22 - 46 - nom.length
}

describe('lireArchiveZip', () => {
  it('relit une archive produite par archiveZip', () => {
    const fichiers = new Map([
      ['organisation.yaml', Buffer.from('slug: exemple\n')],
      ['activites/ete/perimetres.yaml', Buffer.from('é'.repeat(800))],
      ['medias/vide.png', Buffer.alloc(0)],
    ])
    expect(lireArchiveZip(archiveZip(fichiers), LARGES)).toEqual(fichiers)
  })

  it('relit une archive de la commande zip, sans dossiers ni fichiers système', () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'relaytour-zip-'))
    try {
      const contenu = path.join(dossier, 'contenu')
      mkdirSync(path.join(contenu, 'activites/ete'), { recursive: true })
      writeFileSync(path.join(contenu, 'organisation.yaml'), 'slug: exemple\n')
      writeFileSync(path.join(contenu, 'activites/ete/perimetres.yaml'), 'x')
      writeFileSync(path.join(contenu, '.DS_Store'), 'bruit')
      execFileSync('zip', ['-qr', 'contenu.zip', 'contenu'], { cwd: dossier })
      const lus = lireArchiveZip(
        readFileSync(path.join(dossier, 'contenu.zip')),
        LARGES
      )
      expect([...lus.keys()].sort()).toEqual([
        'contenu/activites/ete/perimetres.yaml',
        'contenu/organisation.yaml',
      ])
      expect([...sansDossierEnglobant(lus).keys()].sort()).toEqual([
        'activites/ete/perimetres.yaml',
        'organisation.yaml',
      ])
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  })

  it('ignore les fichiers ajoutés par macOS', () => {
    const archive = archiveZip(
      new Map([
        ['organisation.yaml', Buffer.from('a')],
        ['__MACOSX/._organisation.yaml', Buffer.from('b')],
      ])
    )
    expect([...lireArchiveZip(archive, LARGES).keys()]).toEqual([
      'organisation.yaml',
    ])
  })

  it.each([
    '../hors.yaml',
    '/absolu.yaml',
    'a/../../b',
    'a\\b',
    'C:/x',
    'a//b',
  ])('refuse le chemin %s', nom => {
    const archive = archiveZip(new Map([[nom, Buffer.from('x')]]))
    expect(() => lireArchiveZip(archive, LARGES)).toThrow(ErreurArchive)
  })

  it('refuse une archive au-delà de ses bornes', () => {
    const bombe = archiveZip(new Map([['zeros', Buffer.alloc(5_000_000)]]))
    expect(bombe.length).toBeLessThan(10_000)
    expect(() =>
      lireArchiveZip(bombe, { ...LARGES, decompressee: 1_000_000 })
    ).toThrow(/décompressée/)
    expect(() => lireArchiveZip(bombe, { ...LARGES, taille: 100 })).toThrow(
      /dépasse \d+ Mo\.$/
    )
    const nombreux = archiveZip(
      new Map(Array.from({ length: 5 }, (_, i) => [`f${i}`, Buffer.from('x')]))
    )
    expect(() => lireArchiveZip(nombreux, { ...LARGES, fichiers: 4 })).toThrow(
      /fichiers/
    )
  })

  it('arrête la décompression à la borne malgré une taille annoncée fausse', () => {
    const archive = archiveZip(new Map([['zeros', Buffer.alloc(5_000_000)]]))
    archive.writeUInt32LE(10, entreeCentrale(archive, 'zeros') + 24)
    expect(() =>
      lireArchiveZip(archive, { ...LARGES, decompressee: 1000 })
    ).toThrow(ErreurArchive)
  })

  it('refuse une archive chiffrée, abîmée ou illisible', () => {
    const archive = archiveZip(new Map([['a.txt', Buffer.from('contenu')]]))
    const central = entreeCentrale(archive, 'a.txt')
    const chiffree = Buffer.from(archive)
    chiffree.writeUInt16LE(0x0801, central + 8)
    expect(() => lireArchiveZip(chiffree, LARGES)).toThrow(/chiffrée/)
    const abimee = Buffer.from(archive)
    abimee.writeUInt32LE(0, central + 16)
    expect(() => lireArchiveZip(abimee, LARGES)).toThrow(/abîmé/)
    expect(() => lireArchiveZip(Buffer.from('pas un zip'), LARGES)).toThrow(
      /zip lisible/
    )
  })
})
