import { z } from 'zod'

// Une chaîne vide vaut une absence : docker compose passe `${VAR:-}`, pas une variable absente.
const optionnelle = z
  .string()
  .optional()
  .transform(s => s?.trim() || undefined)

const origine = optionnelle
  .refine(s => s === undefined || /^https?:\/\//.test(s), {
    message: 'Une origine http(s) complète est attendue.',
  })
  .transform(s => s?.replace(/\/$/, ''))

// Variables lues hors de ce schéma, volontairement : DOMAINES_COURRIEL_AUTORISES
// (lib/contenu.ts) et CONTENU_ORGA (scripts orga-*). Elles servent à des scripts qui
// tournent sans base ni `.env` complet, comme `orga:valider` en CI (invariant 12).
const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    // L'environnement se lit ici et jamais dans NODE_ENV : la recette et la production
    // tournent toutes deux en NODE_ENV=production.
    APP_ENV: z.enum(['local', 'recette', 'prod']).default('local'),
    LOG_LEVEL: optionnelle.refine(
      s =>
        s === undefined ||
        ['trace', 'debug', 'info', 'warn', 'error'].includes(s),
      { message: 'LOG_LEVEL vaut trace, debug, info, warn ou error.' }
    ),
    PORT: z.coerce.number().int().positive().default(4400),
    WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(4401),
    DATABASE_URL: z.string().min(1),
    // Secret de signature des cookies de session (32 caractères au moins).
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'BETTER_AUTH_SECRET doit faire au moins 32 caractères.'),
    REDIS_URL: z.string().min(1).default('redis://127.0.0.1:4411'),
    // Liste séparée par des virgules.
    CORS_ORIGIN: z
      .string()
      .min(1)
      .default('http://localhost:5305')
      .transform(s =>
        s
          .split(',')
          .map(o => o.trim())
          .filter(Boolean)
      ),
    // DRAIN_GRACE_MS < SHUTDOWN_TIMEOUT_MS < délai d'arrêt de Docker (10 s).
    DRAIN_GRACE_MS: z.coerce.number().int().positive().default(5_000),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
    // Origine de l'espace organisateur, utilisée dans les liens des mails.
    ORIGINE_ORGA: origine,

    COURRIEL_SMTP_HOTE: optionnelle,
    COURRIEL_SMTP_PORT: z.coerce.number().int().positive().default(465),
    COURRIEL_SMTP_UTILISATEUR: optionnelle,
    COURRIEL_SMTP_MOT_DE_PASSE: optionnelle,
    COURRIEL_EXPEDITEUR: optionnelle.transform(
      s => s ?? 'Relaytour <relaytour@localhost>'
    ),
    // Nom de l'organisation, dans les sujets de mail et l'appel aux référent·es.
    // Une configuration par organisation remplacera ces trois variables (ADR 0006).
    ORGANISATION_NOM: optionnelle.transform(s => s ?? 'Relaytour'),
    CONTACT_RECRUTEMENT: optionnelle,
    PAGE_EQUIPE: optionnelle,
    // Hors production, la liste des adresses qui reçoivent vraiment les mails.
    // C'est une liste et jamais un booléen : le reste part dans Mailpit.
    COURRIEL_DELIVRABILITE: optionnelle
      .transform(s =>
        s === undefined
          ? []
          : s
              .split(',')
              .map(a => a.trim().toLowerCase())
              .filter(Boolean)
      )
      .refine(liste => liste.every(a => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)), {
        message:
          'COURRIEL_DELIVRABILITE est une liste d’adresses séparées par des virgules, pas un booléen.',
      }),
  })
  .superRefine((v, ctx) => {
    if (
      v.APP_ENV !== 'local' &&
      v.CORS_ORIGIN.some(o => o.includes('localhost'))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN contient localhost hors du poste local.',
      })
    }
    // Sans origine, les liens des mails et l'origine de confiance de la connexion
    // pointeraient sur un hôte d'exemple : le démarrage refuse plutôt que deviner.
    if (v.APP_ENV !== 'local' && v.ORIGINE_ORGA === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['ORIGINE_ORGA'],
        message: 'ORIGINE_ORGA est requis hors du poste local.',
      })
    }
    if (v.APP_ENV !== 'local' && v.BETTER_AUTH_SECRET.includes('local')) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: 'BETTER_AUTH_SECRET reprend la valeur du poste local.',
      })
    }
    if (v.DRAIN_GRACE_MS >= v.SHUTDOWN_TIMEOUT_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['DRAIN_GRACE_MS'],
        message:
          'DRAIN_GRACE_MS doit être strictement inférieur à SHUTDOWN_TIMEOUT_MS.',
      })
    }
    const smtp = [
      v.COURRIEL_SMTP_HOTE,
      v.COURRIEL_SMTP_UTILISATEUR,
      v.COURRIEL_SMTP_MOT_DE_PASSE,
    ]
    if (smtp.some(Boolean) && !smtp.every(Boolean)) {
      ctx.addIssue({
        code: 'custom',
        path: ['COURRIEL_SMTP_HOTE'],
        message:
          'COURRIEL_SMTP_HOTE, COURRIEL_SMTP_UTILISATEUR et COURRIEL_SMTP_MOT_DE_PASSE se renseignent ensemble.',
      })
    }
    if (
      v.APP_ENV !== 'prod' &&
      v.COURRIEL_SMTP_HOTE !== undefined &&
      v.COURRIEL_DELIVRABILITE.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['COURRIEL_DELIVRABILITE'],
        message:
          'Un SMTP réel hors production exige COURRIEL_DELIVRABILITE, sinon tous les comptes de test recevraient les mails.',
      })
    }
    if (
      v.COURRIEL_DELIVRABILITE.length > 0 &&
      v.COURRIEL_SMTP_HOTE === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['COURRIEL_DELIVRABILITE'],
        message: 'COURRIEL_DELIVRABILITE ne sert à rien sans SMTP réel.',
      })
    }
    if (v.APP_ENV === 'prod' && v.COURRIEL_DELIVRABILITE.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['COURRIEL_DELIVRABILITE'],
        message: 'COURRIEL_DELIVRABILITE n’a pas de sens en production.',
      })
    }
  })

