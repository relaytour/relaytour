// Les notifications à annoncer par un avis à l'écran (ADR 0065). L'espace retient
// les notifications déjà vues depuis son ouverture : seule une notification non lue
// qui n'en fait pas partie s'annonce, une seule fois.

export interface NotificationAnnoncable {
  id: string
  lue: boolean
}

/** Au-delà, les nouvelles s'annoncent en un seul avis qui les compte. */
export const AVIS_MAX = 3

export function aAnnoncer<T extends NotificationAnnoncable>(
  recues: readonly T[],
  vues: ReadonlySet<string>
): T[] {
  return recues.filter(n => !n.lue && !vues.has(n.id))
}
