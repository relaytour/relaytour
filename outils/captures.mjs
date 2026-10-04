#!/usr/bin/env node
// captures : photographie les écrans de l'espace organisateur pour le site.
//
//   node outils/captures.mjs --origine http://localhost:4460
//   node outils/captures.mjs --seulement editions,equipe
//
// Le script ouvre Google Chrome avec un profil temporaire et le pilote par son
// protocole de débogage (WebSocket natif de Node 24, aucune dépendance). La
// personne se connecte elle-même dans la fenêtre, avec le code reçu par mail :
// le script ne saisit jamais de code. Il enregistre ensuite chaque écran en
// WebP dans site/captures/.
//
// Utilisez une instance au contenu fictif (content/exemple) et des comptes
// fictifs : les captures sont publiques.

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const { values } = parseArgs({
  options: {
    origine: { type: 'string', default: 'http://localhost:4460' },
    sortie: { type: 'string', default: join(RACINE, 'site/captures') },
    chrome: { type: 'string' },
    port: { type: 'string', default: '9333' },
    // Noms des écrans à photographier, séparés par des virgules. Tous par défaut.
    seulement: { type: 'string' },
  },
})

const CHROME =
  values.chrome ??
  process.env.CHROME ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'google-chrome')

const LARGEUR = 1440
const HAUTEUR = 900

// Les écrans d'administration vivent sous l'identifiant de l'activité (ADR 0008).
const ACTIVITE = '/rencontres'

// Chaque geste vaut vrai quand sa cible existe : la boucle de capture l'attend, au
// lieu de photographier un écran où le clic n'a rien fait.

/** Clique le premier élément de <main> dont le texte vaut `texte`. */
const cliquer = texte =>
  `(e => (e?.click(), Boolean(e)))([...document.querySelectorAll('main a, main button')].find(e => e.innerText.trim() === ${JSON.stringify(texte)}))`

/** Clique le premier élément de <main> dont le libellé d'accessibilité vaut `libelle`. */
const cliquerLibelle = libelle =>
  `(e => (e?.click(), Boolean(e)))(document.querySelector(${JSON.stringify(`main [aria-label="${libelle}"]`)}))`

/** Fait défiler jusqu'au titre dont le texte vaut `texte`. */
const defiler = texte =>
  `(e => (e?.scrollIntoView({ block: 'start' }), Boolean(e)))([...document.querySelectorAll('main h2, main h3, main .ant-card-head-title')].find(e => e.innerText.trim() === ${JSON.stringify(texte)}))`

/**
 * Les écrans photographiés : nom du fichier, chemin, réglage du navigateur avant
 * le chargement (`avant`) et geste après le chargement (`apres`). Un écran
 * `surDemande` demande un autre compte : il ne se prend qu'avec --seulement.
 */
const ECRANS = [
  { nom: 'mon-espace', chemin: `${ACTIVITE}/` },
  { nom: 'retroplanning', chemin: `${ACTIVITE}/retroplanning` },
  {
    nom: 'fiches-cartes',
    chemin: `${ACTIVITE}/fiches`,
    avant: "localStorage.setItem('relaytour.fiches.affichage', 'cartes')",
  },
  {
    nom: 'fiches-liste',
    chemin: `${ACTIVITE}/fiches`,
    avant: "localStorage.setItem('relaytour.fiches.affichage', 'liste')",
  },
  { nom: 'fiche', chemin: `${ACTIVITE}/fiches/planifier-les-creneaux` },
  { nom: 'perimetre', chemin: `${ACTIVITE}/perimetres/coordination` },
  // Un périmètre ouvert en consultation (ADR 0014). L'écran se photographie avec le
  // compte d'une personne affectée à un autre périmètre de l'activité, sans rôle
  // d'admin : il ne se prend que sur demande, par --seulement.
  {
    nom: 'perimetre-consultation',
    chemin: `${ACTIVITE}/perimetres/football`,
    surDemande: true,
  },
  { nom: 'preferences', chemin: `${ACTIVITE}/preferences` },
  // Le formulaire public (ADR 0015) : l'activité d'exemple doit l'avoir ouvert.
  { nom: 'rejoindre', chemin: '/rejoindre/rencontres-de-la-vallee/rencontres' },
  { nom: 'avancement', chemin: `${ACTIVITE}/admin/avancement` },
  { nom: 'editions', chemin: `${ACTIVITE}/admin/editions` },
  { nom: 'equipe', chemin: `${ACTIVITE}/admin/equipe` },
  {
    nom: 'equipe-reglage',
    chemin: `${ACTIVITE}/admin/equipe`,
    apres: cliquerLibelle('Régler le périmètre Football'),
  },
  { nom: 'personnes', chemin: `${ACTIVITE}/admin/personnes` },
  // La file de revue (ADR 0015). L'instance d'exemple doit porter une demande en
  // attente, proposée par une personne fictive.
  {
    nom: 'personnes-demandes',
    chemin: `${ACTIVITE}/admin/personnes?onglet=demandes`,
  },
  {
    nom: 'personnes-roles',
    chemin: `${ACTIVITE}/admin/personnes`,
    apres: cliquer('Léa Bernard'),
  },
  { nom: 'redaction', chemin: `${ACTIVITE}/admin/redaction` },
  { nom: 'activites', chemin: `${ACTIVITE}/admin/activites` },
  {
    nom: 'activites-nouvelle',
    chemin: `${ACTIVITE}/admin/activites`,
    apres: cliquer('Nouvelle activité'),
  },
  { nom: 'organisation', chemin: `${ACTIVITE}/admin/organisation` },
  {
    nom: 'organisation-contenu',
    chemin: `${ACTIVITE}/admin/organisation`,
    apres: defiler('Contenu de l’organisation'),
  },
]

