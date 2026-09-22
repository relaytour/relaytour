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
    // L'environnement se lit ici et jamais dans NODE_ENV : une installation déployée
    // tourne en NODE_ENV=production quel que soit son usage.
    APP_ENV: z.enum(['local', 'prod']).default('local'),
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
    // Sans expéditeur, la configuration compose « <nom court> <relaytour@localhost> ».
    COURRIEL_EXPEDITEUR: optionnelle,
    // Amorçage de la configuration d'organisation (lib/organisation.ts) avant le
    // premier import d'organisation.yaml. La ligne en base prend ensuite le relais (ADR 0006).
    ORGANISATION_NOM: optionnelle.transform(s => s ?? 'Relaytour'),
    CONTACT_RECRUTEMENT: optionnelle,
    PAGE_EQUIPE: optionnelle,
    // Adresse ou URL de l'hébergeur, citée quand une limite d'organisation est
    // atteinte (ADR 0008). Absente en auto-hébergement : le message renvoie vers un admin.
    CONTACT_HEBERGEUR: optionnelle,
    // Administration de l'installation (ADR 0008) : jeton d'un hébergeur pour créer,
    // suspendre, limiter et exporter les organisations, sans accès aux données.
    // Absent, l'API d'administration est fermée ; seuls les scripts l'exercent.
    JETON_ADMINISTRATION: optionnelle.refine(
      s => s === undefined || s.length >= 32,
      'JETON_ADMINISTRATION : 32 caractères au moins'
    ),
    // Dossier du serveur où s'écrivent les exports d'organisation.
    EXPORTS_DIR: optionnelle,
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

  // Le Mailpit du poste local (packages/database/docker-compose.yml) reçoit tout sans SMTP.
  const mailpit: ReglageSmtp | null =
    brut.APP_ENV === 'local'
      ? { hote: '127.0.0.1', port: 4415, secure: false }
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
    // Un seul transport : le SMTP renseigné, sinon le Mailpit du poste local, sinon rien.
    // En production sans SMTP, les mails sont mis en file puis ignorés (courriel-sans-transport).
    COURRIEL: smtp ?? mailpit,
  }
}

export type Env = ReturnType<typeof resoudreEnv>

export const env: Env = resoudreEnv(process.env)
