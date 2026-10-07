// Tests de versionner : chaque cas lance le script sur un dépôt temporaire
// (VERSIONNER_RACINE), avec ses propres package.json et fragments.
// Lancement : node --test outils/versionner.test.mjs

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'versionner.mjs')
const PAQUETS = [
  'package.json',
  'packages/server/package.json',
  'packages/orga/package.json',
]

let depots = []
afterEach(() => {
  for (const depot of depots) rmSync(depot, { recursive: true, force: true })
  depots = []
})

/** Un dépôt temporaire dont les trois package.json portent `version`. */
function depot(version, versions = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'versionner-'))
  depots.push(racine)
  for (const relatif of PAQUETS) {
    mkdirSync(join(racine, dirname(relatif)), { recursive: true })
    const nom = relatif === 'package.json' ? 'essai' : relatif.split('/')[1]
    const paquet = { name: nom, version: versions[relatif] ?? version }
    writeFileSync(join(racine, relatif), `${JSON.stringify(paquet, null, 2)}\n`)
  }
  mkdirSync(join(racine, 'notes/fragments'), { recursive: true })
  return racine
}

function fragment(racine, nom, champs) {
  const cible = nom.slice(11).split('-')[0]
  const lignes = [
    '---',
    `cible: ${cible}`,
    `type: ${champs.type}`,
    `audience: ${champs.audience ?? 'organisateurs'}`,
    ...(champs.role ? [`role: ${champs.role}`] : []),
    ...(champs.etat ? [`etat: ${champs.etat}`] : []),
    ...(champs.version ? [`version: ${champs.version}`] : []),
    'fr:',
    `  titre: Titre de ${nom}`,
    `  texte: Texte de ${nom}.`,
    ...(champs.type === 'rupture' ? [`  migration: Migration de ${nom}.`] : []),
    '---',
    '',
  ]
  writeFileSync(join(racine, 'notes/fragments', `${nom}.md`), lignes.join('\n'))
}

function lancerAvec(racine, env, ...args) {
  const resultat = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, VERSIONNER_RACINE: racine, ...env },
    encoding: 'utf8',
  })
  return {
    code: resultat.status,
    sortie: resultat.stdout,
    erreur: resultat.stderr,
  }
}

const lancer = (racine, ...args) => lancerAvec(racine, {}, ...args)

const lire = (racine, relatif) => readFileSync(join(racine, relatif), 'utf8')
const journal = (racine, cible) =>
  JSON.parse(lire(racine, `notes/notes-de-version.${cible}.json`))

test('publier : une fonctionnalité fait monter le deuxième chiffre avant la 1.0', () => {
  const racine = depot('0.3.2')
  fragment(racine, '2026-01-01-serveur-a', { type: 'correctif' })
  fragment(racine, '2026-01-02-orga-b', { type: 'fonctionnalite' })
  const { code, sortie } = lancer(racine, 'publier', '--simulation')
  assert.equal(code, 0)
  assert.match(sortie, /0\.3\.2 → 0\.4\.0/)
})

test('publier : sans fonctionnalité ni rupture, le troisième chiffre monte', () => {
  const racine = depot('0.4.0')
  fragment(racine, '2026-01-01-serveur-a', { type: 'correctif' })
  fragment(racine, '2026-01-02-serveur-b', { type: 'securite' })
  assert.match(lancer(racine, 'publier', '--simulation').sortie, /→ 0\.4\.1/)
})

test('publier : une rupture fait monter le premier chiffre à partir de la 1.0', () => {
  const racine = depot('1.2.3')
  fragment(racine, '2026-01-01-serveur-a', { type: 'rupture' })
  assert.match(lancer(racine, 'publier', '--simulation').sortie, /→ 2\.0\.0/)
})

