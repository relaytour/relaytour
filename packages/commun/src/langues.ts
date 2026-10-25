/**
 * Langues de l'interface (ADR 0047). Le serveur valide une préférence contre cette
 * liste, et l'espace organisateur y lit les catalogues qu'il sait charger. Une
 * langue s'ajoute ici et dans `packages/orga/lingui.config.ts`.
 */
export const LANGUES = ['fr', 'en'] as const
export type Langue = (typeof LANGUES)[number]
export const LANGUE_SOURCE: Langue = 'fr'

export function estUneLangue(valeur: string): valeur is Langue {
  return (LANGUES as readonly string[]).includes(valeur)
}

/**
 * Première langue connue d'une liste de préférences, comme `navigator.languages`
 * ou un en-tête `Accept-Language` déjà découpé. Une balise régionale vaut sa
 * langue : `en-GB` donne `en`. Sans langue connue, le français l'emporte.
 */
export function resoudreLangue(
  preferences: readonly (string | null | undefined)[]
): Langue {
  for (const preference of preferences) {
    if (!preference) continue
    const langue = preference.trim().toLowerCase().split(/[-_;]/)[0]!
    if (estUneLangue(langue)) return langue
  }
  return LANGUE_SOURCE
}
