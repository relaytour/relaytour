// Vérifie que chaque dépendance installée est sous une licence compatible avec l'AGPL-3.0.
// Lancé en CI. Une licence hors liste blanche fait échouer l'étape : la décision d'accepter
// une nouvelle licence se prend ici, dans le code, jamais au fil de l'eau.
import { execFileSync } from 'node:child_process'

const AUTORISEES = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
  'OFL-1.1',
  'LGPL-2.1-or-later',
  'LGPL-3.0-or-later',
  'GPL-3.0-or-later',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
])

// Une expression composée est acceptée si l'une de ses alternatives l'est (OR) ou si
// toutes le sont (AND). Un astérisque final signale une licence devinée par l'outil.
function acceptable(expression) {
  const nettoyee = expression.replace(/[()*]/g, '').trim()
  if (nettoyee.includes(' OR '))
    return nettoyee.split(' OR ').some(l => AUTORISEES.has(l.trim()))
  if (nettoyee.includes(' AND '))
    return nettoyee.split(' AND ').every(l => AUTORISEES.has(l.trim()))
  return AUTORISEES.has(nettoyee)
}

const json = execFileSync(
  'npx',
  [
    '--yes',
    'license-checker-rseidelsohn',
    '--json',
    '--excludePrivatePackages',
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
)
const paquets = JSON.parse(json)
const refusees = Object.entries(paquets)
  .map(([nom, info]) => [
    nom,
    Array.isArray(info.licenses)
      ? info.licenses.join(' OR ')
      : String(info.licenses),
  ])
  .filter(([, licence]) => !acceptable(licence))

if (refusees.length > 0) {
  console.error('✖ Dépendances sous une licence hors liste blanche :')
  for (const [nom, licence] of refusees) console.error(`  ${nom} : ${licence}`)
  process.exit(1)
}
console.log(
  `✔ ${Object.keys(paquets).length} dépendances, toutes sous une licence autorisée.`
)