test('publier --simulation ne modifie aucun fichier', () => {
  const racine = depot('0.1.0')
  fragment(racine, '2026-01-01-serveur-a', { type: 'fonctionnalite' })
  const avant = lire(racine, 'notes/fragments/2026-01-01-serveur-a.md')
  lancer(racine, 'publier', '--simulation')
  assert.equal(lire(racine, 'notes/fragments/2026-01-01-serveur-a.md'), avant)
  assert.equal(JSON.parse(lire(racine, 'package.json')).version, '0.1.0')
})

test('publier rattache les fragments, relève les trois paquets et groupe le journal', () => {
  const racine = depot('0.1.0')
  fragment(racine, '2026-01-01-serveur-ancien', {
    type: 'correctif',
    version: '0.1.0',
  })
  fragment(racine, '2026-01-02-serveur-nouveau', { type: 'fonctionnalite' })
  fragment(racine, '2026-01-03-serveur-reporte', {
    type: 'fonctionnalite',
    etat: 'differe',
  })
  fragment(racine, '2026-01-04-serveur-abandonne', {
    type: 'fonctionnalite',
    etat: 'retire',
  })

  assert.equal(lancer(racine, 'publier').code, 0)

  for (const relatif of PAQUETS) {
    assert.equal(JSON.parse(lire(racine, relatif)).version, '0.2.0')
  }
  assert.match(
    lire(racine, 'notes/fragments/2026-01-02-serveur-nouveau.md'),
    /^version: 0\.2\.0\nfr:$/m
  )
  // Un fragment différé ou retiré ne part pas avec la version.
  assert.doesNotMatch(
    lire(racine, 'notes/fragments/2026-01-03-serveur-reporte.md'),
    /^version:/m
  )
  assert.doesNotMatch(
    lire(racine, 'notes/fragments/2026-01-04-serveur-abandonne.md'),
    /^version:/m
  )

  const serveur = journal(racine, 'serveur')
  assert.equal(serveur.schemaVersion, 4)
  assert.equal(serveur.version, '0.2.0')
  assert.deepEqual(
    serveur.versions.map(v => [v.version, v.notes.map(n => n.id)]),
    [
      [null, ['2026-01-03-serveur-reporte']],
      ['0.2.0', ['2026-01-02-serveur-nouveau']],
      ['0.1.0', ['2026-01-01-serveur-ancien']],
    ]
  )
  assert.deepEqual(journal(racine, 'orga').versions, [])

  // Plus rien à publier : une seconde publication échoue.
  const encore = lancer(racine, 'publier')
  assert.equal(encore.code, 1)
  assert.match(encore.erreur, /aucun fragment à publier/)
})

test('publier --version refuse un numéro qui ne suit pas la version actuelle', () => {
  const racine = depot('0.4.0')
  fragment(racine, '2026-01-01-serveur-a', { type: 'correctif' })
  const { code, erreur } = lancer(racine, 'publier', '--version', '0.4.0')
  assert.equal(code, 1)
  assert.match(erreur, /doit suivre la version actuelle/)
})

test('compiler donne deux fois le même fichier', () => {
  const racine = depot('0.2.0')
  fragment(racine, '2026-01-01-orga-a', { type: 'correctif', version: '0.2.0' })
  fragment(racine, '2026-01-02-orga-b', { type: 'fonctionnalite' })
  lancer(racine, 'compiler')
  const premier = lire(racine, 'notes/notes-de-version.orga.json')
  lancer(racine, 'compiler')
  assert.equal(lire(racine, 'notes/notes-de-version.orga.json'), premier)
})

test('valider refuse un paquet dont le numéro diffère de la racine', () => {
  const racine = depot('0.4.0', { 'packages/orga/package.json': '0.1.0' })
  const { code, erreur } = lancer(racine, 'valider')
  assert.equal(code, 1)
  assert.match(erreur, /packages\/orga\/package\.json porte « 0\.1\.0 »/)
})

