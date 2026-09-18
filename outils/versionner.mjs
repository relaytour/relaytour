#!/usr/bin/env node
// versionner 1.0.0 — notes de version et trains de version.
//
// L'outil est autonome : zéro dépendance, Node 24 suffit. `verifier` imprime
// l'empreinte de cette copie, pour repérer une dérive si l'outil est recopié
// dans un autre dépôt.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const VERSION_OUTIL = '1.0.0'

/**
 * Le VOCABULAIRE de cibles du parc — pas les cibles de ce dépôt-ci, qui sont les
 * clés de `versions.json` et elles seules. Cette liste ne sert qu'à reconnaître
 * la confusion cible/audience et à la nommer : `admin` y figure justement parce
 * qu'il en est le cas archétypal, et il y resterait même sans aucun dépôt qui
 * le déploie.
 *
 * Le nom précédent, `CIBLES_CONNUES`, se lisait « les cibles disponibles » et
 * semait le doute.
 */
const NOMS_DE_CIBLE_DU_PARC = ['serveur', 'web', 'admin', 'mobile']
const TYPES = [
  'fonctionnalite',
  'correctif',
  'rupture',
  'securite',
  'performance',
  'interne',
]
const AUDIENCES = ['public', 'staff', 'interne']
const ETATS = ['prevu', 'differe', 'retire']
const MEDIAS = ['image', 'gif', 'video']

// La racine est le dépôt, pas le dossier de l'outil : le script vit dans
// outils/ mais lit versions.json et notes/ à la racine.
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FICHIER_VERSIONS = join(RACINE, 'versions.json')
const DOSSIER_NOTES = join(RACINE, 'notes')
const DOSSIER_FRAGMENTS = join(DOSSIER_NOTES, 'fragments')
const DOSSIER_PUBLIES = join(DOSSIER_NOTES, 'publies')
const FICHIER_TRAINS = join(DOSSIER_NOTES, 'trains.yml')

// ───────────────────────────────────────────────────────────────────────────
// Sorties
// ───────────────────────────────────────────────────────────────────────────

const OK = '✔'
const ALERTE = '⚠'
const ECHEC = '✖'

function mourir(message) {
  console.error(`${ECHEC} ${message}`)
  process.exit(1)
}

