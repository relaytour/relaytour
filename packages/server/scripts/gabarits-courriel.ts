import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import mjml2html from 'mjml'

// Les gabarits MJML sont compilés une fois, ici, et le résultat est commité dans
// src/courriel/gabarits.genere.ts. La CI vérifie qu'il est à jour (git diff).
// L'image de production n'embarque donc pas mjml, et l'envoi ne bloque pas la boucle d'événements.
//
// Un gabarit = un fichier .mjml et un fichier .txt de même nom. Les fichiers qui
// commencent par « _ » sont des fragments inclus.

const DOSSIER = path.resolve(import.meta.dirname, '../src/courriel/gabarits')
const CIBLE = path.resolve(
  import.meta.dirname,
  '../src/courriel/gabarits.genere.ts'
)

// Mentions qui prouvent que l'en-tête et le pied de page ont bien été inclus.
const MARQUEURS = [
  '{{marque}}',
  '{{organisation}}',
  'github.com/relaytour/relaytour',
]

// MJML strict refuse une variable dans un attribut de couleur. Les gabarits écrivent
// des couleurs sentinelles, remplacées ici par une variable après compilation.
// L'organisation fournit les valeurs à l'envoi (lib/organisation.ts, variablesOrganisation).
const COULEURS_SENTINELLES: Record<string, string> = {
  '#010101': 'couleurEncre',
  '#020202': 'couleurPrimaire',
  '#030303': 'couleurAccent',
  '#040404': 'couleurSol',
}

// Variables fournies par l'organisation, hors de la parité HTML / texte et hors
// de la liste des variables métier du gabarit.
const VARIABLES_ORGANISATION = new Set([
  'organisation',
  // La marque de l'en-tête : le logo PNG de l'organisation ou de l'activité, sinon
  // son nom. rendre() la compose ; la partie texte garde le nom.
  'marque',
  'logoUrl',
  ...Object.values(COULEURS_SENTINELLES),
])

function variables(source: string): string[] {
  return [
    ...new Set([...source.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1] ?? '')),
  ]
    .filter(v => !VARIABLES_ORGANISATION.has(v))
    .sort()
}

function poserSentinelles(html: string): string {
  let resultat = html
  for (const [sentinelle, variable] of Object.entries(COULEURS_SENTINELLES)) {
    resultat = resultat.replaceAll(
      new RegExp(sentinelle, 'gi'),
      `{{${variable}}}`
    )
  }
  return resultat
}

// MJML 5 remplace en silence une inclusion refusée par un commentaire.
// L'assemblage se fait donc par substitution textuelle, qui lève si un fragment manque.
function assembler(source: string): string {
  return source.replaceAll(
    /[ \t]*<mj-include\s+path="\.\/([\w-]+)\.mjml"\s*\/>\n?/g,
    (_m, nom: string) =>
      `${readFileSync(path.join(DOSSIER, `${nom}.mjml`), 'utf8').trimEnd()}\n`
  )
}

const noms = readdirSync(DOSSIER)
  .filter(f => f.endsWith('.mjml') && !f.startsWith('_'))
  .map(f => f.replace(/\.mjml$/, ''))
  .sort()

if (noms.length === 0) throw new Error(`Aucun gabarit dans ${DOSSIER}.`)

const entrees = await Promise.all(
  noms.map(async nom => {
    const source = path.join(DOSSIER, `${nom}.mjml`)
    // mjml2html est asynchrone en version 5, alors que ses types le décrivent synchrone.
    // Sans await, `errors` vaudrait undefined et le contrôle ne vérifierait rien.
    const { html: htmlCompile, errors } = await Promise.resolve(
      mjml2html(assembler(readFileSync(source, 'utf8')), {
        filePath: source,
        validationLevel: 'strict',
        keepComments: false,
        minify: false,
      })
    )
    if (errors.length > 0) {
      throw new Error(
        `${nom}.mjml : ${errors.map(e => e.formattedMessage).join(' · ')}`
      )
    }
    const html = poserSentinelles(htmlCompile)
    const texte = readFileSync(path.join(DOSSIER, `${nom}.txt`), 'utf8')

    for (const [partie, contenu] of [
      ['html', html],
      ['texte', texte],
    ] as const) {
      for (const marqueur of MARQUEURS) {
        if (!contenu.includes(marqueur)) {
          throw new Error(
            `${nom} (${partie}) : l'en-tête ou le pied de page manque (« ${marqueur} » absent).`
          )
        }
      }
    }

    const dansHtml = variables(html)
    const dansTexte = variables(texte)
    if (dansHtml.join(',') !== dansTexte.join(',')) {
      throw new Error(
        `${nom} : variables différentes entre HTML [${dansHtml.join(', ')}] et texte [${dansTexte.join(', ')}].`
      )
    }

    return [
      `  '${nom}': {`,
      `    html: ${JSON.stringify(html)},`,
      `    texte: ${JSON.stringify(texte)},`,
      `    variables: ${JSON.stringify(dansHtml)},`,
      '  },',
    ].join('\n')
  })
)

writeFileSync(
  CIBLE,
  `// Généré par scripts/gabarits-courriel.ts. Ne pas modifier à la main.
// Régénérer : yarn workspace @relaytour/server gabarits:print

export const GABARITS = {
${entrees.join('\n')}
} as const

export type NomGabarit = keyof typeof GABARITS
`,
  'utf8'
)

console.log(`✔ ${noms.length} gabarit(s) compilé(s) : ${noms.join(', ')}`)
