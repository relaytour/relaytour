// Sommaire latéral des modes d'emploi.
//
// Le script construit le sommaire à partir des titres de la page : un lien par
// partie (h2 d'une section), et un lien par écran ou repère (h3) de cette
// partie. Sur un écran large, le sommaire occupe une colonne à gauche et reste
// visible pendant la lecture. Sur un écran étroit, un bouton « Sommaire » en bas
// de l'écran l'ouvre par-dessus la page. La partie en cours de lecture est mise
// en évidence. Sans script, la page garde sa mise en page d'une seule colonne.
/* global document, window */
;(() => {
  const page = document.querySelector('main.page')
  if (!page) return

  // Un titre arrivé sous la barre de navigation, ou sous la bascule des
  // captures, compte comme atteint. La marge des ancres (style.css) en donne la
  // hauteur.
  const seuil = () =>
    (Number.parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue('--marge-ancre')
    ) || 96) + 20
  const LARGE = window.matchMedia('(min-width: 1100px)')

  const identifiants = new Set(
    [...document.querySelectorAll('[id]')].map(element => element.id)
  )
  const identifiant = texte => {
    const base =
      texte
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'section'
    let id = base
    for (let n = 2; identifiants.has(id); n++) id = `${base}-${n}`
    identifiants.add(id)
    return id
  }

  // La cible d'un titre d'écran est sa carte quand elle porte un identifiant :
  // les liens existants du site pointent déjà vers elle.
  const cible = titre => {
    const carte = titre.closest('article[id]')
    if (carte) return carte
    titre.id ||= identifiant(titre.textContent)
    return titre
  }

  const parties = [...page.querySelectorAll(':scope > section')]
    .map(section => {
      const titre = section.querySelector('.entete h2[id]')
      if (!titre) return null
      const ecrans = [...section.querySelectorAll('h3')]
        // Les exemples rendus et les cartes de lien ne sont pas des sections.
        .filter(h3 => !h3.closest('.rendu-markdown, a'))
        .map(h3 => ({ titre: h3, cible: cible(h3) }))
      return { titre, cible: section, ecrans }
    })
    .filter(Boolean)
  if (parties.length === 0) return

  // Les libellés suivent la langue de la page : le site existe aussi en anglais.
  const anglais = document.documentElement.lang === 'en'
  const SOMMAIRE = anglais ? 'Contents' : 'Sommaire'

  const nav = document.createElement('nav')
  nav.className = 'sommaire-lateral'
  nav.setAttribute(
    'aria-label',
    anglais ? 'Contents of the page' : 'Sommaire de la page'
  )

  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = 'sommaire-lateral-bouton'
  bouton.textContent = SOMMAIRE
  bouton.setAttribute('aria-expanded', 'false')

  const corps = document.createElement('div')
  corps.className = 'sommaire-lateral-corps'
  corps.id = identifiant('sommaire-de-la-page')
  bouton.setAttribute('aria-controls', corps.id)

  const etiquette = document.createElement('span')
  etiquette.className = 'etiquette'
  etiquette.textContent = SOMMAIRE
  const liste = document.createElement('ol')
  corps.append(etiquette, liste)

  const lien = (texte, element) => {
    const a = document.createElement('a')
    a.href = `#${element.id}`
    a.textContent = texte.replace(/\s+/g, ' ').trim()
    return a
  }

  for (const partie of parties) {
    const item = document.createElement('li')
    partie.lien = lien(partie.titre.textContent, partie.titre)
    item.append(partie.lien)
    if (partie.ecrans.length > 0) {
      const sousListe = document.createElement('ol')
      for (const ecran of partie.ecrans) {
        const sousItem = document.createElement('li')
        ecran.lien = lien(ecran.titre.textContent, ecran.cible)
        sousItem.append(ecran.lien)
        sousListe.append(sousItem)
      }
      item.append(sousListe)
    }
    partie.item = item
    liste.append(item)
  }

  nav.append(bouton, corps)
  page.prepend(nav)
  page.classList.add('avec-sommaire')

  // Ouverture du sommaire sur un écran étroit.
  const ouvrir = ouvert => {
    nav.toggleAttribute('data-ouvert', ouvert)
    bouton.setAttribute('aria-expanded', String(ouvert))
  }
  bouton.addEventListener('click', () => ouvrir(!nav.hasAttribute('data-ouvert')))
  corps.addEventListener('click', evenement => {
    if (evenement.target.closest('a')) ouvrir(false)
  })
  document.addEventListener('keydown', evenement => {
    if (evenement.key === 'Escape' && nav.hasAttribute('data-ouvert')) {
      ouvrir(false)
      bouton.focus()
    }
  })
  document.addEventListener('click', evenement => {
    if (!nav.contains(evenement.target)) ouvrir(false)
  })
  LARGE.addEventListener('change', () => ouvrir(false))

  // Partie et écran en cours de lecture.
  const haut = element => element.getBoundingClientRect().top
  // Le dernier élément atteint. Parmi des cartes d'une même rangée, celle de
  // l'ancre de l'adresse l'emporte, sinon la première.
  const dernierAtteint = elements => {
    const limite = seuil()
    const atteints = elements.filter(e => haut(e.cible) <= limite)
    const dernier = atteints.at(-1)
    if (!dernier) return undefined
    const rangee = atteints.filter(e => haut(e.cible) === haut(dernier.cible))
    const ancre = window.location.hash.slice(1)
    return rangee.find(e => e.cible.id === ancre) ?? rangee[0]
  }
  let actif = null

  function suivre() {
    const enBas =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
    const partie = enBas ? parties.at(-1) : (dernierAtteint(parties) ?? parties[0])
    const ecran = enBas ? partie.ecrans.at(-1) : dernierAtteint(partie.ecrans)
    const courant = ecran?.lien ?? partie.lien
    if (courant === actif) return
    actif = courant

    for (const p of parties) {
      p.item.classList.toggle('actif', p === partie)
      p.lien.removeAttribute('aria-current')
      for (const e of p.ecrans) e.lien.removeAttribute('aria-current')
    }
    courant.setAttribute('aria-current', 'location')

    // Dans la colonne, le lien actif reste visible sans faire défiler la page.
    if (LARGE.matches && corps.scrollHeight > corps.clientHeight) {
      const position =
        haut(courant) - corps.getBoundingClientRect().top + corps.scrollTop
      if (
        position < corps.scrollTop ||
        position > corps.scrollTop + corps.clientHeight - 40
      )
        corps.scrollTop = position - corps.clientHeight / 3
    }
  }

  let attente = false
  const planifier = () => {
    if (attente) return
    attente = true
    window.requestAnimationFrame(() => {
      attente = false
      suivre()
    })
  }
  window.addEventListener('scroll', planifier, { passive: true })
  window.addEventListener('resize', planifier)
  // Deux cartes d'une même rangée partagent leur position : passer de l'une à
  // l'autre change l'ancre sans faire défiler la page.
  window.addEventListener('hashchange', planifier)
  suivre()
})()
