#!/usr/bin/env node
// versionner : journal des changements du dépôt Relaytour.
//
// Chaque changement visible porte un fragment dans notes/fragments/. Le script
// contrôle ces fragments (`valider`), les compile en un fichier JSON par cible
// (`compiler`) et en crée de nouveaux (`noter`). Il n'a aucune dépendance.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

/** Les cibles du dépôt et le paquet qui porte la version de chacune. */
const CIBLES = ['serveur', 'orga']
const PAQUET_DE_CIBLE = {
  serveur: 'packages/server/package.json',
  orga: 'packages/orga/package.json',
}
const TYPES = [
  'fonctionnalite',
  'correctif',
  'rupture',
  'securite',
  'performance',
  'interne',
]
const AUDIENCES = ['organisateurs', 'interne', 'public']
// `retire` sort du journal compilé ; `differe` y reste avec son état.
const ETATS = ['prevu', 'differe', 'retire']
const CHAMPS = ['cible', 'type', 'audience', 'etat', 'fr']

// Le script vit dans outils/ mais lit et écrit à la racine du dépôt.
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER_NOTES = join(RACINE, 'notes')
const DOSSIER_FRAGMENTS = join(DOSSIER_NOTES, 'fragments')

const OK = '✔'
const ECHEC = '✖'

function mourir(message) {
  console.error(`${ECHEC} ${message}`)
  process.exit(1)
}

// ───────────────────────────────────────────────────────────────────────────
// Analyseur YAML restreint au frontmatter des fragments
//
// Il accepte des mappages imbriqués, des scalaires nus ou entre guillemets et
// les blocs `>-`, `>` et `|`. Il refuse les listes, le style de flux, les
// ancres et les tabulations. Toute construction inconnue produit une erreur
// nommée plutôt qu'une valeur devinée. Les scalaires restent des chaînes.
// ───────────────────────────────────────────────────────────────────────────

function analyserScalaire(brut) {
  if (brut === 'true') return true
  if (brut === 'false') return false
  if (brut === 'null' || brut === '~' || brut === '') return null
  const guillemets = brut.match(/^"(.*)"$/) || brut.match(/^'(.*)'$/)
  return guillemets ? guillemets[1] : brut
}

