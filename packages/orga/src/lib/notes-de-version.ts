import { graphql } from '../gql'
import type { RoleNoteDeVersion, TypeNoteDeVersion } from '../gql/graphql'

import type { VarianteEtat } from '../composants/Etat'

// Version de l'installation et notes de version (ADR 0021). Le serveur ne rend
// que les notes du rôle de la personne dans l'organisation active.

export const VERSION = graphql(`
  query VersionInstallation {
    versionInstallation
  }
`)

export const NOTES_DE_VERSION = graphql(`
  query NotesDeVersion {
    notesDeVersion {
      numero
      date
      notes {
        id
        type
        role
        titre
        texte
      }
    }
  }
`)

export const TYPES_NOTE: Record<
  TypeNoteDeVersion,
  { libelle: string; variante: VarianteEtat }
> = {
  FONCTIONNALITE: { libelle: 'Nouveauté', variante: 'faite' },
  CORRECTIF: { libelle: 'Correctif', variante: 'neutre' },
  RUPTURE: { libelle: 'Changement important', variante: 'alerte' },
  SECURITE: { libelle: 'Sécurité', variante: 'alerte' },
  PERFORMANCE: { libelle: 'Performance', variante: 'neutre' },
}

/** Le libellé d'une note réservée à des admins ; rien pour une note lue par tous. */
export const ROLES_NOTE: Record<RoleNoteDeVersion, string | null> = {
  REFERENT: null,
  ADMIN_ACTIVITE: 'Admins d’activité',
  ADMIN_ORGANISATION: 'Admins de l’organisation',
}

/** « 5 octobre 2026 », à partir d'une date « AAAA-MM-JJ » lue en UTC. */
export function dateDeVersion(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
