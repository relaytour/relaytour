import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En local, Vite relaie la connexion et GraphQL vers l'API, comme Caddy en production.
// Le navigateur ne parle qu'à une seule origine : le cookie de session reste de
// première partie et aucune requête n'est cross-origin.
const API = process.env.RELAYTOUR_API ?? 'http://localhost:4400'

export default defineConfig({
  plugins: [react()],
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
