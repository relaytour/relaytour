// Brouillon de l'éditeur de fiche. Le texte en cours de rédaction se garde dans le
// navigateur : une page rechargée, un onglet fermé ou une session terminée ne le
// perdent pas. Le brouillon ne quitte jamais le navigateur. Il s'efface à
// l'enregistrement de la fiche, à l'abandon de la saisie et à la déconnexion.

const PREFIXE = 'relaytour.brouillon.'

export interface Brouillon {
  titre: string
  contenu: string
  /** La version de la fiche lue avant la rédaction, null pour une fiche nouvelle. */
  versionDeDepart: string | null
  /** L'instant de la dernière frappe gardée, en ISO 8601. */
  enregistreLe: string
}

type Stockage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>

/** Le stockage du navigateur, absent en navigation privée stricte ou hors navigateur. */
function stockageDuNavigateur(): Stockage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * La clé d'un brouillon : l'organisation, l'activité et la fiche. Une fiche nouvelle
 * se désigne par son périmètre, ou par `commune`.
 */
export function cleBrouillon(parties: {
  organisation: string | null
  activite: string
  fiche: string
}): string {
  return `${PREFIXE}${parties.organisation ?? 'unique'}.${parties.activite}.${parties.fiche}`
}

export function lireBrouillon(
  cle: string,
  stockage = stockageDuNavigateur()
): Brouillon | null {
  try {
    const lu: unknown = JSON.parse(stockage?.getItem(cle) ?? 'null')
    if (typeof lu !== 'object' || lu === null) return null
    const { titre, contenu, versionDeDepart, enregistreLe } = lu as Record<
      string,
      unknown
    >
    if (
      typeof titre !== 'string' ||
      typeof contenu !== 'string' ||
      typeof enregistreLe !== 'string' ||
      (versionDeDepart !== null && typeof versionDeDepart !== 'string')
    ) {
      return null
    }
    return { titre, contenu, versionDeDepart, enregistreLe }
  } catch {
    return null
  }
}

export function ecrireBrouillon(
  cle: string,
  brouillon: Brouillon,
  stockage = stockageDuNavigateur()
): void {
  try {
    stockage?.setItem(cle, JSON.stringify(brouillon))
  } catch {
    // Stockage plein ou indisponible : la saisie reste à l'écran, sans filet.
  }
}

export function effacerBrouillon(
  cle: string,
  stockage = stockageDuNavigateur()
): void {
  try {
    stockage?.removeItem(cle)
  } catch {
    // Rien à effacer.
  }
}

/** Efface tous les brouillons du navigateur : la personne se déconnecte. */
export function effacerLesBrouillons(stockage = stockageDuNavigateur()): void {
  try {
    if (stockage === null) return
    const cles: string[] = []
    for (let i = 0; i < stockage.length; i++) {
      const cle = stockage.key(i)
      if (cle?.startsWith(PREFIXE)) cles.push(cle)
    }
    for (const cle of cles) stockage.removeItem(cle)
  } catch {
    // Rien à effacer.
  }
}
