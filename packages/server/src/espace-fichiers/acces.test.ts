import { describe, expect, it } from 'vitest'

import { planifierUnique, type FileUnique } from './acces.ts'

// La vérification des accès se met en file une fois par organisation (ADR 0044).

/** Une file BullMQ réduite à ses jobs et à leurs états. */
function fileSimulee(etats: Record<string, string>) {
  const ajouts: string[] = []
  const retraits: string[] = []
  const file: FileUnique = {
    getJob: id =>
      Promise.resolve(
        etats[id] === undefined
          ? undefined
          : {
              getState: () => Promise.resolve(etats[id]!),
              remove: () => {
                retraits.push(id)
                return Promise.resolve()
              },
            }
      ),
    add: (_nom, _donnees, { jobId }) => {
      ajouts.push(jobId)
      return Promise.resolve()
    },
  }
  return { file, ajouts, retraits }
}

describe('planifierUnique', () => {
  const planifier = async (etats: Record<string, string>) => {
    const f = fileSimulee(etats)
    await planifierUnique(f.file, 'acces', 'org')
    return { ajouts: f.ajouts, retraits: f.retraits }
  }

  it('met une vérification en file quand aucune n’attend', async () => {
    expect(await planifier({})).toEqual({ ajouts: ['acces'], retraits: [] })
  })

  it('regroupe une demande avec la vérification qui attend', async () => {
    for (const etat of ['waiting', 'delayed', 'prioritized']) {
      expect(await planifier({ acces: etat })).toEqual({
        ajouts: [],
        retraits: [],
      })
    }
  })

  it('remplace une vérification terminée', async () => {
    for (const etat of ['completed', 'failed']) {
      expect(await planifier({ acces: etat })).toEqual({
        ajouts: ['acces'],
        retraits: ['acces'],
      })
    }
  })

  it('donne une suite à une vérification en cours, une seule fois', async () => {
    expect(await planifier({ acces: 'active' })).toEqual({
      ajouts: ['acces-suite'],
      retraits: [],
    })
    expect(
      await planifier({ acces: 'active', 'acces-suite': 'delayed' })
    ).toEqual({ ajouts: [], retraits: [] })
    expect(
      await planifier({ acces: 'active', 'acces-suite': 'completed' })
    ).toEqual({ ajouts: ['acces-suite'], retraits: ['acces-suite'] })
  })
})
