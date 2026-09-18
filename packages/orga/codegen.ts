import type { CodegenConfig } from '@graphql-codegen/cli'

// Types des requêtes de l'interface, générés depuis le contrat commité du serveur.
// Régénérer : yarn workspace @relaytour/orga codegen (ou yarn codegen à la racine).
const config: CodegenConfig = {
  schema: '../server/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**'],
  ignoreNoDocuments: true,
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        scalars: { Date: 'string', DateTime: 'string' },
      },
    },
  },
}

export default config
