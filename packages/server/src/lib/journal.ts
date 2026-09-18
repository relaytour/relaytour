import { pino } from 'pino'

// Journal JSON sur stdout. Chaque ligne porte un champ `evenement` stable, filtrable
// par grep. Les messages sont en français ; les champs servent à l'outillage.
//
// Aucune adresse complète, aucun code, aucun jeton n'entre dans le journal :
// on journalise l'identifiant utilisateur, ou l'adresse tronquée par `courrielTronque`.
// Le filet `redact` caviarde les champs sensibles qui passeraient malgré tout.
//
// Ce fichier lit process.env et pas env.ts : le schéma l'importe, et l'impression du
// schéma (scripts/print-schema.ts) doit fonctionner sans fichier .env.

const APP_ENV = process.env.APP_ENV?.trim() || 'local'
const NIVEAUX = ['trace', 'debug', 'info', 'warn', 'error']
const demande = process.env.LOG_LEVEL?.trim()

const SENSIBLES = [
  'password',
  'token',
  'jeton',
  'code',
  'otp',
  'authorization',
  'cookie',
]

export const journal = pino({
  level:
    demande && NIVEAUX.includes(demande)
      ? demande
      : APP_ENV === 'local'
        ? 'debug'
        : 'info',
  base: { env: APP_ENV },
  redact: {
    paths: [...SENSIBLES, ...SENSIBLES.map(champ => `*.${champ}`)],
    censor: '⟨retiré⟩',
  },
})

/** « qu…@gmail.com » : assez pour reconnaître un compte, pas assez pour constituer un fichier. */
export function courrielTronque(courriel: string): string {
  const arobase = courriel.indexOf('@')
  if (arobase <= 0) return '⟨illisible⟩'
  return `${courriel.slice(0, Math.min(2, arobase))}…${courriel.slice(arobase)}`
}
