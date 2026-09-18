import { defineConfig } from 'vitest/config'

// Tests d'intégration : une vraie MariaDB est requise (DATABASE_URL).
// La CI monte un service dédié ; le poste local utilise sa base de développement.
try {
  process.loadEnvFile('.env')
} catch {
  // Pas de .env : la CI passe ses variables directement.
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
