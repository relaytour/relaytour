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

// Rend une tentative réservée par INCR, sans passer sous zéro : la clé a pu expirer
// entre la réservation et la restitution.
const RENDRE = `
local compte = tonumber(redis.call('GET', KEYS[1]) or '0')
if compte > 0 then return redis.call('DECR', KEYS[1]) end
return 0
`

/**
 * Rend une tentative comptée par `limiterParCle` : l'appel réserve sa place avant
 * un contrôle, puis la rend si le contrôle réussit. Seuls les échecs s'accumulent,
 * et deux requêtes parallèles ne peuvent pas dépasser la limite ensemble. Ne lève jamais.
 */
export async function rendreTentative(cle: string): Promise<void> {
  try {
    await avecDelai(
      (await connexion()).eval(RENDRE, 1, `limite:${cle}`),
      1_000,
      'Limite par clé'
    )
  } catch (erreur) {
    journal.error(
      { evenement: 'limite-indisponible', message: (erreur as Error).message },
      'Redis ne répond pas : la tentative n’est pas rendue.'
    )
  }
}
