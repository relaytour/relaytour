// Ouvre le tiroir des notifications depuis un autre composant, par exemple l'avis
// d'une nouvelle notification (ADR 0065).

const EVENEMENT = 'relaytour:ouvrir-cloche'

export function ouvrirLaCloche(): void {
  window.dispatchEvent(new Event(EVENEMENT))
}

/** Appelle `ouvrir` à chaque demande ; rend la fonction qui cesse d'écouter. */
export function ecouterLaCloche(ouvrir: () => void): () => void {
  window.addEventListener(EVENEMENT, ouvrir)
  return () => window.removeEventListener(EVENEMENT, ouvrir)
}
