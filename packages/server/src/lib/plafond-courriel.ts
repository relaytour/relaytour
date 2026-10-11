import { limiterParCle, rendreTentative } from './limite.ts'

/**
 * Plafond quotidien des mails d'une installation (ADR 0031). Le compteur vit dans
 * Redis, par jour UTC, pour toute l'installation. Sans plafond, rien n'est compté.
 */

/** Sortes de mail qui partent toujours : une personne doit pouvoir se connecter. */
export const SORTES_HORS_PLAFOND: ReadonlySet<string> = new Set([
  'code-connexion',
])

// Le compteur d'un jour garde sa clé deux jours : il couvre le jour entier, quel
// que soit l'instant du premier envoi.
const DUREE_DU_COMPTEUR_SECONDES = 2 * 24 * 3600

/** Clé du compteur du jour UTC de `maintenant`. */
export function cleDuJour(maintenant: Date): string {
  return `courriel-quotidien:${maintenant.toISOString().slice(0, 10)}`
}

/** Millisecondes entre `maintenant` et le début du jour UTC suivant. */
export function attenteJusquAuLendemain(maintenant: Date): number {
  const lendemain = Date.UTC(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth(),
    maintenant.getUTCDate() + 1
  )
  return lendemain - maintenant.getTime()
}

type Limiter = typeof limiterParCle

/**
 * Réserve un envoi dans le compteur du jour. Renvoie « atteint » quand le plafond
 * est dépassé : l'appelant reporte alors le mail au lendemain. Sans plafond, ou
 * pour une sorte hors plafond, l'envoi est libre et rien n'est compté.
 *
 * Si Redis ne répond pas, l'envoi passe : la file elle-même dépend de Redis, et
 * une panne ne doit pas retenir les mails.
 */
export async function reserverEnvoi(
  sorte: string,
  plafond: number | undefined,
  maintenant: Date = new Date(),
  limiter: Limiter = limiterParCle
): Promise<'libre' | 'atteint'> {
  if (plafond === undefined || SORTES_HORS_PLAFOND.has(sorte)) return 'libre'
  const admis = await limiter(
    cleDuJour(maintenant),
    plafond,
    DUREE_DU_COMPTEUR_SECONDES
  )
  return admis ? 'libre' : 'atteint'
}

/**
 * Rend un envoi réservé qui n'est pas parti (panne du transport) : le nouvel essai
 * le réservera de nouveau. Ne lève jamais.
 */
export async function rendreEnvoi(
  sorte: string,
  plafond: number | undefined,
  maintenant: Date = new Date(),
  rendre: typeof rendreTentative = rendreTentative
): Promise<void> {
  if (plafond === undefined || SORTES_HORS_PLAFOND.has(sorte)) return
  await rendre(cleDuJour(maintenant))
}