// ───────────────────────────────────────────────────────────────────────────
// Analyseur YAML — sous-ensemble STRICT
//
// Il ne comprend que ce que le format utilise : des mappages imbriqués, des
// scalaires simples ou entre guillemets, et les blocs repliés `>-` / `>` / `|`.
// Pas de listes, pas de flux `{ … }`, pas d'ancres. Tout le reste est une
// ERREUR nommée, jamais une valeur devinée : un analyseur permissif transforme
// une faute de frappe en champ manquant, et un champ manquant en note muette.
//
// Les scalaires ne sont JAMAIS convertis en nombre. « 1.4 » doit rester la
// chaîne « 1.4 » — converti, il deviendrait 1.4 puis « 1.4 » au réencodage,
// mais « 1.40 » deviendrait « 1.4 » et le train changerait de nom en silence.
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
  // Chaque niveau retient son indentation et l'objet qu'il remplit.
  const pile = [{ indentation: -1, objet: racine }]
  let i = 0

  const faute = (n, message) => mourir(`${origine}:${n + 1} — ${message}`)

  while (i < lignes.length) {
    const ligne = lignes[i]
    if (ligne.trim() === '' || ligne.trim().startsWith('#')) {
      i += 1
      continue
    }

    // Une tabulation compte pour UN caractère : un frontmatter indenté au tab
    // s'imbriquerait de travers au lieu d'être refusé. YAML les interdit dans
    // l'indentation, et cet analyseur promet de nommer ce qu'il ne comprend
    // pas plutôt que de le deviner.
    if (/^[ ]*\t/.test(ligne)) {
      faute(i, "tabulation dans l'indentation — YAML exige des espaces")
    }
    const indentation = ligne.length - ligne.trimStart().length
    const corps = ligne.trim()

    const paire = corps.match(/^("[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)\s*:\s*(.*)$/)
    if (!paire) faute(i, `ligne incomprise : « ${corps} »`)

    const cle = String(analyserScalaire(paire[1]))

    // Le retrait des commentaires est le seul endroit où cet analyseur peut
    // CORROMPRE une valeur au lieu de la refuser. Un `.replace(/\s+#.*$/)`
    // aveugle transforme « titre: Corrige le bug #123 » en « Corrige le bug »
    // et « titre: "Bug #123" » en « "Bug » — guillemet non fermé compris. Le
    // texte part ensuite dans le manifeste servi aux UI, tronqué, sans que
    // rien ne l'ait signalé.
    let valeurBrute = paire[2].trim()
    const cite = valeurBrute.match(/^"([^"]*)"|^'([^']*)'/)
    if (cite) {
      // Cité : le contenu est littéral, seul ce qui SUIT peut être un
      // commentaire.
      const apres = valeurBrute.slice(cite[0].length).trim()
      if (apres !== '' && !apres.startsWith('#')) {
        faute(i, `texte inattendu après la valeur citée : « ${apres} »`)
      }
      valeurBrute = cite[0]
    } else if (/\s#/.test(valeurBrute)) {
      // Nu : YAML dirait « commentaire », l'auteur voulait peut-être son
      // texte. On ne trie pas à sa place — on refuse et on dit quoi faire.
      faute(
        i,
        `« # » ambigu dans une valeur non citée : commentaire ou texte ?\n      ` +
          `entourer la valeur de guillemets pour la garder entière, ` +
          `ou passer la prose en bloc « >- » où « # » est toujours littéral`
      )
    }

    // Le style de flux se reconnaît au DÉBUT de la valeur, pas à la présence
    // d'un crochet quelque part dans la ligne : « titre: Migration [beta] »
    // est de la prose parfaitement légitime, et la refuser ferait de la
    // stricture une nuisance plutôt qu'un garde-fou. Un garde-fou qui se
    // trompe est un garde-fou qu'on apprend à contourner.
    if (/^[{[]/.test(valeurBrute)) {
      faute(
        i,
        'style de flux (`{ … }` / `[ … ]`) non accepté — écrire la forme imbriquée, une clé par ligne'
      )
    }

    while (
      pile.length > 1 &&
      indentation <= pile[pile.length - 1].indentation
    ) {
      pile.pop()
    }
    const parent = pile[pile.length - 1].objet
    if (Object.hasOwn(parent, cle)) faute(i, `clé « ${cle} » en double`)

    if (valeurBrute === '>-' || valeurBrute === '>' || valeurBrute === '|') {
      // Bloc replié : on avale les lignes plus indentées. `>` joint par une
      // espace (prose), `|` conserve les retours (aucun usage aujourd'hui,
      // mais le refuser serait une surprise silencieuse).
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
      while (morceaux.length && morceaux[morceaux.length - 1] === '')
        morceaux.pop()
      parent[cle] =
        valeurBrute === '|' ? morceaux.join('\n') : morceaux.join(' ').trim()
      i = j
      continue
    }

    if (valeurBrute === '') {
      // « clé: » suivi d'un bloc plus indenté est un mappage ; « clé: » seul
      // vaut `null`, comme en YAML. Confondre les deux n'était pas une
      // approximation d'analyseur, c'était un trou dans le CONTRAT : le
      // gabarit de `noter` produit « titre: » vide, qui devenait `{}` —
      // truthy, donc le contrôle de traduction manquante passait, et le
      // manifeste servait `"titre": {}` là où toute UI attend une chaîne.
      let j = i + 1
      while (
        j < lignes.length &&
        (lignes[j].trim() === '' || lignes[j].trim().startsWith('#'))
      )
        j += 1
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

function lireVersions() {
  if (!existsSync(FICHIER_VERSIONS)) {
    mourir(`versions.json absent à la racine (${FICHIER_VERSIONS})`)
  }
  const donnees = JSON.parse(readFileSync(FICHIER_VERSIONS, 'utf8'))
  if (donnees.schemaVersion !== 1) {
    mourir(
      `versions.json : schemaVersion ${donnees.schemaVersion} inconnue de cet outil`
    )
  }
  // `projet` part dans un champ contractuel : absent, il est déduit (et
  // `valider` le signale) ; présent mais vide, blanc ou non-chaîne, il
  // atteindrait le manifeste tel quel. Une valeur fausse vaut moins qu'une
  // valeur absente — l'absence, elle, a un repli documenté.
  if (donnees.projet !== undefined) {
    if (typeof donnees.projet !== 'string' || donnees.projet.trim() === '') {
      mourir(
        `versions.json → projet : « ${donnees.projet} » n'est pas un nom — chaîne non vide attendue`
      )
    }
    // Normalisé ICI, une fois : sinon les journaux et le manifeste peuvent
    // afficher deux formes du même nom.
    donnees.projet = donnees.projet.trim()
  }
  for (const [cible, trains] of Object.entries(donnees.cibles ?? {})) {
    exigerSemver(trains.prod, `versions.json → ${cible}.prod`)
    exigerSemver(trains.prochaine, `versions.json → ${cible}.prochaine`)
  }
  return donnees
}

function lireTrains() {
  if (!existsSync(FICHIER_TRAINS)) return {}
  return analyserYaml(readFileSync(FICHIER_TRAINS, 'utf8'), 'notes/trains.yml')
}

/**
 * Le nom du projet vient de `versions.json`, pas de l'empaquetage. Déduit du
 * package.json, il dépend de ce qui a été copié là où l'outil tourne : dans
 * l'étage Docker `notes`, qui ne copie que versions.json, outils/ et notes/,
 * la déduction retombait sur le nom du dossier de travail et le manifeste
 * servi par l'API annonçait `"projet": "app"` quand celui du site, construit
 * sur le runner, annonçait le vrai nom. Deux manifestes du MÊME dépôt qui se
 * contredisent, dans un champ contractuel — constaté en ligne après le
 * premier déploiement réel.
 *
 * Les replis restent, pour ne rien casser là où `projet` n'est pas encore
 * déclaré, mais `valider` les signale : une déduction n'est pas une source.
 */
function nomDuProjet(versions) {
  // `lireVersions` a déjà refusé une valeur vide, blanche ou non-chaîne :
  // ce qui arrive ici est soit absent, soit utilisable.
  if (versions?.projet) return versions.projet
  const paquet = join(RACINE, 'package.json')
  if (existsSync(paquet)) {
    const nom = JSON.parse(readFileSync(paquet, 'utf8')).name
    if (nom) return nom
  }
  return basename(RACINE)
}

function brancheCourante() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: RACINE,
      encoding: 'utf8',
      // stderr fermé : dans un dépôt sans commit, git se plaint de « HEAD »
      // sur stderr avant de sortir en erreur. Ce bruit ferait croire à une
      // panne de l'outil alors que la branche est simplement inconnue.
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/** Fragments d'un dossier, triés par nom — donc par date, puis par cible. */
function lireFragments(dossier) {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier)
    .filter(nom => nom.endsWith('.md'))
    .sort()
    .map(nom => lireFragment(join(dossier, nom)))
}

function lireFragment(chemin) {
  const texte = readFileSync(chemin, 'utf8')
  const bornes = texte.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  const relatif = chemin.slice(RACINE.length + 1)
  if (!bornes) mourir(`${relatif} — pas de frontmatter délimité par « --- »`)

  const id = basename(chemin, '.md')
  const date = id.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    mourir(`${relatif} — le nom doit commencer par AAAA-MM-JJ`)
  }
  return { id, date, chemin, relatif, champs: analyserYaml(bornes[1], relatif) }
}

// ───────────────────────────────────────────────────────────────────────────
// Validation
// ───────────────────────────────────────────────────────────────────────────

/** @returns {{erreurs: string[], alertes: string[]}} */
function controler(fragment, cibles, langues) {
  const erreurs = []
  const alertes = []
  const c = fragment.champs
  const attendu = (nom, valeur, liste) => {
    if (valeur === undefined) {
      erreurs.push(`« ${nom} » manquant`)
      return
    }
    if (!liste.includes(valeur)) {
      erreurs.push(
        `valeur « ${valeur} » inconnue pour « ${nom} »\n      valeurs acceptées : ${liste.join(', ')}`
      )
    }
  }

  attendu('cible', c.cible, cibles)
  attendu('type', c.type, TYPES)
  attendu('audience', c.audience, AUDIENCES)
  if (c.etat !== undefined) attendu('etat', c.etat, ETATS)

  // LA confusion que ce modèle à deux axes va produire, nommée avant qu'elle
  // coûte une demi-heure. Un validateur qui la voit venir vaut mieux qu'un
  // paragraphe de documentation.
  if (c.audience !== undefined && NOMS_DE_CIBLE_DU_PARC.includes(c.audience)) {
    erreurs.push(
      `— « ${c.audience} » est une CIBLE, pas une audience. Les deux axes sont indépendants.`
    )
  }

  if (!c.fr || typeof c.fr !== 'object') erreurs.push('bloc « fr » manquant')
  else {
    if (!c.fr.titre) erreurs.push('« fr.titre » manquant')
    if (!c.fr.texte) erreurs.push('« fr.texte » manquant')
  }

  // Une rupture sans migration est une note qui annonce un problème sans dire
  // quoi faire. Elle coûte plus cher que pas de note du tout.
  if (c.type === 'rupture' && !(c.fr && c.fr.migration)) {
    erreurs.push('« fr.migration » obligatoire quand type est « rupture »')
  }

  for (const langue of langues.filter(l => l !== 'fr')) {
    const bloc = c[langue]
    if (!bloc || !bloc.titre || !bloc.texte) {
      // Avertissement et non erreur : l'équipe écrit sous la pression de la
      // PR, la traduction se fait au moment calme de la sortie. `promouvoir`,
      // lui, refuse — c'est le seul moment où quelqu'un traduit vraiment.
      alertes.push(`« ${langue} » absent (bloquant à la promotion, pas ici)`)
    } else if (c.type === 'rupture' && !bloc.migration) {
      alertes.push(`« ${langue}.migration » absent (bloquant à la promotion)`)
    }
  }

  if (c.media !== undefined && c.media !== null) {
    if (typeof c.media !== 'object')
      erreurs.push('« media » doit être un bloc imbriqué')
    else {
      if (!MEDIAS.includes(c.media.type)) {
        erreurs.push(
          `media.type « ${c.media.type} » inconnu\n      valeurs acceptées : ${MEDIAS.join(', ')}`
        )
      }
      if (!c.media.url) erreurs.push('« media.url » manquant')
      // `alt` est obligatoire, et ce n'est pas du zèle : ces notes sont lues
      // par des utilisateurs, et un média sans texte alternatif en exclut une
      // partie. La documentation l'annonçait déjà sans que rien ne le vérifie.
      if (!c.media.alt)
        erreurs.push(
          '« media.alt » manquant — un média sans alternative textuelle exclut une partie du public'
        )
    }
  }

  const connus = new Set([
    'cible',
    'type',
    'audience',
    'etat',
    'media',
    'version',
    ...langues,
  ])
  for (const cle of Object.keys(c)) {
    if (!connus.has(cle)) erreurs.push(`champ « ${cle} » inconnu`)
  }

  return { erreurs, alertes }
}

function commandeValider() {
  const versions = lireVersions()
  const cibles = Object.keys(versions.cibles)
  const langues = versions.langues ?? ['fr']
  const fragments = lireFragments(DOSSIER_FRAGMENTS)

  console.log(`versionner ${VERSION_OUTIL} — ${nomDuProjet(versions)}`)
  console.log(
    `notes/fragments — ${fragments.length} fragment${fragments.length > 1 ? 's' : ''} en attente de sortie`
  )

  // On compte les FRAGMENTS en défaut, pas les lignes de message : un fragment
  // dont l'erreur mérite deux lignes d'explication n'est pas deux problèmes.
  let nErreurs = 0
  let nAlertes = 0
  for (const fragment of fragments) {
    const { erreurs, alertes } = controler(fragment, cibles, langues)
    const etiquette = fragment.id.padEnd(46)
    if (erreurs.length) {
      nErreurs += 1
      console.log(`  ${ECHEC} ${etiquette} ${erreurs[0]}`)
      for (const reste of erreurs.slice(1)) console.log(`      ${reste}`)
    } else if (alertes.length) {
      nAlertes += 1
      console.log(`  ${ALERTE} ${etiquette} ${alertes.join(' ; ')}`)
    } else {
      const c = fragment.champs
      const suffixe = c.type === 'rupture' ? ' — migration présente' : ''
      console.log(`  ${OK} ${etiquette} ${c.type} / ${c.audience}${suffixe}`)
    }
  }

  if (!versions.projet) {
    // Compté, pas seulement affiché : un récapitulatif qui annonce « 0
    // avertissement » sous un ⚠ visible se contredit lui-même, et c'est le
    // total qu'on lit en diagonale.
    nAlertes += 1
    console.log(
      `  ${ALERTE} versions.json n'a pas de « projet » — le nom sera DÉDUIT, et une déduction\n` +
        `      dépend de l'endroit où l'outil tourne : dans un étage Docker qui ne copie pas\n` +
        `      package.json, deux manifestes du même dépôt peuvent se contredire.`
    )
  }

  const trains = lireTrains()
  for (const cible of Object.keys(trains)) {
    if (!cibles.includes(cible)) {
      console.log(
        `  ${ECHEC} notes/trains.yml déclare la cible « ${cible} », absente de versions.json`
      )
      nErreurs += 1
    }
  }

  if (nErreurs === 0 && nAlertes === 0) {
    console.log(fragments.length ? 'Aucune erreur.' : '')
  } else {
    console.log(
      `${nErreurs} erreur${nErreurs > 1 ? 's' : ''}, ${nAlertes} avertissement${nAlertes > 1 ? 's' : ''}.`
    )
  }
  process.exit(nErreurs ? 1 : 0)
}

// ───────────────────────────────────────────────────────────────────────────
// Compilation
// ───────────────────────────────────────────────────────────────────────────

function entree(fragment, langues) {
  const c = fragment.champs
  const sortie = {
    id: fragment.id,
    type: c.type,
    audience: c.audience,
  }
  for (const langue of langues) {
    const bloc = c[langue]
    sortie[langue] = bloc
      ? {
          titre: bloc.titre ?? null,
          texte: bloc.texte ?? null,
          migration: bloc.migration ?? null,
        }
      : null
  }
  sortie.media = c.media ?? null
  return sortie
}

/**
 * Refuse tout ce qui n'est pas strictement `x.y.z`. Sans ce contrôle,
 * `comparerVersions` rend `NaN` (donc un tri NON DÉTERMINISTE, pas une erreur)
 * et `trainDe` fabrique un train « 1.undefined » — deux façons de deviner là
 * où cet outil promet de refuser. Un `versions.json` corrigé à la main est le
 * chemin le plus court vers les deux.
 */
function exigerSemver(version, origine) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    mourir(`${origine} : « ${version} » n'est pas un numéro x.y.z`)
  }
  return version
}

function trainDe(version) {
  const morceaux = version.split('.')
  return `${morceaux[0]}.${morceaux[1]}`
}

/** Tri semver croissant sur des versions sans pré-release (la prod n'en a pas). */
function comparerVersions(a, b) {
  const ma = a.split('.').map(Number)
  const mb = b.split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    if ((ma[i] ?? 0) !== (mb[i] ?? 0)) return (ma[i] ?? 0) - (mb[i] ?? 0)
  }
  return 0
}

