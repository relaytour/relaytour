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

describe('connexion par code', () => {
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
