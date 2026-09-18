import { prisma } from '@relaytour/database'
import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins/email-otp'

import { mettreEnFile } from './courriel/file.ts'
import { env } from './env.ts'
import { CODE_VALIDITE_SECONDES } from './lib/connexion.ts'
import { courrielTronque, journal } from './lib/journal.ts'
import { limiterParCle } from './lib/limite.ts'

// Connexion par code reçu par mail (ADR 0002).
//
// Le navigateur appelle Better Auth sur l'origine de l'espace organisateur
// (`/api/auth/*`, relayé vers l'API par Caddy ou par Vite) : le cookie de session
// reste un cookie de première partie, sans CORS.

// Les seules routes de Better Auth ouvertes. Toute autre route répond 404, y compris
// celles qu'une mise à jour de Better Auth ajouterait.
const ROUTES_OUVERTES = new Set([
  '/email-otp/send-verification-otp',
  '/sign-in/email-otp',
  '/get-session',
  '/sign-out',
])

// Au plus 5 codes par adresse sur 15 minutes, en plus de la limite par IP de Better Auth.
const LIMITE_CODES_PAR_ADRESSE = { max: 5, fenetreSecondes: 15 * 60 }

export function creerAuth(pluginsSupplementaires: BetterAuthPlugin[] = []) {
  return betterAuth({
    appName: 'Relaytour',
    baseURL: env.ORIGINE_ORGA,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.ORIGINE_ORGA],
    telemetry: { enabled: false },
    database: prismaAdapter(prisma, { provider: 'mysql' }),

    user: {
      additionalFields: {
        isAdmin: { type: 'boolean', defaultValue: false, input: false },
        archivedAt: { type: 'date', required: false, input: false },
      },
    },

    session: {
      expiresIn: 30 * 24 * 3600,
      // La session glisse : chaque jour d'utilisation la prolonge de 30 jours.
      updateAge: 24 * 3600,
    },

    rateLimit: {
      enabled: env.APP_ENV !== 'local',
      storage: 'database',
      customRules: {
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/sign-in/email-otp': { window: 60, max: 10 },
      },
    },

    advanced: {
      cookiePrefix: 'relaytour',
      // Caddy est le seul proxy : il remplace X-Forwarded-For par l'adresse du client.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },

    databaseHooks: {
      session: {
        create: {
          // Un compte archivé ne peut plus ouvrir de session, même avec un code valide.
          before: async session => {
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { archivedAt: true },
            })
            if (user === null || user.archivedAt !== null) return false
          },
        },
      },
    },

    hooks: {
      before: createAuthMiddleware(async ctx => {
        if (!ROUTES_OUVERTES.has(ctx.path)) {
          throw new APIError('NOT_FOUND')
        }
        if (ctx.path === '/email-otp/send-verification-otp') {
          const corps = ctx.body as
            { email?: unknown; type?: unknown } | undefined
          if (corps?.type !== 'sign-in') throw new APIError('BAD_REQUEST')
          const adresse =
            typeof corps.email === 'string'
              ? corps.email.trim().toLowerCase()
              : ''
          const autorise = await limiterParCle(
            `code:${adresse}`,
            LIMITE_CODES_PAR_ADRESSE.max,
            LIMITE_CODES_PAR_ADRESSE.fenetreSecondes
          )
          if (!autorise) {
            journal.warn(
              {
                evenement: 'connexion-codes-limites',
                destinataire: courrielTronque(adresse),
              },
              'Trop de codes demandés pour cette adresse.'
            )
            throw new APIError('TOO_MANY_REQUESTS')
          }
        }
      }),
    },

    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_VALIDITE_SECONDES,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        // Inscription fermée : une adresse inconnue reçoit la même réponse et aucun mail.
        disableSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'sign-in') return
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, archivedAt: true },
          })
          if (user === null || user.archivedAt !== null) return
          // Exception documentée (ADR 0002) : le job porte le code, il expire avec lui
          // et disparaît dès son traitement. La mise en file n'est pas attendue, pour que
          // la réponse ne soit pas plus lente qu'avec une adresse inconnue.
          void mettreEnFile(
            'code-connexion',
            { userId: user.id },
            { code: otp }
          )
        },
      }),
      ...pluginsSupplementaires,
    ],
  })
}

export const auth = creerAuth()

export type Auth = ReturnType<typeof creerAuth>
