#!/usr/bin/env node
// captures : photographie les écrans de l'espace organisateur pour le site.
//
//   node outils/captures.mjs --origine http://localhost:4460
//   node outils/captures.mjs --compte referent
//   node outils/captures.mjs --seulement editions,equipe
//   node outils/captures.mjs --largeur 375 --hauteur 812 --mobile --sortie /tmp/captures-mobile
//
// Chaque écran se photographie avec le compte du rôle que son mode d'emploi
// décrit : `--compte` choisit le rôle, et une passe prend tous ses écrans. Le
// site se refait donc en trois passes, une par rôle.
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
    // Rôle du compte connecté : la passe prend les écrans de ce rôle.
    compte: { type: 'string', default: 'admin-organisation' },
    // Noms des écrans à photographier, séparés par des virgules, quel que soit
    // leur rôle. Par défaut, tous ceux du rôle choisi.
    seulement: { type: 'string' },
    // Taille de la fenêtre photographiée. `--mobile` émule un téléphone : écran
    // tactile et agent de navigation mobile, pour les règles `(pointer: coarse)`.
    largeur: { type: 'string', default: '1440' },
    hauteur: { type: 'string', default: '900' },
    mobile: { type: 'boolean', default: false },
  },
})

const CHROME =
  values.chrome ??
  process.env.CHROME ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'google-chrome')

const LARGEUR = Number(values.largeur)
const HAUTEUR = Number(values.hauteur)
if (
  !Number.isInteger(LARGEUR) ||
  !Number.isInteger(HAUTEUR) ||
  LARGEUR < 320 ||
  HAUTEUR < 480
) {
  console.error(
    '✖ --largeur (320 au moins) et --hauteur (480 au moins) sont des nombres de pixels.'
  )
  process.exit(1)
}

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

// Le compte de chaque rôle, sur l'instance d'exemple. Un compte d'un rôle plus
// large montrerait des menus et des boutons que le rôle décrit ne voit pas.
const COMPTES = {
  'admin-organisation': 'un admin de l’organisation',
  'admin-activite':
    'un admin de l’activité, qui n’est pas admin de l’organisation',
  referent:
    'une personne affectée au pôle Bénévoles seulement, sans rôle d’admin, avec un droit de rédaction sur ce pôle',
}

/**
 * Les écrans photographiés : nom du fichier, rôle du compte (`compte`, admin de
 * l'organisation par défaut), chemin, réglage du navigateur avant le chargement
 * (`avant`) et geste après le chargement (`apres`).
 */
