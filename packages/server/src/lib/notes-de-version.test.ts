import { describe, expect, it } from 'vitest'

import {
  notesPourLeRole,
  versionInstallation,
  type Journal,
} from './notes-de-version.ts'

function note(
  id: string,
  champs: Partial<Journal['versions'][number]['notes'][number]> = {}
) {
  return {
    id,
    date: id.slice(0, 10),
    type: 'fonctionnalite',
    audience: 'organisateurs',
    role: 'referent',
    etat: 'prevu',
    fr: { titre: `Titre de ${id}`, texte: `Texte de ${id}.` },
    ...champs,
  }
}

const orga: Journal = {
  version: '0.3.0',
  versions: [
    { version: null, notes: [note('2026-03-01-orga-a-venir')] },
    {
      version: '0.3.0',
      notes: [
        note('2026-02-03-orga-reglage', { role: 'admin-organisation' }),
        note('2026-02-02-orga-correctif', { type: 'correctif' }),
        note('2026-02-01-orga-ecran'),
      ],
    },
    {
      version: '0.2.0',
      notes: [note('2026-01-02-orga-equipe', { role: 'admin-activite' })],
    },
  ],
}

const serveur: Journal = {
  version: '0.3.0',
  versions: [
    {
      version: '0.10.0',
      notes: [note('2026-04-01-serveur-plus-tard')],
    },
    {
      version: '0.3.0',
      notes: [
        note('2026-02-05-serveur-interne', {
          type: 'interne',
          audience: 'interne',
          role: null,
        }),
        note('2026-02-04-serveur-heberger', { audience: 'public', role: null }),
        note('2026-02-02-serveur-reporte', { etat: 'differe' }),
        note('2026-02-02-serveur-mail'),
      ],
    },
  ],
}

const lire = (role: Parameters<typeof notesPourLeRole>[0]) =>
  notesPourLeRole(role, [orga, serveur]).map(v => [
    v.numero,
    v.notes.map(n => n.id),
  ])

describe('notesPourLeRole', () => {
  it('donne à une référente ou un référent les seules notes de son rôle', () => {
    expect(lire('referent')).toEqual([
      ['0.10.0', ['2026-04-01-serveur-plus-tard']],
      [
        '0.3.0',
        [
          '2026-02-02-serveur-mail',
          '2026-02-01-orga-ecran',
          '2026-02-02-orga-correctif',
        ],
      ],
    ])
  })

  it('ajoute les notes des admins d’activité, puis celles des admins de l’organisation', () => {
    expect(lire('admin-activite').at(-1)).toEqual([
      '0.2.0',
      ['2026-01-02-orga-equipe'],
    ])
    const ids = lire('admin-organisation').flatMap(([, notes]) => notes)
    expect(ids).toContain('2026-02-03-orga-reglage')
    expect(ids).toContain('2026-01-02-orga-equipe')
  })

  it('écarte la prochaine version, les notes internes, publiques et différées', () => {
    const ids = lire('admin-organisation').flatMap(([, notes]) => notes)
    expect(ids).not.toContain('2026-03-01-orga-a-venir')
    expect(ids).not.toContain('2026-02-05-serveur-interne')
    expect(ids).not.toContain('2026-02-04-serveur-heberger')
    expect(ids).not.toContain('2026-02-02-serveur-reporte')
  })

  it('date une version de sa note la plus récente, toutes audiences confondues', () => {
    const version = notesPourLeRole('referent', [orga, serveur])[1]
    expect(version?.date).toBe('2026-02-05')
  })

  it('lit les journaux embarqués', () => {
    const versions = notesPourLeRole('admin-organisation')
    expect(versions.length).toBeGreaterThan(0)
    expect(versions.length).toBeGreaterThanOrEqual(
      notesPourLeRole('referent').length
    )
  })
})

describe('versionInstallation', () => {
  it('prend le numéro du build, sinon celui du journal embarqué', () => {
    expect(versionInstallation({ APP_VERSION: '1.2.3' })).toBe('1.2.3')
    expect(versionInstallation({})).toMatch(/^\d+\.\d+\.\d+$/)
    expect(versionInstallation({ APP_VERSION: ' ' })).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
