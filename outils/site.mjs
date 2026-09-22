#!/usr/bin/env node
// site : prépare le site de présentation (site/) à partir des jetons de Relaytour.
//
// Le script écrit site/jetons.css (variables CSS des deux thèmes livrés), remplace
// le tableau des palettes de site/design-system.html entre ses deux marqueurs, et
// copie les polices embarquées dans site/polices/. La CI le relance et vérifie
// que rien ne change : le site ne peut pas diverger des jetons.
//
// Node 24 importe directement le TypeScript des jetons : aucune dépendance.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = join(RACINE, 'site')

const { THEMES, contraste, variablesCss } = await import(
  join(RACINE, 'packages/tokens/src/index.ts')
)

// ── Variables CSS ───────────────────────────────────────────────────────────

function bloc(selecteur, theme) {
  const lignes = Object.entries(variablesCss(theme)).map(
    ([nom, valeur]) => `  ${nom}: ${valeur};`
  )
  return `${selecteur} {\n${lignes.join('\n')}\n}\n`
}

const jetons = [
  '/* Fichier généré par outils/site.mjs à partir de packages/tokens. Ne pas modifier. */',
  '',
  bloc(':root', THEMES['bleu-vert']),
  bloc("[data-theme='encre-lagon']", THEMES['encre-lagon']),
].join('\n')
writeFileSync(join(SITE, 'jetons.css'), jetons)

// ── Tableau des palettes ────────────────────────────────────────────────────

const ROLES = [
  ['encre', 'Encre'],
  ['primaire', 'Primaire'],
  ['accent', 'Accent'],
  ['succes', 'Succès'],
  ['alerte', 'Alerte'],
  ['erreur', 'Erreur'],
]

const format = n => n.toFixed(1).replace('.', ',')

function palette(nom, titre, theme) {
  const c = theme.couleurs
  const lignes = ROLES.map(([cle, libelle]) => {
    const blanc = contraste(c[cle], '#FFFFFF')
    const sol = contraste(c[cle], c.sol3)
    const niveau = Math.min(blanc, sol) >= 7 ? 'AAA' : 'AA'
    return `        <tr>
          <th scope="row"><span class="nuancier" style="background: ${c[cle]}"></span>${libelle}</th>
          <td class="mono">${c[cle]}</td>
          <td class="mono">${format(blanc)}:1</td>
          <td class="mono">${format(sol)}:1</td>
          <td><span class="niveau">${niveau}</span></td>
        </tr>`
  })
  return `    <div class="verre panneau">
      <h3>${titre}</h3>
      <div class="defilement">
      <table class="tableau" data-palette="${nom}">
        <thead>
          <tr><th scope="col">Rôle</th><th scope="col">Valeur</th><th scope="col">Sur blanc</th><th scope="col">Sur le sol</th><th scope="col">Niveau</th></tr>
        </thead>
        <tbody>
${lignes.join('\n')}
        </tbody>
      </table>
      </div>
    </div>`
}

const DEBUT = '<!-- palettes:debut (généré par outils/site.mjs) -->'
const FIN = '<!-- palettes:fin -->'
const cheminDs = join(SITE, 'design-system.html')
const page = readFileSync(cheminDs, 'utf8')
const i = page.indexOf(DEBUT)
const j = page.indexOf(FIN)
if (i === -1 || j === -1 || j < i) {
  console.error(
    '✖ site/design-system.html : marqueurs des palettes introuvables'
  )
  process.exit(1)
}
const tableaux = [
  palette(
    'bleu-vert',
    'A · bleu-vert et terre cuite, par défaut',
    THEMES['bleu-vert']
  ),
  palette(
    'encre-lagon',
    'B · encre et lagon, alternatif',
    THEMES['encre-lagon']
  ),
].join('\n')
writeFileSync(
  cheminDs,
  `${page.slice(0, i + DEBUT.length)}\n${tableaux}\n    ${page.slice(j)}`
)

// ── Polices embarquées (licence OFL) ────────────────────────────────────────

const POLICES = [
  '@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2',
  '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
  '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
]
mkdirSync(join(SITE, 'polices'), { recursive: true })
for (const chemin of POLICES) {
  const source = join(RACINE, 'node_modules', chemin)
  copyFileSync(source, join(SITE, 'polices', chemin.split('/').pop()))
}
// La licence OFL accompagne chaque famille redistribuée.
for (const [paquet, nom] of [
  ['@fontsource-variable/hanken-grotesk', 'OFL-hanken-grotesk.txt'],
  ['@fontsource/ibm-plex-mono', 'OFL-ibm-plex-mono.txt'],
]) {
  copyFileSync(
    join(RACINE, 'node_modules', paquet, 'LICENSE'),
    join(SITE, 'polices', nom)
  )
}

console.log('✔ site/jetons.css, palettes et polices à jour')
