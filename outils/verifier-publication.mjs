// Vérifie qu'aucune trace d'une installation réelle n'entre dans le
// dépôt public : adresse IP publique, hôte d'un vrai serveur, secret.
// Lancé en CI sur les fichiers suivis. Les motifs se complètent ici.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const MOTIFS = [
  // Une IP publique. Les plages privées, locales, de documentation et réservées
  // (partagée 100.64/10, tests de performance 198.18/15, multidiffusion et futur
  // usage 224/3, « ce réseau » 0/8, protocoles 192.0.0/24 et 192.88.99/24) sont
  // admises : aucune ne désigne un serveur joignable.
  {
    nom: 'adresse IP publique',
    regex:
      /(?<![\d.])(?!10\.|127\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|2(2[4-9]|[3-5]\d)\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.1[89]\.|192\.0\.0\.|192\.88\.99\.)(\d{1,3}\.){3}\d{1,3}(?!\.?\d)/,
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
