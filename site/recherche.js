// Recherche dans les modes d'emploi.
//
// outils/recherche.mjs prépare site/recherche/. La recherche par défaut passe
// par Pagefind : un index par les mots, de 1 Mo environ, chargé par morceaux.
// Sur un ordinateur, une case propose en plus la recherche par le sens. Elle
// télécharge alors un modèle d'IA léger (multilingual-e5-small, 150 Mo), qui
// s'exécute dans le navigateur et range les passages par le sens de la
// question. Le navigateur garde le modèle en cache, et retient le choix de la
// personne. Rien ne quitte le site : la question reste dans le navigateur.
/* global document, window, navigator, fetch, URL, localStorage */
;(() => {
  const formulaire = document.querySelector('[data-recherche]')
  const script = document.currentScript
  if (!formulaire || !script) return

  const champ = formulaire.querySelector('input[type="search"]')
  const etat = formulaire.querySelector('.recherche-etat')
  const optionIa = formulaire.querySelector('.recherche-ia')
  const caseIa = optionIa?.querySelector('input[type="checkbox"]')
  const liste = formulaire.querySelector('.recherche-resultats')
  if (!champ || !etat || !optionIa || !caseIa || !liste) return

  const langue = document.documentElement.lang === 'en' ? 'en' : 'fr'
  const racine = new URL('./', script.src)
  const dossierGuides = new URL(langue === 'en' ? 'en/modes-d-emploi/' : 'modes-d-emploi/', racine)
  const dossierRecherche = new URL('recherche/', racine)
  const CLE_CHOIX = 'relaytour-recherche-ia'

  const TEXTES = {
    fr: {
      chargement: pourcentage => `Chargement du modèle d'IA : ${pourcentage} %.`,
      preparation: "Préparation du modèle d'IA.",
      echec: "Le modèle d'IA n'a pas pu se charger. La recherche porte sur les mots de votre question.",
      aucun: 'Aucun passage ne correspond à votre question.',
      resultats: nombre => (nombre === 1 ? '1 passage trouvé.' : `${nombre} passages trouvés.`),
      parIa: "Le modèle d'IA range les passages par le sens de votre question.",
    },
    en: {
      chargement: pourcentage => `Loading the AI model: ${pourcentage}%.`,
      preparation: 'Preparing the AI model.',
      echec: 'The AI model could not load. The search matches the words of your question.',
      aucun: 'No passage matches your question.',
      resultats: nombre => (nombre === 1 ? '1 passage found.' : `${nombre} passages found.`),
      parIa: 'The AI model ranks passages by the meaning of your question.',
    },
  }[langue]

  const ORDINATEUR = window.matchMedia('(min-width: 761px)')

  const lireChoix = () => {
    try {
      return localStorage.getItem(CLE_CHOIX) === 'oui'
    } catch {
      return false
    }
  }
  const ecrireChoix = actif => {
    try {
      if (actif) localStorage.setItem(CLE_CHOIX, 'oui')
      else localStorage.removeItem(CLE_CHOIX)
    } catch {
      // Le choix ne se retient pas sans stockage : la case reste utilisable.
    }
  }

  const ecrireEtat = texte => {
    etat.textContent = texte
  }

  // L'IA ne range les résultats que si la case est cochée et le modèle prêt.
  const iaActive = () => caseIa.checked && ORDINATEUR.matches && Boolean(extraire)

  // ---------------------------------------------------------------------------
  // Recherche par défaut : Pagefind

  let pagefind = null
  const chargerPagefind = () => {
    pagefind ||= import(new URL('pagefind/pagefind.js', dossierRecherche).href).then(async module => {
      await module.options({
        basePath: new URL('pagefind/', dossierRecherche).pathname,
        baseUrl: racine.pathname,
        excerptLength: 24,
        // Un mode d'emploi long ne perd pas sa place pour sa seule longueur.
        ranking: { pageLength: 0.3 },
      })
      module.init()
      return module
    })
    return pagefind
  }

  // Une adresse de Pagefind part de la racine du site.
  const adresse = url => new URL(url, racine).href

  // Un écran dont le titre reprend un mot de la question passe devant les
  // écrans où la question revient seulement dans le texte.
  const poidsEcran = (ecran, racines) =>
    (ecran.locations?.length ?? 0) +
    (racines.some(r => normaliser(ecran.title ?? '').includes(r)) ? 5 : 0)

  // Pagefind ne retient que les pages qui contiennent tous les mots de la
  // question. Le script retire donc les mots vides (« un », « le »). Quand
  // les mots réunis trouvent moins de cinq pages, il cherche aussi chaque mot
  // seul : une page qui en contient davantage passe devant.
  async function pagesPagefind(module, question) {
    const termes = question
      .split(/[\s'’,.;:!?«»"()]+/)
      .filter(mot => mot.length > 1 && !MOTS_VIDES.has(normaliser(mot)))
    if (termes.length === 0) return []
    const pages = new Map()
    const ajouter = (resultats, nombreDeTermes) => {
      for (const resultat of resultats) {
        const page = pages.get(resultat.id) ?? { resultat, termes: 0, score: 0 }
        page.termes += nombreDeTermes
        page.score += resultat.score
        pages.set(resultat.id, page)
      }
    }
    const ensemble = await module.search(termes.join(' '))
    ajouter(ensemble.results, termes.length + 1)
    if (termes.length > 1 && ensemble.results.length < 5) {
      for (const terme of termes) ajouter((await module.search(terme)).results, 1)
    }
    return [...pages.values()]
      .sort((a, b) => b.termes - a.termes || b.score - a.score)
      .slice(0, 6)
      .map(page => page.resultat)
  }

  async function chercherPagefind(question) {
    const module = await chargerPagefind()
    const trouvees = await pagesPagefind(module, question)
    const pages = await Promise.all(trouvees.map(resultat => resultat.data()))
    const racines = [...new Set(mots(question).map(racineMot))]
    const resultats = []
    for (const page of pages) {
      // Les deux écrans de la page les plus proches de la question.
      const ecrans = [...(page.sub_results ?? [])]
        .sort((a, b) => poidsEcran(b, racines) - poidsEcran(a, racines))
        .slice(0, 2)
      const entrees = ecrans.length > 0 ? ecrans : [page]
      for (const ecran of entrees) {
        resultats.push({
          page: page.meta?.title ?? '',
          titre: ecran === page ? (page.meta?.title ?? '') : ecran.title,
          lien: adresse(ecran.url),
          extrait: { html: ecran.excerpt },
        })
      }
    }
    return resultats.slice(0, 8)
  }

  // ---------------------------------------------------------------------------
  // Recherche par le sens : modèle d'IA exécuté dans le navigateur

  const MOTS_VIDES = new Set(
    (langue === 'en'
      ? 'a an the and or of to in on for with by at from is are be do does how what when where which who can i my me you your it this that as into'
      : 'a au aux avec ce ces comment dans de des du elle en est et il je la le les leur mes mon ma ne nous on ou par pas pour qu que qui sa se ses son sur un une vos votre vous y est-ce quoi quand faire fait'
    ).split(' ')
  )

  const normaliser = texte =>
    texte
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()

  const mots = texte =>
    normaliser(texte)
      .split(/[^a-z0-9]+/)
      .filter(mot => mot.length > 1 && !MOTS_VIDES.has(mot))

  // Une racine grossière : un mot et ses formes proches (« inviter »,
  // « invitation », « invités ») partagent leurs premières lettres.
  const racineMot = mot => (mot.length <= 4 ? mot : mot.slice(0, Math.max(4, mot.length - 3)))

  let index = null
  let chargementIndex = null
  let extraire = null
  let chargementModele = null

  function chargerIndex() {
    chargementIndex ||= fetch(new URL(`${langue}.json`, dossierRecherche))
      .then(reponse => {
        if (!reponse.ok) throw new Error(String(reponse.status))
        return reponse.json()
      })
      .then(donnees => {
        const binaire = window.atob(donnees.vecteurs)
        const vecteurs = new Int8Array(binaire.length)
        for (let i = 0; i < binaire.length; i++) vecteurs[i] = (binaire.charCodeAt(i) << 24) >> 24
        const passages = donnees.passages.map(passage => ({
          ...passage,
          motsTitre: new Set(mots(`${passage.page} ${passage.partie}`)),
          motsTexte: new Set(mots(passage.texte)),
        }))
        // Un mot rare pèse plus qu'un mot présent dans beaucoup de passages.
        const frequences = new Map()
        for (const passage of passages) {
          const racines = new Set([...passage.motsTitre, ...passage.motsTexte].map(racineMot))
          for (const r of racines) frequences.set(r, (frequences.get(r) ?? 0) + 1)
        }
        index = { ...donnees, passages, vecteurs, frequences }
        return index
      })
    return chargementIndex
  }

  const contient = (ensemble, racine) => {
    for (const mot of ensemble) if (mot.startsWith(racine)) return true
    return false
  }

  // Score par les mots, entre 0 et 1 : la part des mots de la question que le
  // passage contient, pondérée par leur rareté. Un mot du titre compte double.
  function scoreMots(racines, passage) {
    let total = 0
    let trouve = 0
    for (const r of racines) {
      const poids = Math.log(1 + index.passages.length / (index.frequences.get(r) ?? 1))
      total += poids
      if (contient(passage.motsTitre, r)) trouve += poids
      else if (contient(passage.motsTexte, r)) trouve += poids * 0.7
    }
    return total === 0 ? 0 : trouve / total
  }

  // Le modèle e5 range ses similarités entre 0,75 et 0,9 environ : le score
  // les ramène entre 0 et 1.
  const scoreSens = similarite => Math.max(0, Math.min(1, (similarite - 0.76) / 0.12))

  // Un extrait d'environ 170 caractères autour du premier mot trouvé.
  function extraitAutour(texte, racines) {
    const normalise = normaliser(texte)
    let debut = 0
    for (const r of racines) {
      const position = normalise.search(new RegExp(`\\b${r}`))
      if (position >= 0) {
        debut = Math.max(0, position - 50)
        break
      }
    }
    if (debut > 0) debut = texte.indexOf(' ', debut) + 1
    const fin = Math.min(texte.length, debut + 170)
    return `${debut > 0 ? '… ' : ''}${texte.slice(debut, fin).trim()}${fin < texte.length ? ' …' : ''}`
  }

  async function chercherParLeSens(question) {
    await chargerIndex()
    const racines = [...new Set(mots(question).map(racineMot))]
    const sortie = await extraire(`query: ${question}`, { pooling: 'mean', normalize: true })
    const vecteur = sortie.data
    const dimension = index.dimension
    const meilleurs = new Map()
    index.passages.forEach((passage, i) => {
      let produit = 0
      for (let j = 0; j < dimension; j++) produit += vecteur[j] * index.vecteurs[i * dimension + j]
      const score = 0.7 * scoreSens(produit / 127) + 0.3 * scoreMots(racines, passage)
      // Un écran découpé en plusieurs passages ne donne qu'un résultat.
      const actuel = meilleurs.get(passage.lien)
      if (!actuel || actuel.score < score) meilleurs.set(passage.lien, { passage, score })
    })
    const tries = [...meilleurs.values()].sort((a, b) => b.score - a.score)
    // Un résultat loin derrière le meilleur ne s'affiche pas.
    const plancher = Math.max(0.2, (tries[0]?.score ?? 0) * 0.75)
    return tries
      .filter(resultat => resultat.score >= plancher)
      .slice(0, 8)
      .map(({ passage }) => ({
        page: passage.page,
        titre: passage.partie,
        lien: new URL(passage.lien, dossierGuides).href,
        extrait: { texte: extraitAutour(passage.texte, racines), racines },
      }))
  }

  function chargerModele() {
    if (chargementModele) return chargementModele
    const progression = new Map()
    ecrireEtat(TEXTES.chargement(0))
    chargementModele = (async () => {
      const { env, pipeline } = await import(new URL('lib/transformers.min.js', dossierRecherche).href)
      env.allowRemoteModels = false
      env.allowLocalModels = true
      // transformers.js 4.3 ne cherche le tokenizer que sous un chemin, pas sous
      // une adresse complète : le modèle se désigne par son chemin sur le site.
      env.localModelPath = new URL('modeles/', dossierRecherche).pathname
      env.backends.onnx.wasm.wasmPaths = {
        mjs: new URL('lib/ort-wasm-simd-threaded.mjs', dossierRecherche).href,
        wasm: new URL('lib/ort-wasm-simd-threaded.wasm', dossierRecherche).href,
      }
      await chargerIndex()
      extraire = await pipeline('feature-extraction', index.modele, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: avancement => {
          if (avancement.status === 'progress' && avancement.total) {
            progression.set(avancement.file, [avancement.loaded, avancement.total])
            let charge = 0
            let total = 0
            for (const [l, t] of progression.values()) {
              charge += l
              total += t
            }
            ecrireEtat(TEXTES.chargement(Math.floor((100 * charge) / total)))
          } else if (avancement.status === 'ready') {
            ecrireEtat(TEXTES.preparation)
          }
        },
      })
      ecrireEtat('')
      lancer()
    })().catch(() => {
      caseIa.checked = false
      ecrireChoix(false)
      chargementModele = null
      ecrireEtat(TEXTES.echec)
    })
    return chargementModele
  }

  // ---------------------------------------------------------------------------
  // Affichage

  // Met en évidence les mots de la question, sans passer par innerHTML.
  function surligner(element, texte, racines) {
    const normalise = normaliser(texte)
    const motif = racines.length ? new RegExp(`\\b(${racines.join('|')})[a-z0-9]*`, 'g') : null
    let curseur = 0
    for (const trouve of motif ? normalise.matchAll(motif) : []) {
      element.append(texte.slice(curseur, trouve.index))
      const marque = document.createElement('mark')
      marque.textContent = texte.slice(trouve.index, trouve.index + trouve[0].length)
      element.append(marque)
      curseur = trouve.index + trouve[0].length
    }
    element.append(texte.slice(curseur))
  }

  // L'extrait de Pagefind est du HTML qui ne porte que des balises <mark>. Le
  // script n'en recopie que le texte et ces balises.
  function recopierExtrait(element, html) {
    const modele = document.createElement('template')
    modele.innerHTML = html
    for (const noeud of modele.content.childNodes) {
      if (noeud.nodeName === 'MARK') {
        const marque = document.createElement('mark')
        marque.textContent = noeud.textContent
        element.append(marque)
      } else {
        element.append(noeud.textContent)
      }
    }
  }

  function afficher(resultats) {
    liste.replaceChildren(
      ...resultats.map(resultat => {
        const element = document.createElement('li')
        const lien = document.createElement('a')
        lien.href = resultat.lien
        const page = document.createElement('span')
        page.className = 'recherche-page'
        page.textContent = resultat.page
        const titre = document.createElement('span')
        titre.className = 'recherche-titre'
        titre.textContent = resultat.titre
        const extrait = document.createElement('span')
        extrait.className = 'recherche-extrait'
        if (resultat.extrait.html !== undefined) recopierExtrait(extrait, resultat.extrait.html)
        else surligner(extrait, resultat.extrait.texte, resultat.extrait.racines)
        lien.append(page, titre, extrait)
        element.append(lien)
        return element
      })
    )
  }

  let derniereQuestion = ''

  async function lancer() {
    const question = champ.value.trim()
    derniereQuestion = question
    const enChargement = Boolean(chargementModele) && !extraire
    if (question.length < 2) {
      liste.replaceChildren()
      if (!enChargement) ecrireEtat('')
      return
    }
    try {
      const parIa = iaActive()
      const resultats = parIa ? await chercherParLeSens(question) : await chercherPagefind(question)
      if (question !== derniereQuestion) return
      afficher(resultats)
      if (!enChargement) {
        const nombre = resultats.length ? TEXTES.resultats(resultats.length) : TEXTES.aucun
        ecrireEtat(parIa && resultats.length ? `${nombre} ${TEXTES.parIa}` : nombre)
      }
    } catch {
      liste.replaceChildren()
      ecrireEtat(TEXTES.aucun)
    }
  }

  // ---------------------------------------------------------------------------
  // Événements

  let minuteur = 0
  champ.addEventListener('input', () => {
    window.clearTimeout(minuteur)
    minuteur = window.setTimeout(lancer, 150)
  })

  // Le premier clic dans le champ prépare Pagefind, et le modèle d'IA si la
  // personne l'a choisi lors d'une visite précédente.
  champ.addEventListener('focus', () => {
    chargerPagefind().catch(() => {
      formulaire.hidden = true
    })
    if (caseIa.checked && ORDINATEUR.matches) chargerModele()
  })

  caseIa.addEventListener('change', () => {
    ecrireChoix(caseIa.checked)
    if (caseIa.checked) chargerModele()
    else if (!extraire) ecrireEtat('')
    lancer()
  })

  // La case n'existe que sur un écran d'ordinateur, quand le site sert le modèle.
  let iaDisponible = false
  const afficherOption = () => {
    optionIa.hidden = !(iaDisponible && ORDINATEUR.matches)
  }
  ORDINATEUR.addEventListener('change', () => {
    afficherOption()
    lancer()
  })

  champ.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      liste.querySelector('a')?.focus()
      event.preventDefault()
    }
  })

  liste.addEventListener('keydown', event => {
    const liens = [...liste.querySelectorAll('a')]
    const position = liens.indexOf(document.activeElement)
    if (position < 0) return
    if (event.key === 'ArrowDown') liens[position + 1]?.focus()
    else if (event.key === 'ArrowUp') (liens[position - 1] ?? champ).focus()
    else if (event.key === 'Escape') champ.focus()
    else return
    event.preventDefault()
  })

  // La touche Entrée ouvre le premier résultat.
  formulaire.addEventListener('submit', event => {
    event.preventDefault()
    const premier = liste.querySelector('a')
    if (premier) window.location.href = premier.href
  })

  // Le formulaire n'apparaît que si l'index Pagefind existe sur le site. La
  // case de l'IA n'apparaît que si le modèle y est aussi.
  fetch(new URL('pagefind/pagefind.js', dossierRecherche), { method: 'HEAD' })
    .then(reponse => {
      if (!reponse.ok) return
      formulaire.hidden = false
      return fetch(new URL(`${langue}.json`, dossierRecherche), { method: 'HEAD' }).then(modele => {
        if (!modele.ok || navigator.connection?.saveData) return
        iaDisponible = true
        caseIa.checked = lireChoix()
        afficherOption()
      })
    })
    .catch(() => {})
})()
