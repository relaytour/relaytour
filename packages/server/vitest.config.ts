import { createRequire } from 'node:module'

import { defineConfig } from 'vitest/config'

// Une seule copie de graphql : Vite préférerait sa version ESM, que Pothos et Apollo
// ne chargent pas. Le schéma et l'API REST (ADR 0064) partagent ainsi leurs classes.
const graphql = createRequire(import.meta.url).resolve('graphql')

// Tests unitaires : aucune connexion à la base ni à Redis.
// Les tests d'intégration ont leur propre configuration (vitest.integration.config.ts).
export default defineConfig({
  resolve: { alias: [{ find: /^graphql$/, replacement: graphql }] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
    // env.ts valide l'environnement à l'import : une URL factice suffit, rien ne se connecte.
    env: {
      DATABASE_URL: 'mysql://test:test@127.0.0.1:1/test',
      BETTER_AUTH_SECRET: 'secret-de-test-local-0123456789abcdef',
    },
  },
})
