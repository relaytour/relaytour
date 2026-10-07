import journalOrga from '../../../../notes/notes-de-version.orga.json'
import journalServeur from '../../../../notes/notes-de-version.serveur.json'

// Notes de version lues dans l'espace organisateur (ADR 0021).
//
// Les deux journaux compilés par `outils/versionner.mjs` entrent dans le build du
// serveur : une installation affiche les notes des versions qu'elle exécute, sans
// appel sortant. Seules les notes d'audience « organisateurs » s'affichent. Chaque
// note porte le rôle le moins étendu qu'elle concerne ; une personne lit les notes
// de son rôle et des rôles moins étendus.

/** Les rôles d'une note, du moins étendu au plus étendu. */
export const ROLES_NOTE = [
  'referent',
  'admin-activite',
  'admin-organisation',
] as const
export type RoleNote = (typeof ROLES_NOTE)[number]

/** Les types affichés, dans l'ordre de lecture d'une version. */
export const TYPES_NOTE = [
  'fonctionnalite',
  'correctif',
  'rupture',
  'securite',
  'performance',
] as const
export type TypeNote = (typeof TYPES_NOTE)[number]

interface NoteCompilee {
  id: string
  date: string
  type: string
  audience: string
  role: string | null
  etat: string
  fr: { titre: string; texte: string }
}

export interface Journal {
  version: string
  versions: { version: string | null; notes: NoteCompilee[] }[]
}

export interface NoteDeVersion {
  id: string
  date: string
  type: TypeNote
  role: RoleNote
  titre: string
  texte: string
}

export interface VersionPubliee {
  numero: string
  /** Date de la note la plus récente de la version, toutes audiences confondues. */
  date: string
  notes: NoteDeVersion[]
}

const JOURNAUX: Journal[] = [journalOrga, journalServeur]

function morceaux(version: string): number[] {
  return version.split('.').map(Number)
}

function comparerVersions(a: string, b: string): number {
  const [x, y] = [morceaux(a), morceaux(b)]
  for (let i = 0; i < 3; i += 1) {
    const ecart = (x[i] ?? 0) - (y[i] ?? 0)
    if (ecart !== 0) return ecart
  }
  return 0
}

function estUnType(type: string): type is TypeNote {
  return (TYPES_NOTE as readonly string[]).includes(type)
}

function estUnRole(role: string | null): role is RoleNote {
  return role !== null && (ROLES_NOTE as readonly string[]).includes(role)
}

/**
 * Les versions publiées que lit une personne de ce rôle, de la plus récente à la
 * plus ancienne. Une version sans note pour ce rôle n'apparaît pas. Les notes de
 * la prochaine version (sans numéro) et les notes différées restent hors de la liste.
 */
export function notesPourLeRole(
  role: RoleNote,
  journaux: Journal[] = JOURNAUX
): VersionPubliee[] {
  const rang = ROLES_NOTE.indexOf(role)
  const versions = new Map<string, { date: string; notes: NoteDeVersion[] }>()
  for (const journal of journaux) {
    for (const groupe of journal.versions) {
      if (groupe.version === null) continue
      const version = versions.get(groupe.version) ?? { date: '', notes: [] }
      versions.set(groupe.version, version)
      for (const note of groupe.notes) {
        if (note.date > version.date) version.date = note.date
        if (
          note.audience !== 'organisateurs' ||
          note.etat !== 'prevu' ||
          !estUnType(note.type) ||
          !estUnRole(note.role) ||
          ROLES_NOTE.indexOf(note.role) > rang
        ) {
          continue
        }
        version.notes.push({
          id: note.id,
          date: note.date,
          type: note.type,
          role: note.role,
          titre: note.fr.titre,
          texte: note.fr.texte,
        })
      }
    }
  }
  return [...versions]
    .filter(([, version]) => version.notes.length > 0)
    .sort(([a], [b]) => comparerVersions(b, a))
    .map(([numero, version]) => ({
      numero,
      date: version.date,
      notes: version.notes.sort(
        (a, b) =>
          TYPES_NOTE.indexOf(a.type) - TYPES_NOTE.indexOf(b.type) ||
          b.id.localeCompare(a.id)
      ),
    }))
}

/**
 * Le numéro de version de l'installation : celui du build de l'image, sinon celui
 * du journal embarqué (poste local).
 */
export function versionInstallation(
  source: NodeJS.ProcessEnv = process.env
): string {
  return source.APP_VERSION?.trim() || journalServeur.version
}
