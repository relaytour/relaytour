/**
 * Rejette une promesse qui ne se règle pas dans le délai.
 *
 * La connexion Redis de BullMQ (maxRetriesPerRequest: null) met les commandes en
 * attente tant que Redis est injoignable, sans jamais échouer : sans délai, une panne
 * de Redis bloquerait la requête HTTP qui met un mail en file. Le 16 septembre 2026,
 * la première CI, sans Redis, a ainsi bloqué deux tests jusqu'à leur délai de 30 s.
 */
export function avecDelai<T>(
  promesse: Promise<T>,
  ms: number,
  quoi: string
): Promise<T> {
  let minuteur: NodeJS.Timeout | undefined
  const expiration = new Promise<never>((_resolve, rejeter) => {
    minuteur = setTimeout(
      () => rejeter(new Error(`${quoi} : pas de réponse en ${ms} ms`)),
      ms
    )
  })
  return Promise.race([promesse, expiration]).finally(() =>
    clearTimeout(minuteur)
  )
}
