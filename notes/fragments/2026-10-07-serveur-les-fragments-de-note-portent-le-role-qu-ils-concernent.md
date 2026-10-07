---
cible: serveur
type: interne
audience: interne
etat: prevu
version: 0.11.0
fr:
  titre: >-
    Les fragments de note portent le rôle qu'ils concernent
  texte: >-
    Un fragment d'audience `organisateurs` porte un champ `role` : `referent`,
    `admin-activite` ou `admin-organisation`. `yarn versionner noter` reçoit
    l'option `--role`. Le journal compilé passe en `schemaVersion: 4`, et le
    build du serveur embarque les deux journaux.
---

- `outils/versionner.mjs`, `packages/server/Dockerfile` (ADR 0021).
