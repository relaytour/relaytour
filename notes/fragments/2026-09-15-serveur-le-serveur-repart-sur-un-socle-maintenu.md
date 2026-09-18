---
cible: serveur
type: interne
audience: interne
etat: prevu
fr:
  titre: >-
    Le serveur repose sur un socle maintenu
  texte: >-
    L'API tourne sur Node 24 avec un seul schéma GraphQL, une file de mails
    et une sonde de santé. Aucune liste de personnes n'est lisible sans
    authentification. Cette base porte l'espace organisateur.
---

Socle technique (ADR 0001).

- Yarn 4, Node 24, ESLint 9, Vitest.
- Prisma 6 sur MariaDB 11.8, client généré hors Git.
- BullMQ et Redis, gabarits MJML précompilés, Mailpit en local et en recette.
