// Page à rouvrir après la connexion (ADR 0067). Une application tierce envoie la
// personne vers l'écran de consentement : sans session, la personne se connecte
// d'abord, puis revient sur cet écran. Le lien du mail de connexion s'ouvre souvent
// dans un autre onglet : la page se garde dans le navigateur, 15 minutes au plus,
// comme la demande d'autorisation.

const CLE = 'relaytour.suite-connexion'
const DUREE_MS = 15 * 60 * 1000

/** Vrai pour une adresse de cette origine : un chemin, jamais une autre origine. */
export function suiteSure(chemin: string): boolean {
  return /^\/(?![/\\])/.test(chemin) && !/[\r\n]/.test(chemin)
}

export function memoriserSuite(chemin: string, maintenant = Date.now()): void {
  if (!suiteSure(chemin)) return
  try {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({ chemin, jusquA: maintenant + DUREE_MS })
    )
  } catch {
    // Stockage indisponible : la personne revient à l'accueil.
  }
}

/** La page à rouvrir, une seule fois, ou null. */
export function reprendreSuite(maintenant = Date.now()): string | null {
  try {
    const brut = window.localStorage.getItem(CLE)
    window.localStorage.removeItem(CLE)
    if (brut === null) return null
    const { chemin, jusquA } = JSON.parse(brut) as {
      chemin?: unknown
      jusquA?: unknown
    }
    if (
      typeof chemin !== 'string' ||
      typeof jusquA !== 'number' ||
      jusquA < maintenant ||
      !suiteSure(chemin)
    ) {
      return null
    }
    return chemin
  } catch {
    return null
  }
}
