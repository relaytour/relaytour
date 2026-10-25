import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

/**
 * Langues du serveur : mails, notifications, messages d'erreur (ADR 0047).
 *
 * Le serveur tourne sous tsx et se construit avec tsup, qui n'exécutent pas la
 * macro de Lingui. Les messages s'écrivent donc sans macro, par
 * `i18n._('Texte français {variable}', { variable })` : le texte français sert
 * d'identifiant, comme dans l'espace organisateur. `i18n` vient de
 * `src/lib/langue.ts` ; l'extraction ne lit que les appels à un objet nommé `i18n`.
 *
 * `langues:compiler` écrit les catalogues compilés (`messages.ts`) que le serveur
 * importe. Les deux formes sont commitées, et la CI vérifie qu'elles sont à jour.
 */
export default defineConfig({
  sourceLocale: 'fr',
  locales: ['fr', 'en'],
  fallbackLocales: { default: 'fr' },
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: [
        '**/node_modules/**',
        '<rootDir>/src/locales/**',
        '<rootDir>/src/**/*.test.ts',
      ],
    },
  ],
  format: formatter({ lineNumbers: false }),
  orderBy: 'message',
  compileNamespace: 'ts',
})
