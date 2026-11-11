// Proposition du modèle de notifications du rôle (ADR 0065). L'espace la montre
// au plus une fois par jour et par navigateur, tant que la personne ne l'a ni
// appliquée ni refusée. Le choix se garde sur le serveur ; la date du dernier
// avis, dans le navigateur seulement.

const PREFIXE = 'relaytour.proposition-modele.'

type Stockage = Pick<Storage, 'getItem' | 'setItem'>

function stockage(): Stockage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** La clé d'un avis : l'organisation et le modèle proposé. */
export function cleAvis(organisation: string, modele: string): string {
  return `${PREFIXE}${organisation}.${modele}`
}

/** L'avis se montre s'il n'a pas déjà été montré ce jour-là. */
export function doitProposer(
  modele: string | null | undefined,
  dernierAvis: string | null,
  jour: string
): modele is string {
  return Boolean(modele) && dernierAvis !== jour
}

/** Le jour local, au format AAAA-MM-JJ. */
export function jourLocal(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const j = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${j}`
}

export function dernierAvis(cle: string, s = stockage()): string | null {
  try {
    return s?.getItem(cle) ?? null
  } catch {
    return null
  }
}

export function noterAvis(cle: string, jour: string, s = stockage()): void {
  try {
    s?.setItem(cle, jour)
  } catch {
    // Un stockage refusé montre l'avis à chaque ouverture : rien ne se perd.
  }
}
