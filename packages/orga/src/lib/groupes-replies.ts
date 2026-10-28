import { useCallback, useState } from 'react'

import { ecrireGroupesReplies, lireGroupesReplies } from './regroupement'

/**
 * Les groupes repliés d'une liste, gardés par le navigateur sous `cle`. Un
 * groupe replié le reste d'un écran à l'autre tant que sa clé ne change pas.
 */
export function useGroupesReplies(cle: string) {
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