function compilerCible(cible, versions, trains, langues) {
  const dossierCible = join(DOSSIER_PUBLIES, cible)
  const parVersion = new Map()

  if (existsSync(dossierCible)) {
    for (const nomTrain of readdirSync(dossierCible).sort()) {
      const dossierTrain = join(dossierCible, nomTrain)
      if (nomTrain === 'retires') continue
      for (const fragment of lireFragments(dossierTrain)) {
        const version = fragment.champs.version
        if (!version)
          mourir(`${fragment.relatif} — publié sans champ « version »`)
        exigerSemver(version, fragment.relatif)
        if (!parVersion.has(version)) parVersion.set(version, [])
        parVersion.get(version).push(fragment)
      }
    }
  }

  // Le rang est attribué dans l'ordre chronologique des versions sorties : un
  // entier monotone par cible. C'est LUI que le client compare, jamais deux
  // chaînes de provenances différentes — le défaut de frontend-event
  // (UpdateTag.tsx:38) tient tout entier dans cette confusion.
  const ordonnees = [...parVersion.keys()].sort(comparerVersions)
  const rangs = new Map(ordonnees.map((v, i) => [v, i + 1]))

  const parTrain = new Map()
  for (const version of ordonnees) {
    const nomTrain = trainDe(version)
    if (!parTrain.has(nomTrain)) parTrain.set(nomTrain, [])
    const fragments = parVersion.get(version)
    parTrain.get(nomTrain).push({
      version,
      rang: rangs.get(version),
      // La date de la version est celle de sa note la plus récente : elle est
      // déduite des noms de fichiers, donc stable d'une exécution à l'autre.
      // Une date d'exécution rendrait la compilation non idempotente et le
      // contrat committé changerait à chaque CI.
      date: fragments
        .map(f => f.date)
        .sort()
        .at(-1),
      entrees: fragments.map(f => entree(f, langues)),
    })
  }

  const declares = trains[cible] ?? {}
  const listeTrains = [...parTrain.keys()]
    .sort((a, b) => comparerVersions(`${b}.0`, `${a}.0`))
    .map(nomTrain => {
      const declare = declares[nomTrain] ?? {}
      const versionsDuTrain = parTrain
        .get(nomTrain)
        .sort((a, b) => comparerVersions(b.version, a.version))
      return {
        train: nomTrain,
        nom: declare.nom ?? null,
        date: versionsDuTrain[0].date.slice(0, 7),
        prerelease: declare.prerelease ?? false,
        resumeCorrectifs: declare.resumeCorrectifs ?? null,
        versions: versionsDuTrain,
      }
    })

  return {
    schemaVersion: 1,
    projet: nomDuProjet(versions),
    cible,
    index: {
      rang: ordonnees.length,
      prod: versions.cibles[cible].prod,
      prochaine: versions.cibles[cible].prochaine,
    },
    enRecette: [],
    trains: listeTrains,
  }
}

