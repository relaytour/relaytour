---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    Le serveur marque les jalons et lie leurs tâches
  texte: >-
    Les mutations `marquerJalon`, `lierTaches` et `delierTache` portent les jalons
    de l'ADR 0062. Le type `Tache` gagne `jalon`, `resumeJalon`, `tachesLiees`,
    `jalons` et `historiqueJalon`. `creerTache` reçoit l'argument `jalon`, et les
    déclinaisons reçoivent `jalons`. Une migration additive ajoute deux colonnes
    nulles à `Tache`, une colonne nulle à `Journal`, quatre étapes de journal et la
    table `LienJalon`.
---

`schema/jalons.ts` porte les champs et les mutations ; `lib/jalons.ts` calcule le
décompte et prévient les périmètres des jalons quand une tâche liée change. La
reconduction reprend le marqueur et les liens, et l'export complet les écrit.
