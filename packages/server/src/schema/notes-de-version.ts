import type { AppContext } from '../context.ts'
import {
  notesPourLeRole,
  versionInstallation,
  type NoteDeVersion,
  type RoleNote,
  type VersionPubliee,
} from '../lib/notes-de-version.ts'

import { builder } from './builder.ts'

// Version de l'installation et notes de version (ADR 0021). Le numéro se lit sans
// session, comme sur /health. Les notes se lisent avec une session : le serveur ne
// rend que celles du rôle de la personne dans l'organisation active.

const TypeNoteEnum = builder.enumType('TypeNoteDeVersion', {
  values: {
    FONCTIONNALITE: { value: 'fonctionnalite' },
    CORRECTIF: { value: 'correctif' },
    RUPTURE: { value: 'rupture' },
    SECURITE: { value: 'securite' },
    PERFORMANCE: { value: 'performance' },
  } as const,
})

const RoleNoteEnum = builder.enumType('RoleNoteDeVersion', {
  description:
    'Le rôle le moins étendu qu’une note concerne. Une personne lit les notes de son rôle et des rôles moins étendus.',
  values: {
    REFERENT: { value: 'referent' },
    ADMIN_ACTIVITE: { value: 'admin-activite' },
    ADMIN_ORGANISATION: { value: 'admin-organisation' },
  } as const,
})

const NoteDeVersionRef = builder
  .objectRef<NoteDeVersion>('NoteDeVersion')
  .implement({
    fields: t => ({
      id: t.exposeString('id'),
      date: t.field({ type: 'Date', resolve: n => new Date(n.date) }),
      type: t.field({ type: TypeNoteEnum, resolve: n => n.type }),
      role: t.field({ type: RoleNoteEnum, resolve: n => n.role }),
      titre: t.exposeString('titre'),
      texte: t.exposeString('texte'),
    }),
  })

const VersionPublieeRef = builder
  .objectRef<VersionPubliee>('VersionPubliee')
  .implement({
    description:
      'Une version de Relaytour et ses notes lisibles par la personne connectée.',
    fields: t => ({
      numero: t.exposeString('numero'),
      date: t.field({
        type: 'Date',
        description: 'Date de la note la plus récente de la version.',
        resolve: v => new Date(v.date),
      }),
      notes: t.field({ type: [NoteDeVersionRef], resolve: v => v.notes }),
    }),
  })

/** Le rôle le plus étendu de la personne dans l'organisation active (ADR 0010). */
async function roleDeLaPersonne(ctx: AppContext): Promise<RoleNote> {
  if (ctx.organisation?.role === 'ADMIN') return 'admin-organisation'
  if ((await ctx.activitesAdministrees()).size > 0) return 'admin-activite'
  return 'referent'
}

builder.queryFields(t => ({
  versionInstallation: t.string({
    description:
      'Numéro de version de l’installation. Lisible sans session, comme sur /health.',
    resolve: () => versionInstallation(),
  }),
  notesDeVersion: t.field({
    type: [VersionPublieeRef],
    authScopes: { connecte: true },
    description:
      'Notes des versions publiées, de la plus récente à la plus ancienne, limitées au rôle de la personne dans l’organisation active.',
    resolve: async (_root, _args, ctx) =>
      notesPourLeRole(await roleDeLaPersonne(ctx)),
  }),
}))
