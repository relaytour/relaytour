import { beforeEach, describe, expect, it, vi } from 'vitest'

const add = vi.fn(() => Promise.resolve())
vi.mock('../jobs/queues.ts', () => ({
  connection: {},
  courrielQueue: { add },
}))

const { mettreEnFile } = await import('./file.ts')

describe('mettreEnFile', () => {
  beforeEach(() => add.mockClear())

  it('met le code de connexion en file sans priorité, pour qu’il passe devant', async () => {
    await mettreEnFile('code-connexion', { userId: 'u1' }, { code: '123456' })
    const options = (add.mock.calls[0] as unknown[])[2] as object
    expect(options).not.toHaveProperty('priority')
  })

  it('donne une priorité aux autres mails', async () => {
    await mettreEnFile('invitation', { userId: 'u1' })
    await mettreEnFile('resume', { userId: 'u1' }, { delai: 1000 })
    expect(add).toHaveBeenCalledTimes(2)
    for (const appel of add.mock.calls as unknown[][]) {
      expect(appel[2]).toMatchObject({ priority: 10 })
    }
  })
})
