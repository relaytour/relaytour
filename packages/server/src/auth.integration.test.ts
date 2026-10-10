import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { APIError } from 'better-auth/api'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { auth } from './auth.ts'

// La connexion par code répond la même chose pour une adresse connue et pour une
// adresse inconnue (ADR 0002). Le refus se prouve sur les deux (invariant 11).

const suffixe = randomUUID().slice(0, 8)
const connue = `connue-${suffixe}@exemple.fr`
const inconnue = `inconnue-${suffixe}@exemple.fr`
const ids = { connue: '' }

beforeAll(async () => {
  ids.connue = randomUUID()
  await prisma.user.create({
    data: {
      id: ids.connue,
      email: connue,
      name: 'Compte connu',
      emailVerified: true,
      isAdmin: false,
    },
  })
})

afterAll(async () => {
  await prisma.verification.deleteMany({
    where: { identifier: { contains: suffixe } },
  })
  await prisma.session.deleteMany({ where: { userId: ids.connue } })
  await prisma.user.deleteMany({ where: { id: ids.connue } })
})

async function demanderUnCode(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
}

/** Statut et code d'erreur d'une tentative de connexion avec un code faux. */
async function essayer(email: string, otp: string) {
  try {
    await auth.api.signInEmailOTP({ body: { email, otp } })
  } catch (erreur) {
    if (erreur instanceof APIError) {
      return { statut: erreur.statusCode, code: erreur.body?.code }
    }
    throw erreur
  }
  throw new Error('La connexion aurait dû échouer.')
}

/** Le code mis en file pour un compte : le worker ne tourne pas pendant les tests. */
async function codeEnFile(userId: string): Promise<string> {
  const { courrielQueue } = await import('./jobs/queues.ts')
  const jobs = await courrielQueue.getJobs([
    'waiting',
    'delayed',
    'prioritized',
  ])
  const job = jobs
    .filter(j => j.data.sorte === 'code-connexion' && j.data.userId === userId)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0]
  if (job?.data.code === undefined) throw new Error('Aucun code en file.')
  await job.remove()
  return job.data.code
}

describe('connexion par code', () => {
  it('répond la même chose pour un code expiré et pour une adresse inconnue', async () => {
    const expiree = `expiree-${suffixe}@exemple.fr`
    await demanderUnCode(connue)
    await demanderUnCode(expiree)
    // Better Auth seul répondrait « code expiré » pour l'adresse connue dont le code
    // a expiré, et « code invalide » pour l'adresse inconnue.
    await prisma.verification.updateMany({
      where: { identifier: `sign-in-otp-${connue}` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const reponses = [
      await essayer(connue, '000000'),
      await essayer(expiree, '000000'),
    ]
    expect(reponses[0]).toEqual(reponses[1])
    expect(reponses[0]).toEqual({ statut: 400, code: 'INVALID_OTP' })
  })

  it('ouvre une session avec le bon code, sans renvoyer le jeton dans le corps', async () => {
    await demanderUnCode(connue)
    const code = await codeEnFile(ids.connue)
    const reponse = await auth.api.signInEmailOTP({
      body: { email: connue, otp: code },
    })
    expect(reponse.user.id).toBe(ids.connue)
    expect(reponse.token).toBeNull()
    expect(await prisma.session.count({ where: { userId: ids.connue } })).toBe(
      1
    )
  })

  it('répond la même chose pour une adresse connue et une adresse inconnue, essai après essai', async () => {
    await demanderUnCode(connue)
    await demanderUnCode(inconnue)
    const reponses = { connue: [] as unknown[], inconnue: [] as unknown[] }
    // Cinq essais permis par code, puis le sixième : Better Auth seul répondrait
    // « trop d'essais » (403) pour l'adresse connue et « code invalide » pour l'autre.
    for (let i = 0; i < 7; i++) {
      reponses.connue.push(await essayer(connue, '000000'))
      reponses.inconnue.push(await essayer(inconnue, '000000'))
    }
    expect(reponses.connue).toEqual(reponses.inconnue)
    expect(reponses.connue[6]).toEqual({ statut: 400, code: 'INVALID_OTP' })
  })
})
