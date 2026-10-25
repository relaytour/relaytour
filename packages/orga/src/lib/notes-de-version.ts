import { msg } from '@lingui/core/macro'
import type { MessageDescriptor } from '@lingui/core'

import { graphql } from '../gql'
import type { RoleNoteDeVersion, TypeNoteDeVersion } from '../gql/graphql'

import type { VarianteEtat } from '../composants/Etat'
import { langueActive } from './langue'

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
  { libelle: MessageDescriptor; variante: VarianteEtat }
> = {
  FONCTIONNALITE: { libelle: msg`Nouveauté`, variante: 'faite' },
  CORRECTIF: { libelle: msg`Correctif`, variante: 'neutre' },
  RUPTURE: { libelle: msg`Changement important`, variante: 'alerte' },
  SECURITE: { libelle: msg`Sécurité`, variante: 'alerte' },
  PERFORMANCE: { libelle: msg`Performance`, variante: 'neutre' },
}

/** Le libellé d'une note réservée à des admins ; rien pour une note lue par tous. */
export const ROLES_NOTE: Record<RoleNoteDeVersion, MessageDescriptor | null> = {
  REFERENT: null,
  ADMIN_ACTIVITE: msg`Admins d’activité`,
  ADMIN_ORGANISATION: msg`Admins de l’organisation`,
}

/** « 5 octobre 2026 », à partir d'une date « AAAA-MM-JJ » lue en UTC. */
export function dateDeVersion(iso: string): string {
  return new Date(iso).toLocaleDateString(langueActive(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
