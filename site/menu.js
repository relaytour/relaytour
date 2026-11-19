// Menu de la barre de navigation sur un écran étroit.
//
// Sous 760 px de large, le script replie les liens de la barre derrière un
// bouton « Menu ». Le bouton ouvre la liste sous la barre, et la touche Échap,
// un clic en dehors ou le choix d'un lien la referment. Sans script, la barre
// garde ses liens visibles sur plusieurs lignes.
/* global document, window */
;(() => {
  const barre = document.querySelector('nav.barre')
  const bouton = barre?.querySelector('.menu-bouton')
  const liens = barre?.querySelector('.liens')
  if (!barre || !bouton || !liens) return

  const ETROIT = window.matchMedia('(max-width: 760px)')

  const ouvrir = ouvert => {
    barre.classList.toggle('ouverte', ouvert)
    bouton.setAttribute('aria-expanded', String(ouvert))
  }

  barre.classList.add('avec-menu')
  bouton.hidden = false

  bouton.addEventListener('click', () => {
    ouvrir(bouton.getAttribute('aria-expanded') !== 'true')
  })

  liens.addEventListener('click', event => {
    if (event.target.closest('a')) ouvrir(false)
  })

  document.addEventListener('click', event => {
    if (!barre.contains(event.target)) ouvrir(false)
  })

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || bouton.getAttribute('aria-expanded') !== 'true') return
    ouvrir(false)
    bouton.focus()
  })

  // Le menu ouvert sur un écran étroit se referme quand l'écran s'élargit.
  ETROIT.addEventListener('change', () => ouvrir(false))
})()
