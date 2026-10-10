import { prisma } from '@relaytour/database'
import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins/email-otp'

import { mettreEnFile } from './courriel/file.ts'
import { env } from './env.ts'
import { ENTETE_IP_CLIENT } from './lib/adresse-client.ts'
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
// Et au plus 20 codes par adresse et par jour : avec 5 essais par code, un tiers qui
// demande des codes sur une adresse ne dispose que de 100 essais par jour sur un
// million de codes possibles.
const LIMITE_CODES_PAR_ADRESSE_ET_PAR_JOUR = {
  max: 20,
  fenetreSecondes: 24 * 3600,
}

// La connexion répond la même chose pour une adresse connue et une adresse inconnue
// (ADR 0002). Sans ce filtre, Better Auth répond « trop d'essais » ou « code expiré »
// pour une adresse qui a un compte, et toujours « code invalide » pour une autre :
// six essais faux suffisent à savoir si une adresse est connue.
const CODES_UNIFORMISES = new Set(['OTP_EXPIRED', 'TOO_MANY_ATTEMPTS'])

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
      // L'adresse du client, telle que le serveur l'a établie (lib/adresse-client.ts) et
      // réécrite dans cet en-tête avant d'appeler Better Auth. Better Auth ne lit
      // qu'une valeur unique dans X-Forwarded-For : avec une chaîne d'adresses (un
      // intermédiaire devant Caddy), il rangerait tous les clients dans un même compteur.
      ipAddress: { ipAddressHeaders: [ENTETE_IP_CLIENT] },
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
          const autorise =
            (await limiterParCle(
              `code:${adresse}`,
              LIMITE_CODES_PAR_ADRESSE.max,
              LIMITE_CODES_PAR_ADRESSE.fenetreSecondes
            )) &&
            (await limiterParCle(
              `code-jour:${adresse}`,
              LIMITE_CODES_PAR_ADRESSE_ET_PAR_JOUR.max,
              LIMITE_CODES_PAR_ADRESSE_ET_PAR_JOUR.fenetreSecondes
            ))
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
      after: createAuthMiddleware(ctx => {
        if (ctx.path !== '/sign-in/email-otp') return Promise.resolve()
        const rendu = ctx.context.returned
        if (
          rendu instanceof APIError &&
          typeof rendu.body?.code === 'string' &&
          CODES_UNIFORMISES.has(rendu.body.code)
        ) {
          return Promise.reject(
            new APIError('BAD_REQUEST', {
              code: 'INVALID_OTP',
              message: 'Invalid OTP',
            })
          )
        }
        // Better Auth renvoie le jeton de session dans le corps de la réponse, en plus
        // du cookie httpOnly. L'espace organisateur ne lit que le cookie : le jeton
        // n'a rien à faire dans un corps qu'un script de la page pourrait lire. Par
        // HTTP, le corps est enveloppé (`_flag: 'json'`) ; par `auth.api`, il est nu.
        const corps =
          rendu !== null &&
          typeof rendu === 'object' &&
          '_flag' in rendu &&
          rendu._flag === 'json' &&
          'body' in rendu
            ? rendu.body
            : rendu
        if (corps !== null && typeof corps === 'object' && 'token' in corps) {
          return Promise.resolve(ctx.json({ ...corps, token: null }))
        }
        return Promise.resolve()
      }),
    },

    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_VALIDITE_SECONDES,
        allowedAttempts: 5,
        // Le code est chiffré en base (XChaCha20-Poly1305, clé dérivée de
        // BETTER_AUTH_SECRET) et non haché : Better Auth ne réutilise un code en cours
        // que s'il peut le relire. Avec `reuse`, une nouvelle demande pendant la
        // validité renvoie le même code et prolonge sa validité, tant qu'il n'a pas
        // épuisé ses essais. Un tiers qui demande des codes sur l'adresse d'une autre
        // personne n'invalide donc plus le code qu'elle attend.
        storeOTP: 'encrypted',
        resendStrategy: 'reuse',
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
