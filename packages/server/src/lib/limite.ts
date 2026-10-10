import { avecDelai } from './delai.ts'
import { journal } from './journal.ts'

// INCR et EXPIRE en une seule commande : un INCR suivi d'un EXPIRE qui échoue laissait
// une clé sans durée de vie, donc une adresse ou une IP bloquée sans fin.
const COMPTER_ET_EXPIRER = `
local compte = redis.call('INCR', KEYS[1])
if compte == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return compte
`

async function connexion() {
  const { connection } = await import('../jobs/queues.ts')
  return connection
}

/** Incrémente le compteur de `cle` et pose sa fenêtre s'il n'en a pas. Renvoie le compte. */
async function compter(cle: string, fenetreSecondes: number): Promise<number> {
  const compte = await avecDelai(
    (await connexion()).eval(
      COMPTER_ET_EXPIRER,
      1,
      `limite:${cle}`,
      fenetreSecondes
    ),
    1_000,
    'Limite par clé'
  )
  return Number(compte)
}

/**
 * Compte un appel pour `cle` dans une fenêtre fixe, dans Redis.
 * Renvoie false quand la limite est dépassée.
 *
 * Si Redis ne répond pas, l'appel passe : la limite par IP de Better Auth reste active,
 * et une panne de Redis ne doit pas empêcher toute connexion. Avec
 * `siIndisponible: 'refuser'`, l'appel est refusé : une écriture ouverte sans session
 * ne reste pas sans limite.
 */
export async function limiterParCle(
  cle: string,
  max: number,
  fenetreSecondes: number,
  options: { siIndisponible?: 'laisser-passer' | 'refuser' } = {}
): Promise<boolean> {
  try {
    return (await compter(cle, fenetreSecondes)) <= max
  } catch (erreur) {
    const refuser = options.siIndisponible === 'refuser'
    journal.error(
      { evenement: 'limite-indisponible', message: (erreur as Error).message },
      refuser
        ? 'Redis ne répond pas : l’appel limité est refusé.'
        : 'Redis ne répond pas : la limite par adresse est ignorée.'
    )
    return !refuser
  }
}

/**
 * Vrai quand `cle` a reçu au moins `max` refus dans sa fenêtre. Sans Redis, faux :
 * le contrôle qui suit (comparaison d'un jeton, par exemple) reste entier.
 */
export async function tropDeRefus(cle: string, max: number): Promise<boolean> {
  try {
    const compte = await avecDelai(
      (await connexion()).get(`limite:${cle}`),
      1_000,
      'Limite par clé'
    )
    return Number(compte ?? 0) >= max
  } catch (erreur) {
    journal.error(
      { evenement: 'limite-indisponible', message: (erreur as Error).message },
      'Redis ne répond pas : les refus récents ne sont pas comptés.'
    )
    return false
  }
}

/** Note un refus pour `cle`, dans une fenêtre fixe. Ne lève jamais. */
export async function noterRefus(
  cle: string,
  fenetreSecondes: number
): Promise<void> {
  try {
    await compter(cle, fenetreSecondes)
  } catch (erreur) {
    journal.error(
      { evenement: 'limite-indisponible', message: (erreur as Error).message },
      'Redis ne répond pas : le refus n’est pas compté.'
    )
  }
}