function ecrireJson(chemin, donnees) {
  writeFileSync(chemin, `${JSON.stringify(donnees, null, 2)}\n`)
}

function commandeCompiler(options) {
  const versions = lireVersions()
  const trains = lireTrains()
  const langues = versions.langues ?? ['fr']
  // `--sortie` est résolu depuis le RÉPERTOIRE COURANT, délibérément, et c'est
  // la seule chose de ce script qui ne suive pas `RACINE`. Un chemin passé en
  // argument se comprend comme celui de `cp` : relatif à l'endroit d'où on
  // appelle. Le build du client le lance depuis `packages/client` avec
  // `--sortie public` (yarn place le cwd sur l'espace de travail) et attend
  // `packages/client/public` — résolu depuis la racine, le manifeste
  // atterrirait dans un `public/` que rien ne publie, et l'erreur serait
  // silencieuse. Les LECTURES, elles, restent toutes ancrées à `RACINE`.
  const destination = options.sortie ? resolve(options.sortie) : DOSSIER_NOTES
  if (options.sortie && !existsSync(destination))
    mkdirSync(destination, { recursive: true })

  // `--cible` ne sert qu'à la variante servie : le build du site n'a aucune
  // raison de publier le manifeste du serveur sur le mutualisé. Sans filtre,
  // la compilation committée écrit toutes les cibles — c'est le contrat, il
  // est entier ou il n'est pas.
  const aCompiler = options.cible
    ? [options.cible]
    : Object.keys(versions.cibles)
  for (const cible of aCompiler) {
    if (!versions.cibles[cible]) {
      mourir(
        `cible « ${cible} » inconnue\n      cibles du dépôt : ${Object.keys(versions.cibles).join(', ')}`
      )
    }
    const manifeste = compilerCible(cible, versions, trains, langues)

    if (options.sortie) {
      // Variante SERVIE. `genereLe` et `genereDepuis` ne sont ici que parce
      // qu'ils ne sont PAS dans le fichier committé : datés, ils rendraient la
      // compilation non idempotente, feraient échouer `git diff --exit-code`
      // et — pire — feraient s'allumer le filtre de pertinence à chaque
      // commit, donc redéployer pour rien.
      manifeste.genereLe = new Date().toISOString()
      manifeste.genereDepuis = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'
      // Le numéro RÉELLEMENT construit dans cet artefact. Sans lui, un lecteur
      // du manifeste ne peut que deviner — et un portail qui affiche
      // `prochaine` à côté d'un `1.4.0-dev.a1b2c3d` venu de /health montre deux
      // choses de nature différente comme si elles se comparaient.
      //
      // La dérivation vit ICI et pas dans le lecteur : elle est déjà dans
      // vite.config.ts et dans le workflow de publication, en faire une quatrième copie côté
      // portail garantirait qu'un jour les quatre divergent.
      // Lu UNE fois : deux lectures de la même variable, c'est deux occasions
      // de diverger le jour où l'une des deux change de défaut.
      const cibleProd = (process.env.ENV_CIBLE ?? 'dev') === 'prod'

      manifeste.index.versionServie = cibleProd
        ? manifeste.index.prod
        : `${manifeste.index.prochaine}-dev.${manifeste.genereDepuis}`
      // Le mode recette se déduit de l'environnement plutôt que de se répéter
      // en shell dans le Dockerfile, le build du client et la CI. Le défaut
      // est la RECETTE : en local, `ENV_CIBLE` n'existe pas, et afficher un
      // manifeste de production ferait croire au développeur qu'il relit la
      // prod. Seul un `ENV_CIBLE=prod` explicite vide le bloc.
      const enRecette = options.recette || !cibleProd
      if (enRecette) {
        // « differe » est inclus : la note est retenue hors de la SORTIE de
        // production, mais son code est sur develop, donc déployé en recette.
        // L'exclure mentirait au testeur sur ce qu'il a sous les yeux. Seul
        // « retire » sort — la fonctionnalité, elle, a été retirée.
        manifeste.enRecette = lireFragments(DOSSIER_FRAGMENTS)
          .filter(
            f =>
              f.champs.cible === cible &&
              (f.champs.etat ?? 'prevu') !== 'retire'
          )
          .map(f => ({ ...entree(f, langues), etat: f.champs.etat ?? 'prevu' }))
      }
    }

    const chemin = join(destination, `notes-de-version.${cible}.json`)
    ecrireJson(chemin, manifeste)
    const enAttente = manifeste.enRecette.length
    console.log(
      `${OK} ${chemin.slice(RACINE.length + 1)} — ${manifeste.trains.length} train(s), rang ${manifeste.index.rang}` +
        (enAttente ? `, ${enAttente} en recette` : '')
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Création d'un fragment
// ───────────────────────────────────────────────────────────────────────────

function slug(titre) {
  return titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function commandeNoter(options) {
  const branche = brancheCourante()
  // Une note naît avec une branche. Sur develop, le fragment atterrirait sans
  // revue ; sur main, il court-circuiterait la promotion.
  if (branche === 'main' || branche === 'develop' || branche === 'master') {
    mourir(
      `« noter » ne tourne pas sur ${branche} — une note naît avec sa branche`
    )
  }

  const versions = lireVersions()
  const cibles = Object.keys(versions.cibles)
  const langues = versions.langues ?? ['fr']

  const verifierChoix = (nom, valeur, liste) => {
    if (!valeur)
      mourir(`--${nom} requis\n      valeurs acceptées : ${liste.join(', ')}`)
    if (!liste.includes(valeur)) {
      mourir(
        `--${nom} « ${valeur} » inconnu\n      valeurs acceptées : ${liste.join(', ')}`
      )
    }
  }
  verifierChoix('cible', options.cible, cibles)
  verifierChoix('type', options.type, TYPES)
  verifierChoix('audience', options.audience, AUDIENCES)
  if (!options.titre) mourir('--titre requis')

  const morceau = slug(options.titre)
  // Un titre fait de ponctuation ou d'emoji donne un slug vide, donc un nom de
  // fichier muet — et le nom EST l'identifiant stable d'une note.
  if (!morceau) {
    mourir(
      `--titre « ${options.titre} » ne donne aucun slug — il lui faut des lettres ou des chiffres`
    )
  }
  const date = new Date().toISOString().slice(0, 10)
  const nom = `${date}-${options.cible}-${morceau}.md`
  const chemin = join(DOSSIER_FRAGMENTS, nom)
  if (existsSync(chemin)) mourir(`${nom} existe déjà`)
  mkdirSync(DOSSIER_FRAGMENTS, { recursive: true })

  // Les champs sont laissés VIDES, sans texte d'amorce : une amorce passerait
  // la validation et sortirait telle quelle en production. Un champ vide est
  // refusé par `valider`, ce qui est exactement le comportement voulu.
  // `titre` part en bloc replié comme le reste de la prose, et pas en scalaire
  // nu : un titre courant contient « # » (« Corrige le bug #123 »), que
  // l'analyseur refuse à juste titre dans une valeur non citée. L'outil
  // fabriquait donc un fragment que sa propre validation rejetait. Dans un
  // bloc « >- », aucun caractère n'a besoin d'échappement — ni « # », ni les
  // guillemets, ni les deux-points.
  const blocs = langues
    .map(langue =>
      [
        `${langue}:`,
        '  titre: >-',
        ...(langue === 'fr' ? [`    ${options.titre}`] : []),
        '  texte: >-',
        ...(options.type === 'rupture' ? ['  migration: >-'] : []),
      ].join('\n')
    )
    .join('\n')

  writeFileSync(
    chemin,
    [
      '---',
      `cible: ${options.cible}`,
      `type: ${options.type}`,
      `audience: ${options.audience}`,
      'etat: prevu',
      blocs,
      '---',
      '',
      "Sous le frontmatter : le détail interne, jamais compilé. C'est le seul",
      "endroit de ce système où l'on écrit pour soi.",
      '',
    ].join('\n')
  )

  console.log(`${OK} ${chemin.slice(RACINE.length + 1)}`)
  console.log(
    "  Ouvre-le et écris la prose : ce que le lecteur peut faire, pas comment c'est implémenté."
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Promotion
// ───────────────────────────────────────────────────────────────────────────

function incrementer(version, niveau) {
  const [majeur, mineur, correctif] = version.split('.').map(Number)
  if (niveau === 'majeur') return `${majeur + 1}.0.0`
  if (niveau === 'mineur') return `${majeur}.${mineur + 1}.0`
  return `${majeur}.${mineur}.${correctif + 1}`
}

function commandePromouvoir(cible, options) {
  const branche = brancheCourante()
  // Refusé sur develop pour une raison de FACTURE autant que d'hygiène : un
  // commit de promotion sur develop modifierait le manifeste de la cible,
  // donc allumerait le filtre de pertinence d'un workflow de déploiement, donc déclencherait
  // un déploiement de recette pour une sortie de production.
  if (branche === 'main' || branche === 'develop' || branche === 'master') {
    mourir(
      `« promouvoir » ne tourne pas sur ${branche} — ouvrir une branche de sortie (ex. sortie/${cible}-x.y.z) dont la PR vise main`
    )
  }

  const versions = lireVersions()
  if (!versions.cibles[cible]) {
    mourir(
      `cible « ${cible} » inconnue\n      cibles du dépôt : ${Object.keys(versions.cibles).join(', ')}`
    )
  }
  const langues = versions.langues ?? ['fr']
  // Deux drapeaux à la fois se départageaient par ordre d'écriture, en
  // silence : `--majeur --correctif` sortait une majeure. Une promotion au
  // mauvais niveau ne se rattrape pas — un tag ne se réécrit jamais.
  const niveaux = ['majeur', 'mineur', 'correctif'].filter(n => options[n])
  if (niveaux.length > 1) {
    mourir(
      `drapeaux incompatibles : --${niveaux.join(' --')} — un seul niveau à la fois`
    )
  }
  const niveau = niveaux[0] ?? 'mineur'

  const tous = lireFragments(DOSSIER_FRAGMENTS).filter(
    f => f.champs.cible === cible
  )
  const emportes = tous.filter(f => (f.champs.etat ?? 'prevu') === 'prevu')
  const differes = tous.filter(f => f.champs.etat === 'differe')
  const retires = tous.filter(f => f.champs.etat === 'retire')

  if (!emportes.length) {
    mourir(
      `aucun fragment « prevu » pour la cible ${cible} — sortir une version sans note est un bruit, pas une sortie`
    )
  }

  // Valider AVANT de déplacer. `valider` ne parcourt que notes/fragments/ :
  // une fois dans publies/, un fragment fautif n'est plus jamais relu, et son
  // entrée part dans le manifeste amputée du champ manquant — `undefined`
  // disparaît à la sérialisation JSON, donc le contrat sort incomplet et la
  // CI reste verte. C'est la seule porte par laquelle une note invalide peut
  // atteindre une UI.
  const fautifs = emportes
    .map(f => ({ f, ...controler(f, Object.keys(versions.cibles), langues) }))
    .filter(x => x.erreurs.length)
  if (fautifs.length) {
    console.error(
      `${ECHEC} ${fautifs.length} note(s) invalide(s) — rien n'a été déplacé :`
    )
    for (const { f, erreurs } of fautifs) {
      console.error(`      ${f.id}`)
      for (const e of erreurs) console.error(`        ${e}`)
    }
    process.exit(1)
  }

  const nouvelleVersion = versions.cibles[cible].prochaine
  const nomTrain = trainDe(nouvelleVersion)
  const trains = lireTrains()
  const declare = trains[cible]?.[nomTrain]
  // « 1.4 » ne dit rien, « Gestion des sessions » dit tout. Un train sans nom
  // est un changelog que personne ne lit.
  if (niveau !== 'correctif' && !declare?.nom) {
    mourir(
      `notes/trains.yml n'a pas de « nom » pour ${cible} / ${nomTrain} — c'est un acte produit, il se demande à l'humain`
    )
  }

  const sansTraduction = emportes.filter(f =>
    langues.some(
      l => l !== 'fr' && (!f.champs[l]?.titre || !f.champs[l]?.texte)
    )
  )
  if (sansTraduction.length) {
    console.error(
      `${ECHEC} traduction manquante sur ${sansTraduction.length} note(s) :`
    )
    for (const f of sansTraduction) console.error(`      ${f.id}`)
    console.error(
      "      La promotion est le seul moment où quelqu'un traduit. Pas de drapeau pour passer outre."
    )
    process.exit(1)
  }

  const dossierTrain = join(DOSSIER_PUBLIES, cible, nomTrain)
  mkdirSync(dossierTrain, { recursive: true })

  for (const fragment of emportes) {
    const texte = readFileSync(fragment.chemin, 'utf8')
    // Le numéro est APPOSÉ ici, jamais choisi par l'auteur : c'est ce qui rend
    // une pile de PR réordonnable sans rien renuméroter.
    const estampille = texte.replace(
      /^---\n/,
      `---\nversion: ${nouvelleVersion}\n`
    )
    writeFileSync(fragment.chemin, estampille)
    renameSync(fragment.chemin, join(dossierTrain, basename(fragment.chemin)))
  }

  if (retires.length) {
    const dossierRetires = join(DOSSIER_PUBLIES, cible, 'retires')
    mkdirSync(dossierRetires, { recursive: true })
    for (const fragment of retires) {
      renameSync(
        fragment.chemin,
        join(dossierRetires, basename(fragment.chemin))
      )
    }
  }

  versions.cibles[cible].prod = nouvelleVersion
  versions.cibles[cible].prochaine = incrementer(nouvelleVersion, niveau)
  ecrireJson(FICHIER_VERSIONS, versions)

  console.log(
    `\n  ${cible} — ce qui part en prod : ${nouvelleVersion}${declare?.nom ? ` « ${declare.nom} »` : ''}\n`
  )
  for (const f of emportes)
    console.log(
      `  ${OK} ${f.id.padEnd(46)} ${f.champs.type} / ${f.champs.audience}`
    )
  // Différées et retirées sont NOMMÉES, jamais tues : une note qui disparaît
  // en silence est la seule façon de perdre une information dans ce système.
  for (const f of differes)
    console.log(`  ${ALERTE} ${f.id.padEnd(46)} différée — reste en attente`)
  for (const f of retires)
    console.log(
      `  ${ALERTE} ${f.id.padEnd(46)} retirée — archivée dans publies/${cible}/retires/`
    )
  console.log(`\n  prochaine : ${versions.cibles[cible].prochaine}\n`)

  commandeCompiler({})

  console.log("\n  Rien n'est commité. À relire, puis :")
  console.log(
    `    git add versions.json notes/ && git commit -m "${cible} ${nouvelleVersion}${declare?.nom ? ` — ${declare.nom}` : ''}"`
  )
  console.log(
    "  Le tag git est posé par l'exploitation après la sonde de santé, par personne d'autre."
  )
}

// ───────────────────────────────────────────────────────────────────────────

function commandeVerifier() {
  const chemin = fileURLToPath(import.meta.url)
  const empreinte = createHash('sha256')
    .update(readFileSync(chemin))
    .digest('hex')
  console.log(`versionner ${VERSION_OUTIL}`)
  console.log(`sha256 ${empreinte}`)
  console.log('  À comparer à l’empreinte des autres copies de l’outil.')
  console.log(
    '  Un écart entre deux dépôts est une dérive de VALIDATEUR : silencieuse par nature.'
  )
}

const USAGE = `versionner ${VERSION_OUTIL} — notes de version et trains de version

  noter --cible <c> --type <t> --audience <a> --titre "…"
      Crée un fragment dans notes/fragments/. Refuse sur main, master et develop.

  valider
      Schéma, énumérations, parité des langues, migration obligatoire sur une
      rupture. Sort en 1 dès une erreur ; une traduction absente est un
      avertissement, pas un blocage.

  compiler [--recette] [--sortie <dossier>] [--cible <c>]
      Écrit notes/notes-de-version.<cible>.json — les notes SORTIES seulement,
      et de façon idempotente : c'est un contrat committé, vérifié en CI par
      git diff --exit-code. Avec --sortie, écrit ailleurs et ajoute les champs
      datés, plus les notes en attente (enRecette) sauf si ENV_CIBLE=prod.

  promouvoir <cible> [--majeur|--mineur|--correctif]
      prod ← prochaine, estampille et range les fragments, recompile.
      Ne commite rien. Refuse sur main, master et develop.

  verifier
      Imprime l'empreinte de cette copie, à comparer aux autres dépôts.`

function principal() {
  const [commande, ...reste] = process.argv.slice(2)
  const { values, positionals } = parseArgs({
    args: reste,
    allowPositionals: true,
    strict: false,
    options: {
      cible: { type: 'string' },
      type: { type: 'string' },
      audience: { type: 'string' },
      titre: { type: 'string' },
      sortie: { type: 'string' },
      recette: { type: 'boolean' },
      majeur: { type: 'boolean' },
      mineur: { type: 'boolean' },
      correctif: { type: 'boolean' },
    },
  })

  switch (commande) {
    case 'noter':
      return commandeNoter(values)
    case 'valider':
      return commandeValider()
    case 'compiler':
      return commandeCompiler(values)
    case 'promouvoir':
      if (!positionals[0])
        mourir('cible requise : versionner promouvoir <cible>')
      return commandePromouvoir(positionals[0], values)
    case 'verifier':
      return commandeVerifier()
    default:
      console.log(USAGE)
      process.exit(commande ? 1 : 0)
  }
}

principal()
