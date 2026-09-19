# ADR 0001 — Socle technique

- **Statut** : acceptée
- **Date** : 2026-09-15

## Contexte

Relaytour a besoin d'une authentification, d'une file de mails, de tâches planifiées et d'un déploiement reproductible. Le socle doit rester simple à auto-héberger par une association : une seule API, une seule base, un seul worker.

## Décision

- Yarn 4 via corepack, Node 24, TypeScript 5.9, ESLint 9 (configuration plate), Prettier, Vitest.
- Serveur : Express 5, Apollo Server 5, Pothos, **un seul schéma GraphQL sans gateway**, build tsup en ESM, cartes de sources sans `sourcesContent`.
- Environnement validé par Zod à l'import, `APP_ENV=local|prod`.
- Prisma 6 sur MariaDB 11.8, client généré hors Git.
- BullMQ sur Redis dans un worker séparé ; gabarits MJML précompilés et commités ; Mailpit sur le poste local.
- Journal pino avec un champ `evenement`, adresses tronquées.
- Image Docker multi-étapes (`runtime`, `migrator`), Compose derrière Caddy.
- `outils/versionner.mjs` : un fragment de note de version par changement visible, compilé en un journal JSON par cible.

## Conséquences

- Aucune query ne lit une liste de personnes avant l'authentification.
- Les conventions du socle se modifient par une nouvelle ADR, jamais au fil de l'eau.
