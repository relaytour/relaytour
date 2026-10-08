// Bascule « Ordinateur / Téléphone » des captures du site.
//
// Une capture qui existe en deux tailles porte l'adresse de sa version téléphone
// dans `data-mobile`. Ce script ajoute la bascule aux pages qui en contiennent,
// retient le choix dans le navigateur et, sans choix, suit la largeur de l'écran.
// Sans script, la page garde ses captures d'ordinateur.
/* global document, window */
;(() => {
  const images = [...document.querySelectorAll('img[data-mobile]')]
  if (images.length === 0) return

  const CLE = 'relaytour.site.captures'
  const TAILLES = { ordinateur: 'Ordinateur', telephone: 'Téléphone' }
  // Dimensions des captures du simulateur : deux pixels par point d'écran.
  const LARGEUR_MOBILE = 804
  const HAUTEUR_MOBILE = 1748

  const lire = () => {
    try {
      return window.localStorage.getItem(CLE)
    } catch {
      return null
    }
  }
  const ecrire = taille => {
    try {
      window.localStorage.setItem(CLE, taille)
    } catch {
      // Stockage indisponible : le choix vaut pour la page.
    }
  }

  for (const image of images) {
    image.dataset.ordinateur = image.getAttribute('src')
    image.dataset.largeur = image.getAttribute('width')
    image.dataset.hauteur = image.getAttribute('height')
  }

  const groupe = document.createElement('div')
  groupe.className = 'bascule'
  groupe.setAttribute('role', 'group')
  groupe.setAttribute('aria-label', 'Taille des captures')
  const boutons = Object.entries(TAILLES).map(([taille, libelle]) => {
    const bouton = document.createElement('button')
    bouton.type = 'button'
    bouton.textContent = libelle
    bouton.addEventListener('click', () => {
      ecrire(taille)
      appliquer(taille)
    })
    groupe.append(bouton)
    return [taille, bouton]
  })

  function appliquer(taille) {
    const telephone = taille === 'telephone'
    document.documentElement.dataset.captures = taille
    for (const [nom, bouton] of boutons)
      bouton.setAttribute('aria-pressed', String(nom === taille))
    for (const image of images) {
      image.src = telephone ? image.dataset.mobile : image.dataset.ordinateur
      image.width = telephone ? LARGEUR_MOBILE : Number(image.dataset.largeur)
      image.height = telephone ? HAUTEUR_MOBILE : Number(image.dataset.hauteur)
      // Une capture liée à son fichier suit la même taille.
      const lien = image.closest('a[href]')
      if (lien) lien.href = image.src
    }
  }

  const ancre = document.querySelector('.tete') ?? document.querySelector('main')
  ancre.after(groupe)
  const choix = lire()
  appliquer(
    choix in TAILLES
      ? choix
      : window.matchMedia('(max-width: 760px)').matches
        ? 'telephone'
        : 'ordinateur'
  )
})()
