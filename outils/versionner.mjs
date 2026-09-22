#!/usr/bin/env node
// versionner : journal des changements du dépôt Relaytour.
//
// Chaque changement visible porte un fragment dans notes/fragments/. Le script
// contrôle ces fragments (`valider`), les compile en un fichier JSON par cible
// (`compiler`) et en crée de nouveaux (`noter`). Il prépare aussi une version
// (`publier`) et rédige le texte de sa release (`release`). Il n'a aucune
// dépendance.
//
// Relaytour porte un seul numéro de version, celui du package.json racine. Les
// paquets du serveur et de l'espace organisateur en portent une copie. Un
// fragment sans champ `version` appartient à la prochaine version ; `publier`
// lui attribue le numéro qu'elle calcule.

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

/** Les cibles du dépôt, c'est-à-dire les parties décrites par les notes. */
const CIBLES = ['serveur', 'orga']
const NOM_DE_CIBLE = { serveur: 'Serveur', orga: 'Espace organisateur' }
/** Le premier porte le numéro du produit, les autres en portent une copie. */
const PAQUETS_VERSIONNES = [
  'package.json',
  'packages/server/package.json',
  'packages/orga/package.json',
]
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
const CHAMPS = ['cible', 'type', 'audience', 'etat', 'version', 'fr']
/** Les audiences reprises dans le texte d'une release. */
const AUDIENCES_PUBLIEES = ['organisateurs', 'public']

// Le script vit dans outils/ mais lit et écrit à la racine du dépôt. Les tests
// le lancent sur un dépôt temporaire par VERSIONNER_RACINE.
const RACINE =
  process.env.VERSIONNER_RACINE ??
  resolve(dirname(fileURLToPath(import.meta.url)), '..')
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

const FORME_VERSION = /^\d+\.\d+\.\d+$/

/** [x, y, z] d'un numéro déjà contrôlé. */
function morceaux(version) {
  return version.split('.').map(Number)
}

/** Négatif si a précède b, positif si a suit b, 0 s'ils sont égaux. */
function comparer(a, b) {
  const [ma, mb] = [morceaux(a), morceaux(b)]
  for (let i = 0; i < 3; i += 1) if (ma[i] !== mb[i]) return ma[i] - mb[i]
  return 0
}

/** Le numéro du produit, lu dans le package.json racine et nulle part ailleurs. */
function versionRacine() {
  const [racine] = PAQUETS_VERSIONNES
  const version = lireJson(racine).version
  if (typeof version !== 'string' || !FORME_VERSION.test(version)) {
    mourir(`${racine} : « ${version} » n'est pas un numéro x.y.z`)
  }
  return version
}

/**
 * Le numéro du produit, une fois vérifié que les paquets du serveur et de
 * l'espace organisateur portent le même. « publier » ne passe pas par ici : il
 * réaligne les copies, y compris quand l'une d'elles a divergé.
 */