function analyserYaml(texte, origine) {
  const lignes = texte.split('\n')
  const racine = {}
  const pile = [{ indentation: -1, objet: racine }]
  let i = 0

  const faute = (n, message) => mourir(`${origine}:${n + 1} : ${message}`)

  while (i < lignes.length) {
    const ligne = lignes[i]
    if (ligne.trim() === '' || ligne.trim().startsWith('#')) {
      i += 1
      continue
    }

    if (/^[ ]*\t/.test(ligne)) faute(i, "tabulation dans l'indentation")
    const indentation = ligne.length - ligne.trimStart().length
    const corps = ligne.trim()

    const paire = corps.match(/^("[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)\s*:\s*(.*)$/)
    if (!paire) faute(i, `ligne incomprise : « ${corps} »`)

    const cle = String(analyserScalaire(paire[1]))

    // Un « # » dans une valeur nue est ambigu : commentaire ou texte ? Le
    // script refuse de trancher. Une valeur citée garde son contenu entier.
    let valeurBrute = paire[2].trim()
    const cite = valeurBrute.match(/^"([^"]*)"|^'([^']*)'/)
    if (cite) {
      const apres = valeurBrute.slice(cite[0].length).trim()
      if (apres !== '' && !apres.startsWith('#')) {
        faute(i, `texte inattendu après la valeur citée : « ${apres} »`)
      }
      valeurBrute = cite[0]
    } else if (/\s#/.test(valeurBrute)) {
      faute(
        i,
        '« # » ambigu dans une valeur non citée : citez-la ou passez en bloc « >- »'
      )
    }
    if (/^[{[]/.test(valeurBrute)) {
      faute(i, 'style de flux non accepté : écrivez une clé par ligne')
    }

    while (pile.length > 1 && indentation <= pile.at(-1).indentation) pile.pop()
    const parent = pile[pile.length - 1].objet
    if (Object.hasOwn(parent, cle)) faute(i, `clé « ${cle} » en double`)

    if (valeurBrute === '>-' || valeurBrute === '>' || valeurBrute === '|') {
      // Bloc : les lignes plus indentées forment la valeur. `>` et `>-`
      // joignent par une espace, `|` conserve les retours à la ligne.
      const morceaux = []
      let j = i + 1
      while (j < lignes.length) {
        const suivante = lignes[j]
        if (suivante.trim() === '') {
          morceaux.push('')
          j += 1
          continue
        }
        const indentationSuivante =
          suivante.length - suivante.trimStart().length
        if (indentationSuivante <= indentation) break
        morceaux.push(suivante.trim())
        j += 1
      }
      while (morceaux.at(-1) === '') morceaux.pop()
      parent[cle] =
        valeurBrute === '|' ? morceaux.join('\n') : morceaux.join(' ').trim()
      i = j
      continue
    }

    if (valeurBrute === '') {
      // « clé: » suivi d'un bloc plus indenté ouvre un mappage ; « clé: »
      // seul vaut `null`, comme en YAML.
      let j = i + 1
      while (j < lignes.length && /^\s*(#|$)/.test(lignes[j])) j += 1
      const suit =
        j < lignes.length &&
        lignes[j].length - lignes[j].trimStart().length > indentation
      if (suit) {
        const enfant = {}
        parent[cle] = enfant
        pile.push({ indentation, objet: enfant })
      } else {
        parent[cle] = null
      }
      i += 1
      continue
    }

    parent[cle] = analyserScalaire(valeurBrute)
    i += 1
  }

  return racine
}

// ───────────────────────────────────────────────────────────────────────────
// Lectures
// ───────────────────────────────────────────────────────────────────────────

function lireJson(relatif) {
  const chemin = join(RACINE, relatif)
  if (!existsSync(chemin)) mourir(`${relatif} absent`)
  return JSON.parse(readFileSync(chemin, 'utf8'))
}

function nomDuProjet() {
  return lireJson('package.json').name ?? basename(RACINE)
}

/** La version d'une cible est le champ `version` de son package.json. */
function versionDeCible(cible) {
  const relatif = PAQUET_DE_CIBLE[cible]
  const version = lireJson(relatif).version
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    mourir(`${relatif} : « ${version} » n'est pas un numéro x.y.z`)
  }
  return version
}

/** Fragments triés par nom, donc par date puis par cible. */
function lireFragments() {
  if (!existsSync(DOSSIER_FRAGMENTS)) return []
  return readdirSync(DOSSIER_FRAGMENTS)
    .filter(nom => nom.endsWith('.md'))
    .sort()
    .map(nom => lireFragment(join(DOSSIER_FRAGMENTS, nom)))
}

function lireFragment(chemin) {
  const texte = readFileSync(chemin, 'utf8')
  const bornes = texte.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  const relatif = chemin.slice(RACINE.length + 1)
  if (!bornes) mourir(`${relatif} : pas de frontmatter délimité par « --- »`)

  const id = basename(chemin, '.md')
  const date = id.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    mourir(`${relatif} : le nom doit commencer par AAAA-MM-JJ`)
  }
  return { id, date, chemin, relatif, champs: analyserYaml(bornes[1], relatif) }
}

// ───────────────────────────────────────────────────────────────────────────
// Validation
// ───────────────────────────────────────────────────────────────────────────

/** @returns {string[]} les erreurs du fragment */
function controler(fragment) {
  const erreurs = []
  const c = fragment.champs
  const attendu = (nom, valeur, liste) => {
    if (valeur === undefined) erreurs.push(`« ${nom} » manquant`)
    else if (!liste.includes(valeur)) {
      erreurs.push(
        `valeur « ${valeur} » inconnue pour « ${nom} » (${liste.join(', ')})`
      )
    }
  }

  attendu('cible', c.cible, CIBLES)
  attendu('type', c.type, TYPES)
  attendu('audience', c.audience, AUDIENCES)
  if (c.etat !== undefined) attendu('etat', c.etat, ETATS)

  if (
    c.cible !== undefined &&
    !fragment.id.slice(11).startsWith(`${c.cible}-`)
  ) {
    erreurs.push(`le nom du fichier ne porte pas la cible « ${c.cible} »`)
  }

  if (!c.fr || typeof c.fr !== 'object') {
    erreurs.push('bloc « fr » manquant')
  } else {
    if (!c.fr.titre) erreurs.push('« fr.titre » manquant')
    if (!c.fr.texte) erreurs.push('« fr.texte » manquant')
    // Une rupture sans consigne de migration annonce un problème sans dire
    // quoi faire.
    if (c.type === 'rupture' && !c.fr.migration) {
      erreurs.push('« fr.migration » obligatoire quand type est « rupture »')
    }
  }

  for (const cle of Object.keys(c)) {
    if (!CHAMPS.includes(cle)) erreurs.push(`champ « ${cle} » inconnu`)
  }

  return erreurs
}

function commandeValider() {
  const fragments = lireFragments()
  console.log(`versionner : ${nomDuProjet()}`)
  console.log(
    `notes/fragments : ${fragments.length} fragment${fragments.length > 1 ? 's' : ''}`
  )

  // Le compte porte sur les fragments en défaut, pas sur les messages.
  let nErreurs = 0
  for (const fragment of fragments) {
    const erreurs = controler(fragment)
    const etiquette = fragment.id.padEnd(46)
    if (erreurs.length) {
      nErreurs += 1
      console.log(`  ${ECHEC} ${etiquette} ${erreurs[0]}`)
      for (const reste of erreurs.slice(1)) console.log(`      ${reste}`)
    } else {
      const c = fragment.champs
      const etat = c.etat && c.etat !== 'prevu' ? ` (${c.etat})` : ''
      console.log(`  ${OK} ${etiquette} ${c.type} / ${c.audience}${etat}`)
    }
  }

  if (nErreurs === 0) {
    if (fragments.length) console.log('Aucune erreur.')
  } else {
    console.log(`${nErreurs} erreur${nErreurs > 1 ? 's' : ''}.`)
  }
  process.exit(nErreurs ? 1 : 0)
}

// ───────────────────────────────────────────────────────────────────────────
// Compilation
// ───────────────────────────────────────────────────────────────────────────

function entree(fragment) {
  const c = fragment.champs
  return {
    id: fragment.id,
    date: fragment.date,
    type: c.type,
    audience: c.audience,
    etat: c.etat ?? 'prevu',
    fr: {
      titre: c.fr.titre,
      texte: c.fr.texte,
      migration: c.fr.migration ?? null,
    },
  }
}

/**
 * Le journal d'une cible : ses fragments non retirés, du plus récent au plus
 * ancien. Rien ne dépend de l'heure d'exécution, pour que deux compilations
 * successives donnent le même fichier.
 */
function compilerCible(cible, fragments) {
  const notes = fragments
    .filter(f => f.champs.cible === cible && f.champs.etat !== 'retire')
    .map(entree)
    .reverse()
  return {
    schemaVersion: 2,
    projet: nomDuProjet(),
    cible,
    version: versionDeCible(cible),
    notes,
  }
}

function commandeCompiler() {
  const fragments = lireFragments()
  const fautifs = fragments.filter(f => controler(f).length)
  if (fautifs.length) {
    mourir(
      `${fautifs.length} fragment(s) invalide(s), rien n'a été écrit. Lancez « valider ».`
    )
  }
  mkdirSync(DOSSIER_NOTES, { recursive: true })
  for (const cible of CIBLES) {
    const journal = compilerCible(cible, fragments)
    const chemin = join(DOSSIER_NOTES, `notes-de-version.${cible}.json`)
    writeFileSync(chemin, `${JSON.stringify(journal, null, 2)}\n`)
    console.log(
      `${OK} ${chemin.slice(RACINE.length + 1)} : version ${journal.version}, ${journal.notes.length} note(s)`
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Création d'un fragment
// ───────────────────────────────────────────────────────────────────────────

function slug(titre) {
  return titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function commandeNoter(options) {
  const verifierChoix = (nom, valeur, liste) => {
    if (!valeur) mourir(`--${nom} requis (${liste.join(', ')})`)
    if (!liste.includes(valeur)) {
      mourir(`--${nom} « ${valeur} » inconnu (${liste.join(', ')})`)
    }
  }
  verifierChoix('cible', options.cible, CIBLES)
  verifierChoix('type', options.type, TYPES)
  verifierChoix('audience', options.audience, AUDIENCES)
  if (!options.titre) mourir('--titre requis')

  const morceau = slug(options.titre)
  if (!morceau) {
    mourir(`--titre « ${options.titre} » ne donne aucun slug`)
  }
  const date = new Date().toISOString().slice(0, 10)
  const nom = `${date}-${options.cible}-${morceau}.md`
  const chemin = join(DOSSIER_FRAGMENTS, nom)
  if (existsSync(chemin)) mourir(`${nom} existe déjà`)
  mkdirSync(DOSSIER_FRAGMENTS, { recursive: true })

  // Le texte reste vide : `valider` refuse un fragment sans texte, ce qui
  // évite qu'une amorce parte telle quelle dans le journal. Le titre est
  // écrit en bloc « >- », où « # », guillemets et deux-points sont libres.
  const blocFr = [
    'fr:',
    '  titre: >-',
    `    ${options.titre}`,
    '  texte: >-',
    ...(options.type === 'rupture' ? ['  migration: >-'] : []),
  ].join('\n')

  writeFileSync(
    chemin,
    [
      '---',
      `cible: ${options.cible}`,
      `type: ${options.type}`,
      `audience: ${options.audience}`,
      'etat: prevu',
      blocFr,
      '---',
      '',
      'Sous le frontmatter : le détail technique, jamais compilé.',
      '',
    ].join('\n')
  )

  console.log(`${OK} ${chemin.slice(RACINE.length + 1)}`)
  console.log(
    "  Ouvrez le fichier et écrivez ce que le lecteur peut faire, pas comment c'est implémenté."
  )
}

// ───────────────────────────────────────────────────────────────────────────

const USAGE = `versionner : journal des changements du dépôt

  noter --cible <c> --type <t> --audience <a> --titre "…"
      Crée un fragment dans notes/fragments/.
      cibles : ${CIBLES.join(', ')}
      types : ${TYPES.join(', ')}
      audiences : ${AUDIENCES.join(', ')}

  valider
      Contrôle le schéma et les énumérations de chaque fragment, et exige une
      consigne de migration sur une rupture. Sort en 1 dès une erreur.

  compiler
      Écrit notes/notes-de-version.<cible>.json à partir des fragments, avec la
      version lue dans le package.json de chaque cible. Le résultat est
      idempotent : c'est un contrat commité, vérifié en CI par
      git diff --exit-code.`

function principal() {
  const [commande, ...reste] = process.argv.slice(2)
  const { values } = parseArgs({
    args: reste,
    allowPositionals: true,
    strict: false,
    options: {
      cible: { type: 'string' },
      type: { type: 'string' },
      audience: { type: 'string' },
      titre: { type: 'string' },
    },
  })

  switch (commande) {
    case 'noter':
      return commandeNoter(values)
    case 'valider':
      return commandeValider()
    case 'compiler':
      return commandeCompiler()
    default:
      console.log(USAGE)
      process.exit(commande ? 1 : 0)
  }
}

principal()