export type ReglageSmtp = {
  hote: string
  port: number
  secure: boolean
  utilisateur?: string
  motDePasse?: string
}

export function resoudreEnv(source: NodeJS.ProcessEnv) {
  const brut = EnvSchema.parse(source)

  // Mailpit n'existe qu'en local et en recette : la capture est impossible en production.
  const mailpit: ReglageSmtp | null =
    brut.APP_ENV === 'local'
      ? { hote: '127.0.0.1', port: 4415, secure: false }
      : brut.APP_ENV === 'recette'
        ? { hote: 'mailpit', port: 1025, secure: false }
        : null

  const smtp: ReglageSmtp | null =
    brut.COURRIEL_SMTP_HOTE === undefined
      ? null
      : {
          hote: brut.COURRIEL_SMTP_HOTE,
          port: brut.COURRIEL_SMTP_PORT,
          // 465 = TLS implicite. La valeur se déduit du port, jamais d'une chaîne « true ».
          secure: brut.COURRIEL_SMTP_PORT === 465,
          utilisateur: brut.COURRIEL_SMTP_UTILISATEUR,
          motDePasse: brut.COURRIEL_SMTP_MOT_DE_PASSE,
        }

  return {
    ...brut,
    LOG_LEVEL: brut.LOG_LEVEL ?? (brut.APP_ENV === 'local' ? 'debug' : 'info'),
    ORIGINE_ORGA: brut.ORIGINE_ORGA ?? 'http://localhost:5305',
    // Voie principale : le SMTP réel s'il est renseigné, sinon Mailpit, sinon rien.
    COURRIEL: smtp ?? mailpit,
    // Voie de capture : existe seulement pendant un essai de délivrabilité hors production.
    COURRIEL_CAPTURE: smtp === null ? null : mailpit,
  }
}

export type Env = ReturnType<typeof resoudreEnv>

export const env: Env = resoudreEnv(process.env)
