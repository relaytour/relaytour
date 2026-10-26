---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.22.0
fr:
  titre: >-
    Une nouvelle édition reprend les tâches de la précédente ou les tâches types
  texte: >-
    À la création d’une édition, vous choisissez son point de départ : aucune
    tâche, les tâches types des périmètres, ou les tâches d’une édition passée.
    Vous décochez les tâches que vous ne reprenez pas. Chaque échéance garde le
    même écart avec le premier jour, et une tâche reprise repart à faire. Le
    menu « Ajouter des tâches » de l’écran Éditions fait la même chose plus
    tard.
en:
  titre: >-
    A new edition carries over the previous edition’s tasks or the task templates
  texte: >-
    When you create an edition, you choose its starting point: no tasks, the
    areas’ task templates, or the tasks of a past edition. You uncheck the tasks
    you do not carry over. Each due date keeps the same gap from the first day,
    and a carried-over task starts again as to do. The “Add tasks” menu of the
    Editions screen does the same later.
---

ADR 0048. Mutations `appliquerTachesTypes` et `reconduireEdition`, avec leurs
simulations `simulerTachesTypes` et `simulerReconduction`. La création des tâches
depuis les tâches types est partagée avec `orga:importer --edition`
(`packages/server/src/orga/taches-de-la-periode.ts`).
