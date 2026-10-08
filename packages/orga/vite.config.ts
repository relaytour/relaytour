import { createHash } from 'node:crypto'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// En local, Vite relaie la connexion et GraphQL vers l'API, comme Caddy en production.
// Le navigateur ne parle qu'à une seule origine : le cookie de session reste de
// première partie et aucune requête n'est cross-origin.
const API = process.env.RELAYTOUR_API ?? 'http://localhost:4400'

/**
 * Construit le service worker (ADR 0023) : `src/sw.ts` devient `/sw.js`, à la
 * racine pour couvrir toute l'application. Le plugin y écrit la liste des scripts
 * et des styles du build, et une version tirée de cette liste et de la page :
 * un build identique garde le même service worker. Aucune dépendance ne s'ajoute.
 */
function serviceWorker(): Plugin {
  return {
    name: 'relaytour-service-worker',
    apply: 'build',
    // Après le plugin de Vite qui écrit index.html dans le build.
    enforce: 'post',
    buildStart() {
      this.emitFile({ type: 'chunk', id: 'src/sw.ts', fileName: 'sw.js' })
    },
    generateBundle(_options, bundle) {
      const sw = bundle['sw.js']
      if (sw === undefined || sw.type !== 'chunk')
        throw new Error('Le service worker est absent du build.')
      if (sw.imports.length > 0 || sw.dynamicImports.length > 0)
        throw new Error(
          'Le service worker doit tenir dans un seul fichier, sans import.'
        )
      const fichiers = Object.keys(bundle)
        .filter(nom => /^assets\/.+\.(?:js|css)$/.test(nom))
        .sort()
        .map(nom => `/${nom}`)
      // La page entre dans la version : un build qui ne change qu'elle doit
      // produire un nouveau service worker, sinon le repli hors connexion
      // garderait l'ancienne page.
      const page = bundle['index.html']
      if (page === undefined || page.type !== 'asset')
        throw new Error('La page index.html est absente du build.')
      const version = createHash('sha256')
        .update(fichiers.join('\n'))
        .update(page.source)
        .digest('hex')
        .slice(0, 12)
      sw.code = sw.code
        .replaceAll('__VERSION_COQUILLE__', JSON.stringify(version))
        .replaceAll('__FICHIERS_COQUILLE__', JSON.stringify(fichiers))
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Une dépendance remontée à la racine du monorepo ne doit jamais charger une
  // seconde copie de React dans cette SPA.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    proxy: {
      '/api/auth': { target: API, xfwd: true },
      '/graphql': { target: API, xfwd: true },
      '/medias': { target: API, xfwd: true },
    },
  },
  build: {
    sourcemap: false,
    // Les bibliothèques changent rarement : des fichiers séparés restent en cache
    // d'un déploiement à l'autre.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          antd: ['antd', '@ant-design/icons'],
          apollo: ['@apollo/client', 'graphql', 'rxjs'],
        },
      },
    },
    // antd pèse à lui seul près d'un mégaoctet minifié. L'outil sert à quelques
    // dizaines de personnes : le seuil par défaut de 500 ko n'a pas de sens ici.
    chunkSizeWarningLimit: 1200,
  },
})
