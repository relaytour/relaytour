import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { lireCatalogue, taux } from './langues.mjs'

const CATALOGUE = `msgid ""
msgstr ""
"Language: en\\n"

#: src/pages/Accueil.tsx
msgid "Bonjour"
msgstr "Hello"

msgid "Une phrase "
"sur deux lignes"
msgstr ""
"A sentence "
"on two lines"

msgid "À traduire"
msgstr ""

#~ msgid "Ancien message"
#~ msgstr "Old message"
`

describe('lireCatalogue', () => {
  it('lit les entrées, suites de lignes comprises, sans l’en-tête ni les obsolètes', () => {
    assert.deepEqual(lireCatalogue(CATALOGUE), [
      { msgid: 'Bonjour', msgstr: 'Hello' },
      {
        msgid: 'Une phrase sur deux lignes',
        msgstr: 'A sentence on two lines',
      },
      { msgid: 'À traduire', msgstr: '' },
    ])
  })
})

describe('taux', () => {
  it('arrondit vers le bas et vaut zéro sans message', () => {
    assert.equal(taux({ messages: 3, traduits: 2 }), 66)
    assert.equal(taux({ messages: 0, traduits: 0 }), 0)
  })
})