const choisis = values.seulement?.split(',').map(nom => nom.trim())
const inconnus = (choisis ?? []).filter(nom => !ECRANS.some(e => e.nom === nom))
if (inconnus.length > 0) {
  console.error(`Écrans inconnus : ${inconnus.join(', ')}`)
  process.exit(1)
}

const attendre = ms => new Promise(r => setTimeout(r, ms))

// ── Chrome ──────────────────────────────────────────────────────────────────

const profil = mkdtempSync(join(tmpdir(), 'relaytour-captures-'))
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${values.port}`,
    `--user-data-dir=${profil}`,
    `--window-size=${LARGEUR},${HAUTEUR + 120}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Une fenêtre recouverte par une autre ne doit pas suspendre ses animations :
    // une fenêtre modale resterait invisible sur la capture.
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    `${values.origine}/connexion`,
  ],
  { stdio: 'ignore' }
)

// Chrome écrit dans son profil jusqu'à sa sortie : le profil s'efface après.
async function fermer(code = 0) {
  if (chrome.exitCode === null) {
    const sortie = new Promise(ok => chrome.once('exit', ok))
    chrome.kill()
    await Promise.race([sortie, attendre(5000)])
  }
  rmSync(profil, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  })
  process.exit(code)
}
process.on('SIGINT', () => void fermer(130))

async function cible() {
  for (let essai = 0; essai < 50; essai += 1) {
    try {
      const reponse = await fetch(`http://127.0.0.1:${values.port}/json/list`)
      const pages = (await reponse.json()).filter(p => p.type === 'page')
      if (pages.length > 0) return pages[0].webSocketDebuggerUrl
    } catch {
      // Chrome démarre encore.
    }
    await attendre(200)
  }
  throw new Error('Chrome ne répond pas sur le port de débogage.')
}

const socket = new WebSocket(await cible())
await new Promise((ok, ko) => {
  socket.addEventListener('open', ok, { once: true })
  socket.addEventListener('error', ko, { once: true })
})

let prochainId = 1
const enAttente = new Map()
socket.addEventListener('message', evenement => {
  const message = JSON.parse(evenement.data)
  const promesse = enAttente.get(message.id)
  if (!promesse) return
  enAttente.delete(message.id)
  if (message.error) promesse.ko(new Error(message.error.message))
  else promesse.ok(message.result)
})

function envoyer(methode, params = {}) {
  const id = prochainId++
  socket.send(JSON.stringify({ id, method: methode, params }))
  return new Promise((ok, ko) => enAttente.set(id, { ok, ko }))
}

async function evaluer(expression) {
  const { result } = await envoyer('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  return result.value
}

// ── Connexion par la personne ───────────────────────────────────────────────

await envoyer('Page.enable')
await envoyer('Runtime.enable')
console.log(
  'Connectez-vous dans la fenêtre Chrome avec un compte fictif. Le code arrive dans Mailpit.'
)
// Pendant un chargement, la page ne répond pas, répond sans valeur ou porte encore
// une adresse vide (about:blank). Seule une page de l'instance, autre que celle de
// la connexion, prouve la session.
const horsConnexion = adresse =>
  typeof adresse === 'string' &&
  adresse.startsWith(`${values.origine}/`) &&
  new URL(adresse).pathname !== '/connexion'
for (;;) {
  if (horsConnexion(await evaluer('location.href').catch(() => undefined)))
    break
  await attendre(1000)
}
console.log('✔ Session ouverte. Les captures commencent.')

// ── Captures ────────────────────────────────────────────────────────────────

await envoyer('Emulation.setDeviceMetricsOverride', {
  width: LARGEUR,
  height: HAUTEUR,
  deviceScaleFactor: 1,
  mobile: false,
})
mkdirSync(values.sortie, { recursive: true })
let echecs = 0

for (const ecran of ECRANS.filter(e =>
  choisis ? choisis.includes(e.nom) : !e.surDemande
)) {
  if (ecran.avant) await evaluer(ecran.avant)
  await envoyer('Page.navigate', { url: `${values.origine}${ecran.chemin}` })
  await attendre(2500)
  // Sans session, l'application renvoie à la connexion : cet écran ne se publie pas.
  if (!horsConnexion(await evaluer('location.href').catch(() => undefined))) {
    console.error(`✖ ${ecran.nom} : la session n'est pas ouverte.`)
    echecs += 1
    continue
  }
  if (ecran.apres) {
    // La cible d'un geste arrive avec les données de la page : le geste se répète
    // jusqu'à la trouver, cinq secondes au plus.
    let trouve = false
    for (let essai = 0; essai < 20 && !trouve; essai += 1) {
      trouve = await evaluer(ecran.apres)
      if (!trouve) await attendre(250)
    }
    if (!trouve) {
      console.error(`✖ ${ecran.nom} : la cible du geste est introuvable.`)
      echecs += 1
      continue
    }
    await attendre(1200)
  }
  await evaluer('document.fonts.ready.then(() => true)')
  const { data } = await envoyer('Page.captureScreenshot', {
    format: 'webp',
    quality: 88,
  })
  const fichier = join(values.sortie, `${ecran.nom}.webp`)
  writeFileSync(fichier, Buffer.from(data, 'base64'))
  console.log(`✔ ${fichier}`)
}

socket.close()
await fermer(echecs > 0 ? 1 : 0)
