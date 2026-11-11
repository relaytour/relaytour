import { useSearchParams } from 'react-router'

/** Le paramètre d'adresse qui ouvre la fenêtre d'une tâche, sur tout écran. */
export const PARAMETRE_DETAIL = 'detail'

/** Le lien de partage d'une tâche, depuis l'activité : `/taches/<id>`. */
export const cheminTache = (id: string) => `/taches/${id}`

/**
 * L'état d'historique d'une fenêtre ouverte depuis l'écran : sa fermeture revient
 * alors en arrière, sans empiler une seconde entrée.
 */
export const ETAT_OUVERTE_ICI = { fenetreTache: true } as const

export const ouverteIci = (etat: unknown) =>
  typeof etat === 'object' &&
  etat !== null &&
  (etat as { fenetreTache?: unknown }).fenetreTache === true

/**
 * Ouvre la fenêtre d'une tâche sur l'écran courant. L'adresse porte la tâche :
 * elle se copie depuis la barre du navigateur, et le retour arrière referme la
 * fenêtre.
 */
export function useOuvrirTache() {
  const [, setParametres] = useSearchParams()
  return (id: string) =>
    setParametres(
      courants => {
        const suite = new URLSearchParams(courants)
        suite.set(PARAMETRE_DETAIL, id)
        return suite
      },
      { state: ETAT_OUVERTE_ICI }
    )
}
