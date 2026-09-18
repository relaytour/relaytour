import { avecDelai } from './delai.ts'
import { journal } from './journal.ts'

/**
 * Compte un appel pour `cle` dans une fenêtre fixe, dans Redis.
 * Renvoie false quand la limite est dépassée.
 *
 * Si Redis ne répond pas, l'appel passe : la limite par IP de Better Auth reste active,
 * et une panne de Redis ne doit pas empêcher toute connexion.
 */
export async function limiterParCle(
  cle: string,
  max: number,
  fenetreSecondes: number
): Promise<boolean> {
  try {
    const { connection } = await import('../jobs/queues.ts')
    const nom = `limite:${cle}`
    const compte = await avecDelai(
      connection.incr(nom),
      1_000,
      'Limite par adresse'
    )
    if (compte === 1) {
      await avecDelai(
        connection.expire(nom, fenetreSecondes),
        1_000,
        'Limite par adresse'
      )
    }
    return compte <= max
  } catch (erreur) {
    journal.error(
      { evenement: 'limite-indisponible', message: (erreur as Error).message },
      'Redis ne répond pas : la limite par adresse est ignorée.'
    )
    return true
  }
}
