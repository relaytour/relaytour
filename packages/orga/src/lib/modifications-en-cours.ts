import { useEffect } from 'react'

// Les saisies en cours de l'espace (ADR 0065) : un écran ou une fenêtre qui porte
// une modification non enregistrée s'inscrit ici. Avant de quitter la page pour une
// notification, l'espace demande une confirmation.

const enCours = new Set<symbol>()

/** Une modification non enregistrée existe-t-elle quelque part dans l'espace ? */
export function aDesModificationsEnCours(): boolean {
  return enCours.size > 0
}

/** Inscrit une saisie, et rend la fonction qui la retire. */
export function inscrireModification(): () => void {
  const jeton = Symbol('modification')
  enCours.add(jeton)
  return () => {
    enCours.delete(jeton)
  }
}

/** Inscrit la saisie du composant tant que `actif` est vrai. */
export function useModificationEnCours(actif: boolean): void {
  useEffect(() => (actif ? inscrireModification() : undefined), [actif])
}
