---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les admins fixent l'effectif de chaque périmètre
  texte: >-
    Chaque périmètre peut indiquer dans le dépôt le nombre de référentes et de
    référents souhaité. L'import d'une édition crée cette valeur si elle manque
    et ne la remplace jamais. Les admins la modifient ensuite dans l'espace
    organisateur.
en:
  titre: >-
    Admins set the target headcount of each area
  texte: >-
    Each area can state in the repository the number of coordinators wanted. An
    edition import creates this value if it is missing and never replaces it.
    Admins then change it in the organizer workspace.
---

- Table `EffectifPerimetre` (migration additive `effectifs_perimetres`), en
  cascade sur le périmètre et l'édition.
- Champ facultatif `effectif` dans `content/orga/perimetres.yaml`, lu par
  `lireModeles` et créé par `importerModeles` s'il manque pour l'édition.
- Requêtes admin `postesAPourvoir` et `appelPostes`, mutation admin
  `definirEffectif` (journal `effectif-defini`). Logique pure dans
  `src/lib/postes.ts`.
