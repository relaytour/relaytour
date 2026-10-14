import { describe, expect, it } from 'vitest'

import { archiveePourCeMail } from './appartenances.ts'

const active = (organisationId: string) => ({ organisationId, archiveLe: null })
const archivee = (organisationId: string) => ({
  organisationId,
  archiveLe: new Date('2026-10-01'),
})

describe('archiveePourCeMail', () => {
  it('retient le mail de l’organisation où la personne est archivée, pas celui d’une autre', () => {
    const appartenances = [archivee('a'), active('b')]
    expect(archiveePourCeMail(appartenances, 'a')).toBe(true)
    expect(archiveePourCeMail(appartenances, 'b')).toBe(false)
  })

  it('laisse partir le mail d’une organisation dont la personne n’est pas membre', () => {
    // Une invitation en attente (ADR 0030) : aucune appartenance dans l'organisation.
    expect(archiveePourCeMail([archivee('a')], 'c')).toBe(false)
    expect(archiveePourCeMail([], 'c')).toBe(false)
  })

  it('sans organisation connue, ne retient le mail que d’une personne archivée partout', () => {
    expect(archiveePourCeMail([archivee('a'), archivee('b')], undefined)).toBe(
      true
    )
    expect(archiveePourCeMail([archivee('a'), active('b')], undefined)).toBe(
      false
    )
    expect(archiveePourCeMail([], undefined)).toBe(false)
  })
})
