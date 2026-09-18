import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    worker: 'src/worker.ts',
    // Compilé pour exister dans l'image, qui n'embarque ni tsx ni scripts/.
    'creer-admin': 'scripts/creer-admin.ts',
    'orga-importer': 'scripts/orga-importer.ts',
    'planification-lancer': 'scripts/planification-lancer.ts',
  },
  format: ['esm'],
  // Les dépendances CJS embarquées appellent require() : on le fournit en ESM.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  target: 'node24',
  platform: 'node',
  sourcemap: true,
  // Les traces gardent fichier et ligne, mais l'image ne transporte pas le code source.
  esbuildOptions(options) {
    options.sourcesContent = false
  },
  clean: true,
  // La source du workspace database est embarquée ; @prisma/client reste externe.
  // Les builds ESM de @pothos/* contiennent des imports sans extension que Node refuse.
  noExternal: ['@relaytour/database', /^@pothos\//],
  external: [/\.node$/],
})
