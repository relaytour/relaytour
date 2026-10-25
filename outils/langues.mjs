#!/usr/bin/env node
// langues : état des catalogues de traduction de l'espace organisateur et du serveur
// (ADR 0047).
//
//   node outils/langues.mjs etat            affiche le taux de traduction de chaque langue
//   node outils/langues.mjs etat --ecrire   écrit aussi packages/orga/src/locales/etat.json
//   node outils/langues.mjs verifier en     échoue si un message anglais reste à traduire,
//                                           dans l'espace organisateur ou dans le serveur
//
// L'espace organisateur lit etat.json pour ne proposer que les langues traduites à
// SEUIL % au moins. `yarn workspace @relaytour/orga langues:extraire` le réécrit
// après chaque extraction, et la CI vérifie qu'il est à jour. Aucune dépendance.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Les tests de versionner lancent ce script sur un dépôt temporaire (LANGUES_RACINE).
const RACINE =
  process.env.LANGUES_RACINE ??
  resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOGUES = join(RACINE, 'packages/orga/src/locales')
const CATALOGUES_SERVEUR = join(RACINE, 'packages/server/src/locales')
export const SEUIL = 90

/** Décode une chaîne PO entre guillemets : `"a\"b"` donne `a"b`. */
function chaine(ligne) {
  return JSON.parse(ligne.slice(ligne.indexOf('"')))
}

/**
 * Lit les entrées d'un catalogue PO : `msgid` et `msgstr`, suites de lignes
 * comprises. L'en-tête (`msgid ""`) et les entrées obsolètes (`#~`) ne comptent pas.
 */
export function lireCatalogue(texte) {
  const entrees = []
  let courante = null
  let champ = null
  const clore = () => {
    if (courante !== null && courante.msgid !== '') entrees.push(courante)
    courante = null
    champ = null
  }
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim()
    if (ligne === '') {
      clore()
    } else if (ligne.startsWith('msgid ')) {
      if (courante !== null && champ === 'msgstr') clore()
      courante = { msgid: chaine(ligne), msgstr: '' }
      champ = 'msgid'
    } else if (ligne.startsWith('msgstr ')) {
      if (courante !== null) {
        courante.msgstr = chaine(ligne)
        champ = 'msgstr'
      }
    } else if (ligne.startsWith('"') && courante !== null && champ !== null) {
      courante[champ] += chaine(ligne)
    }
  }
  clore()
  return entrees
}

/** Nombre de messages et de messages traduits de chaque langue. */
export function etatDesCatalogues(dossier = CATALOGUES) {
  const etat = {}
  for (const langue of readdirSync(dossier, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()) {
    const entrees = lireCatalogue(
      readFileSync(join(dossier, langue, 'messages.po'), 'utf8')
    )
    etat[langue] = {
      messages: entrees.length,
      traduits: entrees.filter(e => e.msgstr !== '').length,
    }
  }
  return etat
}

/** Taux de traduction en pour cent, arrondi vers le bas ; 0 sans message. */
export function taux({ messages, traduits }) {
  return messages === 0 ? 0 : Math.floor((traduits * 100) / messages)
}

function main(argv) {
  const [commande, ...reste] = argv
  const etat = etatDesCatalogues()
  const paquets = {
    orga: etat,
    serveur: etatDesCatalogues(CATALOGUES_SERVEUR),
  }
  if (commande === 'etat') {
    for (const [paquet, etats] of Object.entries(paquets)) {
      for (const [langue, e] of Object.entries(etats)) {
        console.log(
          `${paquet.padEnd(8)} ${langue.padEnd(6)} ${String(taux(e)).padStart(3)} %  ${e.traduits} / ${e.messages}`
        )
      }
    }
    if (reste.includes('--ecrire')) {
      writeFileSync(
        join(CATALOGUES, 'etat.json'),
        `${JSON.stringify(etat, null, 2)}\n`
      )
    }
    return 0
  }
  if (commande === 'verifier') {
    const langue = reste[0]
    let echec = false
    for (const [paquet, etats] of Object.entries(paquets)) {
      const e = etats[langue]
      if (e === undefined) {
        console.error(
          `✖ ${paquet} : aucun catalogue pour la langue « ${langue} ».`
        )
        echec = true
      } else if (e.traduits < e.messages) {
        console.error(
          `✖ ${paquet} : ${e.messages - e.traduits} messages restent à traduire en « ${langue} ».`
        )
        echec = true
      } else {
        console.log(
          `✔ ${paquet} : catalogue « ${langue} » complet, ${e.messages} messages.`
        )
      }
    }
    return echec ? 1 : 0
  }
  console.error(
    'Usage : node outils/langues.mjs etat [--ecrire] | verifier <langue>'
  )
  return 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
