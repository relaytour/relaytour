#!/usr/bin/env node
// captures : photographie les écrans de l'espace organisateur pour le site.
//
//   node outils/captures.mjs --origine http://localhost:4460
//   node outils/captures.mjs --compte referent
//   node outils/captures.mjs --seulement editions,equipe
//   node outils/captures.mjs --largeur 375 --hauteur 812 --mobile --sortie /tmp/captures-mobile
//   node outils/captures.mjs --simulateur Relaytour --amont http://localhost:4571 --sortie site/captures/mobile
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
// Avec --simulateur, les captures viennent de l'application installée sur un
// simulateur iOS démarré, pas d'un navigateur (macOS, Xcode et cwebp). Le script
// écoute alors à l'adresse de --origine et relaie l'espace organisateur, qui
// tourne à l'adresse de --amont. La personne ajoute l'application à l'écran
// d'accueil du simulateur depuis Safari, l'ouvre et s'y connecte.
//
// Utilisez une instance au contenu fictif (content/exemple) et des comptes
// fictifs : les captures sont publiques.

import { execFileSync, spawn } from 'node:child_process'
import http from 'node:http'
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
    // Nom ou identifiant d'un simulateur iOS démarré : les captures viennent de
    // l'application installée sur son écran d'accueil, pas d'un navigateur.
    simulateur: { type: 'string' },
    // Avec --simulateur : l'adresse où tourne l'espace organisateur. Le script le
    // relaie à l'adresse de --origine, celle que l'application installée ouvre.
    amont: { type: 'string' },
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
    avant:
      "localStorage.setItem('relaytour.retroplanning.regroupement', 'mois')",
  },
  // Le même écran, rangé par phase puis par périmètre (ADR 0025).
  {
    nom: 'retroplanning-phases',
    compte: 'referent',
    chemin: `${ACTIVITE}/retroplanning`,
    avant:
      "localStorage.setItem('relaytour.retroplanning.regroupement', 'phase')",
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
    avant: "localStorage.setItem('relaytour.taches.regroupement', 'echeance')",
  },
  // Les tâches du périmètre rangées par phase (ADR 0025).
  {
    nom: 'perimetre-phases',
    compte: 'referent',
    chemin: `${ACTIVITE}/perimetres/benevoles`,
    avant: "localStorage.setItem('relaytour.taches.regroupement', 'phase')",
  },
  // Tâches partagées (ADR 0026). Le geste déplie le détail des déclinaisons de
  // chaque tâche partagée du périmètre, puis attend que le serveur l'ait rendu.
  {
    nom: 'perimetre-partage',
    compte: 'referent',
    chemin: `${ACTIVITE}/perimetres/benevoles`,
    avant: "localStorage.setItem('relaytour.taches.regroupement', 'echeance')",
    apres: `(resumes => {
      if (resumes.length === 0) return false
      for (const resume of resumes)
        if (resume.getAttribute('aria-expanded') !== 'true') resume.click()
      resumes[0].closest('.rt-carte-tache').scrollIntoView({ block: 'center' })
      return document.querySelectorAll('main .rt-declinaisons-liste .rt-etiquette').length > 0
    })([...document.querySelectorAll('main .rt-declinaisons-resume')])`,
  },
  // La fenêtre « Nouvelle tâche », avec les périmètres où la décliner. Le geste
  // ouvre la fenêtre, ajoute les sports, puis la fait défiler jusqu'à ce champ.
  {
    nom: 'tache-decliner',
    compte: 'referent',
    chemin: `${ACTIVITE}/perimetres/benevoles`,
    apres: `(fenetre => {
      if (!fenetre) return (${cliquer('Nouvelle tâche')}, false)
      const sports = fenetre.querySelector('[aria-label="Ajouter tous les périmètres du groupe Sports"]')
      if (!sports) return false
      if (!sports.disabled) return (sports.click(), false)
      const champ = [...fenetre.querySelectorAll('label')].find(l => l.innerText.trim().startsWith('Décliner dans'))
      if (!champ) return false
      champ.scrollIntoView({ block: 'start' })
      fenetre.dataset.defilements = Number(fenetre.dataset.defilements ?? 0) + 1
      return Number(fenetre.dataset.defilements) >= 5
    })(document.querySelector('.ant-modal-wrap'))`,
  },
  // Un périmètre qui reçoit une tâche proposée : l'instance d'exemple doit porter
  // une déclinaison en attente pour le volley, et le compte y être affecté.
  {
    nom: 'perimetre-propositions',
    compte: 'referent',
    chemin: `${ACTIVITE}/perimetres/volley`,
    avant: "localStorage.setItem('relaytour.taches.regroupement', 'echeance')",
  },
  // Un périmètre ouvert en consultation (ADR 0014) : la personne n'y est pas
  // affectée.
  {
    nom: 'perimetre-consultation',
    compte: 'referent',
    chemin: `${ACTIVITE}/perimetres/football`,
    avant: "localStorage.setItem('relaytour.taches.regroupement', 'echeance')",
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
  // Les phases de l'activité, dans sa fenêtre de modification (ADR 0025). Le
  // geste ouvre la fenêtre, puis la fait défiler jusqu'aux phases. antd la remonte
  // quand il y place le focus : le défilement se répète avant la capture.
  {
    nom: 'activites-phases',
    compte: 'admin-activite',
    chemin: `${ACTIVITE}/admin/activites`,
    apres: `(fenetre => {
      if (!fenetre) return (${cliquerLibelle('Modifier Les Rencontres de la Vallée')}, false)
      const phases = [...fenetre.querySelectorAll('label')].find(l => l.innerText.trim() === 'Phases')
      if (!phases) return false
      // Sur un téléphone, la fenêtre occupe l'écran : le libellé reste sous la barre d'état.
      if (window.innerWidth < 768) phases.style.scrollMarginTop = '96px'
      phases.scrollIntoView({ block: 'start' })
      fenetre.dataset.defilements = Number(fenetre.dataset.defilements ?? 0) + 1
      return Number(fenetre.dataset.defilements) >= 5
    })(document.querySelector('.ant-modal-wrap'))`,
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

// Largeur des captures du simulateur, en pixels : deux par point d'écran.
const LARGEUR_SIMULATEUR = 804

// Un pilote ouvre l'application, évalue une expression dans la page, charge un
// chemin et enregistre l'écran. Chrome photographie une fenêtre de navigateur ;
// le simulateur iOS photographie l'application installée (ADR 0023).
const pilote = values.simulateur
  ? await piloteSimulateur()
  : await piloteChrome()
process.on('SIGINT', () => void pilote.fermer(130))

// ── Chrome ──────────────────────────────────────────────────────────────────

async function piloteChrome() {
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

  await envoyer('Page.enable')
  await envoyer('Runtime.enable')

  return {
    consigne:
      'Connectez-vous dans la fenêtre Chrome avec ce compte fictif. Le code arrive dans Mailpit.',
    extension: 'webp',
    async evaluer(expression) {
      const { result } = await envoyer('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      return result.value
    },
    async preparer() {
      await envoyer('Emulation.setDeviceMetricsOverride', {
        width: LARGEUR,
        height: HAUTEUR,
        deviceScaleFactor: values.mobile ? 2 : 1,
        mobile: values.mobile,
      })
      if (!values.mobile) return
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
    },
    async naviguer(chemin) {
      await envoyer('Page.navigate', { url: `${values.origine}${chemin}` })
    },
    async capturer(fichier) {
      const { data } = await envoyer('Page.captureScreenshot', {
        format: 'webp',
        quality: 88,
      })
      writeFileSync(fichier, Buffer.from(data, 'base64'))
    },
    // Chrome écrit dans son profil jusqu'à sa sortie : le profil s'efface après.
    async fermer(code = 0) {
      socket.close()
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
    },
  }
}

// ── Simulateur iOS ──────────────────────────────────────────────────────────

// L'application installée ne se pilote pas de l'extérieur : aucun protocole de
// débogage n'y entre. Le script se place donc devant l'espace organisateur : un
// relais écoute à l'adresse de `--origine`, transmet chaque requête à `--amont`
// et ajoute un petit script aux pages. Ce script vient chercher les expressions
// à évaluer et renvoie leur résultat. Rien de tout cela n'existe hors du relais :
// l'application photographiée est celle du build.
async function piloteSimulateur() {
  if (!values.amont) {
    console.error(
      '✖ --simulateur demande --amont : l’adresse où tourne l’espace organisateur, que le relais sert à l’adresse de --origine.'
    )
    process.exit(1)
  }
  const simctl = (...args) =>
    execFileSync('xcrun', ['simctl', ...args], {
      encoding: 'utf8',
      // simctl annonce chaque capture sur sa sortie d'erreur.
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  const appareil = values.simulateur
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' })
  } catch {
    console.error(
      '✖ cwebp est introuvable : il convertit les captures du simulateur (brew install webp).'
    )
    process.exit(1)
  }

  const PILOTE = `(() => {
  if (window.__relaytourPilote) return
  window.__relaytourPilote = true
  const boucle = async () => {
    for (;;) {
      try {
        const ordre = await (await fetch('/__captures/ordre')).json()
        if (ordre.id === undefined) continue
        let valeur, erreur
        try { valeur = await (0, eval)(ordre.expression) } catch (e) { erreur = String(e) }
        await fetch('/__captures/resultat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: ordre.id, valeur, erreur }),
        })
      } catch {
        await new Promise(r => setTimeout(r, 500))
      }
    }
  }
  void boucle()
})()`

  const ordres = []
  const demandeurs = []
  const resultats = new Map()
  let prochain = 1
  const servir = () => {
    while (ordres.length > 0 && demandeurs.length > 0) {
      const res = demandeurs.shift()
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(ordres.shift()))
    }
  }

  const amont = new URL(values.amont)
  const relais = http.createServer((req, res) => {
    if (req.url === '/__captures/pilote.js') {
      res.writeHead(200, {
        'content-type': 'text/javascript',
        'cache-control': 'no-store',
      })
      res.end(PILOTE)
      return
    }
    if (req.url === '/__captures/ordre') {
      demandeurs.push(res)
      // Une page qui change d'adresse abandonne son attente : sa réponse quitte
      // la file, sinon le prochain ordre partirait dans une connexion fermée.
      res.on('close', () => {
        const i = demandeurs.indexOf(res)
        if (i >= 0) demandeurs.splice(i, 1)
      })
      // Une attente longue se referme d'elle-même : la page en ouvre une autre.
      setTimeout(() => {
        const i = demandeurs.indexOf(res)
        if (i < 0) return
        demandeurs.splice(i, 1)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{}')
      }, 20_000)
      servir()
      return
    }
    if (req.url === '/__captures/resultat') {
      let corps = ''
      req.on('data', morceau => (corps += morceau))
      req.on('end', () => {
        const { id, valeur, erreur } = JSON.parse(corps)
        resultats.get(id)?.({ valeur, erreur })
        resultats.delete(id)
        res.writeHead(204).end()
      })
      return
    }
    // Sans compression, pour lire la page ; l'hôte reste celui de l'origine, que
    // la connexion vérifie.
    const enTetes = { ...req.headers, 'accept-encoding': 'identity' }
    const versAmont = http.request(
      {
        hostname: amont.hostname,
        port: amont.port,
        path: req.url,
        method: req.method,
        headers: enTetes,
      },
      reponse => {
        const type = String(reponse.headers['content-type'] ?? '')
        if (!type.startsWith('text/html')) {
          res.writeHead(reponse.statusCode ?? 502, reponse.headers)
          reponse.pipe(res)
          return
        }
        const morceaux = []
        reponse.on('data', m => morceaux.push(m))
        reponse.on('end', () => {
          const page = Buffer.concat(morceaux)
            .toString('utf8')
            .replace(
              '</head>',
              '<script src="/__captures/pilote.js"></script></head>'
            )
          const sortants = { ...reponse.headers }
          delete sortants['content-length']
          delete sortants.etag
          sortants['cache-control'] = 'no-store'
          res.writeHead(reponse.statusCode ?? 200, sortants)
          res.end(page)
        })
      }
    )
    versAmont.on('error', () => res.writeHead(502).end())
    req.pipe(versAmont)
  })
  const origine = new URL(values.origine)
  await new Promise((ok, ko) => {
    relais.once('error', ko)
    // Sans hôte : « localhost » vaut ::1 ou 127.0.0.1 selon le simulateur.
    relais.listen(Number(origine.port), ok)
  })

  // Une barre d'état identique sur toutes les captures.
  simctl(
    'status_bar',
    appareil,
    'override',
    '--time',
    '9:41',
    '--batteryState',
    'charged',
    '--batteryLevel',
    '100',
    '--wifiBars',
    '3',
    '--cellularBars',
    '4'
  )

  const temporaire = mkdtempSync(join(tmpdir(), 'relaytour-captures-'))
  return {
    consigne: `Dans le simulateur « ${appareil} », ouvrez ${values.origine} dans Safari, ajoutez l’application à l’écran d’accueil, ouvrez-la et connectez-vous avec ce compte fictif. Le code arrive dans Mailpit.`,
    extension: 'webp',
    evaluer(expression) {
      const id = prochain++
      return new Promise((ok, ko) => {
        const minuteur = setTimeout(() => {
          resultats.delete(id)
          ko(new Error('La page ne répond pas.'))
        }, 15_000)
        resultats.set(id, ({ valeur, erreur }) => {
          clearTimeout(minuteur)
          if (erreur) ko(new Error(erreur))
          else ok(valeur)
        })
        ordres.push({ id, expression })
        servir()
      })
    },
    async preparer() {},
    // L'application installée garde sa fenêtre : la page charge le chemin
    // elle-même, puis le pilote se rebranche.
    async naviguer(chemin) {
      await this.evaluer(
        `setTimeout(() => location.assign(${JSON.stringify(chemin)}), 50), true`
      )
    },
    async capturer(fichier) {
      const png = join(temporaire, 'ecran.png')
      simctl('io', appareil, 'screenshot', '--type=png', png)
      // L'écran d'un iPhone compte trois pixels par point : deux suffisent au site.
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '86',
        '-resize',
        String(LARGEUR_SIMULATEUR),
        '0',
        png,
        '-o',
        fichier,
      ])
    },
    async fermer(code = 0) {
      relais.closeAllConnections()
      relais.close()
      try {
        simctl('status_bar', appareil, 'clear')
      } catch {
        // Le simulateur est peut-être déjà éteint.
      }
      rmSync(temporaire, { recursive: true, force: true })
      process.exit(code)
    },
  }
}

// ── Connexion par la personne ───────────────────────────────────────────────

// Avec --seulement, les écrans choisis disent quel compte utiliser.
for (const role of new Set(aPrendre.map(e => e.compte))) {
  const noms = aPrendre.filter(e => e.compte === role).map(e => e.nom)
  console.log(`${noms.join(', ')} : ${COMPTES[role]}.`)
}
console.log(pilote.consigne)
// Pendant un chargement, la page ne répond pas, répond sans valeur ou porte encore
// une adresse vide (about:blank). Seule une page de l'instance, autre que celle de
// la connexion, prouve la session.
const horsConnexion = adresse =>
  typeof adresse === 'string' &&
  adresse.startsWith(`${values.origine}/`) &&
  new URL(adresse).pathname !== '/connexion'
const adresseCourante = () =>
  pilote.evaluer('location.href').catch(() => undefined)
for (;;) {
  if (horsConnexion(await adresseCourante())) break
  await attendre(1000)
}
console.log('✔ Session ouverte. Les captures commencent.')

// ── Captures ────────────────────────────────────────────────────────────────

await pilote.preparer()
mkdirSync(values.sortie, { recursive: true })
let echecs = 0

for (const ecran of aPrendre) {
  if (ecran.avant) await pilote.evaluer(ecran.avant)
  await pilote.naviguer(ecran.chemin)
  await attendre(2500)
  // Sans session, l'application renvoie à la connexion : cet écran ne se publie pas.
  let adresse
  for (let essai = 0; essai < 10 && adresse === undefined; essai += 1) {
    adresse = await adresseCourante()
    if (adresse === undefined) await attendre(500)
  }
  if (!horsConnexion(adresse)) {
    console.error(`✖ ${ecran.nom} : la session n'est pas ouverte.`)
    echecs += 1
    continue
  }
  if (ecran.apres) {
    // La cible d'un geste arrive avec les données de la page : le geste se répète
    // jusqu'à la trouver, cinq secondes au plus.
    let trouve = false
    for (let essai = 0; essai < 20 && !trouve; essai += 1) {
      trouve = await pilote.evaluer(ecran.apres)
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
  await pilote.evaluer(
    "document.querySelector('.ant-menu-item-selected')?.scrollIntoView({ block: 'nearest' }), true"
  )
  await attendre(200)
  await pilote.evaluer('document.fonts.ready.then(() => true)')
  const fichier = join(values.sortie, `${ecran.nom}.${pilote.extension}`)
  await pilote.capturer(fichier)
  console.log(`✔ ${fichier}`)
}

await pilote.fermer(echecs > 0 ? 1 : 0)
