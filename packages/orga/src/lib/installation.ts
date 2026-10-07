/**
 * Vrai dans l'application installée (ADR 0023) : l'espace organisateur s'affiche
 * sans barre d'adresse. Safari sur iPhone l'annonce par `navigator.standalone`.
 */
export function estInstallee(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
