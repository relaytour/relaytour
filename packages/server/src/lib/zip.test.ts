import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { archiveZip } from './zip.ts'

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
