import type {
  StatutTache,
  SuiviAdmin,
  SuiviPerimetres,
  TypeNotification,
} from '@relaytour/database'

// Importance d'une notification pour chacun de ses destinataires (ADR 0065).
// « Vous concerne » part toujours ; « Suivi » et « Détail » suivent les réglages de
// suivi de la personne. Ce fichier ne lit pas la base : les points d'émission
// passent le contexte, et le filtre des destinataires applique le résultat.

export type Importance = 'MOI' | 'SUIVI' | 'DETAIL'

/** Ce que le filtre sait d'une personne affectée au périmètre. */
export interface Destinataire {
  userId: string
  /** La personne est contact principal du périmètre pour la période. */
  contactPrincipal: boolean
  /** Le périmètre a au moins un contact principal pour la période. */
  perimetreAUnContact: boolean
}

/** L'importance d'une notification, pour une personne du périmètre. */
export type ImportancePour = Importance | ((d: Destinataire) => Importance)

/** Le réglage de la personne couvre-t-il cette importance pour ce périmètre ? */
export function couvre(
  preferences: {
    suiviPerimetres: SuiviPerimetres
    detailContactPrincipal: boolean
  },
  importance: Importance,
  contactPrincipal: boolean
): boolean {
  if (importance === 'MOI') return true
  // Le détail des périmètres de contact vaut le niveau « Tout le détail » pour ces
  // seuls périmètres.
  const niveau: SuiviPerimetres =
    preferences.detailContactPrincipal && contactPrincipal
      ? 'DETAIL'
      : preferences.suiviPerimetres
  if (importance === 'SUIVI') return niveau !== 'MOI'
  return niveau === 'DETAIL'
}

/** Une notification d'admin couvre-t-elle le réglage « Suivi d'admin » ? */
export function couvreAdmin(
  suiviAdmin: SuiviAdmin,
  type: TypeNotification
): boolean {
  return importanceAdmin(type) === 'MOI' || suiviAdmin === 'DETAIL'
}

/**
 * L'importance d'une notification d'admin. Les actions à mener (une demande, un
 * souhait, un accès à valider) concernent l'admin ; le reste est du détail.
 *
 * La fonction reprend tout le tableau de l'ADR 0065. Une demande reçue, une
 * candidature, une invitation acceptée et un bénévole retiré ne passent pas par
 * `notifierLesAdmins` : leurs points d'émission les créent toujours, ce qui
 * revient à l'importance « Vous concerne ».
 */
export function importanceAdmin(type: TypeNotification): Importance {
  switch (type) {
    case 'DEMANDE_RECUE':
    case 'CANDIDATURE_RECUE':
    case 'SOUHAIT_FORMULE':
    case 'ACCES_FOURNISSEUR_A_VALIDER':
    case 'BENEVOLE_RETIRE':
    case 'INVITATION_ACCEPTEE':
      return 'MOI'
    default:
      return 'DETAIL'
  }
}

/** Une modification, un commentaire ou un statut, pour une personne qui n'est pas assignée. */
export function importanceChangement(statut?: StatutTache | null): Importance {
  // Une tâche faite fait avancer le périmètre : c'est un suivi. Le reste est du détail.
  return statut === 'FAITE' ? 'SUIVI' : 'DETAIL'
}

/** Une tâche créée : à prendre si elle n'a personne, du détail sinon. */
export function importanceCreation(aUnePersonne: boolean): Importance {
  return aUnePersonne ? 'DETAIL' : 'SUIVI'
}

/**
 * Une assignation ou un retrait : la personne concernée l'apprend toujours, les
 * autres personnes assignées en suivi, le reste du périmètre en détail.
 */
export function importanceAssignation(
  personneId: string,
  assignees: ReadonlySet<string>
): (d: Destinataire) => Importance {
  return d =>
    d.userId === personneId
      ? 'MOI'
      : assignees.has(d.userId)
        ? 'SUIVI'
        : 'DETAIL'
}

/**
 * Une déclinaison proposée attend un accord : les contacts principaux du périmètre
 * cible la reçoivent en premier, ou toute l'équipe quand le périmètre n'en a pas.
 */
export function importanceDemandeAccord(d: Destinataire): Importance {
  return !d.perimetreAUnContact || d.contactPrincipal ? 'MOI' : 'SUIVI'
}
