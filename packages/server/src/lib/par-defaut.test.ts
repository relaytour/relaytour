import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// ADR 0008 : le code de production ne passe plus par l'organisation ni par l'activité
// « par défaut ». Chaque requête lit l'organisation du contexte, chaque script et le
// worker désignent l'organisation visée. Seuls les tests et l'amorçage des tests y
// recourent encore.

const RACINES = ['src', 'scripts'].map(r =>
  path.join(import.meta.dirname, '..', '..', r)
)
const AUTORISES = [
  path.join('src', 'lib', 'organisation.ts'),
  path.join('src', 'test', 'contexte.ts'),
]

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap(nom => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiers(chemin)
    return chemin.endsWith('.ts') && !chemin.endsWith('.test.ts')
      ? [chemin]
      : []
  })
}

describe('organisation et activité par défaut', () => {
  it('ne sont appelées par aucun code de production', () => {
    const racineServeur = path.join(import.meta.dirname, '..', '..')
    const appels = RACINES.flatMap(fichiers)
      .filter(f => !AUTORISES.includes(path.relative(racineServeur, f)))
      .filter(f =>
        /\b(organisationParDefaut|activiteParDefaut)\(/.test(
          readFileSync(f, 'utf8')
        )
      )
      .map(f => path.relative(racineServeur, f))
    expect(appels).toEqual([])
  })
})
