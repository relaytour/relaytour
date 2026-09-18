import { defineConfig } from 'vitest/config'

// Tests unitaires : aucune connexion à la base ni à Redis.
// Les tests d'intégration ont leur propre configuration (vitest.integration.config.ts).
export default defineConfig({
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
