import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ErreurModeles,
  lireModeles,
  RACINE_EN_MEMOIRE,
  systemeEnMemoire,
} from './modeles.ts'

// Un dossier de contenu se lit à l'identique depuis le disque ou depuis une archive
// en mémoire (ADR 0049) : mêmes modèles, mêmes images, mêmes erreurs.

const EXEMPLE = path.resolve(import.meta.dirname, '../../../../content/exemple')

/** Les fichiers d'un dossier, par chemin relatif. */
function fichiersDe(racine: string): Map<string, Buffer> {
  const resultat = new Map<string, Buffer>()
  const parcourir = (dossier: string) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name)
      if (e.isDirectory()) parcourir(chemin)
      else resultat.set(path.relative(racine, chemin), readFileSync(chemin))
    }
  }
  parcourir(racine)
  return resultat
}

describe('dossier de contenu lu en mémoire', () => {
  it('donne les mêmes modèles que le disque', () => {
    const depuisLeDisque = lireModeles(EXEMPLE)
    const enMemoire = lireModeles(
      RACINE_EN_MEMOIRE,
      systemeEnMemoire(fichiersDe(EXEMPLE))
    )
    expect(enMemoire).toEqual(depuisLeDisque)
  })

  it('signale les mêmes erreurs', () => {
    const fichiers = fichiersDe(EXEMPLE)
    fichiers.delete('organisation.yaml')
    fichiers.set(
      'activites/rencontres/fiches/communes/sans-entete.md',
      Buffer.from('Une fiche sans en-tête.')
    )
    let erreurs: string[] = []
    try {
      lireModeles(RACINE_EN_MEMOIRE, systemeEnMemoire(fichiers))
    } catch (e) {
      erreurs = (e as ErreurModeles).erreurs
    }
    expect(erreurs).toContain(
      'organisation.yaml est absent (slug, nom, domainesCourrielAutorises au minimum)'
    )
    expect(erreurs).toContain(
      "activites/rencontres/fiches/communes/sans-entete.md : l'en-tête entre deux lignes « --- » est absent"
    )
  })
})
