import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'

// Volets de l'espace organisateur (docs/design-system.md, « Volets ») : le volet
// de navigation, déplié ou réduit à un rail d'icônes, et le volet latéral des
// écrans à deux colonnes, qui reste dans l'écran pendant le défilement.

/** Le choix de la personne pour le volet de navigation. */
export type EtatVolet = 'deplie' | 'rail'

const CLE = 'relaytour.volet'
/**
 * Distance entre le haut de l'écran et le contenu, sous la barre haute collée :
 * sa marge (16), sa hauteur (64) et l'écart qui la suit (20).
 */
export const HAUT_SOUS_LA_BARRE = 100
/** Largeur d'écran à partir de laquelle le volet s'ouvre déplié, en pixels. */
export const LARGEUR_VOLET_DEPLIE = 1100

/** Le choix retenu dans le navigateur, ou null tant que la personne n'a rien choisi. */
export function lireVolet(): EtatVolet | null {
  try {
    const valeur = window.localStorage.getItem(CLE)
    return valeur === 'deplie' || valeur === 'rail' ? valeur : null
  } catch {
    return null
  }
}

export function ecrireVolet(etat: EtatVolet): void {
  try {
    window.localStorage.setItem(CLE, etat)
  } catch {
    // Stockage indisponible : le choix vaut pour la page.
  }
}

/**
 * L'état du volet : le choix de la personne, sinon déplié sur un grand écran et
 * en rail sur un écran moyen.
 */
export function etatDuVolet(
  choix: EtatVolet | null,
  large: boolean
): EtatVolet {
  return choix ?? (large ? 'deplie' : 'rail')
}

/** Vrai quand la fenêtre mesure au moins cette largeur. Suit le redimensionnement. */
export function useLargeurAuMoins(pixels: number): boolean {
  const requete = `(min-width: ${pixels}px)`
  return useSyncExternalStore(
    prevenir => {
      const media = window.matchMedia(requete)
      media.addEventListener('change', prevenir)
      return () => media.removeEventListener('change', prevenir)
    },
    () => window.matchMedia(requete).matches,
    () => true
  )
}

/**
 * La position d'un volet plus haut que l'écran, qui suit le sens du défilement.
 * En descendant, son bas se cale sur le bas de l'écran ; en remontant, son haut
 * se cale sous la barre haute. `haut` vaut la valeur de `top` à poser : entre
 * `ecran - hauteur - marge` (bas calé) et `sous` (haut calé).
 */
export function hautDuVolet(
  precedent: number,
  deplacement: number,
  mesures: { hauteur: number; ecran: number; sous: number; marge: number }
): number {
  const { hauteur, ecran, sous, marge } = mesures
  // Un volet qui tient dans l'écran reste simplement sous la barre haute.
  if (hauteur <= ecran - sous - marge) return sous
  const plancher = ecran - hauteur - marge
  return Math.min(sous, Math.max(plancher, precedent - deplacement))
}

/**
 * Garde un volet latéral dans l'écran pendant le défilement de la page. Sans ce
 * suivi, un volet court laisse un vide à côté d'un contenu long, et un volet
 * plus haut que l'écran ne montre jamais sa fin.
 */
export function useVoletCollant(
  volet: RefObject<HTMLElement | null>,
  sous: number,
  actif: boolean
): void {
  const haut = useRef(sous)
  useEffect(() => {
    const element = volet.current
    if (element === null) return
    if (!actif) {
      element.style.removeProperty('top')
      return
    }
    let dernier = window.scrollY
    const poser = (deplacement: number) => {
      haut.current = hautDuVolet(haut.current, deplacement, {
        hauteur: element.offsetHeight,
        ecran: window.innerHeight,
        sous,
        marge: 16,
      })
      element.style.setProperty('top', `${haut.current}px`)
    }
    const defiler = () => {
      const y = window.scrollY
      poser(y - dernier)
      dernier = y
    }
    const remesurer = () => poser(0)
    poser(0)
    window.addEventListener('scroll', defiler, { passive: true })
    window.addEventListener('resize', remesurer)
    const observateur = new ResizeObserver(remesurer)
    observateur.observe(element)
    return () => {
      window.removeEventListener('scroll', defiler)
      window.removeEventListener('resize', remesurer)
      observateur.disconnect()
    }
  }, [volet, sous, actif])
}
