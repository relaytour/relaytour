// Vérifie qu'aucune trace d'une installation réelle n'entre dans le
// dépôt public : adresse IP publique, hôte d'un vrai serveur, secret.
// Lancé en CI sur les fichiers suivis. Les motifs se complètent ici.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const MOTIFS = [
  // Une IP publique. Les plages privées, locales et de documentation sont admises.
  {
    nom: 'adresse IP publique',
    regex:
      /(?<![\d.])(?!10\.|127\.|0\.0\.0\.0|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|255\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)(\d{1,3}\.){3}\d{1,3}(?!\.?\d)/,
  },
  { nom: 'clé privée', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nom: 'jeton GitHub', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  {
    nom: 'mot de passe en clair dans une URL',
    regex:
      /:\/\/[^\s:@/]+:(?!<mot-de-passe>|relaytour-local|test|build|root:test)[^\s@/]{6,}@/,
  },
]

const fichiers = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(
    f =>
      f &&
      !f.endsWith('.png') &&
      !f.endsWith('.woff2') &&
      f !== 'yarn.lock' &&
      f !== 'outils/verifier-publication.mjs'
  )

const trouvailles = []
for (const fichier of fichiers) {
  const contenu = readFileSync(fichier, 'utf8')
  contenu.split('\n').forEach((ligne, i) => {
    for (const { nom, regex } of MOTIFS) {
      if (regex.test(ligne)) trouvailles.push(`${fichier}:${i + 1} : ${nom}`)
    }
  })
}
// Les commits portent une adresse du projet ou l'adresse noreply de leur auteur,
// jamais une adresse personnelle. La règle vaut pour les commits postérieurs au
// passage à l'adresse noreply (29 septembre 2026) : l'historique antérieur reste.
const DEPUIS = '2026-09-30'
const ADRESSE_ADMISE =
  /(@users\.noreply\.github\.com|^noreply@github\.com|@relaytour\.org)$/
const adresses = execFileSync(
  'git',
  ['log', `--since=${DEPUIS}`, '--format=%h %ae%n%h %ce', 'HEAD'],
  { encoding: 'utf8' }
)
  .split('\n')
  .filter(Boolean)
for (const ligne of adresses) {
  const [sha, adresse] = ligne.split(' ')
  if (!ADRESSE_ADMISE.test(adresse ?? '')) {
    trouvailles.push(`commit ${sha} : adresse de commit hors du projet`)
  }
}

if (trouvailles.length > 0) {
  console.error('✖ Le dépôt contient des traces à retirer avant publication :')
  for (const t of trouvailles) console.error(`  ${t}`)
  process.exit(1)
}
console.log(`✔ ${fichiers.length} fichiers suivis, aucune trace privée.`)
