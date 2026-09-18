---
cible: serveur
type: fonctionnalite
audience: staff
etat: prevu
fr:
  titre: >-
    Une édition se crée aussi en ligne de commande
  texte: >-
    La commande edition:creer crée une édition avec son année, son nom et ses
    dates, sans passer par l'espace organisateur. Une installation neuve peut
    ainsi importer ses tâches types dès le premier démarrage. Une édition déjà
    présente n'est jamais modifiée.
---

- Script `packages/server/scripts/creer-edition.ts`, livré dans l'image sous
  `dist/creer-edition.js`.
- Règles de saisie partagées avec la mutation `creerEdition` dans
  `src/lib/editions.ts` (année entre 2020 et 2100, nom obligatoire, fin après
  début).
