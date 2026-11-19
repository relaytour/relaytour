// Recherche dans les modes d'emploi.
//
// outils/recherche.mjs prépare site/recherche/ : les passages de chaque mode
// d'emploi, leurs vecteurs, le modèle multilingual-e5-small et transformers.js.
// Le script cherche d'abord par les mots de la question, dès la première
// lettre. Il charge ensuite le modèle dans le navigateur et range les passages
// par le sens de la question. Sur un ordinateur, le chargement part quand la
// personne place le curseur dans le champ. Sur un téléphone, ou quand le
// navigateur demande d'économiser les données, la personne le lance par un
// bouton. Le navigateur garde le modèle en cache après le premier chargement.
// Rien ne quitte le site : la question reste dans le navigateur.
/* global document, window, navigator, fetch, URL */
;(() => {
  const formulaire = document.querySelector('[data-recherche]')
  const script = document.currentScript
  if (!formulaire || !script) return

  const champ = formulaire.querySelector('input[type="search"]')
  const etat = formulaire.querySelector('.recherche-etat')
  const boutonSens = formulaire.querySelector('.recherche-sens')
  const liste = formulaire.querySelector('.recherche-resultats')
  if (!champ || !etat || !boutonSens || !liste) return

  const langue = document.documentElement.lang === 'en' ? 'en' : 'fr'
  const racine = new URL('./', script.src)
  const dossierGuides = new URL(langue === 'en' ? 'en/modes-d-emploi/' : 'modes-d-emploi/', racine)
  const dossierRecherche = new URL('recherche/', racine)

  const TEXTES = {
    fr: {
      mots: 'La recherche porte sur les mots de votre question.',
      chargement: pourcentage => `Chargement de la recherche par le sens : ${pourcentage} %.`,
      preparation: 'Préparation de la recherche par le sens.',
      sens: 'La recherche tient compte du sens de votre question.',
      echec: "La recherche par le sens n'a pas pu se charger. La recherche porte sur les mots de votre question.",
      aucun: 'Aucun passage ne correspond à votre question.',
      resultats: nombre => (nombre === 1 ? '1 passage trouvé.' : `${nombre} passages trouvés.`),
    },
    en: {
      mots: 'The search matches the words of your question.',
      chargement: pourcentage => `Loading meaning-based search: ${pourcentage}%.`,
      preparation: 'Preparing meaning-based search.',
      sens: 'The search takes the meaning of your question into account.',
      echec: 'Meaning-based search could not load. The search matches the words of your question.',
      aucun: 'No passage matches your question.',
      resultats: nombre => (nombre === 1 ? '1 passage found.' : `${nombre} passages found.`),
    },
  }[langue]

  // Mots trop fréquents pour distinguer un passage d'un autre.
  const MOTS_VIDES = new Set(
    (langue === 'en'
      ? 'a an the and or of to in on for with by at from is are be do does how what when where which who can i my me you your it this that as into'
      : 'a au aux avec ce ces comment dans de des du elle en est et il je la le les leur mes mon ma ne nous on ou où par pas pour qu que qui sa se ses son sur un une vos votre vous y est-ce quoi quand faire fait'
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
  let modeleEnEchec = false
  let derniereQuestion = ''

  const ecrireEtat = texte => {
    etat.textContent = texte
  }

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

  async function vecteurQuestion(question) {
    if (!extraire) return null
    const sortie = await extraire(`query: ${question}`, { pooling: 'mean', normalize: true })
    return sortie.data
  }

  async function chercher(question) {
    await chargerIndex()
    const racines = [...new Set(mots(question).map(racineMot))]
    const vecteur = await vecteurQuestion(question).catch(() => {
      extraire = null
      modeleEnEchec = true
      return null
    })
    const dimension = index.dimension
    const meilleurs = new Map()
    index.passages.forEach((passage, i) => {
      const parMots = scoreMots(racines, passage)
      let score = parMots
      if (vecteur) {
        let produit = 0
        for (let j = 0; j < dimension; j++) produit += vecteur[j] * index.vecteurs[i * dimension + j]
        score = 0.7 * scoreSens(produit / 127) + 0.3 * parMots
      } else if (parMots < 0.5) {
        return
      }
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
      .map(resultat => ({ ...resultat, racines }))
  }

  // Un extrait d'environ 160 caractères autour du premier mot trouvé.
  function extrait(texte, racines) {
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

  function afficher(resultats) {
    liste.replaceChildren(
      ...resultats.map(({ passage, racines }) => {
        const element = document.createElement('li')
        const lien = document.createElement('a')
        lien.href = new URL(passage.lien, dossierGuides).href
        const titre = document.createElement('span')
        titre.className = 'recherche-titre'
        titre.textContent = passage.partie
        const page = document.createElement('span')
        page.className = 'recherche-page'
        page.textContent = passage.page
        const texte = document.createElement('span')
        texte.className = 'recherche-extrait'
        surligner(texte, extrait(passage.texte, racines), racines)
        lien.append(page, titre, texte)
        element.append(lien)
        return element
      })
    )
  }

  const modeTexte = () => (extraire ? TEXTES.sens : modeleEnEchec ? TEXTES.echec : TEXTES.mots)

  async function lancer() {
    const question = champ.value.trim()
    derniereQuestion = question
    if (question.length < 2) {
      liste.replaceChildren()
      ecrireEtat(chargementModele && !extraire ? etat.textContent : modeTexte())
      return
    }
    try {
      const resultats = await chercher(question)
      if (question !== derniereQuestion) return
      afficher(resultats)
      if (!chargementModele || extraire || modeleEnEchec) {
        ecrireEtat(`${resultats.length ? TEXTES.resultats(resultats.length) : TEXTES.aucun} ${modeTexte()}`)
      }
    } catch {
      formulaire.hidden = true
    }
  }

  function chargerModele() {
    if (chargementModele) return chargementModele
    boutonSens.hidden = true
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
      ecrireEtat(modeTexte())
      lancer()
    })().catch(() => {
      modeleEnEchec = true
      ecrireEtat(modeTexte())
    })
    return chargementModele
  }

  // Un téléphone ou une connexion économe ne télécharge le modèle que sur demande.
  const chargementAutomatique = () =>
    !navigator.connection?.saveData && window.matchMedia('(min-width: 761px)').matches

  let minuteur = 0
  champ.addEventListener('input', () => {
    window.clearTimeout(minuteur)
    minuteur = window.setTimeout(lancer, 120)
  })

  champ.addEventListener('focus', () => {
    chargerIndex().catch(() => {
      formulaire.hidden = true
    })
    if (chargementAutomatique()) chargerModele()
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

  boutonSens.addEventListener('click', () => {
    chargerModele()
    champ.focus()
  })

  // Le formulaire n'apparaît que si l'index existe sur le site.
  fetch(new URL(`${langue}.json`, dossierRecherche), { method: 'HEAD' })
    .then(reponse => {
      if (!reponse.ok) return
      formulaire.hidden = false
      boutonSens.hidden = chargementAutomatique()
      ecrireEtat(TEXTES.mots)
    })
    .catch(() => {})
})()
