---
cible: serveur
type: securite
audience: interne
etat: prevu
fr:
  titre: >-
    L'API passe sur Apollo Server 5 et Express 5
  texte: >-
    L'API tourne sur Apollo Server 5 et Express 5, deux versions maintenues.
    Apollo Server 4 n'est plus maintenu depuis janvier 2026. Ce passage
    retire de l'image de production les bibliothèques form-data,
    path-to-regexp et qs, signalées par l'audit, et corrige sha.js.
    Les routes, le contrôle CSRF et l'arrêt propre fonctionnent comme avant.
---

- `@apollo/server` 4.13 vers 5.5.1, `express` 4.21 vers 5.2.1, `@types/express` 5.0.6.
- Apollo 5 ne fournit plus `@apollo/server/express4` : `expressMiddleware` vient de `@as-integrations/express5` 1.1.2.
- Express 5 : la route `app.all('/api/auth/*')` devient `app.all('/api/auth/*splat')`. Les autres routes (`/health`, `/ready`, `/graphql`) ne changent pas.
- `sha.js` passe à 2.4.12 dans le lockfile (GHSA-95m3-7q98-8xr5) ; `@apollo/utils.createhash` 3.0.1 l'exige encore.
- Restent dans l'audit de production : `tar`, `minimatch`, `brace-expansion`, `glob` (via `node-gyp`, tiré par `fsevents`), `cron-parser` et `deepmerge-ts` (via `bullmq`), `@protobufjs/utf8` (via `@apollo/protobufjs`), `ip-address` (via `socks`), `picomatch` (via `tinyglobby`).
