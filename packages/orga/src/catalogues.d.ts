/**
 * `@lingui/vite-plugin` compile un catalogue `.po` en module à l'import, en
 * développement, au build et dans les tests. Cette déclaration en donne le type à
 * TypeScript (`src/lib/langue.ts`).
 */
declare module '*.po' {
  import type { Messages } from '@lingui/core'
  export const messages: Messages
}
