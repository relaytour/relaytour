import { useState } from 'react'

/** Ajoute à un ordre connu les identifiants qu'il ne contient pas encore. */
export function completerOrdre(
  connu: readonly string[],
  ids: readonly string[]
): string[] {
  const presents = new Set(connu)
  return [...connu, ...ids.filter(id => !presents.has(id))]
}

/**
 * Les identifiants reçus depuis le dernier changement de `cle`, dans l'ordre de leur
 * première réception. Une liste que le serveur trie selon son état garde ainsi sa
 * disposition pendant les modifications : elle ne se réordonne qu'au changement de
 * clé ou au rechargement de la page.
 */
export function usePremiereReception(
  cle: string | undefined,
  ids: readonly string[]
): string[] {
  const [memo, setMemo] = useState<{
    cle: string | undefined
    ordre: string[]
  }>({ cle, ordre: [] })
  const ordre = completerOrdre(memo.cle === cle ? memo.ordre : [], ids)
  if (memo.cle !== cle || ordre.length !== memo.ordre.length) {
    setMemo({ cle, ordre })
  }
  return ordre
}
