import { createRequire } from 'node:module'

import { defineConfig } from 'vitest/config'

// Une seule copie de graphql : Vite préférerait sa version ESM, que Pothos et Apollo
// ne chargent pas. Le schéma et l'API REST (ADR 0064) partagent ainsi leurs classes.
const graphql = createRequire(import.meta.url).resolve('graphql')

// Tests d'intégration : une vraie MariaDB est requise (DATABASE_URL).
// La CI monte un service dédié ; le poste local utilise sa base de développement.
try {
  process.loadEnvFile('.env')
} catch {
  // Pas de .env : la CI passe ses variables directement.
}
// Clé de chiffrement de l'espace de fichiers (ADR 0038) pour les tests seulement :
// elle chiffre des jetons fictifs, dans une base de test.
process.env.CLE_CHIFFREMENT_ESPACE_FICHIERS ||= Buffer.alloc(32, 7).toString(
  'base64'
)
// Nextcloud ouvert à tout hôte public : les tests simulent ses réponses.
process.env.NEXTCLOUD_HOTES ||= '*'

export default defineConfig({
  resolve: { alias: [{ find: /^graphql$/, replacement: graphql }] },
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
