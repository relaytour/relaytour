// Rangement des notifications (ADR 0032 et 0033) : la cloche les range par
import { langueActive } from './langue'
// activité, l'écran des admins par activité puis par périmètre. Les notifications
// sans activité forment un groupe à part, placé en tête.

export interface NotificationRangee {
  id: string
  lue: boolean
  activite: { id: string; slug: string; nom: string } | null
  perimetre: {
    id: string
    slug: string
    nom: string
    couleur?: string | null
  } | null
}

export interface Groupe<T> {
  /** Clé stable du groupe : l'identifiant de l'activité ou du périmètre, ou `''`. */
  cle: string
  titre: string
  activiteId: string | null
  perimetreId: string | null
  couleur: string | null
  nonLues: number
  elements: T[]
}

function ranger<T extends NotificationRangee>(
  notifications: T[],
  cleDe: (n: T) => string | null,
  titreDe: (n: T) => string,
  sansCle: string,
  completer: (n: T) => Pick<Groupe<T>, 'activiteId' | 'perimetreId' | 'couleur'>
): Groupe<T>[] {
  const groupes = new Map<string, Groupe<T>>()
  for (const n of notifications) {
    const cle = cleDe(n) ?? ''
    const groupe = groupes.get(cle) ?? {
      cle,
      titre: cle === '' ? sansCle : titreDe(n),
      ...completer(n),
      nonLues: 0,
      elements: [],
    }
    groupe.elements.push(n)
    if (!n.lue) groupe.nonLues++
    groupes.set(cle, groupe)
  }
  // Le groupe sans clé en tête, puis les autres dans l'ordre alphabétique.
  return [...groupes.values()].sort((a, b) =>
    a.cle === ''
      ? -1
      : b.cle === ''
        ? 1
        : a.titre.localeCompare(b.titre, langueActive())
  )
}

/** Range des notifications par activité ; celles sans activité forment `sansActivite`. */
export function grouperParActivite<T extends NotificationRangee>(
  notifications: T[],
  sansActivite: string
): Groupe<T>[] {
  return ranger(
    notifications,
    n => n.activite?.id ?? null,
    n => n.activite!.nom,
    sansActivite,
    n => ({
      activiteId: n.activite?.id ?? null,
      perimetreId: null,
      couleur: null,
    })
  )
}

/**
 * Range les notifications d'une activité par périmètre ; celles sans périmètre
 * forment `sansPerimetre`.
 */
export function grouperParPerimetre<T extends NotificationRangee>(
  notifications: T[],
  sansPerimetre: string
): Groupe<T>[] {
  return ranger(
    notifications,
    n => n.perimetre?.id ?? null,
    n => n.perimetre!.nom,
    sansPerimetre,
    n => ({
      activiteId: n.activite?.id ?? null,
      perimetreId: n.perimetre?.id ?? null,
      couleur: n.perimetre?.couleur ?? null,
    })
  )
}
