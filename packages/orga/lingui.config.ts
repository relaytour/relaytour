import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

/**
 * Langues de l'espace organisateur (ADR 0047).
 *
 * Le français est la langue source : le texte français sert d'identifiant de
 * message. Retoucher une phrase française détache donc sa traduction, qui
 * redevient « à traduire » dans les autres catalogues au lieu de diverger en
 * silence. Une langue s'ajoute ici, puis `yarn workspace @relaytour/orga
 * langues:extraire` crée son catalogue (voir TRADUIRE.md).
 */
export default defineConfig({
  sourceLocale: 'fr',
  locales: ['fr', 'en'],
  // Un message absent d'un catalogue s'affiche en français.
  fallbackLocales: { default: 'fr' },
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: ['**/node_modules/**', '<rootDir>/src/gql/**'],
    },
  ],
  // Sans numéro de ligne, un déplacement de code ne réécrit pas les catalogues.
  format: formatter({ lineNumbers: false }),
  // Les catalogues se rangent par texte français, dans l'ordre de lecture des
  // traductrices et des traducteurs.
  orderBy: 'message',
})
