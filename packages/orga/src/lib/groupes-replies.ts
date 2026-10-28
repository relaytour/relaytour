import { useCallback, useState } from 'react'

import {
  cleGroupesReplies,
  ecrireGroupesReplies,
  lireGroupesReplies,
} from './regroupement'

/**
 * Les groupes repliés des listes d'un écran, gardés par le navigateur. Un
 * groupe replié le reste d'une visite à l'autre tant que sa clé ne change pas.
 */
export function useGroupesReplies(ecran: string) {
  const cle = cleGroupesReplies(ecran)
  const [replies, setReplies] = useState(() => lireGroupesReplies(cle))
  const basculer = useCallback(
    (groupe: string) =>
      setReplies(avant => {
        const apres = avant.includes(groupe)
          ? avant.filter(x => x !== groupe)
          : [...avant, groupe]
        ecrireGroupesReplies(cle, apres)
        return apres
      }),
    [cle]
  )
  const estReplie = useCallback(
    (groupe: string) => replies.includes(groupe),
    [replies]
  )
  return { estReplie, basculer }
}