const ECRANS = [
  // ── Guide des référentes et référents ──────────────────────────────────────
  { nom: 'mon-espace', compte: 'referent', chemin: `${ACTIVITE}/` },
  {
    nom: 'retroplanning',
    compte: 'referent',
    chemin: `${ACTIVITE}/retroplanning`,
  },
  {
    nom: 'fiches-cartes',
    compte: 'referent',
    chemin: `${ACTIVITE}/fiches`,
    avant: "localStorage.setItem('relaytour.fiches.affichage', 'cartes')",
  },
  {
    nom: 'fiches-liste',
    compte: 'referent',
    chemin: `${ACTIVITE}/fiches`,
    avant: "localStorage.setItem('relaytour.fiches.affichage', 'liste')",
  },
  {
    nom: 'fiche',
    compte: 'referent',
    chemin: `${ACTIVITE}/fiches/planifier-les-creneaux`,
  },
  // Le périmètre de la personne, avec ses tâches et le droit d'y écrire.
  {
    nom: 'perimetre',
    compte: 'referent',
    chemin: `${ACTIVITE}/perimetres/benevoles`,
  },
  // Un périmètre ouvert en consultation (ADR 0014) : la personne n'y est pas
  // affectée.
  {
    nom: 'perimetre-consultation',
    compte: 'referent',
    chemin: `${ACTIVITE}/perimetres/football`,
  },
  { nom: 'preferences', compte: 'referent', chemin: `${ACTIVITE}/preferences` },
  // ── Guide de l'admin d'activité ────────────────────────────────────────────
  // L'équipe d'une activité, lue par un de ses admins (ADR 0018).
  {
    nom: 'equipe',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/equipe`,
  },
  {
    nom: 'personnes',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/personnes`,
  },
  // La fenêtre d'un compte, où un admin d'activité affecte la personne et note
  // ses souhaits.
  {
    nom: 'personnes-compte',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/personnes`,
    apres: cliquerLibelle('Modifier le compte de Sofia Lambert'),
  },
  // Un message préparé pour toute l'équipe (ADR 0020). La fenêtre n'ouvre aucune
  // messagerie tant que personne ne clique son bouton.
  {
    nom: 'message',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/equipe`,
    apres: cliquer('Écrire à l’équipe'),
  },
  // Le champ « Messagerie » en bas de la fenêtre (ADR 0022). Le geste ouvre la
  // fenêtre, puis la fait défiler jusqu'en bas. antd la remonte quand il y place
  // le focus : le défilement se répète pendant une seconde avant la capture.
  {
    nom: 'message-messagerie',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/equipe`,
    apres: `(fenetre => {
      if (!fenetre) return (${cliquer('Écrire à l’équipe')}, false)
      if (!fenetre.querySelector('[aria-label="Messagerie"]')) return false
      fenetre.scrollTo(0, fenetre.scrollHeight)
      fenetre.dataset.defilements = Number(fenetre.dataset.defilements ?? 0) + 1
      return Number(fenetre.dataset.defilements) >= 5
    })(document.querySelector('.ant-modal-wrap'))`,
  },
  // Le réglage de la messagerie, réservé aux admins (ADR 0022).
  {
    nom: 'preferences-messagerie',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/preferences`,
    apres: defiler('Votre messagerie'),
  },
  // L'historique des messages. L'instance d'exemple doit en porter au moins un.
  {
    nom: 'personnes-messages',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/personnes?onglet=messages`,
  },
  // La file de revue (ADR 0015). L'instance d'exemple doit porter une demande en
  // attente, proposée par une personne fictive.
  {
    nom: 'personnes-demandes',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/personnes?onglet=demandes`,
  },
  {
    nom: 'avancement',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/avancement`,
  },
  {
    nom: 'classement',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/classement`,
  },
  {
    nom: 'editions',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/editions`,
  },
  {
    nom: 'equipe-reglage',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/equipe`,
    apres: cliquerLibelle('Régler le périmètre Football'),
  },
  // Les droits de rédaction des périmètres de l'activité.
  {
    nom: 'redaction',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/redaction`,
  },
  {
    nom: 'activites',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/activites`,
  },
  // ── Admin de l'organisation ────────────────────────────────────────────────
  // Le formulaire public (ADR 0015) : l'activité d'exemple doit l'avoir ouvert.
  { nom: 'rejoindre', chemin: '/rejoindre/rencontres-de-la-vallee/rencontres' },
  // L'annuaire de l'organisation, avec les activités de chaque personne (ADR 0018).
  { nom: 'annuaire', chemin: `${ACTIVITE}/admin/annuaire` },
  {
    nom: 'personnes-roles',
    chemin: `${ACTIVITE}/admin/annuaire`,
    apres: cliquerLibelle('Modifier le compte de Léa Bernard'),
  },
  // Les admins de l'organisation et de chaque activité (ADR 0019).
  { nom: 'admins', chemin: `${ACTIVITE}/admin/admins` },
  // Le même écran pour un admin de l'organisation, qui accorde aussi un droit sur
  // toutes les fiches.
  { nom: 'redaction-organisation', chemin: `${ACTIVITE}/admin/redaction` },
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
].map(ecran => ({ compte: 'admin-organisation', ...ecran }))

if (!(values.compte in COMPTES)) {
  console.error(
    `Rôle inconnu : ${values.compte}. Rôles : ${Object.keys(COMPTES).join(', ')}`
  )
  process.exit(1)
}

const choisis = values.seulement?.split(',').map(nom => nom.trim())
const inconnus = (choisis ?? []).filter(nom => !ECRANS.some(e => e.nom === nom))
if (inconnus.length > 0) {
  console.error(`Écrans inconnus : ${inconnus.join(', ')}`)
  process.exit(1)
}

const aPrendre = ECRANS.filter(e =>
  choisis ? choisis.includes(e.nom) : e.compte === values.compte
)

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
// Avec --seulement, les écrans choisis disent quel compte utiliser.
for (const role of new Set(aPrendre.map(e => e.compte))) {
  const noms = aPrendre.filter(e => e.compte === role).map(e => e.nom)
  console.log(`${noms.join(', ')} : ${COMPTES[role]}.`)
}
console.log(
  'Connectez-vous dans la fenêtre Chrome avec ce compte fictif. Le code arrive dans Mailpit.'
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
  deviceScaleFactor: values.mobile ? 2 : 1,
  mobile: values.mobile,
})
if (values.mobile) {
  await envoyer('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  })
  // L'espace organisateur lit l'agent de navigation pour choisir les étapes
  // d'installation : un téléphone Android sous Chrome.
  await envoyer('Emulation.setUserAgentOverride', {
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36',
    platform: 'Android',
  })
}
mkdirSync(values.sortie, { recursive: true })
let echecs = 0

for (const ecran of aPrendre) {
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
  // Le menu d'un admin de l'organisation dépasse la hauteur de la fenêtre :
  // l'entrée de l'écran photographié doit rester visible.
  await evaluer(
    "document.querySelector('.ant-menu-item-selected')?.scrollIntoView({ block: 'nearest' })"
  )
  await attendre(200)
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