function versionDuProduit() {
  const [racine, ...copies] = PAQUETS_VERSIONNES
  const version = versionRacine()
  for (const relatif of copies) {
    const copie = lireJson(relatif).version
    if (copie !== version) {
      mourir(
        `${relatif} porte « ${copie} » au lieu de « ${version} » (${racine}). Lancez « publier » pour relever les numéros.`
      )
    }
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
function controler(fragment, produit) {
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

  if (c.version !== undefined) {
    if (typeof c.version !== 'string' || !FORME_VERSION.test(c.version)) {
      erreurs.push(`« version » : « ${c.version} » n'est pas un numéro x.y.z`)
    } else if (produit && comparer(c.version, produit) > 0) {
      // Seul `publier` écrit ce champ, avec le numéro qu'il pose aussi dans
      // les package.json.
      erreurs.push(
        `« version » ${c.version} dépasse la version du produit (${produit})`
      )
    }
  }

  for (const cle of Object.keys(c)) {
    if (!CHAMPS.includes(cle)) erreurs.push(`champ « ${cle} » inconnu`)
  }

  return erreurs
}

function commandeValider() {
  const produit = versionDuProduit()
  const fragments = lireFragments()
  console.log(`versionner : ${nomDuProjet()} ${produit}`)
  console.log(
    `notes/fragments : ${fragments.length} fragment${fragments.length > 1 ? 's' : ''}`
  )

  // Le compte porte sur les fragments en défaut, pas sur les messages.
  let nErreurs = 0
  for (const fragment of fragments) {
    const erreurs = controler(fragment, produit)
    const etiquette = fragment.id.padEnd(46)
    if (erreurs.length) {
      nErreurs += 1
      console.log(`  ${ECHEC} ${etiquette} ${erreurs[0]}`)
      for (const reste of erreurs.slice(1)) console.log(`      ${reste}`)
    } else {
      const c = fragment.champs
      const etat = c.etat && c.etat !== 'prevu' ? ` (${c.etat})` : ''
      const version = c.version ?? 'prochaine'
      console.log(
        `  ${OK} ${etiquette} ${version} ${c.type} / ${c.audience}${etat}`
      )
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

/** Les fragments qui entrent dans le journal : tous sauf les retirés. */
function publies(fragments) {
  return fragments.filter(f => f.champs.etat !== 'retire')
}

/**
 * Le journal d'une cible, groupé par version : la prochaine version en tête
 * (fragments sans numéro), puis les versions publiées de la plus récente à la
 * plus ancienne. Dans un groupe, les notes vont de la plus récente à la plus
 * ancienne. Rien ne dépend de l'heure d'exécution, pour que deux compilations
 * successives donnent le même fichier.
 */
function compilerCible(cible, fragments, produit) {
  const groupes = new Map()
  for (const fragment of publies(fragments)) {
    if (fragment.champs.cible !== cible) continue
    const version = fragment.champs.version ?? null
    if (!groupes.has(version)) groupes.set(version, [])
    groupes.get(version).push(entree(fragment))
  }
  const numeros = [...groupes.keys()]
    .filter(version => version !== null)
    .sort((a, b) => comparer(b, a))
  const versions = [...(groupes.has(null) ? [null] : []), ...numeros].map(
    version => ({ version, notes: groupes.get(version).reverse() })
  )
  return {
    schemaVersion: 3,
    projet: nomDuProjet(),
    cible,
    version: produit,
    versions,
  }
}

/** Arrête le script si un fragment est invalide. */
function exigerFragmentsValides(fragments, produit) {
  const fautifs = fragments.filter(f => controler(f, produit).length)
  if (fautifs.length) {
    mourir(
      `${fautifs.length} fragment(s) invalide(s), rien n'a été écrit. Lancez « valider ».`
    )
  }
}

function ecrireJournaux(fragments, produit) {
  mkdirSync(DOSSIER_NOTES, { recursive: true })
  for (const cible of CIBLES) {
    const journal = compilerCible(cible, fragments, produit)
    const chemin = join(DOSSIER_NOTES, `notes-de-version.${cible}.json`)
    writeFileSync(chemin, `${JSON.stringify(journal, null, 2)}\n`)
    const nNotes = journal.versions.reduce((n, v) => n + v.notes.length, 0)
    console.log(
      `${OK} ${chemin.slice(RACINE.length + 1)} : version ${produit}, ${nNotes} note(s)`
    )
  }
}

function commandeCompiler() {
  const produit = versionDuProduit()
  const fragments = lireFragments()
  exigerFragmentsValides(fragments, produit)
  ecrireJournaux(fragments, produit)
}

// ───────────────────────────────────────────────────────────────────────────
// Publication d'une version
// ───────────────────────────────────────────────────────────────────────────

/**
 * Les fragments que la prochaine version publiera : sans numéro, ni retirés ni
 * différés.
 */
function fragmentsAPublier(fragments) {
  return fragments.filter(
    f =>
      f.champs.version === undefined &&
      f.champs.etat !== 'retire' &&
      f.champs.etat !== 'differe'
  )
}

/**
 * Le numéro suivant, d'après le type le plus fort des fragments à publier.
 * Avant la 1.0, une rupture ou une fonctionnalité fait monter le deuxième
 * chiffre et tout le reste le troisième. À partir de la 1.0, une rupture fait
 * monter le premier chiffre.
 */
function numeroSuivant(actuelle, types) {
  const [x, y, z] = morceaux(actuelle)
  const rupture = types.includes('rupture')
  const fonctionnalite = types.includes('fonctionnalite')
  if (x >= 1 && rupture) return `${x + 1}.0.0`
  if (rupture || fonctionnalite) return `${x}.${y + 1}.0`
  return `${x}.${y}.${z + 1}`
}

/** Ajoute `version: x.y.z` au frontmatter, juste avant le bloc `fr:`. */
function rattacher(fragment, version) {
  const texte = readFileSync(fragment.chemin, 'utf8')
  const suite = texte.replace(/^fr:$/m, `version: ${version}\nfr:`)
  if (suite === texte) mourir(`${fragment.relatif} : ligne « fr: » introuvable`)
  writeFileSync(fragment.chemin, suite)
}

/** Remplace le champ `version` d'un package.json sans toucher au reste. */
function relever(relatif, version) {
  const chemin = join(RACINE, relatif)
  const texte = readFileSync(chemin, 'utf8')
  const suite = texte.replace(
    /^(\s*"version"\s*:\s*)"[^"]*"/m,
    `$1"${version}"`
  )
  if (suite === texte && lireJson(relatif).version !== version) {
    mourir(`${relatif} : champ « version » introuvable`)
  }
  writeFileSync(chemin, suite)
}

function commandePublier(options) {
  const actuelle = versionRacine()
  const fragments = lireFragments()
  exigerFragmentsValides(fragments, actuelle)

  const aPublier = fragmentsAPublier(fragments)
  if (!aPublier.length) {
    mourir(`aucun fragment à publier depuis la version ${actuelle}`)
  }

  const proposee = numeroSuivant(
    actuelle,
    aPublier.map(f => f.champs.type)
  )
  const version = options.version ?? proposee
  if (!FORME_VERSION.test(version)) {
    mourir(`--version « ${version} » n'est pas un numéro x.y.z`)
  }
  if (comparer(version, actuelle) <= 0) {
    mourir(`--version ${version} doit suivre la version actuelle ${actuelle}`)
  }

  const simulation = options.simulation === true
  console.log(
    `Version ${actuelle} → ${version}${version === proposee ? '' : ` (proposée : ${proposee})`}${simulation ? ', simulation : rien ne sera écrit' : ''}`
  )
  for (const cible of CIBLES) {
    const notes = aPublier.filter(f => f.champs.cible === cible)
    console.log(`  ${NOM_DE_CIBLE[cible]} : ${notes.length} note(s)`)
    for (const f of notes)
      console.log(`    ${f.champs.type.padEnd(15)} ${f.id}`)
  }
  if (simulation) return

  for (const fragment of aPublier) rattacher(fragment, version)
  for (const relatif of PAQUETS_VERSIONNES) relever(relatif, version)
  ecrireJournaux(lireFragments(), version)
  console.log(
    `${OK} Relisez le diff, puis ouvrez la PR « chore(version): ${version} » vers develop.`
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Texte d'une release
// ───────────────────────────────────────────────────────────────────────────

/** Une note en liste Markdown : le titre en gras, le texte à la ligne. */
function ligne(titre, texte) {
  return `- **${titre}**\\\n  ${texte}`
}

/** Les fragments d'un groupe, triés par type puis du plus récent au plus ancien. */
function trier(fragments) {
  return [...fragments].sort(
    (a, b) =>
      TYPES.indexOf(a.champs.type) - TYPES.indexOf(b.champs.type) ||
      b.id.localeCompare(a.id)
  )
}

/**
 * Le Markdown de la release d'une version. Les consignes de migration de
 * toutes les ruptures viennent en tête, quelle que soit leur audience : une
 * installation doit les appliquer. Suivent les notes destinées aux
 * organisateurs et au public, cible par cible.
 */
function texteDeRelease(fragments, version) {
  const notes = publies(fragments).filter(f => f.champs.version === version)
  const sections = []

  const ruptures = trier(notes.filter(f => f.champs.type === 'rupture'))
  if (ruptures.length) {
    sections.push(
      [
        '## Consignes de migration',
        '',
        ...ruptures.map(f =>
          ligne(
            `${f.champs.fr.titre} (${NOM_DE_CIBLE[f.champs.cible]})`,
            f.champs.fr.migration
          )
        ),
      ].join('\n')
    )
  }

  for (const cible of ['orga', 'serveur']) {
    const lignes = trier(
      notes.filter(
        f =>
          f.champs.cible === cible &&
          AUDIENCES_PUBLIEES.includes(f.champs.audience)
      )
    ).map(f => ligne(f.champs.fr.titre, f.champs.fr.texte))
    if (lignes.length) {
      sections.push([`## ${NOM_DE_CIBLE[cible]}`, '', ...lignes].join('\n'))
    }
  }

  if (!sections.length) {
    sections.push(
      'Cette version ne contient que des changements internes au projet.'
    )
  }
  return `${sections.join('\n\n')}\n`
}

function commandeRelease(options) {
  const produit = versionDuProduit()
  const version = options.version ?? produit
  if (!FORME_VERSION.test(version)) {
    mourir(`--version « ${version} » n'est pas un numéro x.y.z`)
  }
  const fragments = lireFragments()
  exigerFragmentsValides(fragments, produit)
  if (!fragments.some(f => f.champs.version === version)) {
    mourir(`aucun fragment ne porte la version ${version}`)
  }
  process.stdout.write(texteDeRelease(fragments, version))
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
      Écrit notes/notes-de-version.<cible>.json à partir des fragments, groupés
      par version, avec le numéro du package.json racine. Le résultat est
      idempotent : c'est un contrat commité, vérifié en CI par
      git diff --exit-code.

  publier [--version x.y.z] [--simulation]
      Prépare la prochaine version : propose le numéro d'après les types des
      fragments sans version, leur attribue ce numéro, relève les package.json
      et compile. --simulation affiche le résultat sans rien écrire.

  release [--version x.y.z]
      Écrit sur la sortie standard le texte de la release d'une version (par
      défaut la version actuelle), à partir de ses fragments.`

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
      version: { type: 'string' },
      simulation: { type: 'boolean' },
    },
  })

  switch (commande) {
    case 'noter':
      return commandeNoter(values)
    case 'valider':
      return commandeValider()
    case 'compiler':
      return commandeCompiler()
    case 'publier':
      return commandePublier(values)
    case 'release':
      return commandeRelease(values)
    default:
      console.log(USAGE)
      process.exit(commande ? 1 : 0)
  }
}

principal()
