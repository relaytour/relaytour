import { useSearchParams } from 'react-router'

/** Le paramètre d'adresse qui ouvre la fenêtre d'une tâche, sur tout écran. */
export const PARAMETRE_DETAIL = 'detail'

/** Le lien de partage d'une tâche, depuis l'activité : `/taches/<id>`. */
export const cheminTache = (id: string) => `/taches/${id}`

/**
 * Ouvre la fenêtre d'une tâche sur l'écran courant. L'adresse porte la tâche :
 * elle se copie depuis la barre du navigateur, et le retour arrière referme la
 * fenêtre.
 */
export function useOuvrirTache() {
  const [, setParametres] = useSearchParams()
  return (id: string) =>
    setParametres(courants => {
      const suite = new URLSearchParams(courants)
      suite.set(PARAMETRE_DETAIL, id)
      return suite
    })
}
