import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { apercu, balisesApercu, pageAvecApercu } from './apercu.ts'

const reglages = {
  nomSite: undefined,
  description: undefined,
  image: undefined,
  origineOrga: 'https://orga.exemple.org',
}

// La page livrée par l'espace organisateur : le serveur doit y trouver le bloc.
const PAGE = readFileSync(
  new URL('../../../orga/index.html', import.meta.url),
  'utf8'
)

describe('aperçu d’un lien partagé', () => {
  it('nomme l’organisation désignée, sans rien de plus', () => {
    const a = apercu(
      { nom: 'Les Rencontres de la Vallée', langue: undefined },
      reglages
    )
    expect(a.titre).toBe('Espace organisateur · Les Rencontres de la Vallée')
    expect(a.description).toContain('Les Rencontres de la Vallée')
    expect(a.nomSite).toBe('Relaytour')
    expect(a.image).toBe('https://orga.exemple.org/apercu.jpg')
  })

  it('ne nomme personne sans organisation désignée', () => {
    const a = apercu(null, reglages)
    expect(a.titre).toBe('Espace organisateur')
    expect(a.description).toContain('relaytour.org')
  })

  it('suit la langue de l’organisation', () => {
    const a = apercu({ nom: 'Valley Games', langue: 'en' }, reglages)
    expect(a.titre).toBe('Organizer workspace · Valley Games')
    expect(a.langue).toBe('en')
    expect(balisesApercu(a)).toContain('content="en_US"')
  })

  it('prend les réglages de l’hébergeur', () => {
    const a = apercu(
      { nom: 'TIMM', langue: undefined },
      {
        nomSite: 'Relaytour Cloud',
        description: 'Hébergé par un hébergeur.',
        image: 'https://hebergeur.exemple.com/carte.png',
        origineOrga: 'https://orga.exemple.org',
      }
    )
    expect(a.nomSite).toBe('Relaytour Cloud')
    expect(a.description).toBe('Hébergé par un hébergeur.')
    expect(a.image).toBe('https://hebergeur.exemple.com/carte.png')
    // Les dimensions de l'image livrée ne s'appliquent pas à celle de l'hébergeur.
    expect(balisesApercu(a)).not.toContain('og:image:width')
  })

  it('complète un chemin d’image par l’origine de l’espace', () => {
    const a = apercu(null, { ...reglages, image: '/carte.png' })
    expect(a.image).toBe('https://orga.exemple.org/carte.png')
  })

  it('échappe le nom d’une organisation', () => {
    const a = apercu(
      { nom: 'A "B" <script>alert(1)</script> & C', langue: undefined },
      reglages
    )
    const balises = balisesApercu(a)
    expect(balises).not.toContain('<script>')
    expect(balises).toContain(
      'A &quot;B&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; C'
    )
  })

  it('remplace le bloc fixe de la page livrée', () => {
    const page = pageAvecApercu(
      PAGE,
      apercu({ nom: 'Valley Games', langue: 'en' }, reglages)
    )
    expect(page).not.toBeNull()
    expect(page).toContain('<html lang="en"')
    expect(page).toContain('<title>Organizer workspace · Valley Games</title>')
    expect(page?.match(/<title>/g)).toHaveLength(1)
    expect(page?.match(/property="og:image"/g)).toHaveLength(1)
    // Le reste de la page ne change pas.
    expect(page).toContain('<div id="racine"></div>')
    expect(page).toContain('rel="apple-touch-icon"')
  })

  it('refuse une page sans bloc', () => {
    expect(
      pageAvecApercu('<html><head></head></html>', apercu(null, reglages))
    ).toBeNull()
  })
})