test('publier réaligne un paquet dont le numéro a divergé', () => {
  const racine = depot('0.4.0', { 'packages/orga/package.json': '0.1.0' })
  fragment(racine, '2026-01-01-orga-a', { type: 'correctif' })
  assert.equal(lancer(racine, 'publier').code, 0)
  for (const relatif of PAQUETS) {
    assert.equal(JSON.parse(lire(racine, relatif)).version, '0.4.1')
  }
  assert.equal(lancer(racine, 'valider').code, 0)
})

test('valider refuse un fragment rattaché à une version future', () => {
  const racine = depot('0.4.0')
  fragment(racine, '2026-01-01-serveur-a', {
    type: 'correctif',
    version: '0.5.0',
  })
  const { code, sortie } = lancer(racine, 'valider')
  assert.equal(code, 1)
  assert.match(sortie, /dépasse la version du produit/)
})

test('release : consignes de migration en tête, notes internes absentes', () => {
  const racine = depot('0.2.0')
  fragment(racine, '2026-01-01-serveur-rupture', {
    type: 'rupture',
    audience: 'interne',
    version: '0.2.0',
  })
  fragment(racine, '2026-01-02-serveur-interne', {
    type: 'fonctionnalite',
    audience: 'interne',
    version: '0.2.0',
  })
  fragment(racine, '2026-01-03-orga-ecran', {
    type: 'fonctionnalite',
    version: '0.2.0',
  })
  fragment(racine, '2026-01-04-serveur-ancien', {
    type: 'fonctionnalite',
    version: '0.1.0',
  })

  const { code, sortie } = lancer(racine, 'release', '--version', '0.2.0')
  assert.equal(code, 0)
  assert.equal(
    sortie,
    [
      '## Consignes de migration',
      '',
      '- **Titre de 2026-01-01-serveur-rupture (Serveur)**\\',
      '  Migration de 2026-01-01-serveur-rupture.',
      '',
      '## Espace organisateur',
      '',
      '- **Titre de 2026-01-03-orga-ecran**\\',
      '  Texte de 2026-01-03-orga-ecran.',
      '',
    ].join('\n')
  )
})

test('release : une version sans note publique le dit', () => {
  const racine = depot('0.2.1')
  fragment(racine, '2026-01-01-serveur-a', {
    type: 'interne',
    audience: 'interne',
    version: '0.2.1',
  })
  assert.equal(
    lancer(racine, 'release').sortie,
    'Cette version ne contient que des changements internes au projet.\n'
  )
})

test('release refuse une version sans fragment', () => {
  const racine = depot('0.2.0')
  const { code, erreur } = lancer(racine, 'release', '--version', '0.9.0')
  assert.equal(code, 1)
  assert.match(erreur, /aucun fragment ne porte la version 0\.9\.0/)
})

/** Lance `noter` à un instant et dans un fuseau fixés, et rend les fragments créés. */
function noterLe(racine, instant, fuseau) {
  const resultat = lancerAvec(
    racine,
    { TZ: fuseau, VERSIONNER_MAINTENANT: instant },
    'noter',
    '--cible',
    'orga',
    '--type',
    'correctif',
    '--audience',
    'organisateurs',
    '--titre',
    'Un titre'
  )
  assert.equal(resultat.code, 0, resultat.erreur)
  return readdirSync(join(racine, 'notes/fragments'))
}

test('noter date le fragment du jour local, en avance sur le jour UTC', () => {
  // 22 h 30 UTC le 4 octobre correspond à 0 h 30 le 5 octobre à Paris.
  assert.deepEqual(
    noterLe(depot('0.8.1'), '2026-10-04T22:30:00.000Z', 'Europe/Paris'),
    ['2026-10-05-orga-un-titre.md']
  )
})

test('noter date le fragment du jour local, en retard sur le jour UTC', () => {
  // 3 h 30 UTC le 2 mars correspond à 22 h 30 le 1er mars à Montréal.
  assert.deepEqual(
    noterLe(depot('0.8.1'), '2027-03-02T03:30:00.000Z', 'America/Montreal'),
    ['2027-03-01-orga-un-titre.md']
  )
})

