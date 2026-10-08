import { themeParDefaut } from '@relaytour/tokens'
import { describe, expect, it } from 'vitest'

import {
  adresseOuverture,
  cheminManifest,
  manifestApplication,
  slugDuManifest,
} from './application.ts'
import {
  COTE_ICONE_APPLICATION,
  dimensionsPng,
  verifierIconeApplication,
} from './medias.ts'

const organisation = {
  slug: 'rencontres',
  nom: 'Les Rencontres de la Vallée',
  nomCourt: 'Rencontres',
  theme: themeParDefaut,
  iconeApplicationUrl: undefined,
}

/** Un en-tête PNG aux dimensions données : la vérification ne lit que l'IHDR. */
function enTetePng(largeur: number, hauteur: number): Buffer {
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'latin1')
  b.writeUInt32BE(largeur, 16)
  b.writeUInt32BE(hauteur, 20)
  return b
}

describe('manifestApplication', () => {
  it('reprend l’identité publique et désigne l’organisation', () => {
    const m = manifestApplication(organisation)
    expect(m.name).toBe('Les Rencontres de la Vallée')
    expect(m.short_name).toBe('Rencontres')
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/?organisation=rencontres')
    expect(m.id).toBe(m.start_url)
    expect(m.scope).toBe('/')
    expect(m.theme_color).toBe(themeParDefaut.couleurs.primaire)
    expect(m.background_color).toBe(themeParDefaut.couleurs.sol1)
  })

  it('utilise l’icône de Relaytour sans icône déclarée', () => {
    expect(manifestApplication(organisation).icons).toEqual([
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ])
  })

  it('utilise l’icône déclarée par l’organisation', () => {
    const src = `/medias/${'a'.repeat(64)}.png`
    const m = manifestApplication({ ...organisation, iconeApplicationUrl: src })
    expect(m.icons[0]?.src).toBe(src)
  })

  it('ne porte que des champs de l’identité publique', () => {
    expect(Object.keys(manifestApplication(organisation)).sort()).toEqual([
      'background_color',
      'description',
      'display',
      'icons',
      'id',
      'lang',
      'name',
      'scope',
      'short_name',
      'start_url',
      'theme_color',
    ])
  })
})

describe('adresse du manifest', () => {
  it('relie le slug et le nom de fichier', () => {
    expect(cheminManifest('rencontres')).toBe(
      '/medias/application/rencontres.webmanifest'
    )
    expect(slugDuManifest('rencontres.webmanifest')).toBe('rencontres')
    expect(slugDuManifest('club-des-cimes.webmanifest')).toBe('club-des-cimes')
    expect(adresseOuverture('rencontres')).toBe('/?organisation=rencontres')
  })

  it('refuse un nom de fichier qui n’est pas un slug', () => {
    for (const fichier of [
      'rencontres.json',
      '../rencontres.webmanifest',
      'Rencontres.webmanifest',
      '.webmanifest',
      `${'a'.repeat(64)}.png`,
    ])
      expect(slugDuManifest(fichier)).toBeNull()
  })
})

describe('icône d’application', () => {
  it('lit les dimensions d’un PNG', () => {
    expect(dimensionsPng(enTetePng(512, 512))).toEqual({
      largeur: 512,
      hauteur: 512,
    })
    expect(dimensionsPng(Buffer.from('<svg/>'))).toBeNull()
  })

  it('accepte un carré de 512 pixels et refuse le reste', () => {
    expect(COTE_ICONE_APPLICATION).toBe(512)
    expect(() => verifierIconeApplication(enTetePng(512, 512))).not.toThrow()
    for (const [l, h] of [
      [32, 32],
      [512, 256],
      [1024, 1024],
    ] as const)
      expect(() => verifierIconeApplication(enTetePng(l, h))).toThrow(
        /512 pixels/
      )
  })
})
