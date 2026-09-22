import { describe, expect, it } from 'vitest'

import { pngMinimal } from '../test/images.ts'

import { verifierMedia } from './medias.ts'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#123456"/></svg>'

describe('verifierMedia', () => {
  it('reconnaît un PNG par son contenu', () => {
    const m = verifierMedia(pngMinimal(), 'png')
    expect(m.type).toBe('image/png')
    expect(m.empreinte).toMatch(/^[0-9a-f]{64}$/)
  })

  it('accepte un SVG sans script', () => {
    expect(verifierMedia(Buffer.from(SVG), 'svg').type).toBe('image/svg+xml')
  })

  it('refuse un SVG là où un PNG est attendu', () => {
    expect(() => verifierMedia(Buffer.from(SVG), 'png')).toThrow(/PNG/)
  })

  it.each([
    ['<svg><script>alert(1)</script></svg>', /script/],
    ['<svg onload="alert(1)"></svg>', /gestionnaire/],
    ['<svg><image href="https://exemple.org/a.png"/></svg>', /externe/],
    ['<svg><foreignObject><div/></foreignObject></svg>', /HTML/],
    ['<svg style="background:url(https://exemple.org/a)"></svg>', /externe/],
  ])('refuse un SVG dangereux : %s', (source, message) => {
    expect(() => verifierMedia(Buffer.from(source))).toThrow(message)
  })

  it('refuse un autre format et une image trop lourde', () => {
    expect(() => verifierMedia(Buffer.from('GIF89a'))).toThrow(/PNG ou SVG/)
    const lourd = Buffer.concat([pngMinimal(), Buffer.alloc(600 * 1024)])
    expect(() => verifierMedia(lourd)).toThrow(/Ko/)
  })
})