test('noter garde le jour UTC quand le poste est en UTC', () => {
  assert.deepEqual(noterLe(depot('0.8.1'), '2026-10-04T22:30:00.000Z', 'UTC'), [
    '2026-10-04-orga-un-titre.md',
  ])
})

// Une variable vide est une valeur illisible, pas une variable absente.
for (const valeur of ['demain', '']) {
  test(`noter refuse l'instant illisible « ${valeur} »`, () => {
    const racine = depot('0.8.1')
    const { code, erreur } = lancerAvec(
      racine,
      { VERSIONNER_MAINTENANT: valeur },
      'noter',
      '--cible',
      'orga',
      '--type',
      'correctif',
      '--audience',
      'organisateurs',
      '--titre',
      'Un titre'
    )
    assert.equal(code, 1)
    assert.ok(
      erreur.includes(
        `VERSIONNER_MAINTENANT « ${valeur} » n'est pas un instant`
      ),
      erreur
    )
    assert.deepEqual(readdirSync(join(racine, 'notes/fragments')), [])
  })
}

test('compiler donne à chaque note des organisateurs son rôle, « referent » par défaut', () => {
  const racine = depot('0.2.0')
  fragment(racine, '2026-01-01-orga-pour-tous', {
    type: 'correctif',
    version: '0.2.0',
  })
  fragment(racine, '2026-01-02-orga-pour-les-admins', {
    type: 'correctif',
    role: 'admin-activite',
    version: '0.2.0',
  })
  fragment(racine, '2026-01-03-orga-interne', {
    type: 'interne',
    audience: 'interne',
    version: '0.2.0',
  })
  assert.equal(lancer(racine, 'compiler').code, 0)
  assert.deepEqual(
    journal(racine, 'orga').versions[0].notes.map(n => [n.id, n.role]),
    [
      ['2026-01-03-orga-interne', null],
      ['2026-01-02-orga-pour-les-admins', 'admin-activite'],
      ['2026-01-01-orga-pour-tous', 'referent'],
    ]
  )
})

test('valider refuse un rôle inconnu, et un rôle hors de l’audience des organisateurs', () => {
  const racine = depot('0.2.0')
  fragment(racine, '2026-01-01-orga-inconnu', {
    type: 'correctif',
    role: 'benevole',
  })
  fragment(racine, '2026-01-02-orga-interne', {
    type: 'interne',
    audience: 'interne',
    role: 'admin-organisation',
  })
  const { code, sortie } = lancer(racine, 'valider')
  assert.equal(code, 1)
  assert.ok(
    sortie.includes('valeur « benevole » inconnue pour « role »'),
    sortie
  )
  assert.ok(
    sortie.includes(
      "« role » ne s'emploie qu'avec l'audience « organisateurs »"
    ),
    sortie
  )
})

test('noter écrit le rôle demandé, et « referent » sans option', () => {
  const racine = depot('0.2.0')
  const noter = (titre, ...options) =>
    lancer(
      racine,
      'noter',
      '--cible',
      'orga',
      '--type',
      'correctif',
      '--titre',
      titre,
      ...options
    )
  assert.equal(noter('Pour tous', '--audience', 'organisateurs').code, 0)
  assert.equal(
    noter(
      'Pour les admins',
      '--audience',
      'organisateurs',
      '--role',
      'admin-organisation'
    ).code,
    0
  )
  const refus = noter('Interne', '--audience', 'interne', '--role', 'referent')
  assert.equal(refus.code, 1)
  const [admins, tous] = readdirSync(join(racine, 'notes/fragments'))
    .sort((a, b) => a.slice(11).localeCompare(b.slice(11)))
    .map(nom => lire(racine, `notes/fragments/${nom}`))
  assert.match(admins, /^role: admin-organisation$/m)
  assert.match(tous, /^role: referent$/m)
})
